/**
 * Core text-statistics logic, shared by the web app and the command-line tool.
 * Works in browsers (exposes `window.WordCount`) and in Node (`module.exports`).
 *
 * All counting follows the Unicode standard, UAX #29 "Unicode Text Segmentation"
 * (https://www.unicode.org/reports/tr29/), via the built-in `Intl.Segmenter`:
 *   - words      = word-boundary segments that are word-like (letters, numbers, ideographs…);
 *                  emoji are never words
 *   - emoji      = grapheme clusters that are emoji (they still count as characters)
 *   - characters = extended grapheme clusters (what a reader perceives as one character)
 *   - sentences  = sentence-boundary segments that contain at least one word
 * Environments without `Intl.Segmenter` fall back to Unicode property regexes.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.WordCount = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const WORDS_PER_MINUTE = 200;
  const hasSegmenter =
    typeof Intl !== "undefined" && typeof Intl.Segmenter === "function";
  const segmenters = hasSegmenter
    ? {
        word: new Intl.Segmenter(undefined, { granularity: "word" }),
        grapheme: new Intl.Segmenter(undefined, { granularity: "grapheme" }),
        sentence: new Intl.Segmenter(undefined, { granularity: "sentence" }),
      }
    : null;

  // Fallbacks approximating UAX #29 with Unicode properties.
  // Letters, marks and numbers, joined by the "MidLetter/MidNum" characters (' ’ . , etc.).
  const WORD_RE = /[\p{L}\p{M}\p{N}\p{Pc}]+(?:['’.,:·][\p{L}\p{M}\p{N}\p{Pc}]+)*/gu;
  // An extended grapheme cluster: a base (CRLF, a flag's regional-indicator pair, or any character)
  // plus combining marks, variation selectors, emoji skin-tone modifiers and tag characters,
  // optionally chained with ZERO WIDTH JOINER (emoji ZWJ sequences such as 👨‍👩‍👧).
  const GRAPHEME_RE = new RegExp(
    String.raw`(?:\r\n|\p{RI}\p{RI}|[^])[\p{M}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]*` +
      String.raw`(?:‍(?:\p{RI}\p{RI}|[^])[\p{M}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]*)*`,
    "gu"
  );
  // A grapheme cluster is an emoji if it contains a pictographic character, a flag letter,
  // a keycap (1️⃣) or the emoji presentation selector U+FE0F.
  const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣|️/u;

  /** Split `text` into user-perceived characters (Unicode extended grapheme clusters). */
  function graphemes(text) {
    if (!text) return [];
    if (segmenters) return Array.from(segmenters.grapheme.segment(text), (s) => s.segment);
    return text.match(GRAPHEME_RE) || [];
  }

  /** Replace every emoji with a space, so emoji count as characters but never as (part of) words. */
  function withoutEmoji(text) {
    if (!EMOJI_RE.test(text)) return text;
    return graphemes(text).map((g) => (EMOJI_RE.test(g) ? " " : g)).join("");
  }

  /** Return the list of words in `text` (Unicode word boundaries, ignoring emoji). */
  function words(text) {
    if (!text) return [];
    text = withoutEmoji(text);
    if (segmenters) {
      const out = [];
      for (const seg of segmenters.word.segment(text)) {
        if (seg.isWordLike) out.push(seg.segment);
      }
      return out;
    }
    return text.match(WORD_RE) || [];
  }

  /** Count the words in `text`. */
  function countWords(text) {
    return words(text).length;
  }

  /** Count user-perceived characters (Unicode extended grapheme clusters); each emoji is one. */
  function countCharacters(text) {
    return graphemes(text).length;
  }

  /** Count the emoji in `text`. */
  function countEmoji(text) {
    return graphemes(text).filter((g) => EMOJI_RE.test(g)).length;
  }

  /** Count sentences (Unicode sentence boundaries) that contain at least one word. */
  function countSentences(text) {
    if (!text) return 0;
    const parts = segmenters
      ? Array.from(segmenters.sentence.segment(text), (s) => s.segment)
      : text.split(/(?<=[.!?。！？…])\s+/u);
    return parts.filter((p) => countWords(p) > 0).length;
  }

  // Unicode line terminators: CRLF, LF, VT, FF, CR, NEL, LINE SEPARATOR, PARAGRAPH SEPARATOR.
  const LINE_BREAK = /\r\n|[\n\v\f\r\u0085\u2028\u2029]/u;
  const PARAGRAPH_BREAK = /(?:\r\n|[\n\v\f\r\u0085\u2028])[^\S\u2029]*(?:\r\n|[\n\v\f\r\u0085\u2028])|\u2029/u;

  function countParagraphs(text) {
    return text.split(PARAGRAPH_BREAK).filter((p) => /\S/u.test(p)).length;
  }

  /** Full statistics for `text`. */
  function analyze(text) {
    text = text == null ? "" : String(text).normalize("NFC");
    const wordList = words(text);
    const wordCount = wordList.length;
    const frequency = new Map();
    for (const w of wordList) {
      const key = w.toLocaleLowerCase();
      frequency.set(key, (frequency.get(key) || 0) + 1);
    }
    const topWords = [...frequency.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    return {
      words: wordCount,
      uniqueWords: frequency.size,
      characters: countCharacters(text),
      emoji: countEmoji(text),
      charactersNoSpaces: countCharacters(text.replace(/\s/gu, "")),
      sentences: countSentences(text),
      paragraphs: countParagraphs(text),
      lines: text.length ? text.split(LINE_BREAK).length : 0,
      readingTimeMinutes: wordCount === 0 ? 0 : Math.ceil(wordCount / WORDS_PER_MINUTE),
      topWords,
    };
  }

  return { words, countWords, countCharacters, countEmoji, analyze, WORDS_PER_MINUTE };
});
