/**
 * Radar do mercado — só LÊ e AVISA. Quem compra é você.
 *
 * Com a janela do Mercador aberta numa conta (aba Comprar), o próprio jogo atualiza a lista a cada 30 s
 * e toda vez que a janela abre (J duas vezes = lista nova na hora). O launcher lê os cards que o jogo
 * desenhou, compara com a sua lista de alvos e com o menor preço que o radar já viu para cada item, e
 * avisa (card piscando, som, notificação do Windows).
 *
 * Por que não compra sozinho: os Termos proíbem automação (item 10.1), o servidor pede captcha justamente
 * para "compra logo depois do anúncio" e o jogo ignora e denuncia cliques que não vieram de uma pessoa.
 */
const mk = {
  itens: new Map(),        // grupo -> { n, r, o, g, hist: { o: [[t, v]], g: [[t, v]] }, visto, conta }
  contas: new Array(MAX).fill(null), // por conta: { aberto, aba, aqui, mudou, lidoEm }
  achados: [],             // { t, idx, k, n, r, preco, moeda, motivo, aqui }
  vistos: new Map(),       // dedupe: chave -> quando avisou
  naoLidos: 0,
};
const normTxt = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const mediana = (arr) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const nomeMoeda = (m) => (m === 'g' ? 'Gemas' : 'ouro');
const precoTxt = (v, m) => (v == null ? '—' : m === 'g' ? `${fmtInt(v)} 💠` : `${fmtInt(v)} ouro`);

function referencia(it, m) {
  // menor preço "normal": mediana do que o radar já viu (sem a leitura de agora)
  const h = it.hist[m];
  return h.length >= 4 ? mediana(h.slice(0, -1).map((x) => x[1])) : null;
}

function onMercado(p, m) {
  const st = (mk.contas[p.idx] = { ...(mk.contas[p.idx] || {}), aberto: m.aberto, aba: m.aba, aqui: m.aqui, mudou: m.mudou, lidoEm: Date.now() });
  if (!m.cards) return;
  st.nItens = m.cards.length;
  const agora = Date.now();
  for (const c of m.cards) {
    let it = mk.itens.get(c.k);
    if (!it) { it = { n: c.n, r: c.r, hist: { o: [], g: [] } }; mk.itens.set(c.k, it); }
    Object.assign(it, { n: c.n, r: c.r, o: c.o, g: c.g, q: c.q, visto: agora, conta: p.idx });
    for (const moeda of ['o', 'g']) {
      const v = c[moeda];
      if (v == null) continue;
      const h = it.hist[moeda], ult = h[h.length - 1];
      if (!ult || ult[1] !== v || agora - ult[0] > 10 * 60e3) h.push([agora, v]); // guarda mudança ou 1 a cada 10 min
      if (h.length > 40) h.shift();
      checarAlvo(p, c, it, moeda, v);
    }
  }
  if (mk.itens.size > 3000) { // limite de memória: tira os mais antigos
    const velhos = [...mk.itens.entries()].sort((a, b) => a[1].visto - b[1].visto).slice(0, mk.itens.size - 2500);
    velhos.forEach(([k]) => mk.itens.delete(k));
  }
}

function checarAlvo(p, c, it, moeda, v) {
  const motivos = [];
  for (const r of cfg.radar.rules) {
    if (!r.on || !r.q || !(r.max > 0)) continue;
    if (r.moeda !== 'qualquer' && (r.moeda === 'orbs') !== (moeda === 'g')) continue;
    if (!normTxt(c.n).includes(normTxt(r.q))) continue;
    if (v <= r.max) motivos.push(`alvo "${r.q}" até ${precoTxt(r.max, moeda)}`);
  }
  const q = +cfg.radar.queda || 0;
  if (q > 0) {
    const ref = referencia(it, moeda);
    if (ref && v <= ref * (1 - q / 100)) motivos.push(`${Math.round((1 - v / ref) * 100)}% abaixo do normal (${precoTxt(Math.round(ref), moeda)})`);
  }
  if (!motivos.length) return;
  const chave = `${c.k}|${moeda}|${v}`;
  const quando = mk.vistos.get(chave);
  if (quando && Date.now() - quando < 20 * 60e3) return;
  mk.vistos.set(chave, Date.now());
  if (mk.vistos.size > 500) mk.vistos.delete(mk.vistos.keys().next().value);
  const st = mk.contas[p.idx] || {};
  mk.achados.unshift({ t: Date.now(), idx: p.idx, k: c.k, n: c.n, r: c.r, preco: v, moeda, motivo: motivos.join(' · '), aqui: !!st.aqui });
  mk.achados.length = Math.min(mk.achados.length, 60);
  mk.naoLidos++;
  pintarBadge();
  p.el.classList.add('alerta-radar');
  clearTimeout(p.radarT);
  p.radarT = setTimeout(() => p.el.classList.remove('alerta-radar'), 25000);
  alertar(`Radar: ${c.n} por ${precoTxt(v, moeda)}`, `${accName(p)} · ${motivos[0]}${st.aqui ? ' · você está no Mercador' : ' · vá até o Mercador para comprar'}`, p, 990);
  if (drawerOpen('radar')) atualizarRadar();
}

