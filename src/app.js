(function () {
  "use strict";

  const STORAGE_KEY = "wordcount:text";
  const $ = (id) => document.getElementById(id);
  const textarea = $("text");
  const fmt = new Intl.NumberFormat();

  function setStatus(message) {
    $("status").textContent = message;
    clearTimeout(setStatus.timer);
    setStatus.timer = setTimeout(() => ($("status").textContent = ""), 2000);
  }

  function render() {
    const text = textarea.value;
    const s = WordCount.analyze(text);
    for (const key of ["words", "characters", "charactersNoSpaces", "emoji", "sentences", "paragraphs", "uniqueWords"]) {
      $(key).textContent = fmt.format(s[key]);
    }
    $("readingTime").textContent = s.readingTimeMinutes + " min";

    const list = $("topWords");
    list.replaceChildren(
      ...s.topWords.map(({ word, count }) => {
        const li = document.createElement("li");
        const c = document.createElement("span");
        c.className = "count";
        c.textContent = " × " + count;
        li.append(word, c);
        return li;
      })
    );

    try { localStorage.setItem(STORAGE_KEY, text); } catch (_) { /* storage unavailable */ }
  }

  try { textarea.value = localStorage.getItem(STORAGE_KEY) || ""; } catch (_) { /* storage unavailable */ }
  textarea.addEventListener("input", render);

  $("clear").addEventListener("click", () => {
    textarea.value = "";
    render();
    textarea.focus();
  });

  $("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      setStatus("Copied");
    } catch (_) {
      setStatus("Copy not allowed");
    }
  });

  $("paste").addEventListener("click", async () => {
    try {
      const clip = await navigator.clipboard.readText();
      textarea.setRangeText(clip, textarea.selectionStart, textarea.selectionEnd, "end");
      render();
    } catch (_) {
      setStatus("Paste not allowed, use Ctrl/Cmd+V");
    }
  });

  $("file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    textarea.value = await file.text();
    render();
    setStatus("Loaded " + file.name);
    e.target.value = "";
  });

  // Thesaurus. The data (~1.6 MB compressed) is only downloaded the first time it's needed,
  // then the service worker keeps it for offline use.
  const results = $("thesaurus-results");
  let thesaurus = null; // Promise of the loaded thesaurus
  let thesaurusReady = false;
  let lookupToken = 0;
  let replaceRange = null; // { start, end, text } of the selected word the chips will replace

  function loadThesaurus() {
    thesaurus ||= fetch("thesaurus.json")
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then((data) => {
        thesaurusReady = true;
        return Thesaurus.create(data);
      })
      .catch((err) => {
        thesaurus = null;
        throw err;
      });
    return thesaurus;
  }

  /** The single word currently selected in the text, if any (ignoring surrounding spaces). */
  function selectedWord() {
    const { selectionStart: start, selectionEnd: end, value } = textarea;
    if (start === end) return null;
    const raw = value.slice(start, end);
    const text = raw.trim();
    const found = WordCount.words(text);
    if (found.length !== 1 || found[0] !== text) return null;
    const lead = raw.length - raw.trimStart().length;
    return { start: start + lead, end: start + lead + text.length, text };
  }

  function chip(word, className, title) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = className;
    b.textContent = word;
    b.title = title(word);
    b.addEventListener("click", () => useWord(word));
    return b;
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderResults(result, query) {
    if (!result) {
      results.replaceChildren(el("p", "empty", `No synonyms found for “${query}”.`));
      return;
    }
    const title = replaceRange
      ? (w) => `Replace “${replaceRange.text}” with “${Thesaurus.matchCase(w, replaceRange.text)}”`
      : (w) => `Copy “${w}”`;
    const nodes = [];
    for (const match of result.matches) {
      nodes.push(el("h3", null, match.word));
      for (const sense of match.senses) {
        const div = el("div", "sense");
        div.append(el("span", "pos", sense.partOfSpeech), el("span", "def", sense.definition));
        for (const [label, list, cls] of [["Synonyms", sense.synonyms, "chip"], ["Opposites", sense.antonyms, "chip antonym"]]) {
          if (!list.length) continue;
          const chips = el("div", "chips");
          chips.append(...list.map((w) => chip(w, cls, title)));
          div.append(el("span", "label", label), chips);
        }
        nodes.push(div);
      }
    }
    results.replaceChildren(...nodes);
    results.scrollTop = 0;
  }

  async function lookup(query, range) {
    const token = ++lookupToken;
    replaceRange = range || null;
    if (!query.trim()) return;
    if (!thesaurusReady) results.replaceChildren(el("p", "hint", "Loading thesaurus…"));
    try {
      const t = await loadThesaurus();
      if (token !== lookupToken) return; // a newer lookup started meanwhile
      renderResults(t.lookup(query), query.trim());
    } catch (_) {
      if (token === lookupToken) {
        results.replaceChildren(el("p", "empty", "Couldn't load the thesaurus. Check your connection and try again."));
      }
    }
  }

  /** Replace the selected word with `word` (matching its capitalization), or copy it. */
  async function useWord(word) {
    const r = replaceRange;
    if (r && textarea.value.slice(r.start, r.end) === r.text) {
      const replacement = Thesaurus.matchCase(word, r.text);
      textarea.setRangeText(replacement, r.start, r.end, "select");
      replaceRange = { start: r.start, end: r.start + replacement.length, text: replacement };
      render();
      setStatus(`Replaced “${r.text}” with “${replacement}”`);
      // Keep offering the same synonyms, now replacing the new word.
      results.querySelectorAll(".chip").forEach((c) => {
        c.title = `Replace “${replacement}” with “${Thesaurus.matchCase(c.textContent, replacement)}”`;
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(word);
      setStatus(`Copied “${word}”`);
    } catch (_) {
      setStatus("Copy not allowed");
    }
  }

  textarea.addEventListener("select", () => {
    const sel = selectedWord();
    if (!sel) return;
    const r = replaceRange;
    if (r && r.start === sel.start && r.end === sel.end && r.text === sel.text) return; // our own replacement
    $("lookup").value = sel.text;
    lookup(sel.text, sel);
  });

  $("lookup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    lookup($("lookup").value, null);
  });

  // Start downloading as soon as the user shows interest.
  $("lookup").addEventListener("focus", () => loadThesaurus().catch(() => {}), { once: true });

  // Installable app (PWA) support.
  let installPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt = e;
    $("install").hidden = false;
  });
  $("install").addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    $("install").hidden = true;
  });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  render();
})();
