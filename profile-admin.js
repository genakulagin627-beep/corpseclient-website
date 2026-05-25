/**
 * Вкладка «Админ» в profile.html: тема сайта, лицензии, пользователи.
 * API: GET/PATCH /api/admin/site-theme, GET /api/site/theme, GET/POST /api/admin/keys,
 *      GET/PATCH/DELETE /api/admin/users… (см. server/server.js).
 */
(function () {
  var ROLES = ["user", "admin", "youtube", "beta"];
  var ROLE_LABELS = {
    user: "Пользователь",
    admin: "Админ",
    youtube: "Ютубер",
    beta: "Бета",
  };

  var USERS_PAGE = 50;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setLine(el, text, isErr) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("form-error", !!isErr);
  }

  function showOk(el, text) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("hidden", !text);
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(ctx, args);
      }, ms);
    };
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  window.InProtectInitProfileAdmin = function () {
    var A = window.InProtectAuth;
    if (!A || !A.getToken()) return;
    if (!A.isAdminUser || !A.isAdminUser()) return;
    if (window.__inprotectAdminInited) return;
    window.__inprotectAdminInited = true;

    function apiUrl(path) {
      var base = A.getApiBase ? A.getApiBase() : "";
      return base + path;
    }

    function afterApiProbe(fn) {
      var p = A.ensureApiBaseProbed ? A.ensureApiBaseProbed() : Promise.resolve();
      return p.then(fn);
    }

    function authHeaders() {
      var t = A.getToken();
      var h = { "Content-Type": "application/json" };
      if (t) h.Authorization = "Bearer " + t;
      return h;
    }

    function apiErrText(data) {
      var e = data && data.error;
      if (e === "bad_response" || e === "not_json") {
        return (
          "Сервер вернул не JSON (часто сайт открыт не с того порта, что Node). " +
          "Откройте страницу через сервер (например http://localhost:3000/profile.html) " +
          'или в консоли: INPROTECT_API="http://localhost:3000" и перезагрузка.'
        );
      }
      return e ? String(e) : "";
    }

    function fetchJson(url, options) {
      return fetch(url, options || {}).then(function (r) {
        return r.text().then(function (text) {
          var data = {};
          try {
            var trimmed = String(text || "").trim();
            if (trimmed.charCodeAt(0) === 0xfeff) trimmed = trimmed.slice(1);
            data = trimmed ? JSON.parse(trimmed) : {};
          } catch (e) {
            data = { error: "not_json", httpStatus: r.status };
          }
          return { ok: r.ok, status: r.status, data: data };
        });
      });
    }

    function recoverNotJson(promiseFactory, recovered) {
      return promiseFactory().then(function (res) {
        if (res.data && res.data.error === "not_json" && !recovered && A.resetApiRouting) {
          A.resetApiRouting();
          return recoverNotJson(promiseFactory, true);
        }
        return res;
      });
    }

    function adminJson(run) {
      return recoverNotJson(function () {
        return afterApiProbe(run);
      });
    }

    function handleAuth(res, errEl) {
      if (res.status === 401) {
        A.clearSession();
        window.location.replace("login.html");
        return true;
      }
      if (res.status === 403) {
        setLine(errEl, "Нет прав администратора.", true);
        return true;
      }
      return false;
    }

    function patchUser(uid, body) {
      return adminJson(function () {
        return fetchJson(apiUrl("/api/admin/users/" + uid), {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify(body || {}),
        });
      });
    }

    function deleteUser(uid) {
      return adminJson(function () {
        return fetchJson(apiUrl("/api/admin/users/" + uid), {
          method: "DELETE",
          headers: authHeaders(),
        });
      });
    }

    function errMsg(code) {
      var map = {
        last_admin: "Нельзя удалить или понизить последнего администратора.",
        last_admin_ban: "Нельзя забанить последнего администратора.",
        no_self_delete: "Нельзя удалить собственный аккаунт из списка.",
        uid_taken: "UID уже занят.",
        bad_subscription: "Неверный формат даты подписки (ДД.ММ.ГГГГ).",
        bad_new_uid: "Некорректный новый UID.",
        not_found: "Пользователь не найден.",
      };
      return map[code] || code || "Ошибка";
    }

    function setKeysResult(text) {
      var box = $("adm-keys-result");
      var pre = $("adm-keys-pre");
      if (!box || !pre) return;
      if (!text) {
        box.classList.add("hidden");
        pre.textContent = "";
        return;
      }
      pre.textContent = text;
      box.classList.remove("hidden");
    }

    function formatKeyDuration(k) {
      if (k && k.duration_label) {
        return String(k.duration_label);
      }
      var mins = k && k.duration_minutes != null ? parseInt(k.duration_minutes, 10) : 0;
      if (mins > 0) {
        var d = Math.floor(mins / 1440);
        var h = Math.floor((mins % 1440) / 60);
        var m = mins % 60;
        var p = [];
        if (d) {
          p.push(d + " д.");
        }
        if (h) {
          p.push(h + " ч.");
        }
        if (m) {
          p.push(m + " мин.");
        }
        return p.length ? p.join(" ") : mins + " мин.";
      }
      return k && k.duration_days != null ? String(k.duration_days) + " д." : "—";
    }

    function renderKeysRows(keys) {
      var tbody = $("adm-keys-tbody");
      if (!tbody) return;
      tbody.innerHTML = "";
      keys.forEach(function (k) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td><code>" +
          escapeHtml(k.code) +
          "</code></td><td>" +
          escapeHtml(formatKeyDuration(k)) +
          "</td><td>" +
          escapeHtml(k.created_at || "—") +
          "</td><td>" +
          escapeHtml(k.used_at || "—") +
          "</td><td>" +
          (k.used_by_uid != null ? escapeHtml(String(k.used_by_uid)) : "—") +
          "</td>";
        tbody.appendChild(tr);
      });
    }

    function renderUserRow(u) {
      var banned = !!u.banned;
      var role = String(u.role || "user").toLowerCase();
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        u.uid +
        "</td><td>" +
        escapeHtml(u.email) +
        "</td><td>" +
        escapeHtml(u.nickname || "—") +
        "</td><td class=\"adm-role-cell\"></td><td>" +
        escapeHtml(u.subscription_until || "—") +
        "</td><td>" +
        (u.hwid_linked ? "Да" : "Нет") +
        "</td><td>" +
        (banned ? "Да" : "Нет") +
        "</td><td class=\"adm-actions-cell\"></td>";

      var roleCell = tr.querySelector(".adm-role-cell");
      var sel = document.createElement("select");
      sel.className = "adm-role-select";
      ROLES.forEach(function (r) {
        var o = document.createElement("option");
        o.value = r;
        o.textContent = ROLE_LABELS[r] || r;
        if (r === role) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () {
        var nv = sel.value;
        patchUser(u.uid, { role: nv }).then(function (res) {
          if (!res.ok) {
            window.alert(errMsg(res.data && res.data.error));
            sel.value = role;
            return;
          }
          if (u.uid === A.getUser().uid) {
            A.refreshUser().then(function () {
              window.location.reload();
            });
          } else {
            loadUsers();
          }
        });
      });
      roleCell.appendChild(sel);

      var wrap = tr.querySelector(".adm-actions-cell");
      var toolbar = document.createElement("div");
      toolbar.className = "adm-action-toolbar";

      function btn(label, cls, onClick) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-ghost btn-sm" + (cls ? " " + cls : "");
        b.textContent = label;
        b.addEventListener("click", function (ev) {
          ev.preventDefault();
          onClick();
        });
        toolbar.appendChild(b);
      }

      btn("Снять подписку", "", function () {
        if (!window.confirm("Снять подписку с UID " + u.uid + "?")) return;
        patchUser(u.uid, { subscription_until: null }).then(function (res) {
          if (!res.ok) window.alert(errMsg(res.data && res.data.error));
          else loadUsers();
        });
      });

      btn("Дата подписки…", "", function () {
        var v = window.prompt("Дата ДД.ММ.ГГГГ или пусто для сброса:", u.subscription_until || "");
        if (v === null) return;
        v = v.trim();
        if (v !== "" && !/^\d{2}\.\d{2}\.\d{4}$/.test(v)) {
          window.alert("Формат ДД.ММ.ГГГГ");
          return;
        }
        patchUser(u.uid, { subscription_until: v === "" ? null : v }).then(function (res) {
          if (!res.ok) window.alert(errMsg(res.data && res.data.error));
          else loadUsers();
        });
      });

      btn(banned ? "Разбан" : "Бан", "", function () {
        patchUser(u.uid, { banned: !banned }).then(function (res) {
          if (!res.ok) window.alert(errMsg(res.data && res.data.error));
          else loadUsers();
        });
      });

      btn("Сменить UID…", "", function () {
        var v = window.prompt("Новый UID (1…100000):", String(u.uid));
        if (v === null) return;
        var n = parseInt(String(v).trim(), 10);
        if (!n || n < 1 || n > 100000) {
          window.alert("Некорректный UID.");
          return;
        }
        patchUser(u.uid, { new_uid: n }).then(function (res) {
          if (!res.ok) window.alert(errMsg(res.data && res.data.error));
          else {
            window.alert("UID изменён. Пользователю нужен повторный вход.");
            loadUsers();
          }
        });
      });

      btn("Сброс HWID", "", function () {
        if (!window.confirm("Сброс HWID для UID " + u.uid + "?")) return;
        patchUser(u.uid, { reset_hwid: true }).then(function (res) {
          if (!res.ok) window.alert(errMsg(res.data && res.data.error));
          else loadUsers();
        });
      });

      btn("Удалить", "adm-btn-danger", function () {
        if (!window.confirm("Удалить пользователя UID " + u.uid + "? Это необратимо.")) return;
        deleteUser(u.uid).then(function (res) {
          if (!res.ok) window.alert(errMsg(res.data && res.data.error));
          else loadUsers();
        });
      });

      wrap.appendChild(toolbar);

      return tr;
    }

    function loadKeys() {
      var errEl = $("adm-keys-err");
      setLine(errEl, "");
      var tbody = $("adm-keys-tbody");
      if (tbody) {
        tbody.innerHTML =
          "<tr><td colspan=\"5\" style=\"color:var(--muted);padding:0.75rem\">Загрузка…</td></tr>";
      }
      return adminJson(function () {
        return fetchJson(apiUrl("/api/admin/keys?limit=100"), { headers: authHeaders() });
      })
        .then(function (res) {
          if (handleAuth(res, errEl)) return;
          if (!res.ok) {
            setLine(errEl, apiErrText(res.data) || "Ошибка загрузки ключей", true);
            if (tbody) tbody.innerHTML = "";
            return;
          }
          renderKeysRows((res.data && res.data.keys) || []);
        })
        .catch(function () {
          setLine(errEl, "Нет связи с сервером.", true);
          if (tbody) tbody.innerHTML = "";
        });
    }

    function updatePagerMeta(total, off, usersLen) {
      var el = $("adm-users-range");
      if (!el) return;
      if (!total) {
        el.textContent = "—";
        return;
      }
      var from = off + (usersLen ? 1 : 0);
      var to = off + usersLen;
      el.textContent = usersLen ? from + "–" + to + " из " + total : "0 из " + total;
    }

    function loadUsers() {
      var searchEl = $("adm-users-search");
      var offEl = $("adm-users-offset");
      var errEl = $("adm-users-err");
      if (!searchEl || !offEl) return Promise.resolve();
      var q = searchEl.value.trim();
      var off = parseInt(offEl.value, 10) || 0;
      var url = apiUrl("/api/admin/users?limit=" + USERS_PAGE + "&offset=" + off);
      if (q) url += "&q=" + encodeURIComponent(q);
      setLine(errEl, "");
      var tbody = $("adm-users-tbody");
      if (tbody) {
        tbody.innerHTML =
          "<tr><td colspan=\"8\" style=\"color:var(--muted);padding:0.75rem\">Загрузка…</td></tr>";
      }
      return adminJson(function () {
        return fetchJson(url, { headers: authHeaders() });
      })
        .then(function (res) {
          if (handleAuth(res, errEl)) return;
          if (!res.ok) {
            setLine(errEl, apiErrText(res.data) || "Ошибка загрузки списка", true);
            if (tbody) tbody.innerHTML = "";
            return;
          }
          var total = res.data.total != null ? res.data.total : 0;
          var totalEl = $("adm-users-total");
          if (totalEl) totalEl.textContent = String(total);
          var users = res.data.users || [];
          if (!tbody) return;
          tbody.innerHTML = "";
          users.forEach(function (u) {
            tbody.appendChild(renderUserRow(u));
          });
          updatePagerMeta(total, off, users.length);
          var prev = $("adm-users-prev");
          var next = $("adm-users-next");
          if (prev) prev.disabled = off <= 0;
          if (next) next.disabled = off + users.length >= total;
        })
        .catch(function () {
          setLine(errEl, "Нет связи с сервером.", true);
          if (tbody) tbody.innerHTML = "";
        });
    }

    function loadTheme() {
      var errEl = $("adm-theme-err");
      var okEl = $("adm-theme-ok");
      setLine(errEl, "");
      showOk(okEl, "");
      return adminJson(function () {
        return fetchJson(apiUrl("/api/site/theme"), { credentials: "omit" });
      })
        .then(function (res) {
          if (!res.ok) {
            setLine(errEl, apiErrText(res.data) || "Не удалось загрузить тему", true);
            return;
          }
          var d = $("adm-theme-dark");
          var l = $("adm-theme-light");
          var data = res.data || {};
          if (d && data.accent_dark) d.value = data.accent_dark;
          if (l && data.accent_light) l.value = data.accent_light;
        })
        .catch(function () {
          setLine(errEl, "Нет связи с сервером.", true);
        });
    }

    function refreshAll() {
      loadTheme();
      loadKeys();
      loadUsers();
    }

    function wire() {
      var searchEl = $("adm-users-search");
      var runSearch = debounce(function () {
        var o = $("adm-users-offset");
        if (o) o.value = "0";
        loadUsers();
      }, 420);

      if (searchEl) {
        searchEl.addEventListener("input", runSearch);
        searchEl.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            var o = $("adm-users-offset");
            if (o) o.value = "0";
            loadUsers();
          }
        });
      }

      var go = $("adm-users-search-btn");
      if (go) {
        go.addEventListener("click", function () {
          var o = $("adm-users-offset");
          if (o) o.value = "0";
          loadUsers();
        });
      }

      var prev = $("adm-users-prev");
      if (prev) {
        prev.addEventListener("click", function () {
          var o = $("adm-users-offset");
          if (!o) return;
          var off = parseInt(o.value, 10) || 0;
          o.value = String(Math.max(0, off - USERS_PAGE));
          loadUsers();
        });
      }
      var next = $("adm-users-next");
      if (next) {
        next.addEventListener("click", function () {
          var o = $("adm-users-offset");
          if (!o) return;
          var off = parseInt(o.value, 10) || 0;
          o.value = String(off + USERS_PAGE);
          loadUsers();
        });
      }

      var ra = $("adm-refresh-all");
      if (ra) ra.addEventListener("click", refreshAll);

      var kr = $("adm-key-reload");
      if (kr) kr.addEventListener("click", loadKeys);

      var kc = $("adm-key-create");
      if (kc) {
        kc.addEventListener("click", function () {
          var errEl = $("adm-keys-err");
          setLine(errEl, "");
          var days = parseInt(($("adm-key-days") && $("adm-key-days").value) || "0", 10);
          var hours = parseInt(($("adm-key-hours") && $("adm-key-hours").value) || "0", 10);
          var mins = parseInt(($("adm-key-mins") && $("adm-key-mins").value) || "0", 10);
          var count = parseInt(($("adm-key-count") && $("adm-key-count").value) || "0", 10);
          if (Number.isNaN(days) || days < 0 || days > 10000) {
            setLine(errEl, "Дни: 0…10000", true);
            return;
          }
          if (Number.isNaN(hours) || hours < 0 || hours > 8760) {
            setLine(errEl, "Часы: 0…8760", true);
            return;
          }
          if (Number.isNaN(mins) || mins < 0 || mins > 525600) {
            setLine(errEl, "Минуты: 0…525600", true);
            return;
          }
          var totalMin = days * 1440 + hours * 60 + mins;
          if (totalMin < 1) {
            setLine(errEl, "Укажите срок: сумма дней, часов и минут должна быть больше нуля.", true);
            return;
          }
          if (!count || count < 1 || count > 50) {
            setLine(errEl, "Количество: 1…50", true);
            return;
          }
          adminJson(function () {
            return fetchJson(apiUrl("/api/admin/keys"), {
              method: "POST",
              headers: authHeaders(),
              body: JSON.stringify({
                duration_days: days,
                duration_hours: hours,
                duration_minutes: mins,
                count: count,
              }),
            });
          })
            .then(function (res) {
              if (!res.ok) {
                setLine(errEl, apiErrText(res.data) || "Ошибка создания", true);
                return;
              }
              var list = (res.data && res.data.keys) || [];
              var text = list.length ? list.map(function (x) {
                return x.code;
              }).join("\n") : "";
              setKeysResult(text);
              loadKeys();
            })
            .catch(function () {
              setLine(errEl, "Нет связи с сервером.", true);
            });
        });
      }

      var copyBtn = $("adm-keys-copy");
      if (copyBtn) {
        copyBtn.addEventListener("click", function () {
          var pre = $("adm-keys-pre");
          var t = pre ? pre.textContent : "";
          if (!t) return;
          copyToClipboard(t).then(
            function () {
              copyBtn.textContent = "Скопировано";
              setTimeout(function () {
                copyBtn.textContent = "Копировать";
              }, 1600);
            },
            function () {
              window.alert("Не удалось скопировать — выделите текст вручную.");
            }
          );
        });
      }

      var ts = $("adm-theme-save");
      if (ts) {
        ts.addEventListener("click", function () {
          var errEl = $("adm-theme-err");
          var okEl = $("adm-theme-ok");
          setLine(errEl, "");
          showOk(okEl, "");
          var darkEl = $("adm-theme-dark");
          var lightEl = $("adm-theme-light");
          adminJson(function () {
            return fetchJson(apiUrl("/api/admin/site-theme"), {
              method: "PATCH",
              headers: authHeaders(),
              body: JSON.stringify({
                accent_dark: darkEl ? darkEl.value : "",
                accent_light: lightEl ? lightEl.value : "",
              }),
            });
          })
            .then(function (res) {
              if (handleAuth(res, errEl)) return;
              if (!res.ok) {
                var hint = res.data && res.data.hint ? " " + res.data.hint : "";
                setLine(errEl, (apiErrText(res.data) || "Ошибка") + hint, true);
                return;
              }
              if (typeof window.InProtectReloadTheme === "function") {
                window.InProtectReloadTheme();
              }
              showOk(okEl, "Сохранено. У гостей цвет обновится при следующей загрузке страницы.");
            })
            .catch(function () {
              setLine(errEl, "Нет связи с сервером.", true);
            });
        });
      }
    }

    wire();

    document.querySelectorAll(".profile-tab").forEach(function (t) {
      t.addEventListener("click", function () {
        if (t.getAttribute("data-tab") === "admin") refreshAll();
      });
    });

    if (window.location.hash === "#admin") {
      document.querySelectorAll(".profile-tab").forEach(function (x) {
        x.classList.toggle("is-active", x.getAttribute("data-tab") === "admin");
      });
      document.querySelectorAll(".profile-panel").forEach(function (p) {
        p.classList.toggle("is-visible", p.getAttribute("data-panel") === "admin");
      });
      refreshAll();
    }
  };
})();
