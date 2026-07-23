import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

const root = resolve(new URL("..", import.meta.url).pathname);
const locales = ["en", "zh-Hans"];
const documents = ["licenses", "privacy", "terms"];
const allowedHosts = new Set(["www.apache.org", "opensource.org", "www.openssl.org"]);

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0 || !process.argv[i + 1]) throw new Error(`missing ${name}`);
  return process.argv[i + 1];
}
const release = arg("--release");
const effectiveDate = arg("--effective-date");
if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(release) || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) throw new Error("invalid release metadata");

function normalize(value) {
  const text = value.replace(/\r\n?/g, "\n").normalize("NFC");
  if (Buffer.byteLength(text) > 256_000) throw new Error("document exceeds size limit");
  if (/<\/?[A-Za-z][^>]*>|!\[[^\]]*\]\(/.test(text)) throw new Error("raw HTML and images are forbidden");
  for (const match of text.matchAll(/https?:\/\/[^\s)`]+/g)) {
    const url = new URL(match[0]);
    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) throw new Error(`URL not allowed: ${url}`);
  }
  return text.endsWith("\n") ? text : `${text}\n`;
}

function inline(text) {
  let escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  escaped = escaped.replace(/(https:\/\/[^\s<]+)/g, (raw) => {
    const suffix = /[.,。]$/.test(raw) ? raw.slice(-1) : "";
    const href = suffix ? raw.slice(0, -1) : raw;
    return `<a href="${href}" rel="noopener noreferrer">${href}</a>${suffix}`;
  });
  return escaped;
}

function renderMarkdown(markdown) {
  const out = [];
  let listOpen = false;
  for (const line of markdown.trim().split("\n")) {
    if (/^- /.test(line)) {
      if (!listOpen) out.push("<ul>");
      listOpen = true;
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (listOpen) { out.push("</ul>"); listOpen = false; }
    if (!line) continue;
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
    else out.push(`<p>${inline(line.replace(/  $/, ""))}</p>`);
  }
  if (listOpen) out.push("</ul>");
  return out.join("\n");
}

const entries = [];
for (const locale of locales) {
  for (const document of documents) {
    const source = `content/${locale}/${document}.md`;
    const markdown = normalize(await readFile(resolve(root, source), "utf8"));
    if (!markdown.includes(release) || !markdown.includes(effectiveDate)) throw new Error(`metadata missing in ${source}`);
    const bytes = Buffer.from(markdown);
    const releasePath = `site/releases/${release}/${locale}/${document}.md`;
    await mkdir(dirname(resolve(root, releasePath)), { recursive: true });
    await writeFile(resolve(root, releasePath), bytes);
    const pagePath = `site/${locale}/${document}/index.html`;
    await mkdir(dirname(resolve(root, pagePath)), { recursive: true });
    const title = markdown.match(/^# (.+)$/m)?.[1] ?? document;
    const nav = documents.map((item) => `<a href="../${item}/">${item}</a>`).join(" · ");
    const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${inline(title)}</title><link rel="stylesheet" href="../../assets/legal.css"></head>
<body><header><a class="brand" href="../../">Adaivo Music</a><nav aria-label="Legal documents">${nav}</nav></header><main>${renderMarkdown(markdown)}</main><footer>© 2026 Adaivo. All rights reserved. <a href="../../releases/${release}/${locale}/${document}.md">Canonical Markdown</a></footer></body></html>
`;
    await writeFile(resolve(root, pagePath), html);
    entries.push({ locale, document, source, page: `${locale}/${document}/`, markdown: `releases/${release}/${locale}/${document}.md`, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
}
entries.sort((a, b) => `${a.locale}/${a.document}`.localeCompare(`${b.locale}/${b.document}`));
const manifest = { release, effectiveDate, generatedFrom: "c810e47c83771fafea1366a6a58d4762c553b751", documents: entries };
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
await writeFile(resolve(root, "manifest.json"), manifestText);
await writeFile(resolve(root, "site/manifest.json"), manifestText);

const cards = entries.map((entry) => `<li><a href="${entry.page}">${entry.locale} · ${entry.document}</a></li>`).join("");
await writeFile(resolve(root, "site/index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Adaivo Music Legal</title><link rel="stylesheet" href="assets/legal.css"></head>
<body><header><span class="brand">Adaivo Music</span></header><main><h1>Legal documents · 法律文件</h1><p>Release ${release} · Effective ${effectiveDate}</p><ul class="cards">${cards}</ul><p><a href="manifest.json">Release manifest</a></p></main><footer>© 2026 Adaivo. All rights reserved. Public readability does not grant reuse.</footer></body></html>
`);
