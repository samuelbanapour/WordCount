"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { create, baseForms, matchCase } = require("../src/thesaurus.js");

const thesaurus = create(require("../src/thesaurus.json"));
const words = (result) => result.matches.map((m) => m.word);
const allSynonyms = (match) => match.senses.flatMap((s) => s.synonyms);
const allAntonyms = (match) => match.senses.flatMap((s) => s.antonyms);

test("finds synonyms, opposites and definitions", () => {
  const r = thesaurus.lookup("happy");
  assert.deepEqual(words(r), ["happy"]);
  const [happy] = r.matches;
  assert.ok(allSynonyms(happy).includes("glad"));
  assert.ok(allAntonyms(happy).includes("unhappy"));
  assert.equal(happy.senses[0].partOfSpeech, "adjective");
  assert.match(happy.senses[0].definition, /joy|pleasure/);
});

test("never lists the word itself as its own synonym", () => {
  for (const w of ["big", "run", "fast", "good"]) {
    for (const s of thesaurus.lookup(w).matches[0].senses) {
      assert.ok(!s.synonyms.some((x) => x.toLowerCase() === w), `${w} in its own synonyms`);
    }
  }
});

test("most common meaning comes first", () => {
  assert.equal(thesaurus.lookup("run").matches[0].senses[0].partOfSpeech, "verb");
});

test("case and spacing are ignored", () => {
  assert.deepEqual(words(thesaurus.lookup("  HAPPY ")), ["happy"]);
  assert.deepEqual(words(thesaurus.lookup("look   up")), ["look up"]);
});

test("inflected forms find their dictionary form", () => {
  assert.deepEqual(words(thesaurus.lookup("ran")), ["run"]);
  assert.deepEqual(words(thesaurus.lookup("happier")), ["happy"]);
  assert.deepEqual(words(thesaurus.lookup("children")), ["child"]);
  assert.deepEqual(words(thesaurus.lookup("cats")), ["cat"]);
  assert.ok(words(thesaurus.lookup("running")).includes("run"));
  assert.ok(words(thesaurus.lookup("bigger")).includes("big"));
  assert.deepEqual(words(thesaurus.lookup("said")), ["said", "say"]);
});

test("unknown words and empty input return null", () => {
  assert.equal(thesaurus.lookup("xyzzyq"), null);
  assert.equal(thesaurus.lookup(""), null);
  assert.equal(thesaurus.lookup("   "), null);
});

test("object property names are not treated as words", () => {
  for (const w of ["__proto__", "toString", "hasOwnProperty", "valueOf"]) {
    assert.equal(thesaurus.lookup(w), null, w);
  }
});

test("baseForms undoes common suffixes", () => {
  assert.ok(baseForms("stopped").includes("stop"));
  assert.ok(baseForms("making").includes("make"));
  assert.ok(baseForms("boxes").includes("box"));
  assert.ok(baseForms("went").includes("go"));
});

test("matchCase copies capitalization", () => {
  assert.equal(matchCase("glad", "happy"), "glad");
  assert.equal(matchCase("glad", "Happy"), "Glad");
  assert.equal(matchCase("glad", "HAPPY"), "GLAD");
  assert.equal(matchCase("glad", "I"), "Glad");
});
