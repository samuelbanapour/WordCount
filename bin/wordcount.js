#!/usr/bin/env node
// Command-line word counter.
// Usage: wordcount [--json] [file ...]          count words (reads stdin when no files are given)
//        wordcount --thesaurus [--json] <word>  show synonyms and opposites
"use strict";

const fs = require("fs");
const { analyze } = require("../src/wordcount.js");

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  console.log(
    "Usage: wordcount [--json] [file ...]\n" +
      "       wordcount --thesaurus [--json] <word>\n\n" +
      "Counts words in the given files, or in standard input.\n" +
      "With -t/--thesaurus, shows synonyms and opposites for a word instead."
  );
  process.exit(0);
}
const json = args.includes("--json");
const thesaurusMode = args.includes("-t") || args.includes("--thesaurus");
const files = args.filter((a) => !["--json", "-t", "--thesaurus"].includes(a));

if (thesaurusMode) {
  const query = files.join(" ");
  if (!query) {
    console.error("wordcount: --thesaurus needs a word, e.g. wordcount --thesaurus happy");
    process.exit(2);
  }
  const thesaurus = require("../src/thesaurus.js").create(require("../src/thesaurus.json"));
  const result = thesaurus.lookup(query);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!result) {
    console.log(`No synonyms found for "${query}".`);
  } else {
    for (const { word, senses } of result.matches) {
      console.log(`== ${word} ==`);
      for (const s of senses) {
        console.log(`(${s.partOfSpeech}) ${s.definition}`);
        if (s.synonyms.length) console.log(`  synonyms:  ${s.synonyms.join(", ")}`);
        if (s.antonyms.length) console.log(`  opposites: ${s.antonyms.join(", ")}`);
      }
    }
  }
  process.exit(result ? 0 : 1);
}

function report(label, stats) {
  if (json) return { file: label, ...stats };
  const lines = [
    `Words:              ${stats.words}`,
    `Unique words:       ${stats.uniqueWords}`,
    `Characters:         ${stats.characters}`,
    `Characters (no sp): ${stats.charactersNoSpaces}`,
    `Emoji:              ${stats.emoji}`,
    `Sentences:          ${stats.sentences}`,
    `Paragraphs:         ${stats.paragraphs}`,
    `Reading time:       ${stats.readingTimeMinutes} min`,
  ];
  if (label) console.log(`== ${label} ==`);
  console.log(lines.join("\n"));
}

if (files.length === 0) {
  const result = report(null, analyze(fs.readFileSync(0, "utf8")));
  if (json) console.log(JSON.stringify(result, null, 2));
} else {
  const results = [];
  let failed = false;
  for (const file of files) {
    try {
      results.push(report(file, analyze(fs.readFileSync(file, "utf8"))));
    } catch (err) {
      console.error(`wordcount: ${file}: ${err.message}`);
      failed = true;
    }
  }
  if (json) console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
  if (failed) process.exit(1);
}
