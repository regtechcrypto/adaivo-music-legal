import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const locales = ["en", "zh-Hans"];
const documents = ["licenses", "privacy", "terms"];
const required = {
  terms: ["Operator", "Acceptance", "Accounts", "Limited", "Subscriptions", "Catalog", "Intellectual", "Service changes", "Disclaimers", "liability", "Indemnity", "Governing", "Changes", "Severability", "Contact"],
  privacy: ["Operator", "Information", "Purposes", "Providers", "Cross-border", "Retention", "Security", "Access", "Children", "Changes", "Contact"],
  licenses: ["Scope", "Runtime", "Native", "license"]
};

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
    assert(["www.apache.org", "opensource.org", "www.openssl.org"].includes(url.hostname), `${locale}/${document}: URL host not allowlisted`);
  }
  if (document === "licenses") assert(!/Adaivo.{0,50}(is open source|licensed under (the )?(MIT|Apache))/i.test(text), `${locale}/${document}: Adaivo content marked OSS`);
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
  }
  const index = await readFile(resolve(root, "site/index.html"), "utf8");
  for (const entry of manifest.documents) assert(index.includes(`href="${entry.page}"`), `broken index link ${entry.page}`);
}

if (process.argv.includes("--self-test")) {
  assert.throws(() => validateSource("# Scope\n2026-07-23.1 2026-07-23 Runtime Native license UNKNOWN", "en", "licenses", "2026-07-23.1", "2026-07-23"), /UNKNOWN/);
  assert.throws(() => validateSource("# Privacy\n2026-07-23.1 2026-07-23 <script>", "en", "privacy", "2026-07-23.1", "2026-07-23"), /raw HTML/);
  const build = spawnSync(process.execPath, ["scripts/build-manifest.mjs", "--release", "2026-07-23.1", "--effective-date", "2026-07-23"], { cwd: root, encoding: "utf8" });
  assert.equal(build.status, 0, build.stderr);
}
await verify();
console.log("legal release verification passed");
