(() => {
  let theme;
  try {
    theme = localStorage.getItem("theme");
  } catch {
    theme = null;
  }
  const dark =
    theme === "dark" ||
    (theme !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.add(dark ? "dark" : "light");
})();
