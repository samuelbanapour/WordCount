# Word Count

Count words, characters, sentences and paragraphs. Use it as a **website**, install it as an **app** (desktop or phone), or run it from the **command line**.

Counting follows the Unicode standard, [UAX #29: Unicode Text Segmentation](https://www.unicode.org/reports/tr29/), so it works for any language:

| Statistic   | Unicode rule |
|-------------|--------------|
| Words       | Word boundaries, counting only word-like segments (letters, numbers, ideographs). Chinese, Japanese, Thai and other languages written without spaces are split into real words. |
| Characters  | Extended grapheme clusters, so `👨‍👩‍👧`, `🇺🇸` or `é` (even when typed as `e` + accent) each count as **one** character. |
| Sentences   | Sentence boundaries that contain at least one word. |
| Lines / paragraphs | All Unicode line terminators, including `U+2028` LINE SEPARATOR and `U+2029` PARAGRAPH SEPARATOR. |

Text is normalized to NFC first, so composed and decomposed forms of the same word are treated as equal. Under UAX #29, contractions (`don't`) and numbers (`2.5`, `1,000`) are one word, and hyphenated words (`well-known`) are two.

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
npm install -g . && wordcount essay.txt  # install the `wordcount` command
```

## Use as a library

```js
const { countWords, analyze } = require("./src/wordcount.js");
countWords("Hello, world!");   // 2
analyze("Hi there. Bye!");     // { words: 3, characters: 14, sentences: 2, ... }
```

## Tests

```sh
npm test
```

Requires Node.js 18+. `Intl.Segmenter` is used where available (all modern browsers and Node). Older environments fall back to Unicode property regexes.
