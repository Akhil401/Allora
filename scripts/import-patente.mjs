/**
 * One-time importer for the patente B question bank.
 *
 * Loads the open ministry-mirror dataset (Ed0ardo/QuizPatenteB) and upserts it
 * into public.patente_questions using the Supabase SERVICE ROLE key (bypasses
 * RLS). Run once after applying migration 0014_patente.sql:
 *
 *   node scripts/import-patente.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Idempotent: re-running updates existing rows (keyed on ext_id).
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DATASET_URL =
  process.env.PATENTE_DATASET_URL ??
  "https://raw.githubusercontent.com/Ed0ardo/QuizPatenteB/main/quizPatenteB2023.json";

// Add more open datasets via PATENTE_DATASET_URLS (comma-separated). Every source
// is fetched and merged; questions are de-duplicated by statement text, so extra
// mirrors only add genuinely new questions.
const EXTRA_SOURCES = (process.env.PATENTE_DATASET_URLS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SOURCES = [DATASET_URL, ...EXTRA_SOURCES];
const REPO_BASE =
  process.env.PATENTE_REPO_BASE ?? "https://raw.githubusercontent.com/Ed0ardo/QuizPatenteB/main/";

/** Build a full image URL. Paths in the dataset look like "/img_sign/550.png". */
function buildImageUrl(img) {
  if (!img) return null;
  const s = String(img).trim();
  if (s.startsWith("http")) return s;
  const path = s.replace(/^\/+/, ""); // strip leading slashes
  return REPO_BASE + (path.includes("/") ? path : "img_sign/" + path);
}

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local — rely on process env */
  }
  return env;
}

/** Best-effort field mapping (dataset field names vary). */
function pick(obj, keys) {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  return undefined;
}
function toBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "v" || s === "vero" || s === "1" || s === "sì" || s === "si";
}

const TEXT_KEYS = ["q", "text", "testo", "domanda", "question", "quiz", "quesito", "affermazione", "frase"];

function textOf(o) {
  if (!o || typeof o !== "object") return undefined;
  return pick(o, TEXT_KEYS);
}

/**
 * Recursively walk the dataset and collect every question object (anything with a
 * text field), tagging it with the nearest top-level key as its topic.
 */
function extractPairs(raw) {
  const out = [];
  const walk = (node, topicKey) => {
    if (Array.isArray(node)) {
      for (const n of node) walk(n, topicKey);
    } else if (node && typeof node === "object") {
      if (textOf(node)) {
        out.push({ q: node, topicKey });
      } else {
        for (const [k, v] of Object.entries(node)) walk(v, topicKey ?? k);
      }
    }
  };
  walk(raw, undefined);
  return out;
}

function mapRow({ q, topicKey }) {
  const text = textOf(q);
  if (!text) return null;
  const answerRaw = pick(q, [
    "a", "answer", "risposta", "vero", "correct", "corretta", "soluzione", "risposta_corretta", "vero_falso", "valore",
  ]);
  const topic = pick(q, [
    "topic", "argomento", "capitolo", "chapter", "categoria", "category", "materia", "sezione", "gruppo",
  ]);
  const img = pick(q, ["image", "img", "immagine", "figura", "sign", "segnale", "picture", "foto"]);

  // Content-hash id so the same statement from different sources de-duplicates.
  const norm = String(text).toLowerCase().replace(/\s+/g, " ").trim();
  const extId = "h" + createHash("sha1").update(norm).digest("hex").slice(0, 16);

  const topicLabel = topic ?? (topicKey ? topicKey.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Generale");

  return {
    ext_id: extId,
    topic: String(topicLabel),
    text_it: String(text),
    correct: toBool(answerRaw),
    image: buildImageUrl(img),
    source: "ministeriale",
  };
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  // Fetch every source (best-effort) and merge. extractPairs handles arrays,
  // {questions}, and nested topic → { … → [questions] } shapes.
  let allPairs = [];
  for (const url of SOURCES) {
    try {
      console.log("Downloading:", url);
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`  skipped (HTTP ${res.status})`);
        continue;
      }
      const raw = await res.json();
      const pairs = extractPairs(raw);
      console.log(`  found ${pairs.length} questions`);
      if (pairs.length > 0 && allPairs.length === 0) {
        console.log("  sample:", JSON.stringify(pairs[0].q).slice(0, 300));
      }
      allPairs = allPairs.concat(pairs);
    } catch (e) {
      console.warn(`  skipped (${e.message})`);
    }
  }
  if (allPairs.length === 0) {
    console.error("No questions found from any source.");
    process.exit(1);
  }

  // Map + de-duplicate by content-hash ext_id.
  const seen = new Set();
  const rows = [];
  for (const p of allPairs) {
    const row = mapRow(p);
    if (!row || seen.has(row.ext_id)) continue;
    seen.add(row.ext_id);
    rows.push(row);
  }
  console.log(
    `Mapped ${rows.length} unique questions (from ${allPairs.length} across ${SOURCES.length} source(s)).`,
  );
  console.log("Example:", rows[0]);

  const db = createClient(url, key, { auth: { persistSession: false } });

  let done = 0;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await db.from("patente_questions").upsert(chunk, { onConflict: "ext_id" });
    if (error) {
      console.error("Upsert failed at", i, "-", error.message);
      process.exit(1);
    }
    done += chunk.length;
    console.log(`Upserted ${done}/${rows.length}`);
  }

  const { count } = await db
    .from("patente_questions")
    .select("id", { count: "exact", head: true });
  console.log(`Done. patente_questions now has ${count} rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
