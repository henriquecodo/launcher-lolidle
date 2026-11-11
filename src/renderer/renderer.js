/**
 * Interface do launcher: um card (<webview>) por conta, com nível, XP/h, ouro, zona, tarefa e RAM.
 * Só LÊ o que a conta mostra (via game-preload). Não manda cliques nem teclas para o jogo.
 */
const GAME_URL = 'https://lolidle.com/jogar';
const MAX = 5;
const IDLE_MS = 10 * 60e3;   // sem mexer na conta há 10 min = pode recarregar sozinho
const STALL_MS = 15 * 60e3;  // XP subia e parou há 15 min = conta travada
const STAGGER_MS = 4000;     // abrir as contas em escadinha (a verificação da Cloudflare não gosta de rajada)
const GAME_W = 1280, GAME_H = 720;

const CAMPEOES = { darius: 'Darius', ezreal: 'Ezreal', lux: 'Lux', katarina: 'Katarina', zac: 'Zac', taric: 'Taric', yasuo: 'Yasuo', ryze: 'Ryze', sona: 'Sona', rengar: 'Rengar', shaco: 'Shaco', aphelios: 'Aphelios' };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let cfg;
let DEMO = ''; // modo demonstração (só em desenvolvimento, para os prints do README)
const panels = new Array(MAX).fill(null); // conta desligada = null (sem webview, sem RAM)
const live = () => panels.filter(Boolean);
const online = () => live().filter((p) => p.state && p.state.loggedIn);
const accName = (p) => cfg.accounts[p.idx].name;

// ---------- Config ----------
const DEFAULT_NAME = /^Conta \d$/;
const defaultAccount = (i) => ({ name: `Conta ${i + 1}`, zoom: null });
let saveTimer;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => window.launcher.saveCfg(cfg), 400); }
const saveNow = () => { clearTimeout(saveTimer); return window.launcher.saveCfg(cfg); };

// ---------- Formatação ----------
const fmt = (n) => (n == null || !Number.isFinite(n) ? '—' : Math.abs(n) >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : Math.abs(n) >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)));
const fmtInt = (n) => (n == null ? '—' : Math.round(n).toLocaleString('pt-BR'));
const fmtMb = (mb) => (mb >= 1024 ? (mb / 1024).toFixed(2) + ' GB' : Math.round(mb) + ' MB');
const fmtDur = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const m = Math.round(ms / 60e3);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h${String(m % 60).padStart(2, '0')}` : `${Math.round(h / 24)} dias`;
};
const agoS = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`; };

// ---------- Tooltip, aviso, notificação ----------
const tip = Object.assign(document.createElement('div'), { id: 'tip' });
document.body.appendChild(tip);
let tipTimer, tipEl;
document.addEventListener('mouseover', (e) => {
  const t = e.target.closest('[data-tip]');
  if (t === tipEl) return;
  tipEl = t; clearTimeout(tipTimer); tip.classList.remove('show');
  if (!t || document.querySelector('.pop.open')) return;
  tipTimer = setTimeout(() => {
    tip.textContent = t.dataset.tip;
    const r = t.getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    tip.style.top = Math.min(innerHeight - 40, r.bottom + 8) + 'px';
    tip.classList.add('show');
  }, 450);
});
document.addEventListener('mousedown', () => { clearTimeout(tipTimer); tip.classList.remove('show'); });

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
let audioCtx;
function beep(tom = 880) {
  if (cfg.beep === false) return;
  try {
    audioCtx ??= new AudioContext();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = tom;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.4);
  } catch {}
}
// Alerta = aviso na tela + som + notificação do Windows (com clique levando à conta).
function alertar(titulo, corpo, p, tom) {
  toast(`${titulo} — ${corpo}`);
  beep(tom);
  if (cfg.notify === false) return;
  try {
    const n = new Notification(titulo, { body: corpo, silent: true });
    n.onclick = () => { window.focus?.(); if (p) focusPanel(p, true); };
  } catch {}
}

