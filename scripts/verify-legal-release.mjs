import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(new URL("..", import.meta.url).pathname);
const publicOrigin = "https://regtechcrypto.github.io";
const publicBasePath = "/adaivo-music-legal/";
const locales = ["en", "zh-Hans"];
const documents = ["licenses", "privacy", "terms"];
const required = {
  terms: ["Operator", "Acceptance", "Accounts", "Limited", "Subscriptions", "Catalog", "Intellectual", "Service changes", "Disclaimers", "liability", "Indemnity", "Governing", "Changes", "Severability", "Contact"],
  privacy: ["Operator", "Information", "Purposes", "Providers", "Cross-border", "Retention", "Security", "Access", "Children", "Changes", "Contact"],
  licenses: ["Scope", "Runtime", "Native", "license"]
};
const runtimeInventoryFile = JSON.parse(await readFile(resolve(root, "inventory/runtime-lock-inventory.json"), "utf8"));
assert.equal(runtimeInventoryFile.sourceCommit, "c810e47c83771fafea1366a6a58d4762c553b751");
assert.equal(runtimeInventoryFile.count, 660);
assert.equal(runtimeInventoryFile.entries.length, 660);
const runtimeInventory = runtimeInventoryFile.entries;

function metadataArgs() {
  const value = (name, fallback) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : fallback;
  };
  return { release: value("--release", "2026-07-23.1"), effectiveDate: value("--effective-date", "2026-07-23") };
}

export function validateManifestMarkdownUrl(value, release, locale, document) {
  const markdownUrl = new URL(value);
  const expected = `${publicOrigin}${publicBasePath}releases/${release}/${locale}/${document}.md`;
  assert.equal(markdownUrl.protocol, "https:", `${locale}/${document}: manifest Markdown must use HTTPS`);
  assert.equal(markdownUrl.origin, publicOrigin, `${locale}/${document}: manifest Markdown origin mismatch`);
  assert.equal(markdownUrl.pathname, `${publicBasePath}releases/${release}/${locale}/${document}.md`, `${locale}/${document}: manifest Markdown path mismatch`);
  assert.equal(markdownUrl.search, "", `${locale}/${document}: manifest Markdown query forbidden`);
  assert.equal(markdownUrl.hash, "", `${locale}/${document}: manifest Markdown fragment forbidden`);
  assert.equal(markdownUrl.username, "", `${locale}/${document}: manifest Markdown credentials forbidden`);
  assert.equal(markdownUrl.password, "", `${locale}/${document}: manifest Markdown credentials forbidden`);
  assert.equal(markdownUrl.href, expected, `${locale}/${document}: manifest Markdown URL must be exact`);
  return markdownUrl;
}

export function validateManifestRoot(manifest) {
  assert.deepEqual(Object.keys(manifest).sort(), ["documents", "effectiveDate", "generatedFrom", "release", "schemaVersion"], "manifest root fields mismatch");
  assert.equal(manifest.schemaVersion, 1, "manifest schemaVersion must equal 1");
  assert(Number.isInteger(manifest.schemaVersion), "manifest schemaVersion must be an integer");
}

