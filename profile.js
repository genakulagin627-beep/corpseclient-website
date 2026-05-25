(function () {
  window.__inprotectAdminInited = false;

  var A = window.InProtectAuth;
  if (!A || !A.getToken()) {
    window.location.replace("login.html");
    return;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function formatDateForProfile(value, lang) {
    if (!value) return lang === "en" ? "None" : "Нет";
    var raw = String(value);
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) return raw;
    var d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString(lang === "en" ? "en-GB" : "ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  var ROLE_LABELS = {
    user: "Пользователь",
    admin: "Администратор",
    youtube: "Ютубер",
    beta: "Бета",
  };

  function syncAdminTabVisibility() {
    var show = A.isAdminUser && A.isAdminUser();
    document.querySelectorAll(".js-admin-only").forEach(function (el) {
      el.classList.toggle("hidden", !show);
    });
  }

  function afterUserLoadedFromServer() {
    fill();
    syncAdminTabVisibility();
    if (window.location.hash === "#admin" && !(A.isAdminUser && A.isAdminUser())) {
      try {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch (eH) {}
    }
    if (typeof window.InProtectInitProfileAdmin === "function") {
      window.InProtectInitProfileAdmin();
    }
  }

  function showProfileLoading() {
    if ($("profile-line")) $("profile-line").textContent = "Загрузка…";
    if ($("profile-role")) $("profile-role").textContent = "…";
    if ($("sub-till")) $("sub-till").textContent = "…";
    if ($("acc-email")) $("acc-email").textContent = "…";
    if ($("acc-reg")) $("acc-reg").textContent = "…";
    if ($("acc-hwid")) $("acc-hwid").textContent = "…";
    if ($("avatar-img")) $("avatar-img").classList.add("hidden");
    if ($("avatar-letter")) $("avatar-letter").classList.remove("hidden");
    document.querySelectorAll(".js-admin-only").forEach(function (el) {
      el.classList.add("hidden");
    });
  }

  function fill() {
    var u = A.getUser();
    if (!u) return;
    var uid = u.uid != null ? u.uid : "—";
    var line = u.displayName + " (" + uid + ")";
    $("profile-line").textContent = line;
    var r = A.isAdminUser && A.isAdminUser() ? "admin" : String(u.role || "user").toLowerCase();
    if ($("profile-role")) {
      $("profile-role").textContent = ROLE_LABELS[r] || ROLE_LABELS.user;
    }
    var lang = localStorage.getItem("inprotect-lang") === "en" ? "en" : "ru";
    $("sub-till").textContent = formatDateForProfile(u.subscriptionTill, lang);
    $("acc-email").textContent = u.email || "—";
    $("acc-reg").textContent = formatDateForProfile(u.registeredAt, lang);
    $("acc-hwid").textContent = u.hwid || "—";
    $("friends-count").textContent = String(u.friends != null ? u.friends : 0);
    $("friends-count-2").textContent = String(u.friends != null ? u.friends : 0);
    $("friends-count-3").textContent = String(u.friends != null ? u.friends : 0);
    $("friends-count-4").textContent = String(u.friends != null ? u.friends : 0);
    var pref = u.prefixes != null ? u.prefixes : "—";
    $("pref-val").textContent = pref;
    $("pref-val-2").textContent = pref;
    $("pref-val-3").textContent = pref;
    $("pref-val-4").textContent = pref;

    var letter = (u.displayName || u.email || "?").charAt(0).toUpperCase();
    if ($("avatar-letter")) $("avatar-letter").textContent = letter;
    if ($("avatar-img")) {
      var avatarUrl = u.avatar_url ? String(u.avatar_url) : "";
      if (avatarUrl) {
        $("avatar-img").src = avatarUrl;
        $("avatar-img").classList.remove("hidden");
        $("avatar-letter").classList.add("hidden");
      } else {
        $("avatar-img").classList.add("hidden");
        $("avatar-letter").classList.remove("hidden");
      }
    }
  }

  document.querySelectorAll(".profile-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var name = tab.getAttribute("data-tab");
      document.querySelectorAll(".profile-tab").forEach(function (t) {
        t.classList.toggle("is-active", t === tab);
      });
      document.querySelectorAll(".profile-panel").forEach(function (p) {
        p.classList.toggle("is-visible", p.getAttribute("data-panel") === name);
      });
    });
  });

  var redeemMsg = {
    key_invalid: "Ключ не найден.",
    key_used: "Ключ уже был активирован.",
    no_code: "Введите ключ.",
    bad_duration: "Ошибка данных ключа на сервере.",
    banned: "Аккаунт заблокирован.",
    unauthorized: "Сессия истекла — войдите снова.",
    network: "Нет связи с сервером. Откройте сайт через http://localhost:3000",
    unknown: "Не удалось активировать ключ.",
  };

  $("btn-activate").addEventListener("click", function () {
    var key = ($("license-key") && $("license-key").value.trim()) || "";
    if (!key) {
      alert("Введите ключ.");
      return;
    }
    A.redeemLicenseKey(key).then(function (r) {
      if (!r.ok) {
        alert(redeemMsg[r.error] || redeemMsg.unknown);
        if (r.error === "unauthorized" || r.error === "banned") {
          window.location.replace("login.html");
        }
        return;
      }
      $("license-key").value = "";
      fill();
      var extMsg =
        r.extended_label ||
        (r.extended_days != null ? r.extended_days + " дн." : r.extended_minutes != null ? r.extended_minutes + " мин." : "?");
      alert("Подписка продлена: " + extMsg + ".");
    });
  });

  $("btn-roulette").addEventListener("click", function () {
    alert("Демо: рулетка скоро будет доступна.");
  });

  $("btn-download").addEventListener("click", function () {
    A.getLauncherDownloadLink().then(function (r) {
      if (!r.ok) {
        if (r.error === "no_subscription") {
          alert("Скачивание доступно только при активной подписке.");
          return;
        }
        if (r.error === "unauthorized") {
          alert("Сессия истекла — войдите снова.");
          window.location.replace("login.html");
          return;
        }
        if (r.error === "download_unconfigured") {
          alert("Ссылка на лаунчер не настроена на сервере.");
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
      window.location.href = href;
    });
  });

  $("friend-send").addEventListener("click", function () {
    var name = ($("friend-name") && $("friend-name").value.trim()) || "";
    if (!name) {
      alert("Введите ник друга.");
      return;
    }
    alert("Демо: заявка отправлена пользователю «" + name + "».");
    $("friend-name").value = "";
  });

  function emailCheckerMsg(code) {
    var m = {
      exists: "Этот e-mail уже занят.",
      email: "Домен почты не из списка разрешённых.",
      email_invalid: "Некорректный формат e-mail.",
      email_domain: "Домен не принимает почту (DNS).",
      email_disposable: "Одноразовые адреса запрещены (Emails Checker).",
      email_undeliverable: "Почта помечена как недоставляемая (Emails Checker).",
      email_risky: "Почта помечена как рискованная (Emails Checker).",
      email_api: "Сервис проверки почты недоступен. Попробуйте позже.",
      email_api_key: "Неверный ключ Emails Checker на сервере.",
      email_checker_unconfigured:
        "Проверка почты на сервере не настроена (EMAILS_CHECKER_ACCESS_KEY или SKIP_EMAILS_CHECKER=1 для dev).",
      email_api_credits: "Закончились кредиты Emails Checker.",
      email_api_rate: "Лимит запросов Emails Checker. Подождите минуту.",
      email_api_timeout: "Таймаут проверки почты. Попробуйте снова.",
      network: "Нет связи с сервером.",
      unknown: "Не удалось сменить e-mail.",
    };
    return m[code] || m.unknown;
  }

  $("email-change").addEventListener("click", function () {
    var em = ($("personal-email") && $("personal-email").value.trim()) || "";
    if (!A.isAllowedEmail(em)) {
      alert("Укажите корректную почту на разрешённом домене.");
      return;
    }
    A.updateProfile({ email: em.toLowerCase() }).then(function (r) {
      if (!r.ok) {
        alert(emailCheckerMsg(r.error));
        return;
      }
      fill();
      $("personal-email").value = "";
      alert("E-mail обновлён.");
    });
  });

  $("header-logout").addEventListener("click", function () {
    A.clearSession();
    window.location.href = "index.html";
  });

  function apiAuthHeaders() {
    var token = A.getToken ? A.getToken() : null;
    if (!token) return {};
    return { Authorization: "Bearer " + token };
  }

  function setAvatarErr(msg) {
    var el = $("avatar-err");
    if (!el) return;
    if (!msg) {
      el.textContent = "";
      el.classList.add("hidden");
      return;
    }
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  if ($("avatar-upload")) {
    $("avatar-upload").addEventListener("click", function () {
      var input = $("avatar-file");
      var file = input && input.files && input.files[0] ? input.files[0] : null;
      if (!file) {
        setAvatarErr("Выберите файл аватара.");
        return;
      }
      setAvatarErr("");
      var token = A.getToken && A.getToken();
      if (!token) {
        window.location.replace("login.html");
        return;
      }
      var formData = new FormData();
      formData.append("avatar", file);

      A.ensureApiBaseProbed()
        .then(function () {
          var base = A.getApiBase();
          return fetch(base + "/api/auth/avatar", {
            method: "POST",
            headers: apiAuthHeaders(),
            body: formData,
          });
        })
        .then(function (r) {
          return r.json().catch(function () {
            return {};
          }).then(function (j) {
            return { ok: r.ok, data: j };
          });
        })
        .then(function (res) {
          if (!res.ok) {
            setAvatarErr((res.data && res.data.error && String(res.data.error)) || "Ошибка загрузки.");
            return;
          }
          if (res.data && res.data.user) {
            A.setUser && A.setUser(res.data.user);
          }
          return A.refreshUser().then(function () {
            fill();
          });
        })
        .catch(function () {
          setAvatarErr("Нет связи с сервером.");
        });
    });
  }

  if ($("avatar-remove")) {
    $("avatar-remove").addEventListener("click", function () {
      setAvatarErr("");
      var token = A.getToken && A.getToken();
      if (!token) {
        window.location.replace("login.html");
        return;
      }
      A.ensureApiBaseProbed()
        .then(function () {
          var base = A.getApiBase();
          return fetch(base + "/api/auth/avatar", {
            method: "DELETE",
            headers: apiAuthHeaders(),
          });
        })
        .then(function (r) {
          return r.json().catch(function () {
            return {};
          }).then(function (j) {
            return { ok: r.ok, data: j };
          });
        })
        .then(function (res) {
          if (!res.ok) {
            setAvatarErr((res.data && res.data.error && String(res.data.error)) || "Ошибка удаления.");
            return;
          }
          if (res.data && res.data.user) {
            A.setUser && A.setUser(res.data.user);
          }
          return A.refreshUser().then(function () {
            fill();
          });
        })
        .catch(function () {
          setAvatarErr("Нет связи с сервером.");
        });
    });
  }

  showProfileLoading();
  A.refreshUser()
    .then(function () {
      afterUserLoadedFromServer();
    })
    .catch(function (err) {
      if (err && err.message === "banned") {
        alert("Аккаунт заблокирован.");
        A.clearSession();
        window.location.replace("login.html");
        return;
      }
      if (!A.getToken()) {
        window.location.replace("login.html");
      } else {
        fill();
        syncAdminTabVisibility();
        if (typeof window.InProtectInitProfileAdmin === "function") {
          window.InProtectInitProfileAdmin();
        }
      }
    });
})();
