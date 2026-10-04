"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { words, countWords, countCharacters, countEmoji, analyze } = require("../src/wordcount.js");

test("empty and whitespace-only text has zero words", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("   \n\t \u3000"), 0);
  assert.deepEqual(analyze(""), {
    words: 0, uniqueWords: 0, characters: 0, emoji: 0, charactersNoSpaces: 0,
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

const EMOJI = ["👋", "😀", "👨‍👩‍👧", "👍🏽", "🧑🏽‍💻", "🏳️‍🌈", "🇺🇸", "🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  "1️⃣", "#️⃣", "🔟", "❤️", "©️", "™", "🅰️", "Ⓜ️"];

function emojiCases() {
  for (const e of EMOJI) {
    assert.equal(countWords(e), 0, `${e} is not a word`);
    assert.equal(countCharacters(e), 1, `${e} is one character`);
    assert.equal(countEmoji(e), 1, `${e} is one emoji`);
  }
  assert.deepEqual(words("I ❤️ NY 🗽!"), ["I", "NY"]);
  assert.deepEqual(words("hi👋there"), ["hi", "there"]);
  assert.deepEqual(words("Score: 1️⃣0️⃣ pts"), ["Score", "pts"]);
  const s = analyze("Good morning ☀️😀 see you 👋");
  assert.equal(s.words, 4);
  assert.equal(s.emoji, 3);
  assert.equal(s.characters, 25);
}

test("emoji count as characters, never as words", emojiCases);

test("emoji handling is the same without Intl.Segmenter", () => {
  const saved = Intl.Segmenter;
  const modPath = require.resolve("../src/wordcount.js");
  delete require.cache[modPath];
  delete Intl.Segmenter;
  try {
    const fallback = require(modPath);
    for (const e of EMOJI) {
      assert.equal(fallback.countWords(e), 0, `${e} is not a word`);
      assert.equal(fallback.countCharacters(e), 1, `${e} is one character`);
    }
    assert.deepEqual(fallback.words("I ❤️ NY 🗽!"), ["I", "NY"]);
  } finally {
    Intl.Segmenter = saved;
    delete require.cache[modPath];
  }
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
