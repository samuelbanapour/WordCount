/**
 * Thesaurus lookups over the compact WordNet data in thesaurus.json
 * (built by scripts/build-thesaurus.js). Shared by the web app and the CLI.
 * Works in browsers (exposes `window.Thesaurus`) and in Node (`module.exports`).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Thesaurus = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const POS_LABELS = { n: "noun", v: "verb", a: "adjective", r: "adverb" };
  const MAX_SYNONYMS = 16;

  // Common irregular forms that suffix rules can't undo.
  const IRREGULAR = {
    am: "be", is: "be", are: "be", was: "be", were: "be", been: "be",
    has: "have", had: "have", does: "do", did: "do", done: "do",
    went: "go", gone: "go", ran: "run", saw: "see", seen: "see",
    said: "say", made: "make", took: "take", taken: "take", came: "come",
    gave: "give", given: "give", knew: "know", known: "know", got: "get",
    gotten: "get", thought: "think", told: "tell", found: "find", left: "leave",
    felt: "feel", bought: "buy", brought: "bring", began: "begin", begun: "begin",
    wrote: "write", written: "write", spoke: "speak", spoken: "speak",
    broke: "break", broken: "break", chose: "choose", chosen: "choose",
    drove: "drive", driven: "drive", ate: "eat", eaten: "eat", fell: "fall",
    fallen: "fall", flew: "fly", flown: "fly", forgot: "forget", forgotten: "forget",
    grew: "grow", grown: "grow", held: "hold", kept: "keep", led: "lead",
    lost: "lose", meant: "mean", met: "meet", paid: "pay", sat: "sit",
    sold: "sell", sent: "send", stood: "stand", taught: "teach",
    understood: "understand", won: "win", swam: "swim", sang: "sing",
    sung: "sing", drank: "drink", drunk: "drink", became: "become",
    slept: "sleep", built: "build", caught: "catch", fought: "fight",
    hid: "hide", hidden: "hide", rode: "ride", ridden: "ride", rose: "rise",
    risen: "rise", shook: "shake", shaken: "shake", stole: "steal",
    stolen: "steal", threw: "throw", thrown: "throw", wore: "wear", worn: "wear",
    woke: "wake", woken: "wake", spent: "spend", lent: "lend", fed: "feed",
    better: "good", best: "good", worse: "bad", worst: "bad",
    children: "child", men: "man", women: "woman", people: "person",
    mice: "mouse", feet: "foot", teeth: "tooth", geese: "goose",
    lives: "life", wives: "wife", knives: "knife", leaves: "leaf",
  };

  // WordNet "morphy" detachment rules: [suffix, replacement].
  const SUFFIX_RULES = [
    ["ies", "y"], ["ses", "s"], ["xes", "x"], ["zes", "z"], ["ches", "ch"], ["shes", "sh"],
    ["men", "man"], ["es", "e"], ["es", ""], ["s", ""],
    ["ied", "y"], ["ed", "e"], ["ed", ""], ["ing", "e"], ["ing", ""],
    ["ier", "y"], ["iest", "y"], ["er", "e"], ["er", ""], ["est", "e"], ["est", ""],
    ["ly", ""], ["ily", "y"],
  ];

  /** Possible dictionary (base) forms of `word`, most likely first. */
  function baseForms(word) {
    const out = [];
    if (Object.prototype.hasOwnProperty.call(IRREGULAR, word)) out.push(IRREGULAR[word]);
    for (const [suffix, replacement] of SUFFIX_RULES) {
      if (word.length > suffix.length + 1 && word.endsWith(suffix)) {
        const stem = word.slice(0, -suffix.length);
        out.push(stem + replacement);
        // Undo consonant doubling: "running" -> "runn" -> "run", "bigger" -> "big".
        if (!replacement && /([b-df-hj-np-tv-z])\1$/.test(stem)) out.push(stem.slice(0, -1));
      }
    }
    return out;
  }

  /** Give `replacement` the same capitalization style as `original` ("Happy" -> "Glad"). */
  function matchCase(replacement, original) {
    if (original.length > 1 && original === original.toUpperCase() && original !== original.toLowerCase()) {
      return replacement.toUpperCase();
    }
    if (original[0] && original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
      return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
  }

  /** Create a thesaurus from parsed thesaurus.json data. */
  function create(data) {
    const { senses, words } = data;
    const has = (w) => Object.prototype.hasOwnProperty.call(words, w);

    function sensesOf(word) {
      return words[word].map((entry) => {
        const [id, ...antonyms] = Array.isArray(entry) ? entry : [entry];
        const [pos, definition, members, similar = []] = senses[id];
        const seen = new Set([word]);
        const synonyms = [];
        for (const w of [...members, ...similar]) {
          const key = w.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            synonyms.push(w);
          }
        }
        return {
          pos,
          partOfSpeech: POS_LABELS[pos],
          definition,
          synonyms: synonyms.slice(0, MAX_SYNONYMS),
          antonyms,
        };
      });
    }

    /**
     * Look up `query`. Returns null when nothing is found, otherwise
     * { query, matches: [{ word, senses: [{ pos, partOfSpeech, definition, synonyms, antonyms }] }] }.
     * `matches` holds the word itself (if listed) and its dictionary form, e.g.
     * "ran" -> [run], "said" -> [said, say], "bigger" -> [bigger, big].
     */
    function lookup(query) {
      const q = String(query || "").normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
      if (!q) return null;
      const found = [];
      if (has(q)) found.push(q);
      const base = baseForms(q).find((w) => w !== q && has(w));
      if (base) found.push(base);
      if (!found.length) return null;
      return { query: q, matches: found.map((word) => ({ word, senses: sensesOf(word) })) };
    }

    return { lookup, size: Object.keys(words).length };
  }

  return { create, baseForms, matchCase, POS_LABELS };
});
