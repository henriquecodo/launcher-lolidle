/**
 * Calculadora de build — roda dentro da conta, só quando você pede, e só LÊ.
 *
 * Usa as fórmulas do PRÓPRIO jogo: importa o módulo de regras dele (js/motor.js, "sem DOM, para poder
 * simular") e chama atributos() — a mesma conta que o jogo faz para mostrar seus atributos — e a fórmula
 * do "Poder real" do jogo (poderPartes, patch ppd1): Poder = C × F(campeão) × (dano × vida)^G.
 *
 * Do que está na tela, lê: campeão, nível, pontos em cada atributo, pontos livres e itens equipados.
 * Bônus que não aparecem na tela (conquistas, mascote, Codex, cartas) entram por calibração: compara o
 * que a fórmula dá com o que o jogo mostra e corrige pela diferença (são multiplicadores, então a melhor
 * distribuição não muda).
 *
 * Não muda nada no jogo: devolve só a recomendação. Você coloca os pontos com seus cliques.
 */
(async () => {
  try {
    const M = await import('/js/motor.js'); // o mesmo módulo que o jogo já carregou (não baixa de novo)
    const $ = (s) => document.querySelector(s);
    const num = (s) => {
      const m = String(s || '').replace(/\s/g, '').match(/([\d.,]+)\s*([kKmM]?)/);
      if (!m) return 0;
      const mult = /k/i.test(m[2]) ? 1e3 : /m/i.test(m[2]) ? 1e6 : 1;
      const v = mult > 1 ? m[1].replace(',', '.') : m[1].replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
      return (parseFloat(v) || 0) * mult;
    };
    // valor sem os efeitos passageiros (o jogo põe "Sem os efeitos: X · agora: Y" na dica quando há buff)
    const mostrado = (sel) => {
      const el = $(sel);
      if (!el || el.closest('[hidden]')) return 0;
      const d = el.dataset.dicaB || '';
      const m = el.classList.contains('st-buff') && d.match(/:\s*([\d.,kKmM]+)/);
      return m ? num(m[1]) : num(el.textContent);
    };

    const ret = $('#hud-retrato');
    const camp = ret && ret.dataset.qual ? ret.dataset.qual.split(':')[0] : '';
    if (!camp || !M.KITS[camp]) return { erro: 'Entre no jogo com o personagem para calcular.' };
    const nivel = parseInt(($('#st-nivel') || {}).textContent, 10) || 1;
    const CHAVES = ['forca', 'vitalidade', 'resistencia', 'agilidade', 'foco'];
    const atual = {};
    for (const k of CHAVES) atual[k] = Math.max(0, Math.round(num(($(`#atributos [data-valor="${k}"]`) || {}).textContent)));
    const livres = (() => { const m = (($('#atrib-pontos') || {}).textContent || '').match(/\d+/); return m ? +m[0] : 0; })();
    const itens = [...document.querySelectorAll('#equip .slot')].map((s) => s.dataset.id).filter((x) => x && M.ITENS[M.baseId(x)]);
    const base = { campeao: camp, nivel, atrib: atual, itens, ranks: {}, conquistas: [], codex: {}, mascote: null };

    // ---- calibração pelo que o jogo mostra ----
    const a0 = M.atributos(base);
    const vidaTxt = (($('#st-vida-txt') || {}).textContent || '').split('/')[1];
    const tela = { ad: mostrado('#st-ad'), armadura: mostrado('#st-arm'), rm: mostrado('#st-rm'), ap: mostrado('#st-ap'), velAtaque: mostrado('#st-va'), vida: num(vidaTxt) };
    const fator = {};
    for (const [k, v] of Object.entries(tela)) {
      const c = a0[k];
      const r = c > 0 && v > 0 ? v / c : 1;
      fator[k] = r > 0.6 && r < 2.5 ? r : 1; // fora disso a leitura falhou: usa a fórmula pura
    }
    const magia = !!M.KITS[camp].magia;
    const P = M.PODER;

    function avaliar(at) {
      const a = M.atributos({ ...base, atrib: at });
      const ad = a.ad * fator.ad, ap = (a.ap || 0) * fator.ap, vidaMax = a.vida * fator.vida;
      const arm = a.armadura * fator.armadura, rm = a.rm * fator.rm;
      const va = Math.min(M.VEL_ATAQUE_MAX, (a.velAtaque || 1) * fator.velAtaque);
      const hab = 1 + (a.danoHab || 0);
      const crit = 1 + Math.min(1, a.critico || 0) * ((a.danoCritico || 2) - 1);
      const dano = (magia
        ? (ap + (a.baseAd || 0) * fator.ad) * (1 + (a.reducaoRecarga || 0)) * (1 + 0.5 * (a.penMagica || 0) / 100) * P.K
        : ad * Math.min(P.velMax, va) * crit * (1 + 0.5 * (a.penArmadura || 0))) * hab;
      const vida = vidaMax * (2 + arm / 100 + rm / 100) / 2 / (1 - Math.min(0.6, a.esquiva || 0)) * (1 + 0.5 * ((a.rouboVida || 0) + (a.vampirismo || 0)));
      const poder = P.C * (P.F[camp] || 1) * Math.max(0, dano * vida) ** P.G;
      return {
        dano, vida, poder,
        stats: { ad, ap, vida: vidaMax, armadura: arm, rm, va, esquiva: a.esquiva || 0, recarga: a.reducaoRecarga || 0, mana: a.mana || 0, critico: a.critico || 0 },
      };
    }

    // Sobe pela encosta: troca pontos entre dois atributos enquanto melhorar, com passos cada vez menores.
    function otimizar(piso, total, w) {
      const nota = (at) => { const r = avaliar(at); return w * Math.log(Math.max(1e-9, r.dano)) + (1 - w) * Math.log(Math.max(1e-9, r.vida)); };
      const livre = total - CHAVES.reduce((s, k) => s + piso[k], 0);
      const sementes = [{ ...atual }];
      const igual = { ...piso }; CHAVES.forEach((k, i) => (igual[k] += Math.floor(livre / 5) + (i < livre % 5 ? 1 : 0)));
      sementes.push(igual);
      for (const k of CHAVES) sementes.push({ ...piso, [k]: piso[k] + livre });
      let melhor = null, melhorNota = -Infinity;
      for (const s0 of sementes) {
        if (CHAVES.reduce((s, k) => s + s0[k], 0) !== total || CHAVES.some((k) => s0[k] < piso[k])) continue;
        let at = { ...s0 }, n = nota(at);
        for (let passo = Math.max(1, Math.floor(livre / 4)); passo >= 1; passo = passo === 1 ? 0 : Math.max(1, Math.floor(passo / 2))) {
          let mexeu = true, voltas = 0;
          while (mexeu && voltas++ < 200) {
            mexeu = false;
            for (const de of CHAVES) for (const para of CHAVES) {
              if (de === para || at[de] - passo < piso[de]) continue;
              const tenta = { ...at, [de]: at[de] - passo, [para]: at[para] + passo };
              const nt = nota(tenta);
              if (nt > n + 1e-12) { at = tenta; n = nt; mexeu = true; }
            }
          }
        }
        if (n > melhorNota) { melhorNota = n; melhor = at; }
      }
      return melhor;
    }

    const total = CHAVES.reduce((s, k) => s + atual[k], 0) + livres;
    const zero = Object.fromEntries(CHAVES.map((k) => [k, 0]));
    const MODOS = [
      { id: 'dano', nome: 'Farm rápido', desc: 'Mata mais rápido; aguenta um pouco menos.', w: 0.72 },
      { id: 'poder', nome: 'Poder máximo', desc: 'O maior Poder pela fórmula do jogo (dano × vida).', w: 0.5 },
      { id: 'tanque', nome: 'Sobrevivência', desc: 'Para zonas difíceis e chefes: morre bem menos.', w: 0.28 },
    ];
    const agora = avaliar(atual);
    const resumo = (at) => { const r = avaliar(at); return { atrib: at, poder: r.poder, dano: r.dano, vida: r.vida, stats: r.stats }; };
    const modos = MODOS.map((m) => ({
      ...m,
      livres: livres > 0 ? resumo(otimizar(atual, total, m.w)) : null,   // onde pôr os pontos livres agora (sem reset)
      ideal: resumo(otimizar(zero, total, m.w)),                         // a distribuição ideal (com reset)
    }));
    const info = Object.fromEntries(Object.entries(M.atributosDe(base)).map(([k, at]) => [k, { nome: at.nome, curto: at.curto, efeito: at.efeito, serve: at.serve }]));
    return {
      camp, nivel, magia, total, livres, atual: resumo(atual), agoraPoder: agora.poder,
      itens: itens.length, fator, info, chaves: CHAVES, modos,
      dica: (M.DICA_ATRIBUTOS || {})[camp] || '',
      pontosPorNivel: M.PONTOS_POR_NIVEL,
    };
  } catch (e) {
    return { erro: 'Não deu para calcular: ' + (e && e.message ? e.message : e) };
  }
})()