function pintarBadge() {
  const b = $('#radar-badge');
  b.hidden = !mk.naoLidos;
  b.textContent = String(mk.naoLidos);
}

// ---------- Gaveta ----------
function abrirRadar() {
  openDrawer('radar', 'Radar do mercado', 'radar', renderRadar);
  mk.naoLidos = 0;
  pintarBadge();
}

function renderRadar(body) {
  body.innerHTML = `
    <div class="sec"><div class="note">
      Abra a janela do <b>Mercador</b> (tecla <kbd>J</kbd>, aba <b>Comprar</b>) em uma conta e deixe aberta.
      O jogo atualiza a lista sozinho a cada 30 s; para atualizar <b>na hora</b>, aperte <kbd>J</kbd> <kbd>J</kbd> (fecha e abre: o jogo baixa a lista nova e mantém seus filtros).
      O radar vê só o que a lista mostra — tire filtros que escondam o que você procura. Para comprar, a conta precisa estar ao lado do Mercador (Fonte ou cidades).
    </div></div>
    <div class="sec"><div class="sec-t">Contas</div><div class="mk-status" id="rd-status"></div></div>
    <div class="sec"><div class="sec-t">Seus alvos</div>
      <div class="rules" id="rd-rules"></div>
      <div class="row-btns"><button class="pbtn" id="rd-add"><i data-icon="plus"></i>Adicionar alvo</button></div>
      <label class="inline">Avisar também quando o menor preço cair
        <select id="rd-queda"><option value="0">nunca</option><option value="20">20%</option><option value="30">30%</option><option value="40">40%</option><option value="50">50%</option></select>
        abaixo do normal visto pelo radar</label>
    </div>
    <div class="sec"><div class="sec-t">Achados</div><div class="hits" id="rd-hits"></div></div>
    <div class="sec"><div class="sec-t">Lista vista agora</div>
      <input class="field" id="rd-busca" placeholder="Procurar item…" spellcheck="false">
      <table class="mk-table" id="rd-list"></table>
    </div>`;
  hydrateIcons(body);
  renderRules();
  const qd = $('#rd-queda', body);
  qd.value = String(cfg.radar.queda);
  qd.onchange = () => { cfg.radar.queda = +qd.value; save(); };
  $('#rd-add', body).onclick = () => { cfg.radar.rules.push({ q: '', moeda: 'ouro', max: 0, on: true }); save(); renderRules(true); };
  $('#rd-busca', body).oninput = () => atualizarLista();
  atualizarRadar();
}

function renderRules(focarUltimo) {
  const box = $('#rd-rules');
  if (!box) return;
  const rs = cfg.radar.rules;
  box.innerHTML = rs.length ? rs.map((r, i) => `
    <div class="rule" data-i="${i}">
      <input type="text" data-f="q" placeholder="Nome do item (ex.: Gume)" value="${esc(r.q)}" spellcheck="false">
      <select data-f="moeda"><option value="ouro">Ouro</option><option value="orbs">Gemas</option><option value="qualquer">Qualquer</option></select>
      <input type="number" data-f="max" min="0" placeholder="Até…" value="${r.max || ''}">
      <input type="checkbox" class="switch" data-f="on" ${r.on ? 'checked' : ''} data-tip="Alvo ligado">
      <button class="ibtn" data-del data-tip="Remover"><i data-icon="trash"></i></button>
    </div>`).join('') : '<div class="muted" style="font-size:12px">Nenhum alvo ainda. Ex.: "Gume do Infinito", ouro, até 50.000.</div>';
  hydrateIcons(box);
  $$('.rule', box).forEach((row) => {
    const r = rs[+row.dataset.i];
    $('[data-f="moeda"]', row).value = r.moeda;
    row.oninput = row.onchange = (e) => {
      const f = e.target.dataset.f;
      if (!f) return;
      r[f] = f === 'on' ? e.target.checked : f === 'max' ? Math.max(0, +e.target.value || 0) : e.target.value;
      save();
    };
    $('[data-del]', row).onclick = () => { rs.splice(+row.dataset.i, 1); save(); renderRules(); };
  });
  if (focarUltimo) { const ins = $$('[data-f="q"]', box); ins[ins.length - 1]?.focus(); }
}

