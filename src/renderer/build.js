/**
 * Calculadora de build: pede à conta o cálculo (src/game/build-engine.js, com as fórmulas do jogo)
 * e mostra onde colocar os pontos de atributo. Não coloca nada: você aplica com os seus cliques.
 */
let buildConta = null, buildRes = null, buildAba = 'livres';

function abrirBuild(p) {
  buildConta = p;
  if (drawerOpen('build')) { renderBuild($('#drawer-body')); return; }
  openDrawer('build', 'Calculadora de build', 'sword', renderBuild);
}

async function calcularBuild(p) {
  if (DEMO && window.DEMO_BUILD) return window.DEMO_BUILD;
  if (!p || !p.ready) return { erro: 'A conta ainda está carregando.' };
  if (!(p.state && p.state.loggedIn)) return { erro: 'Entre no jogo nessa conta para calcular.' };
  try {
    const src = await window.launcher.buildSource();
    return (await p.wv.executeJavaScript(src)) || { erro: 'Sem resposta da conta.' };
  } catch (e) { return { erro: 'Não deu para calcular: ' + (e.message || e) }; }
}

async function renderBuild(body) {
  const contas = online();
  if (!buildConta || !contas.includes(buildConta)) buildConta = contas[0] || buildConta;
  body.innerHTML = `
    <div class="bd-top">
      <select id="bd-conta">${contas.map((p) => `<option value="${p.idx}">${esc(accName(p))} — ${esc(CAMPEOES[p.state.camp] || p.state.camp)} Nv ${p.state.nivel}</option>`).join('') || '<option>Nenhuma conta online</option>'}</select>
      <button class="pbtn gold" id="bd-calc" style="flex:none;padding:0 14px"><i data-icon="reload"></i>Calcular</button>
    </div>
    <div id="bd-out"><div class="loading"><span class="spin"></span>Calculando com as fórmulas do jogo…</div></div>`;
  hydrateIcons(body);
  const sel = $('#bd-conta', body);
  if (buildConta) sel.value = String(buildConta.idx);
  sel.onchange = () => { buildConta = panels[+sel.value]; renderBuild(body); };
  $('#bd-calc', body).onclick = () => renderBuild(body);
  const p = buildConta;
  const r = await calcularBuild(p);
  if (p !== buildConta || !drawerOpen('build')) return;
  buildRes = r;
  if (r.livres > 0 && buildAba !== 'ideal') buildAba = 'livres';
  if (!(r.livres > 0)) buildAba = 'ideal';
  desenharBuild();
}

