import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(new URL("..", import.meta.url).pathname);
const locales = ["en", "zh-Hans"];
const documents = ["licenses", "privacy", "terms"];
const required = {
  terms: ["Operator", "Acceptance", "Accounts", "Limited", "Subscriptions", "Catalog", "Intellectual", "Service changes", "Disclaimers", "liability", "Indemnity", "Governing", "Changes", "Severability", "Contact"],
  privacy: ["Operator", "Information", "Purposes", "Providers", "Cross-border", "Retention", "Security", "Access", "Children", "Changes", "Contact"],
  licenses: ["Scope", "Runtime", "Native", "license"]
};
const runtimeInventory = [
  ["@invertase/react-native-apple-authentication", "2.5.1", "Apache-2.0"],
  ["@react-native-camera-roll/camera-roll", "7.10.2", "MIT"],
  ["@react-native-clipboard/clipboard", "1.16.3", "MIT"],
  ["@react-native-community/push-notification-ios", "1.12.0", "MIT"],
  ["@react-native-google-signin/google-signin", "16.1.2", "MIT"],
  ["@react-native/new-app-screen", "0.86.0", "MIT"],
  ["@react-navigation/bottom-tabs", "7.18.8", "MIT"],
  ["@react-navigation/native", "7.3.8", "MIT"],
  ["@react-navigation/native-stack", "7.17.10", "MIT"],
  ["buffer", "6.0.3", "MIT"], ["react", "19.2.3", "MIT"], ["react-native", "0.86.0", "MIT"],
  ["react-native-app-auth", "8.4.1", "MIT"], ["react-native-blob-util", "0.24.10", "MIT"],
  ["react-native-get-random-values", "2.0.0", "MIT"], ["react-native-iap", "15.4.1", "MIT"],
  ["react-native-keychain", "10.0.0", "MIT"], ["react-native-nitro-modules", "0.35.10", "MIT"],
  ["react-native-qrcode-svg", "6.3.21", "MIT"], ["react-native-quick-base64", "3.0.1", "MIT"],
  ["react-native-quick-crypto", "1.1.6", "MIT"], ["react-native-safe-area-context", "5.8.0", "MIT"],
  ["react-native-screens", "4.26.0", "MIT"], ["react-native-share", "12.2.5", "MIT"],
  ["react-native-svg", "15.15.5", "MIT"], ["react-native-track-player", "4.1.2", "Apache-2.0"],
  ["react-native-view-shot", "5.1.1", "MIT"], ["uuid", "14.0.1", "MIT"]
];

function metadataArgs() {
  const value = (name, fallback) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : fallback;
  };
  return { release: value("--release", "2026-07-23.1"), effectiveDate: value("--effective-date", "2026-07-23") };
}

export function validateSource(text, locale, document, release, effectiveDate) {
  assert(text.includes(release), `${locale}/${document}: release mismatch`);
  assert(text.includes(effectiveDate), `${locale}/${document}: effective-date mismatch`);
  assert(!/<\/?[A-Za-z][^>]*>|<script|!\[[^\]]*\]\(/i.test(text), `${locale}/${document}: raw HTML/script/image`);
  assert(!/\bUNKNOWN\b/.test(text), `${locale}/${document}: UNKNOWN license entry`);
  if (locale === "en") for (const section of required[document]) assert(text.toLowerCase().includes(section.toLowerCase()), `${locale}/${document}: missing ${section}`);
  if (locale === "zh-Hans") assert(text.includes("英文版本为准"), `${locale}/${document}: missing English-controls clause`);
  for (const match of text.matchAll(/https?:\/\/[^\s)`]+/g)) {
    const url = new URL(match[0]);
    assert.equal(url.protocol, "https:", `${locale}/${document}: non-HTTPS URL`);
    assert(["registry.npmjs.org", "www.apache.org", "opensource.org", "www.openssl.org"].includes(url.hostname), `${locale}/${document}: URL host not allowlisted`);
  }
  if (document === "licenses") assert(!/Adaivo.{0,50}(is open source|licensed under (the )?(MIT|Apache))/i.test(text), `${locale}/${document}: Adaivo content marked OSS`);
  if (document === "licenses") for (const [name, version, license] of runtimeInventory) {
    const archiveName = name.includes("/") ? name.split("/").at(-1) : name;
    const resolvedSource = `https://registry.npmjs.org/${name}/-/${archiveName}-${version}.tgz`;
    const row = text.split("\n").find((line) => line.startsWith(`- \`${name}\``));
    assert(row, `${locale}/${document}: missing runtime package ${name}`);
    assert(row.includes(`\`${version}\``), `${locale}/${document}: missing runtime version ${name}@${version}`);
    assert(row.includes(resolvedSource), `${locale}/${document}: missing resolved runtime source ${name}`);
    assert(row.includes(locale === "en" ? "repository: Not recorded" : "仓库：未记录"), `${locale}/${document}: missing explicit repository field ${name}`);
    assert(row.includes(locale === "en" ? "copyright: Not recorded" : "版权：未记录"), `${locale}/${document}: missing explicit copyright field ${name}`);
    assert(row.includes(`\`${license}\``), `${locale}/${document}: missing runtime license ${name}`);
  }
  if (document === "licenses") {
    assert.equal([...text.matchAll(/^- `[^`]+` .*https:\/\/registry\.npmjs\.org\//gm)].length, runtimeInventory.length, `${locale}/${document}: runtime inventory count mismatch`);
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
  assert.equal(await readFile(resolve(root, "site/manifest.json"), "utf8"), `${JSON.stringify(manifest, null, 2)}\n`);
  assert.equal(manifest.release, release);
  assert.equal(manifest.effectiveDate, effectiveDate);
  assert.equal(manifest.documents.length, 6);
  for (const locale of locales) for (const document of documents) {
    const entry = manifest.documents.find((item) => item.locale === locale && item.document === document);
    assert(entry, `missing ${locale}/${document}`);
    const source = await readFile(resolve(root, entry.source), "utf8");
    validateSource(source, locale, document, release, effectiveDate);
    const canonical = await readFile(resolve(root, "site", entry.markdown));
    assert.equal(canonical.length, entry.bytes, `${locale}/${document}: byte mismatch`);
    assert.equal(createHash("sha256").update(canonical).digest("hex"), entry.sha256, `${locale}/${document}: hash mismatch`);
    assert.equal(canonical.toString("utf8"), source.replace(/\r\n?/g, "\n").normalize("NFC").replace(/\n?$/, "\n"));
    const page = await readFile(resolve(root, "site", entry.page, "index.html"), "utf8");
    assert(page.includes(`../../releases/${release}/${locale}/${document}.md`), `${locale}/${document}: broken canonical link`);
    assert(!/<script|<img|https?:\/\/[^"]+\.(js|css)/i.test(page), `${locale}/${document}: forbidden page asset`);
    if (locale === "zh-Hans" && document === "licenses") for (const [name, version] of runtimeInventory) {
      const archiveName = name.includes("/") ? name.split("/").at(-1) : name;
      const resolvedSource = `https://registry.npmjs.org/${name}/-/${archiveName}-${version}.tgz`;
      assert(page.includes(`href="${resolvedSource}"`), `zh-Hans/licenses: malformed generated href for ${name}`);
    }
  }
  const index = await readFile(resolve(root, "site/index.html"), "utf8");
  for (const entry of manifest.documents) assert(index.includes(`href="${entry.page}"`), `broken index link ${entry.page}`);
  await verifyDeterministicBuild(release, effectiveDate);
}

if (process.argv.includes("--self-test")) {
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
