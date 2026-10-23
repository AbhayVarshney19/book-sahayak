(() => {
  const storageKey = "bookSahayakTheme";

  function applySavedTheme() {
    let isDark = false;
    try {
      isDark = localStorage.getItem(storageKey) === "dark";
    } catch (_) {}

    const body = document.body;
    if (!body) return;

    body.classList.toggle("dark-mode", isDark);
    if (body.classList.contains("chat-page")) {
      body.classList.toggle("light-theme", !isDark);
    }
  }

  applySavedTheme();
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey || event.key === null) applySavedTheme();
  });
})();