function atualizarRadar() {
  const st = $('#rd-status');
  if (!st) return;
  const linhas = live().map((p) => {
    const s = p.state, m = mk.contas[p.idx];
    const aberto = m && m.aberto && Date.now() - m.lidoEm < 10e3;
    const desc = !s || !s.loggedIn ? '<span class="muted">fora do jogo</span>'
      : !aberto ? '<span class="muted">Mercador fechado</span>'
      : m.aba !== 'comprar' ? `<span class="muted">aba ${esc(m.aba || '?')}</span>`
      : `${m.nItens ?? '…'} itens · lista nova há ${m.mudou ? agoS(m.mudou) : '—'}`;
    const ond = aberto ? (m.aqui ? '<span class="ok">no Mercador ✓</span>' : '<span class="bad">longe do Mercador</span>') : '';
    return `<div class="mk-row"><b>${esc(accName(p))}</b><span>${desc}</span><span class="spacer"></span>${ond}</div>`;
  });
  st.innerHTML = linhas.join('') || '<div class="muted">Nenhuma conta aberta.</div>';

  const hits = $('#rd-hits');
  hits.innerHTML = mk.achados.length ? mk.achados.slice(0, 25).map((h, i) => {
    const it = mk.itens.get(h.k), aindaLa = it && it[h.moeda] === h.preco && Date.now() - it.visto < 90e3;
    return `<div class="hit${aindaLa ? '' : ' velho'}">
      <span class="hit-n cor-${esc(h.r)}">${esc(h.n)}</span><span class="hit-p ${h.moeda === 'g' ? 'gem' : 'ouro'}">${precoTxt(h.preco, h.moeda)}</span>
      <span class="hit-s">${agoS(h.t)} · ${esc(cfg.accounts[h.idx].name)} · ${esc(h.motivo)}${aindaLa ? '' : ' · <i>pode já ter sido vendido</i>'}<button data-ver="${i}">Ver conta</button></span>
    </div>`;
  }).join('') : '<div class="muted" style="font-size:12px">Nada ainda. Os achados aparecem aqui e como notificação.</div>';
  $$('[data-ver]', hits).forEach((b) => (b.onclick = () => { const h = mk.achados[+b.dataset.ver]; const p = panels[h.idx]; if (p) focusPanel(p, true); }));
  atualizarLista();
}

function atualizarLista() {
  const tb = $('#rd-list');
  if (!tb) return;
  const q = normTxt(($('#rd-busca') || {}).value);
  const queda = +cfg.radar.queda || 0;
  const recentes = [...mk.itens.entries()].filter(([, it]) => Date.now() - it.visto < 5 * 60e3 && (!q || normTxt(it.n).includes(q)));
  recentes.sort((a, b) => (a[1].o ?? Infinity) - (b[1].o ?? Infinity) || (a[1].g ?? Infinity) - (b[1].g ?? Infinity));
  tb.innerHTML = recentes.slice(0, 80).map(([, it]) => {
    const ro = referencia(it, 'o'), rg = referencia(it, 'g');
    const barato = queda > 0 && ((ro && it.o != null && it.o <= ro * (1 - queda / 100)) || (rg && it.g != null && it.g <= rg * (1 - queda / 100)));
    return `<tr class="${barato ? 'barato' : ''}"><td class="cor-${esc(it.r)}">${esc(it.n)}<br><small class="muted">${esc(it.q || '')}</small></td><td class="ouro">${it.o != null ? fmtInt(it.o) : ''}</td><td class="gem">${it.g != null ? fmtInt(it.g) + ' 💠' : ''}</td></tr>`;
  }).join('') || `<tr><td class="muted">${mk.itens.size ? 'Nada com esse nome na lista recente.' : 'Abra o Mercador em uma conta para o radar começar a ler.'}</td></tr>`;
}
