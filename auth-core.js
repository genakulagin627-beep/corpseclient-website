(function (global) {
  var ALLOWED_EMAIL_DOMAINS = [
    "gmail.com",
    "googlemail.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "yahoo.com",
    "yahoo.co.uk",
    "icloud.com",
    "me.com",
    "mail.ru",
    "bk.ru",
    "inbox.ru",
    "list.ru",
    "yandex.ru",
    "yandex.com",
    "ya.ru",
    "protonmail.com",
    "proton.me",
    "rambler.ru",
    "gmx.com",
    "gmx.net",
    "msn.com",
    "inprotect.local",
    "corpseclient.local",
  ];

  var TOKEN_KEY = "inprotect_token";
  var USER_KEY = "inprotect_user";
  var SESSION_KEY = "inprotect_session";

  /** Всегда считаем админом на клиенте (обход кэша / старых данных в localStorage). */
  var CLIENT_ADMIN_UID_DEFAULT = 6;
  var CLIENT_ADMIN_EMAIL_DEFAULT = "inprotect.staff@gmail.com";

  function normalizeClientEmail(e) {
    return String(e || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function jwtPayloadUid() {
    try {
      var t = localStorage.getItem(TOKEN_KEY);
      if (!t || typeof t !== "string") return null;
      var parts = t.split(".");
      if (parts.length !== 3 || !parts[1]) return null;
      var b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      var pad = b64.length % 4;
      if (pad) b64 += new Array(5 - pad).join("=");
      var pl = JSON.parse(atob(b64));
      return pl.uid != null ? Number(pl.uid) : null;
    } catch (e) {
      return null;
    }
  }

  function isClientForcedAdminUser(u) {
    var uidFromJwt = jwtPayloadUid();
    var uid =
      uidFromJwt != null ? uidFromJwt : u && u.uid != null ? Number(u.uid) : null;
    if (uid === CLIENT_ADMIN_UID_DEFAULT) return true;
    if (Array.isArray(global.INPROTECT_CLIENT_ADMIN_UIDS)) {
      if (global.INPROTECT_CLIENT_ADMIN_UIDS.indexOf(uid) !== -1) return true;
    }
    var em = u ? normalizeClientEmail(u.email) : "";
    if (em && em === normalizeClientEmail(CLIENT_ADMIN_EMAIL_DEFAULT)) return true;
    if (global.INPROTECT_CLIENT_ADMIN_EMAIL) {
      if (em && em === normalizeClientEmail(global.INPROTECT_CLIENT_ADMIN_EMAIL)) return true;
    }
    return false;
  }

  function applyClientAdminOverride(u) {
    if (!u || typeof u !== "object") return u;
    if (!isClientForcedAdminUser(u)) return u;
    return Object.assign({}, u, { role: "admin" });
  }

  var LEARNED_API_KEY = "inprotect_api_base_url";
  var apiProbePromise = null;

  function getApiPort() {
    return (
      (window.INPROTECT_API_PORT && String(window.INPROTECT_API_PORT).replace(/[^\d]/g, "")) || "3000"
    );
  }

  function isLikelyLanIP(host) {
    var h = String(host || "");
    return (
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)
    );
  }

  function readLearnedApiBase() {
    try {
      if (typeof sessionStorage === "undefined") return null;
      var s = sessionStorage.getItem(LEARNED_API_KEY);
      if (s === null) return null;
      if (s === "same") return "";
      if (/^https?:\/\/.+/i.test(s)) return String(s).replace(/\/$/, "");
    } catch (e) {}
    return null;
  }

  function writeLearnedApiBase(base) {
    try {
      if (typeof sessionStorage === "undefined") return;
      if (base === "" || base == null) sessionStorage.setItem(LEARNED_API_KEY, "same");
      else sessionStorage.setItem(LEARNED_API_KEY, String(base).replace(/\/$/, ""));
    } catch (e) {}
  }

  function computeHeuristicApiBase() {
    if (typeof window === "undefined") return "";
    if (window.INPROTECT_FORCE_SAME_ORIGIN_API) return "";
    var host = window.location.hostname;
    var port = window.location.port;
    var proto = window.location.protocol;
    var loop = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    var lan = isLikelyLanIP(host);
    var apiPort = getApiPort();
    if ((proto === "file:" || !host) && apiPort) {
      return "http://127.0.0.1:" + apiPort;
    }
    if (loop && port && port !== apiPort) {
      return proto + "//" + host + ":" + apiPort;
    }
    if (lan && port && port !== apiPort) {
      return proto + "//" + host + ":" + apiPort;
    }
    if ((loop || lan) && !port && proto === "http:") {
      return "http://" + host + ":" + apiPort;
    }
    return "";
  }

  function getApiBase() {
    if (typeof window === "undefined") return "";
    if (window.INPROTECT_API) {
      return String(window.INPROTECT_API).replace(/\/$/, "");
    }
    try {
      var met = document.querySelector && document.querySelector('meta[name="inprotect-api-base"]');
      if (met) {
        var mc = met.getAttribute("content");
        if (mc && String(mc).trim()) {
          return String(mc).trim().replace(/\/$/, "");
        }
      }
    } catch (eMeta) {}
    var learned = readLearnedApiBase();
    if (learned !== null) {
      return learned;
    }
    if (window.location.protocol === "file:") {
      return "http://127.0.0.1:" + getApiPort();
    }
    return computeHeuristicApiBase();
  }

  function stripLeadingBom(s) {
    var t = String(s || "");
    if (t.charCodeAt(0) === 0xfeff) return t.slice(1);
    return t;
  }

  function themeJsonLooksValid(text) {
    try {
      var j = JSON.parse(stripLeadingBom(String(text || "").trim()));
      return j && typeof j.accent_dark === "string" && /^#/.test(j.accent_dark);
    } catch (e) {
      return false;
    }
  }

  function tryFetchThemeBase(base) {
    var url = (base || "") + "/api/site/theme";
    return fetch(url, { method: "GET", cache: "no-store", credentials: "omit" }).then(function (r) {
      return r.text().then(function (t) {
        return r.ok && themeJsonLooksValid(t);
      });
    });
  }

  function buildProbeCandidates() {
    var host = String(window.location.hostname || "");
    var proto = window.location.protocol;
    var apiPort = getApiPort();
    var loop = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    var lan = isLikelyLanIP(host);
    var list = [""];
    function push(u) {
      if (list.indexOf(u) === -1) list.push(u);
    }
    if (proto === "file:" || !host) {
      push("http://127.0.0.1:" + apiPort);
      push("http://localhost:" + apiPort);
    }
    if ((loop || lan) && (proto === "http:" || proto === "https:")) {
      push(proto + "//" + host + ":" + apiPort);
      if (proto === "http:") {
        if (host !== "127.0.0.1") push("http://127.0.0.1:" + apiPort);
        if (host !== "localhost") push("http://localhost:" + apiPort);
      }
    }
    var guess = computeHeuristicApiBase();
    if (guess) push(guess);
    return list;
  }

  function resetApiRouting() {
    try {
      sessionStorage.removeItem(LEARNED_API_KEY);
    } catch (eRm) {}
    apiProbePromise = null;
    try {
      delete window.INPROTECT_API;
    } catch (eDel) {
      try {
        window.INPROTECT_API = undefined;
      } catch (e2) {}
    }
  }

  function ensureApiBaseProbed() {
    if (typeof window === "undefined" || typeof fetch === "undefined") {
      return Promise.resolve();
    }
    if (window.INPROTECT_API) {
      var injected = String(window.INPROTECT_API).replace(/\/$/, "");
      return tryFetchThemeBase(injected)
        .then(function (ok) {
          if (ok) return Promise.resolve();
          resetApiRouting();
          return ensureApiBaseProbed();
        })
        .catch(function () {
          resetApiRouting();
          return ensureApiBaseProbed();
        });
    }
    if (readLearnedApiBase() !== null) return Promise.resolve();
    if (apiProbePromise) return apiProbePromise;
    apiProbePromise = new Promise(function (resolve) {
      var candidates = buildProbeCandidates();
      var i = 0;
      function next() {
        if (i >= candidates.length) {
          resolve();
          return;
        }
        var b = candidates[i++];
        tryFetchThemeBase(b).then(function (ok) {
          if (ok) {
            writeLearnedApiBase(b);
            resolve();
          } else {
            next();
          }
        }).catch(function () {
          next();
        });
      }
      next();
    });
    return apiProbePromise;
  }

  global.__inprotectEnsureApiBaseProbed = ensureApiBaseProbed;

  function normalizeDomain(domain) {
    return String(domain || "")
      .trim()
      .toLowerCase()
      .replace(/^@+/, "");
  }

  function isAllowedEmail(email) {
    var s = String(email || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    var at = s.lastIndexOf("@");
    if (at < 1 || at === s.length - 1) return false;
    var local = s.slice(0, at);
    var domain = normalizeDomain(s.slice(at + 1));
    if (local.length < 4 || local.length > 64) return false;
    if (local.startsWith(".") || local.endsWith(".") || local.indexOf("..") !== -1) return false;
    if (!/^[a-z0-9._+-]+$/i.test(local)) return false;
    if (domain.length < 3 || domain.indexOf("..") !== -1) return false;
    if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(domain)) return false;
    return ALLOWED_EMAIL_DOMAINS.indexOf(domain) !== -1;
  }

  function isValidNickname(nick) {
    var n = String(nick || "").trim();
    if (n.length < 3 || n.length > 16) return false;
    return /^[a-zA-Z0-9_]+$/.test(n);
  }

  function getToken() {
    try {
      var t = localStorage.getItem(TOKEN_KEY);
      if (!t || typeof t !== "string") return null;
      var parts = t.split(".");
      if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
        clearSession();
        return null;
      }
      return t;
    } catch (e) {
      return null;
    }
  }

  function setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function getUser() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      var u = JSON.parse(raw);
      return applyClientAdminOverride(u && typeof u === "object" ? u : null);
    } catch (e) {
      return null;
    }
  }

  function setUser(obj) {
    if (!obj || typeof obj !== "object") return;
    var u = applyClientAdminOverride(Object.assign({}, obj));
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    localStorage.setItem(SESSION_KEY, "1");
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    try {
      localStorage.removeItem("inprotect_accounts");
    } catch (e) {}
  }

  function isLoggedIn() {
    var raw = null;
    try {
      raw = localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return false;
    }
    if (!raw || typeof raw !== "string") return false;
    var parts = raw.split(".");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return false;
    if (localStorage.getItem(SESSION_KEY) !== "1") return false;
    var u = getUser();
    if (!u || typeof u.email !== "string" || u.uid == null) return false;
    return true;
  }

  function apiUrl(path) {
    var base = getApiBase();
    return base + path;
  }

  function authHeaders() {
    var t = getToken();
    var h = { "Content-Type": "application/json" };
    if (t) h.Authorization = "Bearer " + t;
    return h;
  }

  function parseResponseJson(r) {
    return r.text().then(function (t) {
      var j = {};
      try {
        j = t ? JSON.parse(t) : {};
      } catch (e) {
        j = {};
      }
      return { ok: r.ok, status: r.status, data: j };
    });
  }

  function refreshUser() {
    return ensureApiBaseProbed().then(function () {
      return fetch(apiUrl("/api/auth/me"), {
        headers: authHeaders(),
        cache: "no-store",
      });
    })
      .then(parseResponseJson)
      .then(function (res) {
        if (res.status === 401 || res.status === 403) {
          clearSession();
          throw new Error(res.status === 403 ? "banned" : "unauthorized");
        }
        if (!res.ok) throw new Error("server");
        var data = res.data;
        if (data && data.user) {
          setUser(data.user);
          return data.user;
        }
        throw new Error("me");
      });
  }

  function registerUser(nickname, email, password) {
    return ensureApiBaseProbed().then(function () {
      return fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname,
          email: email,
          password: password,
        }),
      });
    }).then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, status: r.status, data: j };
      });
    }).then(function (res) {
      if (!res.ok) {
        var err = res.data && res.data.error ? res.data.error : "unknown";
        return { error: err };
      }
      if (res.data.token && res.data.user) {
        setToken(res.data.token);
        setUser(res.data.user);
        return { user: res.data.user };
      }
      return { error: "unknown" };
    });
  }

  function loginUser(email, password) {
    return ensureApiBaseProbed().then(function () {
      return fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });
    })
      .then(parseResponseJson)
      .then(function (res) {
        if (!res.ok) {
          if (res.status === 403 && res.data && res.data.error === "banned") {
            return { error: "banned" };
          }
          return { error: "credentials" };
        }
        if (res.data.token && res.data.user) {
          setToken(res.data.token);
          setUser(res.data.user);
          return { user: res.data.user };
        }
        return { error: "credentials" };
      })
      .catch(function () {
        return { error: "network" };
      });
  }

  function redeemLicenseKey(code) {
    var c = String(code || "").trim();
    if (!c) return Promise.resolve({ ok: false, error: "no_code" });
    return ensureApiBaseProbed().then(function () {
      return fetch(apiUrl("/api/auth/redeem"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ code: c }),
      });
    })
      .then(parseResponseJson)
      .then(function (res) {
        if (res.status === 401) {
          clearSession();
          return { ok: false, error: "unauthorized" };
        }
        if (res.status === 403 && res.data && res.data.error === "banned") {
          clearSession();
          return { ok: false, error: "banned" };
        }
        if (res.ok && res.data && res.data.user) {
          setUser(res.data.user);
          return { ok: true, user: res.data.user, extended_days: res.data.extended_days };
        }
        return { ok: false, error: (res.data && res.data.error) || "unknown" };
      })
      .catch(function () {
        return { ok: false, error: "network" };
      });
  }

  function updateProfile(partial) {
    if (!partial || !partial.email) return Promise.resolve({ ok: false, error: "invalid" });
    var em = String(partial.email).trim().toLowerCase();
    if (!isAllowedEmail(em)) return Promise.resolve({ ok: false, error: "email" });
    return ensureApiBaseProbed().then(function () {
      return fetch(apiUrl("/api/auth/profile"), {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ email: em }),
      });
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, data: j };
        });
      })
      .then(function (res) {
        if (res.ok && res.data && res.data.user) {
          setUser(res.data.user);
          return { ok: true, user: res.data.user };
        }
        return { ok: false, error: (res.data && res.data.error) || "unknown" };
      })
      .catch(function () {
        return { ok: false, error: "network" };
      });
  }

  function getLauncherDownloadLink() {
    return ensureApiBaseProbed().then(function () {
      return fetch(apiUrl("/api/launcher/download-link"), {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
      });
    })
      .then(parseResponseJson)
      .then(function (res) {
        if (res.status === 401) {
          clearSession();
          return { ok: false, error: "unauthorized" };
        }
        if (res.status === 403 && res.data && res.data.error === "no_subscription") {
          return { ok: false, error: "no_subscription" };
        }
        if (res.ok && res.data && res.data.url) {
          return { ok: true, url: String(res.data.url) };
        }
        return { ok: false, error: (res.data && res.data.error) || "unknown" };
      })
      .catch(function () {
        return { ok: false, error: "network" };
      });
  }

  try {
    localStorage.removeItem("inprotect_accounts");
    if (localStorage.getItem(SESSION_KEY) === "1" && !localStorage.getItem(TOKEN_KEY)) {
      clearSession();
    }
  } catch (e) {}

  function isAdminUser() {
    var u = getUser();
    if (!u) return false;
    if (isClientForcedAdminUser(u)) return true;
    return String(u.role || "").toLowerCase() === "admin";
  }

  global.InProtectAuth = {
    isAllowedEmail: isAllowedEmail,
    isValidNickname: isValidNickname,
    isAdminUser: isAdminUser,
    getApiBase: getApiBase,
    apiUrl: apiUrl,
    ensureApiBaseProbed: ensureApiBaseProbed,
    resetApiRouting: resetApiRouting,
    getToken: getToken,
    getUser: getUser,
    setUser: setUser,
    clearSession: clearSession,
    isLoggedIn: isLoggedIn,
    allowedDomains: ALLOWED_EMAIL_DOMAINS,
    registerUser: registerUser,
    loginUser: loginUser,
    redeemLicenseKey: redeemLicenseKey,
    updateProfile: updateProfile,
    getLauncherDownloadLink: getLauncherDownloadLink,
    refreshUser: refreshUser,
  };
})(typeof window !== "undefined" ? window : globalThis);
