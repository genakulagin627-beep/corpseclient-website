/** Нормализация ссылок для прямой загрузки (Dropbox, и т.д.) */
function normalizeDownloadUrl(url) {
  let u = String(url || '').trim();
  if (!u) return u;
  if (/dropbox\.com/i.test(u)) {
    if (/[?&]dl=0\b/i.test(u)) {
      u = u.replace(/([?&])dl=0\b/i, '$1dl=1');
    } else if (!/[?&]dl=1\b/i.test(u)) {
      u += (u.includes('?') ? '&' : '?') + 'dl=1';
    }
  }
  return u;
}

const DEFAULT_MOD_JAR_URL = normalizeDownloadUrl(
  'https://www.dropbox.com/scl/fi/ros3acsfv0hl3he4tsyur/corpse-1.0.0.jar?rlkey=jjshpfldgazgg39xw6f59qy9j&st=esgdx44d&dl=0'
);

const DEFAULT_MC_PACK_URL = normalizeDownloadUrl(
  'https://www.dropbox.com/scl/fi/5f80ehnqrblm14jfuaz9p/1.21.4.zip?rlkey=igf2vc47cucrxr402l3z2xik0&st=h3dhdhfn&dl=0'
);

module.exports = {
  normalizeDownloadUrl,
  DEFAULT_MOD_JAR_URL,
  DEFAULT_MC_PACK_URL,
};
