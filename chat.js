 (function () {
  var A = window.InProtectAuth;
  if (!A || !A.getToken || !A.isLoggedIn || !A.isLoggedIn()) {
    window.location.replace("login.html");
    return;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function formatTime(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch (_e) {
      return "";
    }
  }

  function avatarLetter(user) {
    var v = (user && (user.displayName || user.uid)) || "?";
    return String(v).charAt(0).toUpperCase();
  }

  function buildWsUrl(token) {
    var base = "";
    if (window.InProtectAuth && typeof window.InProtectAuth.getApiBase === "function") {
      base = window.InProtectAuth.getApiBase() || "";
    }
    if (!base && window.INPROTECT_API) {
      base = String(window.INPROTECT_API).replace(/\/$/, "");
    }
    if (base) {
      try {
        var u = new URL(base);
        var wsProto = u.protocol === "https:" ? "wss:" : "ws:";
        return wsProto + "//" + u.host + "/ws/chat?token=" + encodeURIComponent(token);
      } catch (e) {}
    }
    var loc = window.location;
    var proto = loc.protocol === "https:" ? "wss:" : "ws:";
    return proto + "//" + loc.host + "/ws/chat?token=" + encodeURIComponent(token);
  }

  var messagesEl = $("chat-messages");
  var inputEl = $("chat-text");
  var sendBtn = $("chat-send");
  var statusEl = $("chat-status");

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.style.color = isError ? "var(--accent)" : "var(--muted)";
  }

  function shouldStickToBottom() {
    if (!messagesEl) return true;
    var dist = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
    return dist < 140;
  }

  function scrollToBottom() {
    if (!messagesEl) return;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderMessage(msg) {
    if (!messagesEl) return;
    var row = document.createElement("div");
    row.className = "chat-msg";

    var avatarWrap = document.createElement("div");
    avatarWrap.className = "profile-avatar chat-avatar";

    var img = document.createElement("img");
    img.className = "profile-avatar-img";
    img.alt = "Аватар";

    var letter = document.createElement("div");
    letter.className = "chat-avatar-letter";

    var hasAvatar = msg && msg.user && msg.user.avatar_url;
    if (hasAvatar) {
      img.src = String(msg.user.avatar_url);
      img.classList.remove("hidden");
      letter.classList.add("hidden");
    } else {
      img.classList.add("hidden");
      letter.classList.remove("hidden");
    }
    letter.textContent = avatarLetter(msg.user);

    avatarWrap.appendChild(img);
    avatarWrap.appendChild(letter);

    var body = document.createElement("div");
    body.className = "chat-msg-body";

    var head = document.createElement("div");
    head.className = "chat-msg-head";

    var userLink = document.createElement("a");
    userLink.className = "chat-user-link";
    userLink.href = "public-profile.html?uid=" + encodeURIComponent(msg.user.uid);
    userLink.textContent = String(msg.user.displayName || msg.user.uid || "—");

    var time = document.createElement("span");
    time.className = "chat-msg-time";
    time.textContent = formatTime(msg.createdAt);

    head.appendChild(userLink);
    head.appendChild(time);

    var text = document.createElement("div");
    text.className = "chat-msg-text";
    text.textContent = String(msg.text || "");

    body.appendChild(head);
    body.appendChild(text);

    row.appendChild(avatarWrap);
    row.appendChild(body);

    messagesEl.appendChild(row);
  }

  function clearMessages() {
    if (!messagesEl) return;
    messagesEl.innerHTML = "";
  }

  var wsRef = { ws: null };

  function sendMessage() {
    var ws = wsRef.ws;
    if (!ws || ws.readyState !== 1) return;

    var raw = inputEl && inputEl.value ? inputEl.value : "";
    var text = String(raw).trim();
    if (!text) return;

    ws.send(JSON.stringify({ type: "message", text: text }));
    if (inputEl) inputEl.value = "";
    try {
      inputEl.focus();
    } catch (_e) {}
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }

  if (inputEl) {
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  function connectWsWithRef() {
    var token = A.getToken ? A.getToken() : null;
    if (!token) {
      window.location.replace("login.html");
      return;
    }

    setStatus("Подключение…", false);

    var wsUrl = buildWsUrl(token);
    var ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch (_e) {
      setStatus("Нет связи с сервером", true);
      return;
    }

    wsRef.ws = ws;

    ws.onopen = function () {
      setStatus("Онлайн", false);
    };

    ws.onmessage = function (ev) {
      var data = null;
      try {
        data = JSON.parse(ev.data);
      } catch (_e) {
        return;
      }

      if (!data || !data.type) return;

      if (data.type === "history") {
        clearMessages();
        var list = Array.isArray(data.messages) ? data.messages : [];
        list.forEach(function (m) {
          renderMessage(m);
        });
        scrollToBottom();
        return;
      }

      if (data.type === "message") {
        var stick = shouldStickToBottom();
        renderMessage(data);
        if (stick) scrollToBottom();
      }
    };

    ws.onerror = function () {
      setStatus("Ошибка подключения", true);
    };

    ws.onclose = function () {
      setStatus("Отключено. Переподключение…", true);
      wsRef.ws = null;
      setTimeout(connectWsWithRef, 2500);
    };
  }

  if (messagesEl && inputEl && sendBtn) {
    connectWsWithRef();
  }
})();