// ---------- XP ----------
// xp exato = largura da barra (%) × XP do nível (do texto "XP a / b").
function pushXp(p, st) {
  if (!st.loggedIn || st.xpPct == null || !st.xpMax) return;
  const cur = (st.xpPct / 100) * st.xpMax, now = Date.now();
  const prev = p.lastXp;
  if (prev) {
    let d = 0;
    if (st.nivel > prev.nivel) d = prev.max - prev.cur + cur;   // subiu de nível
    else if (st.nivel === prev.nivel) d = cur - prev.cur;
    if (d < 0) d = 0;                                            // morte tira XP: não conta como ganho negativo
    if (d > 0) { p.gained += d; p.lastXpChange = now; p.farming = true; }
  }
  p.lastXp = { cur, max: st.xpMax, nivel: st.nivel };
  p.samples.push([now, p.gained]);
  while (p.samples.length && now - p.samples[0][0] > 10 * 60e3) p.samples.shift();
}
function xpPerHour(p) {
  if (p.samples.length < 2) return null;
  const [t0, g0] = p.samples[0], [t1, g1] = p.samples[p.samples.length - 1];
  return t1 - t0 < 45e3 ? null : ((g1 - g0) / (t1 - t0)) * 3600e3;
}

// ---------- Zoom automático ----------
function effZoom(p) {
  const z = cfg.accounts[p.idx].zoom;
  if (z) return z;
  const r = $('.card-body', p.el).getBoundingClientRect();
  if (!r.width || !r.height) return 0.6;
  return Math.min(1.4, Math.max(0.3, +Math.min(r.width / GAME_W, r.height / GAME_H).toFixed(2)));
}
function applyZoom(p) {
  const z = effZoom(p);
  if (p.lastZoom === z || !p.ready) return;
  p.lastZoom = z;
  try { p.wv.setZoomFactor(z); } catch {}
}

// ---------- Render de um card ----------
function setIcon(el, name) { if (el.dataset.icon !== name) { el.dataset.icon = name; el.innerHTML = svgIcon(name); } }

function problemaDe(p) {
  const s = p.state;
  if (!s) return '';
  if (s.captcha) return 'Verificação pedida';
  if (s.dialogo && /rede|outra aba|sess[ãa]o|recusado/i.test(s.dialogo)) return s.dialogo;
  if (p.naoSalva && Date.now() - p.naoSalva < 10 * 60e3) return 'Não está salvando';
  if (p.semConexao && Date.now() - p.semConexao < 3 * 60e3) return 'Sem conexão';
  return '';
}

function renderPanel(p) {
  const s = p.state, el = p.el, acc = cfg.accounts[p.idx];
  const on = !!(s && s.loggedIn);
  const prob = problemaDe(p);
  el.classList.toggle('live', on);
  el.classList.toggle('login', !!(s && !s.loggedIn));
  el.classList.toggle('problema', !!prob);
  $('.camp', el).textContent = on ? CAMPEOES[s.camp] || s.camp : p.queued ? 'na fila…' : !s ? 'carregando…' : s.login ? 'faça login' : '';
  $('.lvl', el).textContent = on ? `Nv ${s.nivel}` : '';
  const pct = on && s.xpPct != null ? s.xpPct : 0;
  $('.xp .xp-bar > span', el).style.width = pct + '%';
  $('.xp b', el).textContent = on && s.xpPct != null ? pct.toFixed(1) + '%' : '—';
  const x = xpPerHour(p);
  $('.xph b', el).textContent = x == null ? '—' : fmt(x) + '/h';
  const eta = x && p.lastXp ? ((p.lastXp.max - p.lastXp.cur) / x) * 3600e3 : null;
  $('.xph small', el).textContent = eta ? '↑ ' + fmtDur(eta) : '';
  $('.gold b', el).textContent = on ? fmt(s.ouro) : '—';
  const zona = $('.zona', el);
  zona.textContent = on ? s.local || '' : '';
  zona.dataset.tip = on && s.local ? `Em: ${s.local}` : 'Onde a conta está';
  const tf = $('.flag.tarefa', el);
  const tar = on && s.tarefa;
  tf.hidden = !tar;
  if (tar) {
    tf.classList.toggle('pronta', !!tar.pronta);
    tf.textContent = tar.pronta ? 'Tarefa pronta' : tar.num;
    tf.dataset.tip = tar.pronta ? 'Tarefa do Capitão pronta: aperte B na conta para voltar à Fonte e fale com o Capitão da Legião' : tar.txt;
  }
  const w = $('.flag.warn', el);
  w.hidden = !prob; w.textContent = prob;
  el.classList.toggle('alerta', !!(tar && tar.pronta));
  $('.eco', el).classList.toggle('on', acc.eco === true);
  const mute = $('.mute', el);
  mute.classList.toggle('on', p.muted);
  setIcon($('.ic', mute), p.muted ? 'mute' : 'volume');
  setIcon($('.focus .ic', el), el.classList.contains('focused') ? 'shrink' : 'expand');
  const zv = $('.zv', el);
  zv.textContent = Math.round(effZoom(p) * 100) + '%';
  zv.classList.toggle('manual', !!acc.zoom);
  const name = $('.name', el);
  if (document.activeElement !== name) name.value = acc.name;
  // cards estreitos escondem o que é secundário
  const wpx = el.clientWidth;
  el.classList.toggle('compact', wpx < 760);
  el.classList.toggle('tiny', wpx < 470);
}

