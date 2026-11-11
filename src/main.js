/**
 * Launcher LoL Idle — processo principal (Electron).
 *
 * Cria a janela, isola cada conta numa sessão própria (login separado), aplica as travas de segurança
 * dos <webview>, mede a RAM e cuida da energia (PC dormindo = farm parado).
 *
 * Regra de ouro deste launcher: ele NUNCA age dentro do jogo. Não clica, não digita, não intercepta a
 * conexão e não muda o código do jogo (Termos de Uso do LoL Idle, item 10.1). Só mostra as contas lado a
 * lado e LÊ o que já está na tela. Tudo que acontece no jogo é você quem faz.
 */
const { app, BrowserWindow, ipcMain, shell, session, webContents, powerMonitor, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');

const MAX = 5; // Termos 4.4: até 5 contas jogando ao mesmo tempo na mesma rede
const PARTITIONS = Array.from({ length: MAX }, (_, i) => `persist:lol${i + 1}`);
const GAME_PRELOAD = path.join(__dirname, 'preload', 'game-preload.js');

app.setName('launcher-lolidle');
app.setAppUserModelId('io.github.launcher.lolidle'); // notificações do Windows com o nome certo
// Só em desenvolvimento: um perfil separado (testes sem tocar nas contas de verdade).
if (!app.isPackaged && process.env.LAUNCHER_PROFILE) app.setPath('userData', process.env.LAUNCHER_PROFILE);

// --- Economia de memória/CPU ---------------------------------------------
app.commandLine.appendSwitch('enable-low-end-device-mode');            // caches menores por processo
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=768');  // teto do heap por conta
app.commandLine.appendSwitch('disable-features', [
  'CalculateNativeWinOcclusion', 'TranslateUI', 'MediaRouter', 'OptimizationHints', 'AutofillServerCommunication',
  'BackForwardCache', 'SpareRendererForSitePerProcess', 'IntensiveWakeUpThrottling',
  'QuickIntensiveWakeUpThrottlingAfterLoading', 'UseEcoQoSForBackgroundProcess',
].join(','));
// ATENÇÃO: não desligar o isolamento de sites (IsolateOrigins / site-per-process / disable-site-isolation-trials).
// Economiza ~100 MB por conta, mas o captcha da Cloudflare (Turnstile) passa a falhar ("Verificando…" eterno ou
// "Falha na verificação") e ninguém consegue logar. Testado em 10/11/2026.
// Aceleração de vídeo DESLIGADA por padrão (modo leve): o processo da GPU cai de ~490 para ~110 MB.
// O mapa usa um pouco mais de CPU; com o Modo economia do jogo ele nem é desenhado. Liga em Ajustes (gpuOn).
if ((() => { try { return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'launcher-config.json'), 'utf8').replace(/^﻿/, '')).gpuOn !== true; } catch { return true; } })()) {
  app.disableHardwareAcceleration();
}
app.commandLine.appendSwitch('disable-smooth-scrolling');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
// O LoL Idle simula a caça no próprio navegador: com a janela minimizada os timers não podem desacelerar.
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

if (!app.requestSingleInstanceLock()) app.quit();

// --- Configuração local (%APPDATA%\launcher-lolidle\launcher-config.json) ---
const cfgFile = () => path.join(app.getPath('userData'), 'launcher-config.json');
const loadCfg = () => { try { return JSON.parse(fs.readFileSync(cfgFile(), 'utf8').replace(/^﻿/, '')); } catch { return null; } };

const GAME_HOSTS = (h) => h === 'lolidle.com' || h.endsWith('.lolidle.com');
// O "Entrar com Google" do jogo passa pela página de login do Google e volta para lolidle.com.
const LOGIN_HOSTS = (h) => h === 'accounts.google.com';
const hostOf = (u) => { try { const x = new URL(u); return x.protocol === 'https:' ? x.hostname : ''; } catch { return ''; } };
const isGameUrl = (u) => GAME_HOSTS(hostOf(u));

