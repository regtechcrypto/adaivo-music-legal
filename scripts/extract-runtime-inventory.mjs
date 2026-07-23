import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
}

const lockfilePath = arg("--lockfile");
if (!lockfilePath) throw new Error("missing --lockfile");
const lock = JSON.parse(await readFile(resolve(lockfilePath), "utf8"));
assert.equal(lock.lockfileVersion, 3, "runtime inventory requires package-lock v3");
const packages = lock.packages;

function resolveDependency(from, name) {
  let base = from;
  while (true) {
    const candidate = `${base ? `${base}/` : ""}node_modules/${name}`;
    if (packages[candidate]) return candidate;
    if (!base) return null;
    const cut = base.lastIndexOf("/node_modules/");
    base = cut < 0 ? "" : base.slice(0, cut);
  }
}

const queue = Object.keys(packages[""].dependencies ?? {}).sort().map((name) => {
  const path = resolveDependency("", name);
  assert(path, `unresolved root runtime dependency: ${name}`);
  return path;
});
const seen = new Set();
while (queue.length) {
  const path = queue.shift();
  if (seen.has(path)) continue;
  seen.add(path);
  const metadata = packages[path];
  const dependencies = {
    ...(metadata.dependencies ?? {}),
    ...(metadata.optionalDependencies ?? {}),
    ...(metadata.peerDependencies ?? {})
  };
  for (const name of Object.keys(dependencies).sort()) {
    const resolved = resolveDependency(path, name);
    if (!resolved && metadata.peerDependenciesMeta?.[name]?.optional) continue;
    assert(resolved, `unresolved runtime dependency: ${path} -> ${name}`);
    queue.push(resolved);
  }
}

const entries = [...seen].sort().map((path) => {
  const metadata = packages[path];
  assert.notEqual(metadata.dev, true, `development-only package reached runtime closure: ${path}`);
  assert(metadata.version, `missing version: ${path}`);
  assert(metadata.resolved?.startsWith("https://registry.npmjs.org/"), `missing approved resolved source: ${path}`);
  assert(metadata.license, `missing license: ${path}`);
  assert(!/^SEE LICENSE IN/i.test(metadata.license), `SEE LICENSE IN requires manual handling: ${path}`);
  assert(!/\bUNKNOWN\b/i.test(metadata.license), `UNKNOWN license: ${path}`);
  const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
  return {
    path,
    name,
    version: metadata.version,
    resolved: metadata.resolved,
    repository: null,
    copyright: null,
    license: metadata.license,
    patched: ["react-native-blob-util", "react-native-track-player"].includes(name)
  };
});

const inventory = {
  sourceCommit: "c810e47c83771fafea1366a6a58d4762c553b751",
  lockfileVersion: 3,
  closureRule: "root dependencies plus dependencies, optionalDependencies, and peerDependencies using package-lock node_modules resolution",
  count: entries.length,
  entries
};
const serialized = `${JSON.stringify(inventory, null, 2)}\n`;
const output = arg("--output");
const check = arg("--check");
if (output) await writeFile(resolve(output), serialized);
else if (check) assert.equal(await readFile(resolve(check), "utf8"), serialized, "sanitized runtime inventory differs from exact lockfile");
else process.stdout.write(serialized);
