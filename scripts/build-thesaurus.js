#!/usr/bin/env node
// Builds src/thesaurus.json from Princeton WordNet (npm package `wordnet-db`).
// Usage: npm install && npm run build:thesaurus
//
// Output shape (compact, so the whole thesaurus can be cached for offline use):
//   {
//     "senses": [ [pos, definition, [synset members...], [similar words...]?], ... ],
//     "words":  { "happy": [ senseId | [senseId, antonym...], ... ], ... }
//   }
// A word's senses are listed most common first (WordNet's frequency order).
"use strict";

const fs = require("fs");
const path = require("path");

const DICT = path.join(path.dirname(require.resolve("wordnet-db/package.json")), "dict");
const OUT = path.join(__dirname, "..", "src", "thesaurus.json");
const POS_FILES = { n: "noun", v: "verb", a: "adj", r: "adv" };
const MAX_SYNONYMS = 16;
const MAX_DEFINITION = 90;

const lemmaText = (w) => w.replace(/\(.*\)$/, "").replace(/_/g, " ");

function lines(file) {
  return fs.readFileSync(path.join(DICT, file), "utf8").split("\n").filter((l) => l && !l.startsWith("  "));
}

// Parse data.* files: synset offset -> { words, pointers, gloss }.
const synsets = {};
for (const [pos, name] of Object.entries(POS_FILES)) {
  synsets[pos] = new Map();
  for (const line of lines(`data.${name}`)) {
    const [head, gloss = ""] = line.split(" | ");
    const f = head.trim().split(" ");
    const offset = f[0];
    const wCnt = parseInt(f[3], 16);
    let i = 4;
    const words = [];
    for (let k = 0; k < wCnt; k++, i += 2) words.push(lemmaText(f[i]));
    const pCnt = parseInt(f[i++], 10);
    const pointers = [];
    for (let k = 0; k < pCnt; k++, i += 4) {
      const [symbol, target, tpos, st] = f.slice(i, i + 4);
      pointers.push({
        symbol,
        target,
        pos: tpos === "s" ? "a" : tpos,
        source: parseInt(st.slice(0, 2), 16),
        dest: parseInt(st.slice(2), 16),
      });
    }
    synsets[pos].set(offset, { words, pointers, gloss });
  }
}

function definition(gloss) {
  // Keep the definition, drop the quoted examples.
  let d = gloss.split(/;\s*"/)[0].replace(/"/g, "").trim();
  if (d.length > MAX_DEFINITION) d = d.slice(0, MAX_DEFINITION - 1).replace(/\s+\S*$/, "") + "…";
  return d;
}

// Each synset (one meaning) is stored once in `senses`; `words` points each headword at its senses.
const senses = [];
const senseIndex = new Map();
function senseId(pos, offset) {
  const key = pos + offset;
  if (!senseIndex.has(key)) {
    const s = synsets[pos].get(offset);
    // Related adjectives: "^" also-see (happy -> glad, cheerful, joyful) first, then
    // "&" similar-to (happy -> blissful, halcyon), which links an adjective cluster.
    const related = (symbol) =>
      s.pointers
        .filter((p) => p.symbol === symbol && p.pos === "a" && pos === "a")
        .flatMap((p) => synsets[p.pos].get(p.target).words);
    const similar = [...related("^"), ...related("&")];
    const members = [...new Set(s.words)];
    const extra = [...new Set(similar)].filter((w) => !members.includes(w)).slice(0, MAX_SYNONYMS);
    senseIndex.set(key, senses.length);
    senses.push(extra.length ? [pos, definition(s.gloss), members, extra] : [pos, definition(s.gloss), members]);
  }
  return senseIndex.get(key);
}

// How often each word sense was seen in tagged text, used to put the most common meanings first
// across parts of speech (so "run" lists its verb senses before rarer noun senses).
const SS_TYPE_POS = { 1: "n", 2: "v", 3: "a", 4: "r", 5: "a" };
const tagCount = new Map();
for (const line of fs.readFileSync(path.join(DICT, "index.sense"), "utf8").split("\n")) {
  if (!line) continue;
  const [key, offset, , count] = line.split(" ");
  const [lemma, rest] = key.split("%");
  tagCount.set(`${SS_TYPE_POS[rest[0]]}${offset}|${lemmaText(lemma)}`, parseInt(count, 10));
}

const words = Object.create(null);
const counts = new Map(); // lemma -> tag count per entry in words[lemma], for sorting
for (const [pos, name] of Object.entries(POS_FILES)) {
  for (const line of lines(`index.${name}`)) {
    const f = line.trim().split(" ");
    const lemma = lemmaText(f[0]);
    const synCnt = parseInt(f[2], 10);
    const tagged = parseInt(f[f.length - synCnt - 1], 10);
    // Senses are in frequency order; the first `tagged` ones were seen in real text (SemCor).
    // Keep those, and always the most common sense, to keep the file small.
    const offsets = f.slice(f.length - synCnt).slice(0, Math.max(1, tagged));
    if (tagged === 0 && lemma.includes(" ")) continue; // rare multi-word phrases

    for (const offset of offsets) {
      const s = synsets[pos].get(offset);
      const wordIndex = s.words.findIndex((w) => w.toLowerCase() === lemma) + 1;
      if (/^[A-Z]/.test(s.words[wordIndex - 1] || "")) continue; // proper noun (Paris, Einstein…)
      const antonyms = [];
      for (const p of s.pointers) {
        // "!" antonyms are word-to-word; keep the ones that belong to this lemma.
        if (p.symbol === "!" && (p.source === 0 || p.source === wordIndex)) {
          const t = synsets[p.pos].get(p.target);
          antonyms.push(p.dest === 0 ? t.words[0] : t.words[p.dest - 1]);
        }
      }
      const others =
        s.words.some((w) => w.toLowerCase() !== lemma) ||
        (pos === "a" && s.pointers.some((p) => (p.symbol === "&" || p.symbol === "^") && p.pos === "a"));
      if (!others && !antonyms.length) continue;
      const id = senseId(pos, offset);
      (words[lemma] ||= []).push(antonyms.length ? [id, ...new Set(antonyms)] : id);
      if (!counts.has(lemma)) counts.set(lemma, []);
      counts.get(lemma).push(tagCount.get(`${pos}${offset}|${lemma}`) || 0);
    }
  }
}

// Most common meaning first; ties keep WordNet's order (noun, verb, adjective, adverb).
for (const lemma of Object.keys(words)) {
  const c = counts.get(lemma);
  words[lemma] = words[lemma]
    .map((entry, i) => [entry, c[i], i])
    .sort((a, b) => b[1] - a[1] || a[2] - b[2])
    .map(([entry]) => entry);
}

const json = JSON.stringify({ senses, words });
fs.writeFileSync(OUT, json + "\n");
console.log(
  `Wrote ${Object.keys(words).length} words, ${senses.length} senses, ` +
    `${(json.length / 1048576).toFixed(1)} MB to ${path.relative(process.cwd(), OUT)}`
);
