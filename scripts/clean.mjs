import { rm } from "node:fs/promises";

const paths = [
  "packages/core/dist",
  "packages/postgres/dist",
  "packages/cloudflare/dist",
  "examples/astro-cloudflare-supabase/dist",
];

await Promise.all(paths.map((path) => rm(path, { force: true, recursive: true })));