function renderTotals() {
  let sum = 0, any = false, prontas = 0;
  for (const p of live()) {
    const x = xpPerHour(p);
    if (x != null) { sum += x; any = true; }
    if (p.state && p.state.loggedIn && p.state.tarefa && p.state.tarefa.pronta) prontas++;
  }
  $('#st-xph').textContent = any ? fmt(sum) : '—';
  $('#st-tarefas').textContent = String(prontas);
  $('#st-tarefas-btn').classList.toggle('hot', prontas > 0);
}

function renderGrid() {
  const g = $('#grid');
  g.dataset.n = cfg.count;
  g.className = (cfg.layout || 'auto') + ($('.card.focused') ? ' focus' : '');
  $$('#seg-count button').forEach((b) => b.classList.toggle('on', +b.dataset.n === cfg.count));
  $('.seg-thumb').style.transform = `translateX(${(cfg.count - 1) * 28}px)`;
}

function paintMuteAll() {
  const btn = $('#btn-mute-all');
  const all = live().length > 0 && live().every((p) => p.muted);
  btn.classList.toggle('muted', all);
  setIcon($('.ic', btn), all ? 'mute' : 'volume');
  $('span', btn).textContent = all ? 'Sem som' : 'Som';
}

// ---------- Estado vindo do jogo ----------
function onState(p, st) {
  const prev = p.state;
  p.state = st;
  pushXp(p, st);
  const acc = cfg.accounts[p.idx];
  if (st.loggedIn && st.nick && DEFAULT_NAME.test(acc.name)) { acc.name = st.nick.slice(0, 20); save(); }

  // Tarefa do Capitão acabou de ficar pronta
  const pronta = !!(st.loggedIn && st.tarefa && st.tarefa.pronta);
  const eraPronta = !!(prev && prev.loggedIn && prev.tarefa && prev.tarefa.pronta);
  if (pronta && !eraPronta && prev) alertar(`${acc.name}: tarefa pronta`, 'Aperte B na conta e fale com o Capitão da Legião.', p, 660);

  // Verificação (captcha) pedida pelo jogo: só você pode resolver
  if (st.captcha && !(prev && prev.captcha)) alertar(`${acc.name}: verificação pedida`, 'O jogo pediu para confirmar que você é uma pessoa. Resolva na conta.', p, 440);

  for (const a of st.avisos || []) {
    if (a.tipo === 'sem-conexao') p.semConexao = Date.now();
    if (a.tipo === 'nao-salva') { p.naoSalva = Date.now(); alertar(`${acc.name}: não está salvando`, a.texto, p, 440); }
  }
  if (st.mercado) onMercado(p, st.mercado); // radar.js
  renderPanel(p);
  renderTotals();
}

