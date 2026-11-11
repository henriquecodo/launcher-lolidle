/**
 * Roda dentro de cada conta (<webview>), num "mundo isolado": o jogo não enxerga nada daqui e nada
 * daqui mexe no jogo. Só faz duas coisas:
 *  1. Antes de o jogo carregar, grava as preferências do próprio jogo (Modo economia, Desempenho leve),
 *     do mesmo jeito que a engrenagem ⚙ dele grava.
 *  2. A cada 3 s, LÊ a tela (nível, XP, ouro, zona, tarefa, avisos e, com a janela do Mercador aberta,
 *     os cards do mercado) e manda um resumo para o launcher.
 * Nenhum clique, tecla, requisição ou alteração no jogo sai daqui.
 */
const { ipcRenderer } = require('electron');

let prefs = { once: {} };
try { prefs = { ...prefs, ...ipcRenderer.sendSync('game:prefs') }; } catch {}
try { for (const [k, v] of Object.entries(prefs.once || {})) localStorage.setItem(k, v); } catch {}
// Mudança pedida pelo launcher com a conta aberta: grava e o launcher recarrega a conta.
ipcRenderer.on('prefs', (_e, map) => { try { for (const [k, v] of Object.entries(map || {})) localStorage.setItem(k, v); } catch {} });

// ---------- Você está mexendo nesta conta? (o launcher nunca recarrega uma conta nas suas mãos) ----------
let lastInput = Date.now();
for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, () => (lastInput = Date.now()), { capture: true, passive: true });

// ---------- Leitura ----------
const $ = (id) => document.getElementById(id);
const txt = (id) => (($(id) || {}).textContent || '').trim();
// (as janelas do jogo são position: fixed — offsetParent não serve; checkVisibility olha o CSS de verdade)
const visivel = (el) => !!(el && !el.hidden && (el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0));
// números do jogo: "12.3k", "1.2M", "4567", "1.234.567"
function num(s) {
  const m = String(s || '').replace(/\s/g, '').match(/([\d.,]+)\s*([kKmM]?)/);
  if (!m) return null;
  let v = m[1];
  const mult = /k/i.test(m[2]) ? 1e3 : /m/i.test(m[2]) ? 1e6 : 1;
  if (mult > 1) v = v.replace(',', '.');
  else v = v.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n * mult : null;
}

// Avisos que o jogo escreve no registro (#log) e nas janelas de aviso.
const AVISOS = [
  [/sem conex[ãa]o com o servidor/i, 'sem-conexao'],
  [/parou de salvar|n[ãa]o est[áa] salvando|rede cheia/i, 'nao-salva'],
  [/tarefa completa/i, 'tarefa'],
];
let logVisto = '';
function novosAvisos() {
  const log = $('log');
  if (!log) return [];
  const linhas = [...log.children].slice(-8).map((e) => e.textContent.trim());
  const i = linhas.lastIndexOf(logVisto);
  const novas = i >= 0 ? linhas.slice(i + 1) : linhas.slice(-2);
  if (linhas.length) logVisto = linhas[linhas.length - 1];
  const out = [];
  for (const l of novas) for (const [re, tipo] of AVISOS) if (re.test(l)) out.push({ tipo, texto: l.slice(0, 160) });
  return out;
}

// Mercado: só com a janela do Mercador aberta, na aba Comprar. Lê os cards que o PRÓPRIO jogo desenhou
// (o jogo atualiza a lista a cada 30 s e toda vez que a janela abre — J duas vezes = lista nova).
let mercHash = '', mercMudou = 0, mercTick = 0;
function lerMercado() {
  const jan = $('janela-mercado');
  if (!visivel(jan)) { mercHash = ''; return null; }
  const aba = (jan.querySelector('.mj-corpo') || {}).dataset?.aba || '';
  const aqui = !!($('mercado-fora') && $('mercado-fora').hidden); // perto do Mercador = pode comprar
  if (aba !== 'comprar') return { aberto: true, aba, aqui, cards: null, mudou: mercMudou };
  const cards = [...jan.querySelectorAll('#mercado-lista .mj-card2[data-grupo]')].slice(0, 400).map((c) => {
    const nome = c.querySelector('.mj-c-info b');
    const rar = nome && [...nome.classList].find((x) => x.startsWith('cor-'));
    const ouro = c.querySelector('b.ouro[data-preco]'), gem = c.querySelector('b.gem[data-preco]');
    return {
      k: c.dataset.grupo,
      n: nome ? nome.textContent.trim() : '?',
      r: rar ? rar.slice(4) : '',
      o: ouro ? +ouro.dataset.preco : null,
      g: gem ? +gem.dataset.preco : null,
      q: ((c.querySelector('.mj-c-qtd') || {}).textContent || '').trim(),
    };
  });
  const h = cards.map((c) => `${c.k}|${c.o}|${c.g}|${c.q}`).join(';');
  const mudou = h !== mercHash;
  if (mudou) { mercHash = h; mercMudou = Date.now(); }
  // Lista igual: manda só o cabeçalho (economiza memória e IPC), e a lista inteira a cada ~30 s.
  const mandar = mudou || ++mercTick % 10 === 0;
  return { aberto: true, aba, aqui, cards: mandar ? cards : null, mudou: mercMudou };
}

function snapshot() {
  const login = visivel($('tela-entrada'));
  const ret = $('hud-retrato');
  const camp = ret && ret.dataset.qual ? ret.dataset.qual.split(':')[0] : '';
  const nivel = parseInt(txt('st-nivel'), 10) || null;
  const loggedIn = !login && !!nivel && !!camp;
  const xpEl = $('st-xp');
  const xpTxt = txt('st-xp-txt');
  const xpMax = (() => { const m = xpTxt.split('/'); return m.length > 1 ? num(m[1]) : null; })();
  const xpPct = xpEl ? parseFloat(xpEl.style.width) : null;
  const tar = $('tarefa');
  const dialogo = document.querySelector('.dialogo-fundo header');
  return {
    loggedIn,
    login,
    nick: txt('st-nome'),
    camp,
    nivel,
    xpPct: Number.isFinite(xpPct) ? xpPct : null,
    xpMax,
    ouro: num(txt('st-ouro')),
    poder: txt('st-poder'),
    local: txt('local-nome'),
    vida: txt('st-vida-txt'),
    pontosLivres: (() => { const m = txt('atrib-pontos').match(/\d+/); return m ? +m[0] : 0; })(),
    tarefa: tar && !tar.hidden ? { pronta: tar.classList.contains('pronta'), txt: txt('tarefa-txt'), num: txt('tarefa-num') } : null,
    captcha: !!document.querySelector('.captcha-fundo'),
    dialogo: dialogo ? dialogo.textContent.trim().slice(0, 80) : '',
    avisos: loggedIn ? novosAvisos() : [],
    mercado: loggedIn ? lerMercado() : null,
    idleMs: Date.now() - lastInput,
  };
}

setInterval(() => { try { ipcRenderer.sendToHost('state', snapshot()); } catch {} }, 3000);
