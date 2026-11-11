/**
 * Modo demonstração — só para os prints do README (npm start com LAUNCHER_DEMO=contas|build|radar).
 * Não existe no .exe (src/demo fica fora do pacote). Contas e números fictícios; nenhum dado real.
 * O resultado da calculadora foi gerado pelo próprio build-engine.js com um Yasuo nível 62 de exemplo.
 */
/* eslint-disable */
(function demo() {
  window.DEMO_BUILD = {"camp":"yasuo","nivel":62,"magia":false,"total":183,"livres":9,"atual":{"atrib":{"forca":70,"vitalidade":46,"resistencia":18,"agilidade":30,"foco":10},"poder":6524.714682226963,"dano":4179.43488,"vida":43826.81837837838,"stats":{"ad":744,"ap":0,"vida":8220,"armadura":390,"rm":264,"va":2.84,"esquiva":0.075,"recarga":0.04,"mana":100,"critico":1}},"agoraPoder":6524.714682226963,"itens":6,"fator":{"ad":0.9999811831497795,"armadura":1.0010266940451746,"rm":1.0018975332068312,"ap":1,"velAtaque":0.9999031783894164,"vida":1},"info":{"forca":{"nome":"Força","curto":"+1,2 dano","efeito":"+1,2 de dano de ataque","serve":"Mais dano em todos os ataques e habilidades."},"vitalidade":{"nome":"Vitalidade","curto":"+20 vida","efeito":"+20 de vida máxima e +0,1 de regeneração de vida por segundo","serve":"Mais vida: aguenta mais tempo sem poção."},"resistencia":{"nome":"Resistência","curto":"+1,5 armadura, +1 res. mágica","efeito":"+1,5 de armadura e +1 de resistência mágica","serve":"Toma menos dano dos golpes físicos e mágicos."},"agilidade":{"nome":"Agilidade","curto":"+0,8% vel. ataque, +0,25% esquiva","efeito":"+0,8% de velocidade de ataque e +0,25% de esquiva (máx. 25%)","serve":"Ataca mais rápido e às vezes desvia dos golpes."},"foco":{"nome":"Foco","curto":"−0,4% recarga, +1% Fluxo","efeito":"−0,4% de recarga (máx. 30%) e +1% de Fluxo ganho","serve":"Habilidades voltando mais rápido e o Fluxo enchendo mais rápido (o escudo de vento vem mais vezes)."}},"chaves":["forca","vitalidade","resistencia","agilidade","foco"],"modos":[{"id":"dano","nome":"Farm rápido","desc":"Mata mais rápido; aguenta um pouco menos.","w":0.72,"livres":{"atrib":{"forca":70,"vitalidade":46,"resistencia":18,"agilidade":39,"foco":10},"poder":6623.054984072005,"dano":4253.280109781594,"vida":44919.453739612196,"stats":{"ad":744,"ap":0,"vida":8220,"armadura":390,"rm":264,"va":2.8901791411042943,"esquiva":0.0975,"recarga":0.04,"mana":100,"critico":1}},"ideal":{"atrib":{"forca":124,"vitalidade":0,"resistencia":0,"agilidade":59,"foco":0},"poder":6645.647114769557,"dano":4822.016001790058,"vida":40003.29495404731,"stats":{"ad":812.6867075081921,"ap":0,"vida":7300,"armadura":362.9722792607803,"rm":245.96584440227704,"va":2.9997095351682495,"esquiva":0.1475,"recarga":0,"mana":100,"critico":1}}},{"id":"poder","nome":"Poder máximo","desc":"O maior Poder pela fórmula do jogo (dano × vida).","w":0.5,"livres":{"atrib":{"forca":70,"vitalidade":46,"resistencia":18,"agilidade":39,"foco":10},"poder":6623.054984072005,"dano":4253.280109781594,"vida":44919.453739612196,"stats":{"ad":744,"ap":0,"vida":8220,"armadura":390,"rm":264,"va":2.8901791411042943,"esquiva":0.0975,"recarga":0.04,"mana":100,"critico":1}},"ideal":{"atrib":{"forca":0,"vitalidade":21,"resistencia":62,"agilidade":100,"foco":0},"poder":6993.701374998937,"dano":3886.1662808218034,"vida":57313.00709926787,"stats":{"ad":654.9616754523437,"ap":0,"vida":7720,"armadura":456.06776180698154,"rm":308.0834914611006,"va":2.9997095351682495,"esquiva":0.25,"recarga":0,"mana":100,"critico":1}}},{"id":"tanque","nome":"Sobrevivência","desc":"Para zonas difíceis e chefes: morre bem menos.","w":0.28,"livres":{"atrib":{"forca":70,"vitalidade":46,"resistencia":18,"agilidade":39,"foco":10},"poder":6623.054984072005,"dano":4253.280109781594,"vida":44919.453739612196,"stats":{"ad":744,"ap":0,"vida":8220,"armadura":390,"rm":264,"va":2.8901791411042943,"esquiva":0.0975,"recarga":0.04,"mana":100,"critico":1}},"ideal":{"atrib":{"forca":0,"vitalidade":21,"resistencia":62,"agilidade":100,"foco":0},"poder":6993.701374998937,"dano":3886.1662808218034,"vida":57313.00709926787,"stats":{"ad":654.9616754523437,"ap":0,"vida":7720,"armadura":456.06776180698154,"rm":308.0834914611006,"va":2.9997095351682495,"esquiva":0.25,"recarga":0,"mana":100,"critico":1}}}],"dica":"Yasuo luta colado e vive do crítico: Força e Agilidade dão dano e velocidade de ataque (que também acelera a Tempestade de Aço); Vitalidade segura os golpes até o escudo do Fluxo encher.","pontosPorNivel":3};
  cfg.notify = false; cfg.beep = false;
  const CONTAS = [
    { name: 'Principal', camp: 'yasuo', nivel: 62, xpPct: 63.4, xpMax: 48.2e6, ouro: 18.4e6, local: 'Covil do Barão', xph: 9.8e6, tarefa: { pronta: false, txt: 'Tarefa: Barão', num: '38/60' } },
    { name: 'Alt 1', camp: 'aphelios', nivel: 48, xpPct: 21.7, xpMax: 14.1e6, ouro: 3.9e6, local: 'Rota Inferior', xph: 4.1e6, tarefa: { pronta: true, txt: 'Tarefa pronta! Fale com o Capitão', num: '40/40' } },
    { name: 'Alt 2', camp: 'lux', nivel: 35, xpPct: 88.2, xpMax: 2.6e6, ouro: 0.94e6, local: 'Selva', xph: 1.3e6, tarefa: { pronta: false, txt: 'Tarefa: Krugs', num: '12/30' } },
  ];
  function aplicar() {
    CONTAS.forEach((c, i) => {
      const p = panels[i];
      if (!p) return;
      cfg.accounts[i].name = c.name;
      const now = Date.now();
      p.gained = c.xph / 6;
      p.samples = [[now - 10 * 60e3, 0], [now, p.gained]];
      p.lastXp = { cur: (c.xpPct / 100) * c.xpMax, max: c.xpMax, nivel: c.nivel };
      p.state = { loggedIn: true, login: false, nick: c.name, camp: c.camp, nivel: c.nivel, xpPct: c.xpPct, xpMax: c.xpMax, ouro: c.ouro, poder: '', local: c.local,
        tarefa: c.tarefa, captcha: false, dialogo: '', avisos: [], mercado: null, idleMs: 1e9, pontosLivres: 0 };
      renderPanel(p);
    });
    renderTotals();
  }
  // Mercado de exemplo: histórico "normal" e, na última leitura, dois itens bem abaixo do normal.
  function mercado() {
    cfg.radar.rules = [
      { q: 'Gume do Infinito', moeda: 'ouro', max: 2400000, on: true },
      { q: 'Dança da Morte', moeda: 'orbs', max: 900, on: true },
    ];
    cfg.radar.queda = 30;
    const base = [
      ['g:3031', 'Gume do Infinito +6', 'lendario', 3100000, 1450], ['g:6333', 'Dança da Morte +4', 'lendario', 1850000, 1180],
      ['g:3072', 'Sedenta por Sangue +5', 'lendario', 2650000, 1320], ['g:3153', 'Espada do Rei Destruído +3', 'lendario', 1500000, 720],
      ['g:3036', 'Lembranças do Lorde Dominik', 'lendario', 980000, 520], ['g:3172', 'Grevas Bélicas +2', 'epico', 410000, 240],
      ['g:3074', 'Hidra Raivosa +7', 'mitico', 7400000, 3600], ['g:3089', 'Capuz da Morte de Rabadon +1', 'lendario', 2200000, 1100],
      ['g:3004', 'Manamune +2', 'lendario', 1340000, 690], ['g:2501', 'Armadura Sangrenta do Suserano', 'epico', 360000, 210],
    ];
    const cards = (f) => base.map(([k, n, r, o, g]) => ({ k, n, r, o: Math.round(o * f(k)), g: Math.round(g * f(k)), q: '3 à venda' }));
    const t0 = Date.now() - 50 * 60e3;
    for (const [k, n, r, o, g] of base) {
      mk.itens.set(k, { n, r, o, g, q: '3 à venda', visto: Date.now(), conta: 0,
        hist: { o: [0, 1, 2, 3, 4].map((j) => [t0 + j * 11 * 60e3, Math.round(o * (0.97 + 0.015 * j))]), g: [0, 1, 2, 3, 4].map((j) => [t0 + j * 11 * 60e3, Math.round(g * (0.97 + 0.015 * j))]) } });
    }
    const barato = { 'g:3031': 0.72, 'g:6333': 0.66, 'g:3153': 0.62 };
    onMercado(panels[0], { aberto: true, aba: 'comprar', aqui: true, mudou: Date.now() - 14000, cards: cards((k) => barato[k] || 1) });
    if (panels[1]) onMercado(panels[1], { aberto: true, aba: 'comprar', aqui: false, mudou: Date.now() - 41000, cards: null });
    mk.achados.forEach((h, i) => (h.t = Date.now() - (i + 1) * 47e3));
  }
  aplicar();
  setInterval(aplicar, 2000);
  setTimeout(() => {
    if (DEMO === 'build') { buildAba = 'ideal'; abrirBuild(panels[0]); }
    if (DEMO === 'radar') { mercado(); abrirRadar(); }
    setTimeout(() => document.getElementById('toast').classList.remove('show'), 300);
  }, 5000);
})();