// ---------- Cards ----------
function buildPanel(i, delay = 0) {
  const acc = cfg.accounts[i];
  const el = $('#panel-tpl').content.firstElementChild.cloneNode(true);
  el.style.order = i;
  el.dataset.idx = i;
  hydrateIcons(el);
  const wv = document.createElement('webview');
  wv.setAttribute('partition', `persist:lol${i + 1}`); // login isolado por conta
  wv.setAttribute('src', GAME_URL);                    // preload e travas impostos pelo main.js
  const p = { idx: i, el, wv, ready: false, queued: delay > 0, state: null, loadedAt: Date.now(), lastXpChange: Date.now(), farming: false, samples: [], gained: 0, lastXp: null, muted: !!acc.muted, lastZoom: null, hotCount: 0 };
  panels[i] = p;
  const attach = () => { p.queued = false; if (panels[i] === p) $('.card-body', el).appendChild(wv); renderPanel(p); };
  if (delay) setTimeout(attach, delay);

  const name = $('.name', el);
  name.value = acc.name;
  name.addEventListener('input', () => { acc.name = name.value.trim() || `Conta ${i + 1}`; save(); });
  name.addEventListener('keydown', (e) => e.key === 'Enter' && name.blur());

  wv.addEventListener('dom-ready', () => {
    p.ready = true; p.lastZoom = null;
    p.loadedAt = p.lastXpChange = Date.now();
    p.farming = false; p.lastXp = null;
    applyZoom(p);
    if (p.muted) wv.setAudioMuted(true);
  });
  wv.addEventListener('did-start-loading', () => { p.state = null; renderPanel(p); });
  wv.addEventListener('ipc-message', (e) => e.channel === 'state' && !DEMO && onState(p, e.args[0]));
  wv.addEventListener('render-process-gone', (e) => {
    if (e.reason === 'clean-exit' || panels[i] !== p) return;
    p.ready = false; p.state = null; renderPanel(p);
    toast(`${acc.name}: a conta travou — recarregando`);
    setTimeout(() => { if (panels[i] === p) wv.reload(); }, 2000);
  });

  const setZoom = (z) => { acc.zoom = z; p.lastZoom = null; applyZoom(p); renderPanel(p); save(); };
  $('.zin', el).onclick = () => setZoom(Math.min(2, +(effZoom(p) + 0.05).toFixed(2)));
  $('.zout', el).onclick = () => setZoom(Math.max(0.3, +(effZoom(p) - 0.05).toFixed(2)));
  $('.zv', el).onclick = () => setZoom(null);
  let rt;
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { applyZoom(p); renderPanel(p); }, 150); }).observe($('.card-body', el));

  $('.reload', el).onclick = () => reloadPanel(p);
  $('.mute', el).onclick = () => { setMuted(p, !p.muted); paintMuteAll(); save(); };
  $('.eco', el).onclick = () => setEco(p, acc.eco !== true);
  $('.build', el).onclick = () => abrirBuild(p);   // build.js
  $('.flag.tarefa', el).onclick = () => focusPanel(p, true);
  $('.focus', el).onclick = () => focusPanel(p, !el.classList.contains('focused'));

  $('#grid').appendChild(el);
  if (!delay) attach();
  renderPanel(p);
}

function focusPanel(p, on) {
  $$('.card').forEach((x) => x.classList.remove('focused'));
  p.el.classList.toggle('focused', on);
  renderGrid();
  live().forEach((x) => { x.lastZoom = null; });
  setTimeout(() => live().forEach((x) => { applyZoom(x); renderPanel(x); }), 60);
}

const reloadPanel = (p) => p.ready && p.wv.reload();

function setMuted(p, m) {
  p.muted = cfg.accounts[p.idx].muted = m;
  if (p.ready) p.wv.setAudioMuted(m);
  renderPanel(p);
}

// Modo economia do PRÓPRIO jogo (não desenha o mapa; a caça continua). Grava a preferência e recarrega.
function setEco(p, on, quiet) {
  cfg.accounts[p.idx].eco = on;
  save();
  if (p.ready) { try { p.wv.send('prefs', { 'lolidle-economia': JSON.stringify(on) }); } catch {} }
  setTimeout(() => reloadPanel(p), 300);
  if (!quiet) toast(`${accName(p)}: ${on ? 'modo economia (sem mapa)' : 'mapa ligado'} — recarregando`);
  renderPanel(p);
}

function destroyPanel(i) {
  const p = panels[i];
  if (!p) return;
  p.el.remove(); // remove o webview => o processo da conta acaba e a RAM é liberada
  panels[i] = null;
}