function desenharBuild() {
  const out = $('#bd-out'), r = buildRes;
  if (!out || !r) return;
  if (r.erro) { out.innerHTML = `<div class="note">${esc(r.erro)}</div>`; return; }
  const chaves = r.chaves, nomeAt = (k) => (r.info[k] ? r.info[k].nome : k);
  const ganho = (x) => (r.atual.poder > 0 ? (x.poder / r.atual.poder - 1) * 100 : 0);
  const sinal = (v) => (v > 0.05 ? `<span class="ok">+${v.toFixed(1)}%</span>` : v < -0.05 ? `<span class="bad">${v.toFixed(1)}%</span>` : '<span class="muted">igual</span>');
  const maxV = Math.max(1, ...r.modos.flatMap((m) => [m.ideal, m.livres].filter(Boolean).flatMap((x) => chaves.map((k) => x.atrib[k]))), ...chaves.map((k) => r.atual.atrib[k]));
  const stats = (x) => {
    const s = x.stats;
    const golpe = r.magia ? `<span>Poder hab. <b>${fmtInt(s.ap)}</b></span>` : `<span>Dano <b>${fmtInt(s.ad)}</b></span><span>Vel. ataque <b>${s.va.toFixed(2)}</b></span>`;
    return `<div class="mini-stats">${golpe}<span>Vida <b>${fmtInt(s.vida)}</b></span><span>Armadura <b>${fmtInt(s.armadura)}</b></span><span>Res. mágica <b>${fmtInt(s.rm)}</b></span><span>Esquiva <b>${(s.esquiva * 100).toFixed(1)}%</b></span><span>Recarga <b>−${(s.recarga * 100).toFixed(1)}%</b></span></div>`;
  };
  const blocoModo = (m) => {
    const x = buildAba === 'livres' ? m.livres : m.ideal;
    if (!x) return '';
    const linhas = chaves.map((k) => {
      const atual = r.atual.atrib[k], rec = x.atrib[k], d = rec - atual;
      return `<span>${esc(nomeAt(k))}</span>
        <span class="bar"><i style="width:${(atual / maxV) * 100}%"></i><span style="width:${(rec / maxV) * 100}%"></span></span>
        <span class="v">${rec}${d ? `<small class="${d < 0 ? 'neg' : ''}">${d > 0 ? '+' : ''}${d}</small>` : ''}</span>`;
    }).join('');
    return `<div class="mode${m.id === 'poder' ? ' best' : ''}">
      <div class="mode-h"><b>${esc(m.nome)}</b>${m.id === 'poder' ? '<span class="chip lvl">recomendado</span>' : ''}<span class="gain">${sinal(ganho(x))}</span></div>
      <div class="mode-d">${esc(m.desc)} Dano ${sinal((x.dano / r.atual.dano - 1) * 100)} · vida efetiva ${sinal((x.vida / r.atual.vida - 1) * 100)}</div>
      <div class="alloc">${linhas}</div>${stats(x)}
    </div>`;
  };
  const fatores = Object.entries(r.fator).filter(([, v]) => Math.abs(v - 1) > 0.01).map(([k, v]) => `${k} ×${v.toFixed(2)}`).join(', ');
  out.innerHTML = `
    <div class="bd-head">
      <div class="kpi"><span>Campeão</span><b>${esc(CAMPEOES[r.camp] || r.camp)} ${r.nivel}</b></div>
      <div class="kpi"><span>Pontos</span><b>${r.total}</b>${r.livres ? ` <small class="ok">${r.livres} livres</small>` : ''}</div>
      <div class="kpi"><span>Poder real</span><b>${fmt(r.atual.poder)}</b></div>
    </div>
    <div class="tabs">
      <button data-aba="livres" ${r.livres > 0 ? '' : 'disabled'} class="${buildAba === 'livres' ? 'on' : ''}">Pontos livres agora${r.livres ? ` (${r.livres})` : ''}</button>
      <button data-aba="ideal" class="${buildAba === 'ideal' ? 'on' : ''}">Ideal (com reset)</button>
    </div>
    <div class="note" style="margin-bottom:10px">${buildAba === 'livres'
      ? `Onde pôr os <b>${r.livres}</b> pontos que sobraram, sem tirar nenhum do lugar. No jogo: aba <b>Atributos</b>, botão <b>+</b> (Shift + clique = 10 pontos).`
      : 'A melhor distribuição de todos os pontos. Para chegar nela, é preciso o reset de atributos da aba Loja do jogo.'}
      A barra clara é o que você tem; a dourada, a recomendação.</div>
    ${r.modos.map(blocoModo).join('')}
    <div class="sec"><div class="sec-t">O que cada ponto dá</div><div class="attr-info">
      ${chaves.map((k) => `<div><b>${esc(nomeAt(k))}</b> — ${esc(r.info[k]?.efeito || '')}.</div>`).join('')}
    </div></div>
    ${r.dica ? `<div class="sec"><div class="sec-t">Dica do jogo</div><div class="note">${esc(r.dica)}</div></div>` : ''}
    <div class="pop-foot">Conta feita com as regras do próprio jogo (js/motor.js: atributos() e a fórmula do Poder real, dano × vida). Itens equipados: ${r.itens}. ${fatores ? `Bônus que não aparecem na tela (conquistas, mascote, Codex, cartas) calibrados pelo que o jogo mostra: ${esc(fatores)}.` : ''} Efeitos de habilidades e buffs passageiros ficam de fora.</div>`;
  $$('.tabs button', out).forEach((b) => (b.onclick = () => { buildAba = b.dataset.aba; desenharBuild(); }));
}
