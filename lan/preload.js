const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  getConfig: () => ipcRenderer.invoke('config-get'),
  saveConfig: (cfg) => ipcRenderer.invoke('config-save', cfg),
  launch: (versionId) => ipcRenderer.invoke('launch', versionId),
  authLogin: (email, password) => ipcRenderer.invoke('auth-login', { email, password }),
  authRegister: (nickname, email, password) => ipcRenderer.invoke('auth-register', { nickname, email, password }),
  authStatus: () => ipcRenderer.invoke('auth-status'),
  authLogout: () => ipcRenderer.invoke('auth-logout'),
  openSite: () => ipcRenderer.invoke('open-site'),
  getSiteUrl: () => ipcRenderer.invoke('get-site-url'),
  getApiBase: () => ipcRenderer.invoke('get-api-base'),
  settingsGateStatus: () => ipcRenderer.invoke('settings-gate-status'),
  settingsGateUnlock: (pin) => ipcRenderer.invoke('settings-gate-unlock', pin),
  settingsGateLock: () => ipcRenderer.invoke('settings-gate-lock'),
  protInfo: () => ipcRenderer.invoke('prot-info'),
  protComputeHash: (filePath) => ipcRenderer.invoke('prot-compute-hash', filePath),
  obfuscatorGetPrefs: () => ipcRenderer.invoke('obfuscator-get-prefs'),
  obfuscatorSavePrefs: (prefs) => ipcRenderer.invoke('obfuscator-save-prefs', prefs),
  obfuscateRun: (payload) => ipcRenderer.invoke('obfuscate-run', payload),
  dialogPickJarOpen: () => ipcRenderer.invoke('dialog-pick-jar-open'),
  dialogPickProguard: () => ipcRenderer.invoke('dialog-pick-proguard'),
  dialogSaveJar: (defaultName) => ipcRenderer.invoke('dialog-save-jar', defaultName),
  onDownloadProgress: (cb) => {
    ipcRenderer.on('download-progress', (_e, data) => cb(data));
  },
});