function setCount(n, announce, stagger) {
  cfg.count = Math.max(1, Math.min(MAX, n));
  let k = 0;
  for (let i = 0; i < MAX; i++) {
    if (i >= cfg.count) destroyPanel(i);
    else if (!panels[i]) buildPanel(i, stagger ? k++ * STAGGER_MS : 0);
  }
  renderGrid(); renderTotals(); paintMuteAll(); save();
  if (announce) toast(cfg.count === 1 ? 'Rodando 1 conta' : `Rodando ${cfg.count} contas`);
}

// ---------- RAM ----------
async function pollMemory() {
  let m;
  try { m = await window.launcher.metrics(); } catch { return; }
  const limit = cfg.ramLimit || 0;
  $('#st-ram').textContent = fmtMb(m.total);
  live().forEach((p) => {
    const mb = m.accounts[p.idx] || 0;
    const hot = !!(limit && mb > limit);
    const r = $('.ram', p.el);
    r.textContent = mb ? fmtMb(mb) : '';
    r.classList.toggle('hot', hot);
    p.hotCount = hot ? p.hotCount + 1 : 0;
    if (p.hotCount >= 2 && (p.state?.idleMs ?? 0) > 60e3) {
      p.hotCount = 0;
      toast(`${accName(p)} passou do limite de RAM — recarregando`);
      reloadPanel(p);
    }
  });
}

// ---------- Saúde das contas ----------
// Só recarrega conta que você não está usando há 10 min, sem captcha nem aviso aberto.
function healthCheck() {
  const now = Date.now();
  for (const p of live()) {
    const s = p.state;
    if (!p.ready || !s || !s.loggedIn || s.captcha || s.dialogo) continue;
    if ((s.idleMs ?? 0) < IDLE_MS) continue;
    if (cfg.watchdog !== false && p.farming && now - p.lastXpChange > STALL_MS) {
      toast(`${accName(p)}: XP parado há 15 min — recarregando`);
      reloadPanel(p);
    } else if (cfg.autoRefreshH > 0 && now - p.loadedAt > cfg.autoRefreshH * 3600e3 + p.idx * 3 * 60e3) {
      toast(`${accName(p)}: atualização preventiva`);
      reloadPanel(p);
    }
  }
}
function onPower(msg) {
  if (msg.type === 'resume') toast('PC de volta — confira se as contas voltaram a caçar');
}

// ---------- Gaveta (Radar / Build) ----------
let drawerKind = null, drawerRender = null;
function openDrawer(kind, title, icon, render) {
  const d = $('#drawer');
  if (drawerKind === kind && !d.hidden) return closeDrawer();
  drawerKind = kind; drawerRender = render;
  $('#drawer-t').textContent = title;
  setIcon($('#drawer-icon'), icon);
  d.hidden = false;
  render($('#drawer-body'));
}
function closeDrawer() { $('#drawer').hidden = true; drawerKind = null; drawerRender = null; }
const drawerOpen = (kind) => drawerKind === kind && !$('#drawer').hidden;
const focusedOrFirst = () => panels.find((p) => p && p.el.classList.contains('focused')) || online()[0] || null;

// ---------- Barra de ferramentas ----------
function closePops() { $$('.pop').forEach((x) => x.classList.remove('open')); $$('[data-pop]').forEach((x) => x.classList.remove('open')); }

