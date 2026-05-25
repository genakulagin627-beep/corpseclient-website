(function () {
  const body = document.body;
  if (localStorage.getItem("inprotect-theme") === "light") body.classList.add("light");
  if (typeof window.InProtectApplyTheme === "function") {
    window.InProtectApplyTheme();
  }
  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      body.classList.toggle("light");
      localStorage.setItem("inprotect-theme", body.classList.contains("light") ? "light" : "dark");
      if (typeof window.InProtectApplyTheme === "function") {
        window.InProtectApplyTheme();
      }
    });
  }
  const burger = document.getElementById("nav-burger");
  const header = document.querySelector(".site-header");
  if (burger && header) {
    burger.addEventListener("click", function () {
      const o = header.classList.toggle("nav-open");
      burger.setAttribute("aria-expanded", o ? "true" : "false");
    });
    header.querySelectorAll(".nav-link").forEach(function (a) {
      a.addEventListener("click", function () {
        header.classList.remove("nav-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }
})();
