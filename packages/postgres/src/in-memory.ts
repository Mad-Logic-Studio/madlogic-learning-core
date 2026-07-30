import type { AccessLink, AccessLinkId, Enrollment, EnrollmentId, IsoDateTime } from "@madlogic-learning/core";
import {
  type AccessLinkRepository,
  type EnrollmentRepository,
  type IdempotencyRecord,
  type IdempotencyRepository,
  type OutboxRecord,
  type OutboxRepository,
  PersistenceConflictError,
  type PostgresUnitOfWork,
  type TransactionContext,
  type VersionedSaveOptions,
} from "./contracts.js";

interface InMemoryState {
  readonly enrollments: Map<EnrollmentId, Enrollment>;
  readonly accessLinks: Map<AccessLinkId, AccessLink>;
  readonly idempotency: Map<string, IdempotencyRecord>;
  readonly outbox: Map<string, OutboxRecord>;
}

class InMemoryTransactionContext implements TransactionContext {
  constructor(
    readonly transactionId: string,
    readonly state: InMemoryState,
  ) {}
}

function cloneEnrollment(value: Enrollment): Enrollment {
  return { ...value, statusHistory: value.statusHistory.map((record) => ({ ...record })) };
}

function cloneAccessLink(value: AccessLink): AccessLink {
  return { ...value };
}

function cloneIdempotency(value: IdempotencyRecord): IdempotencyRecord {
  return { ...value };
}

function cloneOutbox(value: OutboxRecord): OutboxRecord {
  return { ...value, event: { ...value.event, payload: { ...value.event.payload } } };
}

function cloneState(source: InMemoryState): InMemoryState {
  return {
    enrollments: new Map([...source.enrollments].map(([key, value]) => [key, cloneEnrollment(value)])),
    accessLinks: new Map([...source.accessLinks].map(([key, value]) => [key, cloneAccessLink(value)])),
    idempotency: new Map([...source.idempotency].map(([key, value]) => [key, cloneIdempotency(value)])),
    outbox: new Map([...source.outbox].map(([key, value]) => [key, cloneOutbox(value)])),
  };
}

function replaceState(target: InMemoryState, source: InMemoryState): void {
  target.enrollments.clear();
  target.accessLinks.clear();
  target.idempotency.clear();
  target.outbox.clear();
  for (const [key, value] of source.enrollments) target.enrollments.set(key, cloneEnrollment(value));
  for (const [key, value] of source.accessLinks) target.accessLinks.set(key, cloneAccessLink(value));
  for (const [key, value] of source.idempotency) target.idempotency.set(key, cloneIdempotency(value));
  for (const [key, value] of source.outbox) target.outbox.set(key, cloneOutbox(value));
}

function stateFor(root: InMemoryState, context?: TransactionContext): InMemoryState {
  if (context === undefined) return root;
  if (!(context instanceof InMemoryTransactionContext)) throw new Error("Unsupported transaction context.");
  return context.state;
}

function assertVersion(
  currentVersion: number | undefined,
  nextVersion: number,
  options: VersionedSaveOptions,
  aggregate: string,
): void {
  if (options.expectedVersion === null) {
    if (currentVersion !== undefined) {
      throw new PersistenceConflictError(`${aggregate} already exists.`, "duplicate_record");
    }
    if (nextVersion !== 1) {
      throw new PersistenceConflictError(`${aggregate} initial version must be 1.`, "concurrency_conflict");
    }
    return;
  }
  if (currentVersion !== options.expectedVersion) {
    throw new PersistenceConflictError(
      `${aggregate} expected version ${options.expectedVersion}, found ${currentVersion ?? "missing"}.`,
      "concurrency_conflict",
    );
  }
  if (nextVersion !== options.expectedVersion + 1) {
    throw new PersistenceConflictError(`${aggregate} next version must increment by one.`, "concurrency_conflict");
  }
}

class InMemoryEnrollmentRepository implements EnrollmentRepository {
  constructor(private readonly root: InMemoryState) {}

  async findById(id: EnrollmentId, context?: TransactionContext): Promise<Enrollment | null> {
    const value = stateFor(this.root, context).enrollments.get(id);
    return value === undefined ? null : cloneEnrollment(value);
  }

  async save(enrollment: Enrollment, options: VersionedSaveOptions, context?: TransactionContext): Promise<void> {
    const state = stateFor(this.root, context);
    const current = state.enrollments.get(enrollment.id);
    assertVersion(current?.version, enrollment.version, options, "Enrollment");
    state.enrollments.set(enrollment.id, cloneEnrollment(enrollment));
  }
}

