// Build a compact Italian→English dictionary JSON from FreeDict (ita-eng, TEI).
//
// Usage (from the project root):
//   node scripts/build-dictionary.mjs                # auto-download latest FreeDict ita-eng
//   node scripts/build-dictionary.mjs path/to.tei    # use a TEI file you downloaded
//   node scripts/build-dictionary.mjs path/to.tar.xz # use a src tarball you downloaded
//
// Output: public/dictionary/it-en.json  (array of { it, en, pos })
//
// Requirements: Node 20+ (global fetch) and the `tar` command (built into
// Windows 10+/macOS/Linux) for extracting .tar.xz. Data is CC BY-SA / GPL
// (FreeDict); fine for personal use — keep attribution if you redistribute.

import { execSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT_DIR = "public/dictionary";
const OUT_FILE = join(OUT_DIR, "it-en.json");
const DB_URL = "https://freedict.org/freedict-database.json";

const POS_MAP = {
  n: "noun",
  v: "verb",
  adj: "adjective",
  adv: "adverb",
  prep: "preposition",
  pron: "pronoun",
  conj: "conjunction",
  num: "number",
  interj: "interjection",
  art: "article",
};

async function main() {
  const arg = process.argv[2];
  let teiText;

  if (arg && arg.endsWith(".tei")) {
    console.log("Reading TEI:", arg);
    teiText = readFileSync(arg, "utf8");
  } else {
    const tarPath = arg && arg.endsWith(".xz") ? arg : await download();
    teiText = extractTei(tarPath);
  }

  const words = parseTei(teiText);
  if (words.length === 0) throw new Error("No entries parsed — is this the ita-eng TEI?");

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(words));
  console.log(`Wrote ${words.length} entries → ${OUT_FILE}`);
}

async function download() {
  console.log("Fetching FreeDict catalogue…");
  const db = await (await fetch(DB_URL)).json();
  const dict = (Array.isArray(db) ? db : []).find((d) => d.name === "ita-eng");
  if (!dict) throw new Error("ita-eng not found in FreeDict catalogue.");
  const release =
    (dict.releases || []).find((r) => r.platform === "src") ||
    (dict.releases || []).find((r) => r.platform === "dictd");
  if (!release?.URL) throw new Error("No downloadable src/dictd release found for ita-eng.");

  console.log("Downloading", release.URL);
  const buf = Buffer.from(await (await fetch(release.URL)).arrayBuffer());
  const dir = mkdtempSync(join(tmpdir(), "freedict-"));
  const tarPath = join(dir, "ita-eng.tar.xz");
  writeFileSync(tarPath, buf);
  return tarPath;
}

function extractTei(tarPath) {
  const dir = mkdtempSync(join(tmpdir(), "freedict-x-"));
  console.log("Extracting with tar…");
  execSync(`tar -xf "${tarPath}" -C "${dir}"`, { stdio: "inherit" });
  const tei = findFile(dir, (f) => f.endsWith(".tei"));
  if (!tei) throw new Error("No .tei file inside the archive (try the 'src' release).");
  return readFileSync(tei, "utf8");
}

function findFile(dir, pred) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      const found = findFile(p, pred);
      if (found) return found;
    } else if (pred(name)) {
      return p;
    }
  }
  return null;
}

function parseTei(tei) {
  const out = [];
  const seen = new Set();
  // Split into <entry>…</entry> blocks and pull orth / pos / translations.
  const entries = tei.split(/<entry\b/).slice(1);
  for (const chunk of entries) {
    const body = chunk.split("</entry>")[0] ?? "";
    const it = clean(first(body, /<orth\b[^>]*>([\s\S]*?)<\/orth>/));
    if (!it) continue;
    const posRaw = clean(first(body, /<pos\b[^>]*>([\s\S]*?)<\/pos>/)).toLowerCase();
    const pos = POS_MAP[posRaw] ?? posRaw ?? "";
    const quotes = [...body.matchAll(/<quote\b[^>]*>([\s\S]*?)<\/quote>/g)]
      .map((m) => clean(m[1]))
      .filter(Boolean);
    const en = quotes.slice(0, 3).join(" / ");
    if (!en) continue;
    const key = it.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ it, en, pos });
  }
  out.sort((a, b) => a.it.localeCompare(b.it, "it"));
  return out;
}

function first(text, re) {
  const m = text.match(re);
  return m ? m[1] : "";
}

function clean(s) {
  return (s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

main().catch((err) => {
  console.error("\nBuild failed:", err.message);
  console.error(
    "\nTip: download the ita-eng 'source' package from https://freedict.org/downloads/",
    "\nthen run:  node scripts/build-dictionary.mjs path\\to\\freedict-ita-eng-*.src.tar.xz",
  );
  process.exit(1);
});