ipcMain.handle('cfg:load', () => loadCfg());
ipcMain.handle('cfg:save', (_e, data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const tmp = cfgFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, cfgFile()); // gravação atômica: nunca deixa o arquivo pela metade
  return true;
});
ipcMain.handle('open:external', (_e, url) => { if (/^https:\/\//.test(String(url))) shell.openExternal(url); });

// Preferências do PRÓPRIO jogo (as mesmas da engrenagem ⚙ dele), gravadas antes de a conta abrir.
// O jogo lê do localStorage ao carregar; depois disso quem manda são os botões do jogo.
ipcMain.on('game:prefs', (e) => {
  const cfg = loadCfg() || {};
  const idx = PARTITIONS.findIndex((p) => session.fromPartition(p) === e.sender.session);
  const acc = (cfg.accounts || [])[idx] || {};
  const once = {};
  if (typeof acc.eco === 'boolean') once['lolidle-economia'] = JSON.stringify(acc.eco);   // Modo economia: não desenha o mapa
  if (cfg.leve !== false) once['lolidle-desempenho'] = JSON.stringify('leve');            // Desempenho leve do jogo
  e.returnValue = { once };
});

// Modo demonstração (prints do README): só em desenvolvimento, com LAUNCHER_DEMO=contas|build|radar.
ipcMain.handle('demo:get', () => (!app.isPackaged && process.env.LAUNCHER_DEMO) || '');

// Motor da calculadora de build: a interface injeta este código na conta quando você pede o cálculo.
let buildSource = null;
ipcMain.handle('build:source', () => (buildSource ??= fs.readFileSync(path.join(__dirname, 'game', 'build-engine.js'), 'utf8')));

// --- Energia ----------------------------------------------------------------
// O farm do LoL Idle roda no navegador: PC dormindo = nenhuma conta caçando.
let awakeId = null, keepAwake = false, locked = false;
const lockFarm = () => (loadCfg() || {}).lockFarm !== false;
function applyAwake() {
  const on = keepAwake || (locked && lockFarm());
  if (on && awakeId === null) awakeId = powerSaveBlocker.start('prevent-app-suspension');
  if (!on && awakeId !== null) { powerSaveBlocker.stop(awakeId); awakeId = null; }
}
ipcMain.handle('power:keepAwake', (_e, on) => { keepAwake = !!on; applyAwake(); return awakeId !== null; });
const sendPower = (msg) => BrowserWindow.getAllWindows().forEach((w) => !w.isDestroyed() && w.webContents.send('power', msg));
function watchPower() {
  powerMonitor.on('resume', () => sendPower({ type: 'resume' }));
  powerMonitor.on('lock-screen', () => { locked = true; applyAwake(); });
  powerMonitor.on('unlock-screen', () => { locked = false; applyAwake(); });
}

// --- RAM por conta (MB) -----------------------------------------------------
ipcMain.handle('metrics:get', () => {
  const byPid = new Map(app.getAppMetrics().map((m) => [m.pid, m.memory.workingSetSize / 1024]));
  const total = [...byPid.values()].reduce((a, b) => a + b, 0);
  const accounts = PARTITIONS.map((part) => {
    const ses = session.fromPartition(part);
    const pids = new Set(webContents.getAllWebContents()
      .filter((w) => !w.isDestroyed() && w.session === ses && w.getType() === 'webview')
      .map((w) => w.getOSProcessId()));
    let mb = 0;
    pids.forEach((pid) => (mb += byPid.get(pid) || 0));
    return mb;
  });
  return { total, accounts };
});

const flushStorage = () => PARTITIONS.forEach((p) => {
  const ses = session.fromPartition(p);
  try { ses.flushStorageData(); } catch {}
  ses.cookies.flushStore().catch(() => {});
});
const clearCaches = () => PARTITIONS.forEach((p) => session.fromPartition(p).clearCache().catch(() => {}));

// Chrome comum no user agent (com "Electron/..." a verificação da Cloudflare reprova).
const CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write', 'notifications']);
// Analytics que a página carrega; não fazem parte do jogo. Bloquear economiza RAM e rede em cada conta.
const TRACKERS = [
  '*://static.cloudflareinsights.com/*',
  '*://*.googletagmanager.com/*',
  '*://*.google-analytics.com/*',
  '*://*.doubleclick.net/*',
  '*://connect.facebook.net/*',
];

function hardenSession(ses, blockTrackers) {
  ses.setUserAgent(CHROME_UA);
  ses.setSpellCheckerEnabled(false);
  ses.setPermissionRequestHandler((_wc, perm, cb) => cb(ALLOWED_PERMISSIONS.has(perm)));
  ses.setPermissionCheckHandler((_wc, perm) => ALLOWED_PERMISSIONS.has(perm));
  if (blockTrackers) ses.webRequest.onBeforeRequest({ urls: TRACKERS }, (_d, cb) => cb({ cancel: true }));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1680, height: 980, minWidth: 960, minHeight: 600,
    backgroundColor: '#0b0d12',
    title: 'Launcher LoL Idle',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0f1219', symbolColor: '#9aa3b2', height: 52 },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'ui-preload.js'),
      webviewTag: true, sandbox: true, contextIsolation: true, nodeIntegration: false,
      backgroundThrottling: false, spellcheck: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('page-title-updated', (e) => e.preventDefault());
  win.webContents.on('render-process-gone', (_e, d) => {
    if (d.reason !== 'clean-exit' && !win.isDestroyed()) setTimeout(() => win.reload(), 1000);
  });
  if (!app.isPackaged && process.env.LAUNCHER_SNAPSHOT) { // só em desenvolvimento: print da janela
    setTimeout(async () => fs.writeFileSync(process.env.LAUNCHER_SNAPSHOT, (await win.webContents.capturePage()).toPNG()), +process.env.LAUNCHER_SNAPSHOT_MS || 15000);
  }
}

app.on('second-instance', () => {
  const w = BrowserWindow.getAllWindows()[0];
  if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
});

app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() === 'window') {
    contents.on('will-navigate', (e) => e.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-attach-webview', (e, prefs, params) => {
      if (!isGameUrl(params.src) || !PARTITIONS.includes(params.partition)) return e.preventDefault();
      prefs.preload = GAME_PRELOAD;
      prefs.sandbox = true;
      prefs.contextIsolation = true;
      prefs.nodeIntegration = false;
      prefs.nodeIntegrationInSubFrames = false;
      prefs.spellcheck = false;
      delete prefs.preloadURL;
    });
  }
  if (contents.getType() === 'webview') {
    contents.setBackgroundThrottling(false);
    const lock = (e, url) => { const h = hostOf(url); if (!GAME_HOSTS(h) && !LOGIN_HOSTS(h)) e.preventDefault(); };
    contents.on('will-navigate', lock);
    contents.on('will-redirect', lock);
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https:\/\//.test(url)) shell.openExternal(url); // Discord, termos, wiki... no navegador padrão
      return { action: 'deny' };
    });
  }
});

app.whenReady().then(() => {
  app.userAgentFallback = CHROME_UA;
  const cfg = loadCfg() || {};
  PARTITIONS.forEach((p) => hardenSession(session.fromPartition(p), cfg.blockTrackers !== false));
  keepAwake = cfg.keepAwake === true;
  applyAwake();
  watchPower();
  createWindow();
  setInterval(clearCaches, 30 * 60e3);
  setInterval(flushStorage, 60e3);
});
app.on('before-quit', flushStorage);
app.on('window-all-closed', () => app.quit());
