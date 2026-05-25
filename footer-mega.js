(function () {
  var ru = {
    colPages: "Страницы",
    colCommunicate: "Связь",
    colAccount: "Аккаунт",
    home: "Главная",
    products: "Продукты",
    privacy: "Политика конфиденциальности",
    terms: "Условия использования",
    vk: "VK",
    discord: "Discord",
    telegram: "Telegram",
    signIn: "Войти",
    signUp: "Регистрация",
    tag1: "Всё лучшее — с нами!",
    tag2: "Присоединяйся быстро!",
    feedback: "Обратная связь:",
    rights: "Все права защищены",
  };
  var en = {
    colPages: "Pages",
    colCommunicate: "Communicate",
    colAccount: "Account Data",
    home: "Home",
    products: "Products",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    vk: "VK",
    discord: "Discord",
    telegram: "Telegram",
    signIn: "Sign In",
    signUp: "Sign Up",
    tag1: "All the best is with us!",
    tag2: "Quickly join us!",
    feedback: "Feedback:",
    rights: "All Rights Reserved",
  };

  function pickStrings(container) {
    var override = container && container.getAttribute("data-footer-lang");
    if (override === "en") return en;
    if (override === "ru") return ru;
    return localStorage.getItem("inprotect-lang") === "en" ? en : ru;
  }

  function render(container) {
    if (!container) return;
    var t = pickStrings(container);
    var isEn = t === en;
    var index = "index.html";
    var privacy = isEn ? "privacy-en.html" : "privacy-ru.html";
    var terms = isEn ? "terms-en.html" : "terms-ru.html";
    container.innerHTML =
      '<div class="footer-mega-cols">' +
      '<div class="footer-mega-col"><h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' +
      t.colPages +
      "</h3><ul>" +
      '<li><a href="' +
      index +
      '#home">' +
      t.home +
      "</a></li>" +
      '<li><a href="' +
      index +
      '#learn">' +
      t.products +
      "</a></li>" +
      '<li><a href="' +
      privacy +
      '">' +
      t.privacy +
      "</a></li>" +
      '<li><a href="' +
      terms +
      '">' +
      t.terms +
      "</a></li></ul></div>" +
      '<div class="footer-mega-col"><h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
      t.colCommunicate +
      "</h3><ul>" +
      '<li><a href="https://vk.com" target="_blank" rel="noopener noreferrer">' +
      t.vk +
      "</a></li>" +
      '<li><a href="https://discord.com" target="_blank" rel="noopener noreferrer">' +
      t.discord +
      "</a></li>" +
      '<li><a href="https://telegram.org" target="_blank" rel="noopener noreferrer">' +
      t.telegram +
      "</a></li></ul></div>" +
      '<div class="footer-mega-col"><h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
      t.colAccount +
      "</h3><ul>" +
      '<li><a href="login.html">' +
      t.signIn +
      "</a></li>" +
      '<li><a href="register.html">' +
      t.signUp +
      "</a></li></ul></div></div>" +
      '<div class="footer-mega-brand">' +
      '<div class="footer-mega-logo"><span class="logo-mark" style="color:var(--accent);display:flex"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 3L4 7v6c0 4.5 3 8.5 8 10 5-1.5 8-5.5 8-10V7l-8-4z" stroke="currentColor" stroke-width="1.75"/></svg></span>CorpseClient</div>' +
      '<div class="footer-mega-tag"><p>' +
      t.tag1 +
      "</p><p>" +
      t.tag2 +
      "</p></div></div>" +
      '<div class="footer-mega-bottom">' +
      "<span>" +
      t.feedback +
      ' <a class="mail" href="mailto:support@inprotect.app">support@inprotect.app</a></span>' +
      "<span>© CorpseClient, 2026 · " +
      t.rights +
      "</span></div>";
  }

  function init() {
    document.querySelectorAll("#mega-footer, .js-mega-footer").forEach(function (el) {
      render(el);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  var root = typeof window !== "undefined" ? window : globalThis;
  root.InProtectFooterMega = { render: render, init: init };
})();
