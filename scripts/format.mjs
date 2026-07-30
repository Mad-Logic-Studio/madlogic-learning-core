import { readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const write = process.argv.includes("--write");
const allowed = new Set([".json", ".md", ".mjs", ".ts", ".yml", ".yaml"]);
const ignored = new Set([".git", "dist", "node_modules"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (allowed.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const failures = [];
for (const path of await walk(".")) {
  const current = await readFile(path, "utf8");
  const formatted = `${current.replace(/\r\n/g, "\n").split("\n").map((line) => line.replace(/[ \t]+$/u, "")).join("\n").replace(/\n*$/u, "")}\n`;
  if (current !== formatted) {
    if (write) await writeFile(path, formatted);
    else failures.push(path);
  }
}

if (failures.length) {
  console.error(`Formatting violations:\n${failures.join("\n")}`);
  process.exitCode = 1;
}