class InMemoryAccessLinkRepository implements AccessLinkRepository {
  constructor(private readonly root: InMemoryState) {}

  async findById(id: AccessLinkId, context?: TransactionContext): Promise<AccessLink | null> {
    const value = stateFor(this.root, context).accessLinks.get(id);
    return value === undefined ? null : cloneAccessLink(value);
  }

  async save(accessLink: AccessLink, options: VersionedSaveOptions, context?: TransactionContext): Promise<void> {
    const state = stateFor(this.root, context);
    const current = state.accessLinks.get(accessLink.id);
    assertVersion(current?.version, accessLink.version, options, "AccessLink");
    state.accessLinks.set(accessLink.id, cloneAccessLink(accessLink));
  }
}

class InMemoryIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly root: InMemoryState) {}

  async claim(record: IdempotencyRecord, context?: TransactionContext): Promise<IdempotencyRecord> {
    const state = stateFor(this.root, context);
    const existing = state.idempotency.get(record.key);
    if (existing !== undefined) {
      if (existing.operation !== record.operation || existing.requestHash !== record.requestHash) {
        throw new PersistenceConflictError("Idempotency key was reused with a different request.", "idempotency_conflict");
      }
      return cloneIdempotency(existing);
    }
    state.idempotency.set(record.key, cloneIdempotency(record));
    return cloneIdempotency(record);
  }

  async complete(
    key: string,
    completedAt: IsoDateTime,
    responseReference: string,
    context?: TransactionContext,
  ): Promise<IdempotencyRecord> {
    const state = stateFor(this.root, context);
    const existing = state.idempotency.get(key);
    if (existing === undefined) throw new Error("Idempotency record does not exist.");
    const completed: IdempotencyRecord = {
      ...existing,
      status: "completed",
      completedAt,
      responseReference,
    };
    state.idempotency.set(key, completed);
    return cloneIdempotency(completed);
  }

  async findByKey(key: string, context?: TransactionContext): Promise<IdempotencyRecord | null> {
    const value = stateFor(this.root, context).idempotency.get(key);
    return value === undefined ? null : cloneIdempotency(value);
  }
}

class InMemoryOutboxRepository implements OutboxRepository {
  constructor(private readonly root: InMemoryState) {}

  async append(record: OutboxRecord, context?: TransactionContext): Promise<void> {
    const state = stateFor(this.root, context);
    if (state.outbox.has(record.id)) {
      throw new PersistenceConflictError("Outbox record already exists.", "duplicate_record");
    }
    state.outbox.set(record.id, cloneOutbox(record));
  }

  async listPending(context?: TransactionContext): Promise<readonly OutboxRecord[]> {
    return [...stateFor(this.root, context).outbox.values()]
      .filter((record) => record.publishedAt === undefined)
      .map(cloneOutbox);
  }
}

class InMemoryPostgresUnitOfWork implements PostgresUnitOfWork {
  private transactionSequence = 0;

  constructor(private readonly root: InMemoryState) {}

  async transaction<TResult>(operation: (context: TransactionContext) => Promise<TResult>): Promise<TResult> {
    this.transactionSequence += 1;
    const draft = cloneState(this.root);
    const context = new InMemoryTransactionContext(`in-memory-${this.transactionSequence}`, draft);
    const result = await operation(context);
    replaceState(this.root, draft);
    return result;
  }
}

export interface InMemoryPersistenceFixture {
  readonly enrollments: EnrollmentRepository;
  readonly accessLinks: AccessLinkRepository;
  readonly idempotency: IdempotencyRepository;
  readonly outbox: OutboxRepository;
  readonly unitOfWork: PostgresUnitOfWork;
}

export function createInMemoryPersistenceFixture(): InMemoryPersistenceFixture {
  const state: InMemoryState = {
    enrollments: new Map(),
    accessLinks: new Map(),
    idempotency: new Map(),
    outbox: new Map(),
  };
  return {
    enrollments: new InMemoryEnrollmentRepository(state),
    accessLinks: new InMemoryAccessLinkRepository(state),
    idempotency: new InMemoryIdempotencyRepository(state),
    outbox: new InMemoryOutboxRepository(state),
    unitOfWork: new InMemoryPostgresUnitOfWork(state),
  };
}
