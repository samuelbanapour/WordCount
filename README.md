# Word Count

Count words, characters, sentences and paragraphs, and find better words with the built-in **thesaurus**. Use it as a **website**, install it as an **app** (desktop or phone), or run it from the **command line**.

Counting follows the Unicode standard, [UAX #29: Unicode Text Segmentation](https://www.unicode.org/reports/tr29/), so it works for any language:

| Statistic   | Unicode rule |
|-------------|--------------|
| Words       | Word boundaries, counting only word-like segments (letters, numbers, ideographs). Chinese, Japanese, Thai and other languages written without spaces are split into real words. **Emoji are never words**, including keycaps like `1️⃣` and letter emoji like `🅰️`. |
| Characters  | Extended grapheme clusters, so `👨‍👩‍👧`, `🇺🇸` or `é` (even when typed as `e` + accent) each count as **one** character. |
| Emoji       | Grapheme clusters containing an `Extended_Pictographic` character, a flag (regional indicators), a keycap (`U+20E3`) or the emoji presentation selector (`U+FE0F`). Each emoji counts as one character. |
| Sentences   | Sentence boundaries that contain at least one word. |
| Lines / paragraphs | All Unicode line terminators, including `U+2028` LINE SEPARATOR and `U+2029` PARAGRAPH SEPARATOR. |

Text is normalized to NFC first, so composed and decomposed forms of the same word are treated as equal. Under UAX #29, contractions (`don't`) and numbers (`2.5`, `1,000`) are one word, and hyphenated words (`well-known`) are two.

## Thesaurus

Select a word in your text (double-click it) and the thesaurus panel shows its meanings, most common first, each with a short definition, **synonyms** and **opposites**. Click a synonym to replace the selected word (capitalization is kept: `Happy` → `Cheerful`), or keep clicking to try others. You can also type any word into the search box; clicking a result then copies it.

- Inflected forms are understood: `ran` → *run*, `happier` → *happy*, `children` → *child*, `said` → *said* and *say*.
- 54,000+ words and phrases from [WordNet 3.1](https://wordnet.princeton.edu/) (Princeton University), stored in `src/thesaurus.json`.
- Fully offline and private: the data (about 1.6 MB compressed) downloads the first time you use the thesaurus and is then cached by the app. No word you look up is sent anywhere.

The data file is generated, not hand-edited. To rebuild it:

```sh
npm install
npm run build:thesaurus
```

WordNet license: [`src/WORDNET-LICENSE.txt`](src/WORDNET-LICENSE.txt).

## Web app

Everything is in [`src/`](src/) as plain HTML/CSS/JS, with no build step. You get live counts as you type, the most used words, reading time, opening a text file, and copy/paste/clear buttons. Your text stays on your device and is saved locally between visits.

Run it locally:

```sh
npm start            # or: cd src && python3 -m http.server
```

then open the printed URL (usually http://localhost:3000).

**Publishing:** the included workflow (`.github/workflows/pages.yml`) deploys `src/` to GitHub Pages on every push to `main`. Turn it on once under *Settings → Pages → Source: GitHub Actions*.

## Installable app

The site is a Progressive Web App. Open it in Chrome/Edge and click **Install app** (or the install icon in the address bar). On iPhone/iPad use *Share → Add to Home Screen*, and on Android use *Install app* from the browser menu. Once installed it runs in its own window and works offline.

## Command line

```sh
node bin/wordcount.js essay.txt          # one or more files
echo "Hello world" | node bin/wordcount.js
node bin/wordcount.js --json essay.txt   # machine-readable output
node bin/wordcount.js --thesaurus happy  # synonyms and opposites (-t for short)
npm install -g . && wordcount essay.txt  # install the `wordcount` command
```

## Use as a library

```js
const { countWords, analyze } = require("./src/wordcount.js");
countWords("Hello, world!");   // 2
analyze("Hi there. Bye!");     // { words: 3, characters: 14, sentences: 2, ... }

const thesaurus = require("./src/thesaurus.js").create(require("./src/thesaurus.json"));
thesaurus.lookup("ran");       // { query: "ran", matches: [{ word: "run", senses: [{ partOfSpeech, definition, synonyms, antonyms }, ...] }] }
```

## Tests

```sh
npm test
```

Requires Node.js 18+. `Intl.Segmenter` is used where available (all modern browsers and Node). Older environments fall back to Unicode property regexes.
