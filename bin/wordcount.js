#!/usr/bin/env node
// Command-line word counter. Usage: wordcount [--json] [file ...]   (reads stdin when no files are given)
"use strict";

const fs = require("fs");
const { analyze } = require("../src/wordcount.js");

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  console.log("Usage: wordcount [--json] [file ...]\nCounts words in the given files, or in standard input.");
  process.exit(0);
}
const json = args.includes("--json");
const files = args.filter((a) => a !== "--json");

function report(label, stats) {
  if (json) return { file: label, ...stats };
  const lines = [
    `Words:              ${stats.words}`,
    `Unique words:       ${stats.uniqueWords}`,
    `Characters:         ${stats.characters}`,
    `Characters (no sp): ${stats.charactersNoSpaces}`,
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
