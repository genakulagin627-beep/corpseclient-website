(function () {
  var DEF = { accent_dark: "#c084fc", accent_light: "#9333ea" };

  var LEARNED_API_KEY = "inprotect_api_base_url";

  function readLearnedTheme() {
    try {
      if (typeof sessionStorage === "undefined") return null;
      var s = sessionStorage.getItem(LEARNED_API_KEY);
      if (s === null) return null;
      if (s === "same") return "";
      if (/^https?:\/\/.+/i.test(s)) return String(s).replace(/\/$/, "");
    } catch (e) {}
    return null;
  }

  function apiBase() {
    if (typeof window === "undefined") return "";
    if (window.InProtectAuth && typeof window.InProtectAuth.getApiBase === "function") {
      return window.InProtectAuth.getApiBase() || "";
    }
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
    var learned = readLearnedTheme();
    if (learned !== null) return learned;
    var apiPort =
      (window.INPROTECT_API_PORT && String(window.INPROTECT_API_PORT).replace(/[^\d]/g, "")) || "3000";
    if (window.location.protocol === "file:") {
      return "http://127.0.0.1:" + apiPort;
    }
    var host = String(window.location.hostname || "");
    var port = window.location.port;
    var proto = window.location.protocol;
    var loop = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    var lan =
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host);
    if (!window.INPROTECT_FORCE_SAME_ORIGIN_API) {
      if (!host && apiPort) {
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
    }
    return "";
  }

  function hexRgb(h) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(h || "").trim());
    if (!m) return null;
    return {
      r: parseInt(m[1].slice(0, 2), 16),
      g: parseInt(m[1].slice(2, 4), 16),
      b: parseInt(m[1].slice(4, 6), 16),
    };
  }

  function rgbaFromHex(hex, a) {
    var p = hexRgb(hex);
    if (!p) return null;
    return "rgba(" + p.r + "," + p.g + "," + p.b + "," + a + ")";
  }

  function setVars(el, accent, glowA, gridA) {
    var g = rgbaFromHex(accent, glowA);
    var gr = rgbaFromHex(accent, gridA);
    el.style.setProperty("--accent", accent);
    if (g) el.style.setProperty("--accent-glow", g);
    if (gr) el.style.setProperty("--grid", gr);
  }

  function mergeDefaults(data) {
    var d = data || {};
    return {
      accent_dark: typeof d.accent_dark === "string" ? d.accent_dark : DEF.accent_dark,
      accent_light: typeof d.accent_light === "string" ? d.accent_light : DEF.accent_light,
    };
  }

  function apply() {
    var t = window.__inprotectTheme || DEF;
    var dk = t.accent_dark || DEF.accent_dark;
    var lt = t.accent_light || DEF.accent_light;
    setVars(document.documentElement, dk, 0.22, 0.06);
    var body = document.body;
    if (!body) return;
    if (body.classList.contains("light")) {
      setVars(body, lt, 0.12, 0.05);
    } else {
      ["--accent", "--accent-glow", "--grid"].forEach(function (p) {
        body.style.removeProperty(p);
      });
    }
  }

  function load() {
    var probe =
      (window.InProtectAuth && window.InProtectAuth.ensureApiBaseProbed) ||
      window.__inprotectEnsureApiBaseProbed;
    var start =
      probe && typeof probe === "function" ? probe() : Promise.resolve();
    return start.then(function () {
      var url = (apiBase() || "") + "/api/site/theme";
      return fetch(url, { credentials: "omit" });
    })
      .then(function (r) {
        return r.json().catch(function () {
          return {};
        });
      })
      .then(function (data) {
        window.__inprotectTheme = mergeDefaults(data);
        apply();
        return window.__inprotectTheme;
      })
      .catch(function () {
        window.__inprotectTheme = mergeDefaults({});
        apply();
        return window.__inprotectTheme;
      });
  }

  window.InProtectApplyTheme = apply;
  window.InProtectReloadTheme = load;

  function boot() {
    load();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
