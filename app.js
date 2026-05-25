(function () {
  const STR = {
    ru: {
      navHome: "Главная",
      navProducts: "Продукты",
      navPrivacy: "Политика конфиденциальности",
      navTerms: "Условия использования",
      signIn: "Войти",
      signUp: "Регистрация",
      profile: "Профиль",
      chat: "Чат",
      signOut: "Выход",
      topBadge: "Твой лучший выбор!",
      topTitle: "Лучшее сочетание мощности и стабильности",
      topLead:
        "Покажем, как может выглядеть твой лаунчер и сайт: визуал, карточки и блоки — как у готового клиента. Один экран, без лишних переходов.",
      btnUse: "Использовать",
      btnDownloadLauncher: "Скачать лаунчер",
      launcherDlHint: "Нужна активная подписка. Войди в аккаунт, если кнопка скрыта.",
      btnContact: "Связаться",
      learnTitle: "Узнайте больше!",
      learnSub:
        "Наш клиент даёт удобные и мощные функции, чтобы сделать игру комфортнее — так это выглядит на превью лаунчера.",
      storeBadge: "Продукты",
      storeTitle: "Смотрите продукты!",
      storeLead:
        "Мы уверены, что вы не пожалеете о покупке — качественный продукт, который оправдывает ожидания.",
      storeSubsBtn: "Подписки",
      storeChosen: "Выбрали 5 000+ клиентов",
      storeName: "CorpseClient",
      storeFeat1: "25+ визуальных функций",
      storeFeat2: "Быстрый DLC",
      storeFeat3: "Поддержка 24/7",
      storeFeat4: "Частые обновления DLC",
      storePurchase: "Купить",
      storeHwidLabel: "Сброс HWID",
      storePeriod30: "/ 30 дней",
      storePeriod365: "/ 365 дней",
      storePeriod999: "/ 999 дней",
      price30: "289₽",
      price365: "459₽",
      price999: "579₽",
      priceHwid: "150₽",
      supportTitle: "Поддержка",
      chatU1: "Привет! Помогите, пожалуйста!",
      chatS1: "Конечно! Чем помочь?",
      chatU2: "Спасибо, вы очень быстрые!",
      supportFoot: "Помощь 24/7 при настройке и обновлениях — без лишней суеты.",
      combatTitle: "Бой",
      combatFoot: "Сильные модули движения и боя для PvP — всё в одной колонке.",
      featSpeed: "Speed",
      featSpeedD: "Автоматически ставит блок из руки.",
      featTotem: "AutoTotem",
      featTotemD: "Подготавливает хитбоксы сущностей.",
      featHit: "Hitboxes",
      featHitD: "Автоматически атакует цели рядом.",
      featAura: "KillAura",
      featAuraD: "Бьёт по цели, когда наводишь прицел.",
      featTrig: "TriggerBot",
      featTrigD: "Удар при наведении на сущность.",
      optTitle: "Оптимизация",
      optFoot: "Плавная работа и высокий FPS в Minecraft.",
      visTitle: "Визуализация",
      visFoot: "Сильный ESP и понятный интерфейс.",
      swordLbl: "Меч",
      statsPill: "Статистика",
      statsTitle: "Мы ведём статистику клиента.",
      statsLead: "Смотрите агрегированные цифры по пользователям, обновлениям и запускам — как на продакшене.",
      statUsersLbl: "Пользователи",
      statUsersDesc: "Статистика обновляется с запуском сервиса.",
      statUsersVal: "0",
      statUsersFoot: "Последний пользователь: —",
      statUpdLbl: "Обновления",
      statUpdDesc: "Счётчик обновлений клиента.",
      statUpdVal: "0",
      statUpdFoot: "Последнее обновление: —",
      statLaunchLbl: "Запуски",
      statLaunchDesc: "Количество запусков лаунчера.",
      statLaunchVal: "0",
      statLaunchFoot: "Запусков сегодня: 0",
      contactLine: "Контакты для связи добавь сюда — почта или Discord.",
      privacyIndexTeaser: "Краткое резюме: мы не продаём персональные данные; подробности, цели и сроки — в отдельном документе.",
      termsIndexTeaser: "Условия сервиса, ответственность, Minecraft EULA и допустимое поведение — в отдельном документе.",
      readPrivacyLink: "Открыть политику конфиденциальности (полный текст)",
      readTermsLink: "Открыть условия использования (полный текст)",
      toTop: "Наверх",
    },
    en: {
      navHome: "Home",
      navProducts: "Products",
      navPrivacy: "Privacy Policy",
      navTerms: "Terms of Service",
      signIn: "Sign In",
      signUp: "Sign Up",
      profile: "Profile",
      chat: "Chat",
      signOut: "Sign out",
      topBadge: "Your Best Choice!",
      topTitle: "The best solution among all power, stability",
      topLead:
        "See how your launcher and site could look: visuals, cards, and blocks like a finished client. One page, no extra hops.",
      btnUse: "Use",
      btnDownloadLauncher: "Download launcher",
      launcherDlHint: "Active subscription required. Sign in if the button is hidden.",
      btnContact: "Contact",
      learnTitle: "Learn more!",
      learnSub: "Our client offers convenient and powerful features to enhance your gameplay.",
      storeBadge: "Products",
      storeTitle: "Browse the products!",
      storeLead:
        "We assure you that you will not regret what our client bought — It's a high-quality product that exceeds.",
      storeSubsBtn: "Subscriptions",
      storeChosen: "Chosen by 5,000 customers",
      storeName: "CorpseClient",
      storeFeat1: "25+ visual features",
      storeFeat2: "Fast-acting DLC",
      storeFeat3: "24/7 user support",
      storeFeat4: "Frequent DLC updates",
      storePurchase: "Purchase",
      storeHwidLabel: "Reset HWID",
      storePeriod30: "/ 30 days",
      storePeriod365: "/ 365 days",
      storePeriod999: "/ 999 days",
      price30: "$3.99",
      price365: "$5.99",
      price999: "$7.99",
      priceHwid: "$1.99",
      supportTitle: "Support",
      chatU1: "Hey! Please help me!",
      chatS1: "Of course! How can I help you?",
      chatU2: "Tyvm! This was quick!",
      supportFoot: "24/7 help with setup and updates — smooth and straightforward.",
      combatTitle: "Combat",
      combatFoot: "Powerful movement and combat modules for PvP — all in one column.",
      featSpeed: "Speed",
      featSpeedD: "Automatically places a block in your hand.",
      featTotem: "AutoTotem",
      featTotemD: "Prepares entity hitboxes for combat.",
      featHit: "Hitboxes",
      featHitD: "Automatically targets and attacks nearby enemies.",
      featAura: "KillAura",
      featAuraD: "Attacks automatically when you aim at a target.",
      featTrig: "TriggerBot",
      featTrigD: "Hits when your crosshair is on an entity.",
      optTitle: "Optimization",
      optFoot: "Smooth performance and high FPS in Minecraft.",
      visTitle: "Visualization",
      visFoot: "Top-notch ESP and a clean, functional UI.",
      swordLbl: "Sword",
      statsPill: "Statistics",
      statsTitle: "We track client statistics.",
      statsLead: "View detailed, real-time statistics on users, updates, launches, and more.",
      statUsersLbl: "Users",
      statUsersDesc: "Statistics will update as the service grows.",
      statUsersVal: "0",
      statUsersFoot: "Last user: —",
      statUpdLbl: "Updates",
      statUpdDesc: "Client update counter.",
      statUpdVal: "0",
      statUpdFoot: "Recent update: —",
      statLaunchLbl: "Launches",
      statLaunchDesc: "Launcher session count.",
      statLaunchVal: "0",
      statLaunchFoot: "Today’s launches: 0",
      contactLine: "Add your contact here — email or Discord.",
      privacyIndexTeaser: "In short: we don’t sell personal data; purposes, retention, and rights are explained in the full policy.",
      termsIndexTeaser: "Service rules, liability, Minecraft EULA alignment, and acceptable use — in the full terms.",
      readPrivacyLink: "Open the full Privacy Policy",
      readTermsLink: "Open the full Terms of Service",
      toTop: "Back to top",
    },
  };

  let lang = localStorage.getItem("inprotect-lang") || "ru";
  const body = document.body;
  const html = document.documentElement;
  const header = document.querySelector(".site-header");
  const burger = document.getElementById("nav-burger");
  const themeBtn = document.getElementById("theme-toggle");

  function applyLang() {
    const t = STR[lang] || STR.ru;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      const k = el.getAttribute("data-i18n");
      if (k && t[k] != null) el.textContent = t[k];
    });
    html.setAttribute("lang", lang === "en" ? "en" : "ru");
    document.querySelectorAll(".lang-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-lang") === lang);
    });
    const lp = document.getElementById("link-privacy");
    const lt = document.getElementById("link-terms");
    const idp = document.getElementById("idx-privacy-doc");
    const idt = document.getElementById("idx-terms-doc");
    const pPath = lang === "en" ? "privacy-en.html" : "privacy-ru.html";
    const tPath = lang === "en" ? "terms-en.html" : "terms-ru.html";
    if (lp) lp.setAttribute("href", pPath);
    if (lt) lt.setAttribute("href", tPath);
    if (idp) idp.setAttribute("href", pPath);
    if (idt) idt.setAttribute("href", tPath);
    localStorage.setItem("inprotect-lang", lang);
    var mega = document.getElementById("mega-footer");
    if (mega && window.InProtectFooterMega && typeof window.InProtectFooterMega.render === "function") {
      window.InProtectFooterMega.render(mega);
    }
  }

  function downloadLauncherFromSite() {
    var A = window.InProtectAuth;
    if (!A || !A.isLoggedIn()) {
      window.location.href = "login.html";
      return;
    }
    A.getLauncherDownloadLink().then(function (r) {
      if (!r.ok) {
        if (r.error === "no_subscription") {
          alert("Скачивание лаунчера доступно только с активной подпиской.");
          return;
        }
        if (r.error === "unauthorized") {
          window.location.replace("login.html");
          return;
        }
        if (r.error === "download_unconfigured") {
          alert("Файл лаунчера ещё не выложен на сервер. Собери exe: cd lan && npm run dist");
          return;
        }
        alert("Не удалось получить ссылку на лаунчер.");
        return;
      }
      var href = String(r.url || "").trim();
      if (!href) {
        alert("Ссылка на лаунчер пустая.");
        return;
      }
      if (!/^https?:\/\//i.test(href) && A.apiUrl) {
        href = A.apiUrl(href);
      }
      window.location.href = href;
    });
  }

  function applyAuthHeader() {
    var guest = document.getElementById("header-auth-guest");
    var user = document.getElementById("header-auth-user");
    var logout = document.getElementById("header-logout");
    var dlBtn = document.getElementById("btn-download-launcher");
    var dlHint = document.getElementById("launcher-dl-hint");
    if (!guest || !user) return;
    var logged = window.InProtectAuth && window.InProtectAuth.isLoggedIn();
    guest.classList.toggle("header-auth--hidden", logged);
    user.classList.toggle("header-auth--hidden", !logged);
    user.setAttribute("aria-hidden", logged ? "false" : "true");
    if (dlBtn) dlBtn.hidden = !logged;
    if (dlHint) dlHint.hidden = logged;
    if (logout && !logout._bound) {
      logout._bound = true;
      logout.addEventListener("click", function () {
        if (window.InProtectAuth) window.InProtectAuth.clearSession();
        applyAuthHeader();
      });
    }
  }

  var dlBtnMain = document.getElementById("btn-download-launcher");
  if (dlBtnMain && !dlBtnMain._bound) {
    dlBtnMain._bound = true;
    dlBtnMain.addEventListener("click", downloadLauncherFromSite);
  }

  applyLang();
  applyAuthHeader();
  if (window.InProtectAuth && typeof window.InProtectAuth.refreshUser === "function") {
    window.InProtectAuth.refreshUser().then(function () {
      applyAuthHeader();
    }).catch(function () {
      applyAuthHeader();
    });
  }

  document.querySelectorAll(".lang-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      lang = btn.getAttribute("data-lang") || "ru";
      applyLang();
    });
  });

  if (localStorage.getItem("inprotect-theme") === "light") body.classList.add("light");
  if (typeof window.InProtectApplyTheme === "function") {
    window.InProtectApplyTheme();
  }

  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      body.classList.toggle("light");
      localStorage.setItem("inprotect-theme", body.classList.contains("light") ? "light" : "dark");
      if (typeof window.InProtectApplyTheme === "function") {
        window.InProtectApplyTheme();
      }
    });
  }

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

  document.querySelectorAll(".tog").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const on = btn.classList.toggle("on");
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  });
})();
