(function () {
  function $(id) {
    return document.getElementById(id);
  }

  var A = window.InProtectAuth;
  if (!A || !A.ensureApiBaseProbed || !A.getApiBase) {
    setTimeout(function () {
      window.location.replace("login.html");
    }, 0);
    return;
  }

  var ROLE_LABELS = {
    user: "Пользователь",
    admin: "Администратор",
    youtube: "Ютубер",
    beta: "Бета",
  };

  var uid = null;
  try {
    uid = new URLSearchParams(window.location.search).get("uid");
  } catch (_e) {}

  var roleBadge = $("profile-role");
  var nameEl = $("profile-name");
  var uidEl = $("profile-uid");
  var avatarImg = $("avatar-img");
  var avatarLetter = $("avatar-letter");

  function setAvatar(user) {
    var letter = String((user && (user.displayName || user.uid)) || "?").charAt(0).toUpperCase();
    if (!avatarImg || !avatarLetter) return;
    if (user && user.avatar_url) {
      avatarImg.src = String(user.avatar_url);
      avatarImg.classList.remove("hidden");
      avatarLetter.classList.add("hidden");
    } else {
      avatarImg.classList.add("hidden");
      avatarLetter.classList.remove("hidden");
      avatarLetter.textContent = letter;
    }
  }

  if (!uid) {
    if (nameEl) nameEl.textContent = "Пользователь не найден";
    return;
  }

  if (nameEl) nameEl.textContent = "Загрузка…";
  if (roleBadge) roleBadge.textContent = "—";
  if (uidEl) uidEl.textContent = "—";

  A.ensureApiBaseProbed()
    .then(function () {
      var base = A.getApiBase();
      return fetch(base + "/api/public/users/" + encodeURIComponent(uid), { method: "GET", credentials: "omit" });
    })
    .then(function (r) {
      return r
        .json()
        .catch(function () {
          return {};
        })
        .then(function (j) {
          if (!r.ok) throw new Error(j && j.error ? String(j.error) : "not_found");
          return j;
        });
    })
    .then(function (data) {
      if (!data) return;
      if (nameEl) nameEl.textContent = data.displayName || "—";
      if (roleBadge) roleBadge.textContent = ROLE_LABELS[String(data.role || "user").toLowerCase()] || ROLE_LABELS.user;
      if (uidEl) uidEl.textContent = "UID: " + (data.uid != null ? String(data.uid) : "—");
      setAvatar(data);
    })
    .catch(function () {
      if (nameEl) nameEl.textContent = "Пользователь не найден";
      if (roleBadge) roleBadge.textContent = "—";
    });
})();