export function validateSource(text, locale, document, release, effectiveDate) {
  assert(text.includes(release), `${locale}/${document}: release mismatch`);
  assert(text.includes(effectiveDate), `${locale}/${document}: effective-date mismatch`);
  assert(!/<\/?[A-Za-z][^>]*>|<script|!\[[^\]]*\]\(/i.test(text), `${locale}/${document}: raw HTML/script/image`);
  assert(!text.includes("`"), `${locale}/${document}: inline code/backticks are unsupported`);
  assert(!/\bUNKNOWN\b/.test(text), `${locale}/${document}: UNKNOWN license entry`);
  if (locale === "en") for (const section of required[document]) assert(text.toLowerCase().includes(section.toLowerCase()), `${locale}/${document}: missing ${section}`);
  if (locale === "zh-Hans") assert(text.includes("英文版本为准"), `${locale}/${document}: missing English-controls clause`);
  for (const match of text.matchAll(/https?:\/\/[^\s)`]+/g)) {
    const url = new URL(match[0]);
    assert.equal(url.protocol, "https:", `${locale}/${document}: non-HTTPS URL`);
    assert(["registry.npmjs.org", "spdx.org", "www.apache.org", "opensource.org", "www.openssl.org"].includes(url.hostname), `${locale}/${document}: URL host not allowlisted`);
  }
  if (document === "licenses") assert(!/Adaivo.{0,50}(is open source|licensed under (the )?(MIT|Apache))/i.test(text), `${locale}/${document}: Adaivo content marked OSS`);
  if (document === "licenses") for (const entry of runtimeInventory) {
    const row = text.split("\n").find((line) => line.includes(locale === "en" ? `lock path: ${entry.path};` : `锁路径：${entry.path}；`));
    assert(row, `${locale}/${document}: missing runtime package path ${entry.path}`);
    assert(row.includes(locale === "en" ? `package: ${entry.name};` : `软件包：${entry.name}；`), `${locale}/${document}: missing runtime package ${entry.name}`);
    assert(row.includes(locale === "en" ? `version: ${entry.version};` : `版本：${entry.version}；`), `${locale}/${document}: missing runtime version ${entry.path}`);
    assert(row.includes(entry.resolved), `${locale}/${document}: missing resolved runtime source ${entry.path}`);
    assert(row.includes(locale === "en" ? "repository: Not recorded" : "仓库：未记录"), `${locale}/${document}: missing explicit repository field ${entry.path}`);
    assert(row.includes(locale === "en" ? "copyright: Not recorded" : "版权：未记录"), `${locale}/${document}: missing explicit copyright field ${entry.path}`);
    assert(row.includes(locale === "en" ? `license: ${entry.license}` : `许可：${entry.license}`), `${locale}/${document}: missing runtime license ${entry.path}`);
    if (entry.patched) assert(row.includes(locale === "en" ? "patched locally" : "应用本地补丁"), `${locale}/${document}: missing patched-package disclosure ${entry.path}`);
  }
  if (document === "licenses") {
    const rowPattern = locale === "en" ? /^- package: .*source: https:\/\/registry\.npmjs\.org\//gm : /^- 软件包：.*源链接：https:\/\/registry\.npmjs\.org\//gm;
    assert.equal([...text.matchAll(rowPattern)].length, runtimeInventory.length, `${locale}/${document}: runtime inventory count mismatch`);
  }
}

async function listFiles(base, relative = "") {
  const output = [];
  for (const entry of await readdir(resolve(base, relative), { withFileTypes: true })) {
    const next = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...await listFiles(base, next));
    else output.push(next);
  }
  return output.sort();
}

async function verifyDeterministicBuild(release, effectiveDate) {
  const isolated = await mkdtemp(resolve(tmpdir(), "adaivo-legal-"));
  try {
    const noticeBuild = spawnSync(process.execPath, ["scripts/build-runtime-notices.mjs", "--output-dir", isolated], { cwd: root, encoding: "utf8" });
    assert.equal(noticeBuild.status, 0, noticeBuild.stderr);
    for (const path of ["content/en/licenses.md", "content/zh-Hans/licenses.md"]) {
      assert((await readFile(resolve(isolated, path))).equals(await readFile(resolve(root, path))), `generated runtime notice differs: ${path}`);
    }
    const build = spawnSync(process.execPath, ["scripts/build-manifest.mjs", "--release", release, "--effective-date", effectiveDate, "--output-dir", isolated], { cwd: root, encoding: "utf8" });
    assert.equal(build.status, 0, build.stderr);
    const expectedPaths = ["manifest.json", ...await listFiles(isolated, "site")];
    const actualPaths = ["manifest.json", ...await listFiles(root, "site")];
    assert.deepEqual(actualPaths, expectedPaths, "generated file set differs from isolated rebuild");
    for (const path of expectedPaths) {
      const expected = await readFile(resolve(isolated, path));
      const actual = await readFile(resolve(root, path));
      assert(expected.equals(actual), `generated file differs from isolated rebuild: ${path}`);
    }
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
}

async function verify() {
  const { release, effectiveDate } = metadataArgs();
  const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
  validateManifestRoot(manifest);
  assert.equal(await readFile(resolve(root, "site/manifest.json"), "utf8"), `${JSON.stringify(manifest, null, 2)}\n`);
  assert.equal(manifest.release, release);
  assert.equal(manifest.effectiveDate, effectiveDate);
  assert.equal(manifest.documents.length, 6);
  const css = await readFile(resolve(root, "site/assets/legal.css"), "utf8");
  const cssFingerprint = createHash("sha256").update(css).digest("hex").slice(0, 16);
  for (const locale of locales) for (const document of documents) {
    const entry = manifest.documents.find((item) => item.locale === locale && item.document === document);
    assert(entry, `missing ${locale}/${document}`);
    const markdownUrl = validateManifestMarkdownUrl(entry.markdown, release, locale, document);
    const source = await readFile(resolve(root, entry.source), "utf8");
    validateSource(source, locale, document, release, effectiveDate);
    const canonicalPath = markdownUrl.pathname.slice(`${publicBasePath}`.length);
    const canonical = await readFile(resolve(root, "site", canonicalPath));
    assert.equal(canonical.length, entry.bytes, `${locale}/${document}: byte mismatch`);
    assert.equal(createHash("sha256").update(canonical).digest("hex"), entry.sha256, `${locale}/${document}: hash mismatch`);
    assert.equal(canonical.toString("utf8"), source.replace(/\r\n?/g, "\n").normalize("NFC").replace(/\n?$/, "\n"));
    const page = await readFile(resolve(root, "site", entry.page, "index.html"), "utf8");
    assert(page.includes(`href="../../assets/legal.css?v=${cssFingerprint}"`), `${locale}/${document}: stylesheet fingerprint mismatch`);
    assert(page.includes(`../../releases/${release}/${locale}/${document}.md`), `${locale}/${document}: broken canonical link`);
    assert(!/<script|<img|https?:\/\/[^"]+\.(js|css)/i.test(page), `${locale}/${document}: forbidden page asset`);
    if (locale === "zh-Hans" && document === "licenses") for (const entry of runtimeInventory) {
      assert(page.includes(`href="${entry.resolved}"`), `zh-Hans/licenses: malformed generated href for ${entry.path}`);
    }
  }
  const index = await readFile(resolve(root, "site/index.html"), "utf8");
  for (const entry of manifest.documents) assert(index.includes(`href="${entry.page}"`), `broken index link ${entry.page}`);
  assert(index.includes(`href="assets/legal.css?v=${cssFingerprint}"`), "index stylesheet fingerprint mismatch");
  assert(css.includes("main a{overflow-wrap:anywhere;word-break:break-word}"), "main-content links must wrap at narrow viewports");
  await verifyDeterministicBuild(release, effectiveDate);
}

if (process.argv.includes("--self-test")) {
  const validRoot = { schemaVersion: 1, release: "x", effectiveDate: "x", generatedFrom: "x", documents: [] };
  validateManifestRoot(validRoot);
  assert.throws(() => validateManifestRoot({ ...validRoot, schemaVersion: 2 }), /schemaVersion/);
  assert.throws(() => validateManifestRoot({ ...validRoot, schemaVersion: 1.5 }), /schemaVersion/);
  const { schemaVersion: omittedSchemaVersion, ...missingSchema } = validRoot;
  assert.throws(() => validateManifestRoot(missingSchema), /root fields/);
  assert.throws(() => validateManifestRoot({ ...validRoot, extra: true }), /root fields/);
  const validManifestUrl = "https://regtechcrypto.github.io/adaivo-music-legal/releases/2026-07-23.1/en/terms.md";
  assert.equal(validateManifestMarkdownUrl(validManifestUrl, "2026-07-23.1", "en", "terms").href, validManifestUrl);
  assert.throws(() => validateManifestMarkdownUrl(validManifestUrl.replace("https:", "http:"), "2026-07-23.1", "en", "terms"), /HTTPS/);
  assert.throws(() => validateManifestMarkdownUrl(validManifestUrl.replace("regtechcrypto.github.io", "example.com"), "2026-07-23.1", "en", "terms"), /origin/);
  assert.throws(() => validateManifestMarkdownUrl(validManifestUrl.replace("/terms.md", "/privacy.md"), "2026-07-23.1", "en", "terms"), /path/);
  assert.throws(() => validateManifestMarkdownUrl(`${validManifestUrl}?download=1`, "2026-07-23.1", "en", "terms"), /query/);
  assert.throws(() => validateManifestMarkdownUrl(`${validManifestUrl}#fragment`, "2026-07-23.1", "en", "terms"), /fragment/);
  assert.throws(() => validateManifestMarkdownUrl(validManifestUrl.replace("https://", "https://user@"), "2026-07-23.1", "en", "terms"), /credentials/);
  assert.throws(() => validateSource("# Scope\n2026-07-23.1 2026-07-23 Runtime Native license UNKNOWN", "en", "licenses", "2026-07-23.1", "2026-07-23"), /UNKNOWN/);
  assert.throws(() => validateSource("# Privacy\n2026-07-23.1 2026-07-23 <script>", "en", "privacy", "2026-07-23.1", "2026-07-23"), /raw HTML/);
  const build = spawnSync(process.execPath, ["scripts/build-manifest.mjs", "--release", "2026-07-23.1", "--effective-date", "2026-07-23"], { cwd: root, encoding: "utf8" });
  assert.equal(build.status, 0, build.stderr);
  const generatedIndex = resolve(root, "site/index.html");
  const originalIndex = await readFile(generatedIndex, "utf8");
  try {
    await writeFile(generatedIndex, `${originalIndex}mutated`);
    const mutated = spawnSync(process.execPath, ["scripts/verify-legal-release.mjs", "--release", "2026-07-23.1", "--effective-date", "2026-07-23"], { cwd: root, encoding: "utf8" });
    assert.notEqual(mutated.status, 0, "verifier must reject mutated generated output");
  } finally {
    await writeFile(generatedIndex, originalIndex);
  }
  const licensesSource = resolve(root, "content/en/licenses.md");
  const originalLicenses = await readFile(licensesSource, "utf8");
  try {
    await writeFile(licensesSource, `${originalLicenses}\nhttps://www.apache.org/licenses/LICENSE-2.0?x=1&y=2\" onmouseover=\"alert\n`);
    const hostileBuild = spawnSync(process.execPath, ["scripts/build-manifest.mjs", "--release", "2026-07-23.1", "--effective-date", "2026-07-23"], { cwd: root, encoding: "utf8" });
    assert.equal(hostileBuild.status, 0, hostileBuild.stderr);
    const hostilePage = await readFile(resolve(root, "site/en/licenses/index.html"), "utf8");
    assert(hostilePage.includes('href="https://www.apache.org/licenses/LICENSE-2.0?x=1&amp;y=2"'), "href attribute must escape hostile link data");
    assert(!hostilePage.includes('href=\"https://www.apache.org/licenses/LICENSE-2.0?x=1&y=2\" onmouseover='), "hostile quote must not create an attribute");
  } finally {
    await writeFile(licensesSource, originalLicenses);
    const restore = spawnSync(process.execPath, ["scripts/build-manifest.mjs", "--release", "2026-07-23.1", "--effective-date", "2026-07-23"], { cwd: root, encoding: "utf8" });
    assert.equal(restore.status, 0, restore.stderr);
  }
}
await verify();
console.log("legal release verification passed");