function bindToolbar() {
  hydrateIcons();
  $$('[data-pop]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const pop = $('#' + b.dataset.pop), open = !pop.classList.contains('open');
    closePops();
    if (open) { pop.classList.add('open'); b.classList.add('open'); }
  }));
  $$('.pop').forEach((p) => p.addEventListener('click', (e) => e.stopPropagation()));
  document.addEventListener('click', closePops);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePops(); closeDrawer(); } });
  $('#drawer-close').onclick = closeDrawer;

  $$('#seg-count button').forEach((b) => (b.onclick = () => setCount(+b.dataset.n, true)));
  $('#btn-reload-all').onclick = () => { live().forEach((p, k) => setTimeout(() => reloadPanel(p), k * 1500)); toast('Atualizando todas as contas'); };
  $('#btn-mute-all').onclick = () => { const m = !live().every((p) => p.muted); live().forEach((p) => setMuted(p, m)); paintMuteAll(); save(); };
  $('#st-tarefas-btn').onclick = () => {
    const p = online().find((x) => x.state.tarefa && x.state.tarefa.pronta);
    if (p) focusPanel(p, true); else toast('Nenhuma tarefa do Capitão pronta agora');
  };
  $('#btn-radar').onclick = () => abrirRadar();  // radar.js
  $('#btn-build').onclick = () => { const p = focusedOrFirst(); if (p) abrirBuild(p); else toast('Entre em uma conta para calcular a build'); };
  $('#btn-eco-all').onclick = () => { live().forEach((p, k) => setTimeout(() => setEco(p, true, true), k * 1500)); toast('Modo economia em todas as contas'); closePops(); };
  // Modo leve: 3 contas + Modo economia do jogo nelas (mapa não desenhado; a caça continua) + sem GPU.
  $('#btn-leve').onclick = () => {
    closePops();
    const gpuMuda = cfg.gpuOn === true;
    cfg.gpuOn = false; cfg.leve = true;
    $('#cfg-gpu').checked = false; $('#cfg-leve').checked = true;
    setCount(3, false);
    live().forEach((p, k) => setTimeout(() => setEco(p, true, true), k * 1500));
    toast(`Modo leve: 3 contas, sem mapa${gpuMuda ? ' — a GPU desliga ao reabrir o launcher' : ''}`);
  };
  $('#btn-eco-none').onclick =() => { live().forEach((p, k) => setTimeout(() => setEco(p, false, true), k * 1500)); toast('Mapa ligado em todas as contas'); closePops(); };

  const sw = (id, key, def, after) => {
    const el = $(id);
    el.checked = def ? cfg[key] !== false : cfg[key] === true;
    el.onchange = (e) => { cfg[key] = e.target.checked; save(); after && after(e.target.checked); };
  };
  sw('#cfg-leve', 'leve', true, () => toast('Vale quando cada conta recarregar'));
  sw('#cfg-track', 'blockTrackers', true, () => toast('Vale na próxima vez que abrir o launcher'));
  sw('#cfg-gpu', 'gpuOn', false, () => toast('Vale na próxima vez que abrir o launcher'));
  sw('#cfg-notify', 'notify', true);
  sw('#cfg-beep', 'beep', true);
  sw('#cfg-lock', 'lockFarm', true);
  sw('#cfg-awake', 'keepAwake', false, (on) => window.launcher.keepAwake(on));
  sw('#cfg-watch', 'watchdog', true);
  const sel = (id, key, num) => { const el = $(id); el.value = String(cfg[key]); el.onchange = (e) => { cfg[key] = num ? +e.target.value : e.target.value; save(); if (key === 'layout') renderGrid(); }; };
  sel('#cfg-layout', 'layout');
  sel('#cfg-ram', 'ramLimit', true);
  sel('#cfg-refresh', 'autoRefreshH', true);
}

// ---------- Início ----------
(async function init() {
  const saved = (await window.launcher.loadCfg()) || {};
  cfg = { count: 3, layout: 'auto', ramLimit: 1200, autoRefreshH: 6, ...saved };
  if (!cfg.v || cfg.v < 2) { // 1.1: modo leve por padrão — 3 contas e sem GPU (main.js lê gpuOn)
    cfg.count = 3; cfg.gpuOn = false; delete cfg.gpu;
    if (!cfg.ramLimit || cfg.ramLimit > 1200) cfg.ramLimit = 1200;
    cfg.v = 2;
  }
  cfg.accounts = Array.from({ length: MAX }, (_, i) => ({ ...defaultAccount(i), ...((saved.accounts || [])[i] || {}) }));
  cfg.radar = { rules: [], queda: 30, ...(saved.radar || {}) };
  await saveNow(); // o preload já lê as preferências na primeira carga
  bindToolbar();
  setCount(cfg.count, false, true);
  setInterval(() => { live().forEach(renderPanel); renderTotals(); if (drawerOpen('radar')) atualizarRadar(); }, 5000);
  setInterval(pollMemory, 20000);
  setTimeout(pollMemory, 5000);
  setInterval(healthCheck, 30000);
  window.launcher.onPower(onPower);
  DEMO = await window.launcher.demo();
  if (DEMO) document.body.appendChild(Object.assign(document.createElement('script'), { src: '../demo/demo.js' }));
})();
