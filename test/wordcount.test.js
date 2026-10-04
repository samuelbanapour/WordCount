"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { words, countWords, countCharacters, analyze } = require("../src/wordcount.js");

test("empty and whitespace-only text has zero words", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("   \n\t \u3000"), 0);
  assert.deepEqual(analyze(""), {
    words: 0, uniqueWords: 0, characters: 0, charactersNoSpaces: 0,
    sentences: 0, paragraphs: 0, lines: 0, readingTimeMinutes: 0, topWords: [],
  });
});

test("counts simple words", () => {
  assert.equal(countWords("Hello world"), 2);
  assert.equal(countWords("  one   two\nthree\tfour  "), 4);
});

test("punctuation and symbols are not words", () => {
  assert.equal(countWords("Hello, world! -- How are you? 👋 ★"), 5);
});

test("UAX #29: apostrophes and numbers stay joined, hyphens split", () => {
  assert.deepEqual(words("Don't stop"), ["Don't", "stop"]);
  assert.deepEqual(words("it’s 2.5 or 1,000"), ["it’s", "2.5", "or", "1,000"]);
  assert.deepEqual(words("well-known"), ["well", "known"]);
});

test("any script: accents, Cyrillic, Greek, Arabic, Hindi", () => {
  assert.equal(countWords("Café déjà vu"), 3);
  assert.equal(countWords("Привет мир"), 2);
  assert.equal(countWords("Καλημέρα κόσμε"), 2);
  assert.equal(countWords("مرحبا بالعالم"), 2);
  assert.equal(countWords("नमस्ते दुनिया"), 2);
});

test("scripts without spaces are segmented into words", () => {
  assert.ok(countWords("我喜欢学习中文") > 1);
  assert.ok(countWords("สวัสดีครับ") > 1);
});

test("characters are grapheme clusters", () => {
  assert.equal(countCharacters("hi 👋"), 4);
  assert.equal(countCharacters("👨‍👩‍👧"), 1); // ZWJ family sequence
  assert.equal(countCharacters("👍🏽"), 1); // emoji + skin tone modifier
  assert.equal(countCharacters("🇺🇸"), 1); // flag (regional indicator pair)
  assert.equal(countCharacters("e\u0301"), 1); // e + combining acute accent
  assert.equal(analyze("hi 👋").charactersNoSpaces, 3);
});

test("full statistics", () => {
  const s = analyze("The cat sat. The cat ran!\n\nA new paragraph?");
  assert.equal(s.words, 9);
  assert.equal(s.uniqueWords, 7);
  assert.equal(s.sentences, 3);
  assert.equal(s.paragraphs, 2);
  assert.equal(s.lines, 3);
  assert.equal(s.readingTimeMinutes, 1);
  assert.deepEqual(s.topWords.slice(0, 2), [{ word: "cat", count: 2 }, { word: "the", count: 2 }]);
});

test("Unicode line and paragraph separators", () => {
  assert.equal(analyze("one\u2028two").lines, 2);
  assert.equal(analyze("first\u2029second").paragraphs, 2);
});

test("composed and decomposed forms count the same", () => {
  assert.deepEqual(analyze("caf\u00e9 cafe\u0301").topWords, [{ word: "caf\u00e9", count: 2 }]);
});

test("reading time rounds up", () => {
  assert.equal(analyze("word ".repeat(201)).readingTimeMinutes, 2);
});
