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
