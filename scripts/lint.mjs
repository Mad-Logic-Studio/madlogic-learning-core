import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ignored = new Set(["dist", "node_modules"]);
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}

const failures = [];
for (const path of await walk(".")) {
  const text = await readFile(path, "utf8");
  if (/\bany\b/u.test(text)) failures.push(`${path}: explicit any is prohibited`);
  if (/console\./u.test(text)) failures.push(`${path}: console calls are prohibited in packages`);
  if (path.startsWith("packages/core/") && /from ["'](?:@cloudflare|postgres|pg|@supabase|astro|react|better-auth)/u.test(text)) {
    failures.push(`${path}: core imports a provider-specific package`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
