import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ignored = new Set([".git", "dist", "node_modules"]);
const patterns = [
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u, "private key"],
  [/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/u, "payment credential"],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/u, "JWT-like token"],
  [/socialmedium\.trafft\.com/u, "private booking host"],
  [/mailer(?:lite)?[_ -]?(?:group|automation|subscriber)[_ -]?id/u, "private MailerLite identifier"],
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

const findings = [];
for (const path of await walk(".")) {
  const text = await readFile(path, "utf8");
  for (const [pattern, label] of patterns) if (pattern.test(text)) findings.push(`${path}: ${label}`);
}

if (findings.length) {
  console.error(`Potential sensitive material detected:\n${findings.join("\n")}`);
  process.exitCode = 1;
}
