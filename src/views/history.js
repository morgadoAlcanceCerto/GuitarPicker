import { el, pageHead, stat, select, lineChart, getVar, fmtTime, clear, progressBar, download, toast } from "../ui/components.js";
import { Store } from "../state.js";
import { INSTRUMENTS } from "../music/notes.js";
import { collectionStats, RARITIES } from "../cosmetics/index.js";

export default function history(ctx) {
  const { el: root, navigate } = ctx;
  let instFilter = "all", viewMode = "all";

  root.appendChild(pageHead("Progresso", "Acompanhe sua evolução por instrumento e por sessão."));

  const all = Store.historyFor();
  if (!all.length) {
    root.appendChild(el("div.panel.center", {}, [
      el("h2", { text: "Nenhuma sessão ainda" }),
      el("p.muted", { text: "Toque uma música ou um exercício e seus resultados aparecem aqui." }),
      el("button.btn.primary", { onclick: () => navigate("#/library") }, ["Ver músicas"]),
    ]));
    root.appendChild(buildCollectionPanel(navigate));
    return;
  }

  const usedInstruments = [...new Set(all.map((h) => h.instrument))];
  const instSel = select({ label: "Instrumento", value: instFilter,
    options: [{ value: "all", label: "Todos os instrumentos" }, ...usedInstruments.map((i) => ({ value: i, label: INSTRUMENTS[i]?.name || i }))],
    onchange: (v) => { instFilter = v; renderAll(); } });
  const viewSel = select({ label: "Ver", value: viewMode,
    options: [["all", "Todas as sessões"], ["today", "Hoje"], ["bysong", "Por música (melhor)"]].map(([v, l]) => ({ value: v, label: l })),
    onchange: (v) => { viewMode = v; renderAll(); } });
  const aiBtn = el("button.btn", {
    title: "Baixa um relatório da sua prática em Markdown — mande para o Claude analisar sua evolução e montar um plano de estudo",
    onclick: () => {
      const d = new Date().toISOString().slice(0, 10);
      download(`guitarpicker-progress-${d}.md`, buildProgressReport(all), "text/markdown");
      toast("Relatório salvo — abra com o Claude para a análise", "good");
    },
  }, ["🤖 Exportar para o Claude"]);
  root.appendChild(el("div.panel.tight", { style: { marginBottom: "16px" } }, [
    el("div.row", {}, [instSel, viewSel, el("div", { style: { flex: "1" } }), aiBtn]),
  ]));

  // cosmetics collection progress (independent of the session filters)
  root.appendChild(buildCollectionPanel(navigate));

  const summary = el("div.grid.cards", { style: { marginBottom: "16px" } });
  root.appendChild(summary);

  const charts = el("div.panel", {}, [el("h2", { text: "Evolução" })]);
  const accCanvas = el("canvas.chart");
  const scoreCanvas = el("canvas.chart");
  charts.append(
    el("div.legend", {}, [
      el("span", { html: `<i style="background:${getVar("--good")}"></i>Precisão %` }),
      el("span", { html: `<i style="background:${getVar("--accent")}"></i>Pontos (em escala)` }),
    ]),
    accCanvas, scoreCanvas,
  );
  root.appendChild(charts);

  const tableWrap = el("div.panel", {}, [el("h2", { text: "Sessões" })]);
  const table = el("div");
  tableWrap.appendChild(table);
  root.appendChild(tableWrap);

  renderAll();

  function filtered() {
    let rows = instFilter === "all" ? all : all.filter((h) => h.instrument === instFilter);
    if (viewMode === "today") {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      rows = rows.filter((h) => h.ts >= start.getTime());
    }
    return rows;
  }

  function renderAll() {
    const rows = filtered();
    // summary
    clear(summary);
    const avgAcc = rows.length ? Math.round(rows.reduce((a, h) => a + h.accuracy, 0) / rows.length) : 0;
    const totalTime = rows.reduce((a, h) => a + (h.durationSec || 0), 0);
    const best = rows.reduce((a, h) => Math.max(a, h.maxStreak || 0), 0);
    const passes = rows.filter((h) => h.passed).length;
    const coinsThis = rows.reduce((a, h) => a + (h.coins || 0), 0);
    summary.append(
      stat(rows.length, "Sessões"),
      stat(avgAcc + "%", "Precisão média"),
      stat(passes, "Aprovações"),
      stat(best, "Melhor sequência"),
      stat(fmtTime(totalTime), "Tempo tocado"),
      stat("🪙 " + coinsThis, "Moedas ganhas"),
    );

    // charts (chronological)
    const chrono = rows.slice().sort((a, b) => a.ts - b.ts);
    const accPts = chrono.map((h, i) => ({ x: i, y: h.accuracy }));
    const scorePts = chrono.map((h, i) => ({ x: i, y: Math.min(100, h.score / 50) }));
    requestAnimationFrame(() => {
      lineChart(accCanvas, [{ color: getVar("--good"), points: accPts }], { minY: 0, maxY: 100 });
      lineChart(scoreCanvas, [{ color: getVar("--accent"), points: scorePts }], { minY: 0, maxY: 100 });
    });

    // table
    clear(table);
    let display = rows.slice().sort((a, b) => b.ts - a.ts);
    if (viewMode === "bysong") {
      const bySong = new Map();
      for (const h of rows) {
        const cur = bySong.get(h.songId);
        if (!cur || h.score > cur.score) bySong.set(h.songId, h);
      }
      display = [...bySong.values()].sort((a, b) => b.score - a.score);
    }
    const t = el("table.data", {}, [
      el("tr", {}, ["Quando", "Música", "Instrumento", "Pontos", "Precisão", "Sequência", "Resultado"].map((h) => el("th", { text: h }))),
      ...display.slice(0, 200).map((h) => el("tr", {}, [
        el("td", { text: new Date(h.ts).toLocaleString() }),
        el("td", { text: h.songTitle || h.songId }),
        el("td", { text: INSTRUMENTS[h.instrument]?.name || h.instrument }),
        el("td", { text: h.score.toLocaleString() }),
        el("td", { text: h.accuracy + "%" }),
        el("td", { text: h.maxStreak }),
        el("td", { html: h.passed ? `<span style="color:${getVar("--good")}">Aprovado</span>` : `<span style="color:${getVar("--bad")}">—</span>` }),
      ])),
    ]);
    table.appendChild(t);
  }

  // re-draw charts on resize
  const onResize = () => renderAll();
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}

// Markdown practice report for AI analysis (Claude / Claude Cowork). Plain
// tables, newest first — no app knowledge needed to read it.
export function buildProgressReport(all) {
  const rows = all.slice().sort((a, b) => b.ts - a.ts);
  const day = (ts) => new Date(ts).toISOString().slice(0, 10);
  const avgAcc = Math.round(rows.reduce((a, h) => a + h.accuracy, 0) / rows.length);
  const totalTime = rows.reduce((a, h) => a + (h.durationSec || 0), 0);
  const streak = Store.settings().streak || { count: 0, best: 0 };

  const bySong = new Map();
  for (const h of rows) {
    const s = bySong.get(h.songId) || { title: h.songTitle || h.songId, inst: h.instrument, attempts: 0, passes: 0, bestScore: 0, bestAcc: 0 };
    s.attempts++; if (h.passed) s.passes++;
    s.bestScore = Math.max(s.bestScore, h.score); s.bestAcc = Math.max(s.bestAcc, h.accuracy);
    bySong.set(h.songId, s);
  }
  const songRows = [...bySong.values()].sort((a, b) => b.attempts - a.attempts)
    .map((s) => `| ${s.title} | ${INSTRUMENTS[s.inst]?.name || s.inst} | ${s.attempts} | ${s.passes} | ${s.bestAcc}% | ${s.bestScore.toLocaleString()} |`);

  const sessionRows = rows.map((h) => {
    const n = h.notes || {};
    return `| ${new Date(h.ts).toISOString().slice(0, 16).replace("T", " ")} | ${h.songTitle || h.songId} | ${h.accuracy}% | ${h.score.toLocaleString()} | ${h.maxStreak} | ${h.passed ? "aprovado" : "reprovado"} | ${n.perfect ?? ""}/${n.good ?? ""}/${n.off ?? ""}/${n.miss ?? ""} |`;
  });

  return `# Relatório de prática do GuitarPicker

Gerado em ${new Date().toISOString().slice(0, 10)} · exportado do GuitarPicker (precisão = avaliação por detecção de nota do que foi tocado de verdade).

> **Sugestão de pedido:** Aja como meu professor de violão. Analise este registro de prática: evolução da precisão e dos pontos ao longo do tempo, constância da prática, quais músicas precisam de mais trabalho e onde eu estacionei. Termine com um plano de estudo focado para a próxima semana.

## Resumo

- Sessões: ${rows.length} (${day(rows[rows.length - 1].ts)} → ${day(rows[0].ts)})
- Precisão média: ${avgAcc}% · aprovações: ${rows.filter((h) => h.passed).length}/${rows.length}
- Tempo total tocado: ${fmtTime(totalTime)}
- Sequência de dias praticando: ${streak.count} (recorde ${streak.best})

## Por música

| Música | Instrumento | Tentativas | Aprovações | Melhor precisão | Melhores pontos |
|---|---|---|---|---|---|
${songRows.join("\n")}

## Sessões (mais novas primeiro — a coluna Notas é perfeitas/boas/fora/erradas)

| Quando (UTC) | Música | Precisão | Pontos | Melhor sequência | Resultado | Notas |
|---|---|---|---|---|---|---|
${sessionRows.join("\n")}
`;
}

// Cosmetics collection summary: coin balance, overall completion bar, and a
// per-rarity breakdown. Links to the Locker to spend coins.
function buildCollectionPanel(navigate) {
  const cs = collectionStats();
  const frac = cs.total ? cs.owned / cs.total : 0;
  const tiers = Object.values(RARITIES).filter((r) => r.id !== "common").sort((a, b) => a.order - b.order);

  const chips = el("div.row", { style: { gap: "8px", flexWrap: "wrap", marginTop: "12px" } });
  for (const r of tiers) {
    const b = cs.byRarity[r.id] || { total: 0, owned: 0 };
    if (!b.total) continue;
    chips.appendChild(el("span", {
      style: { fontSize: "12px", padding: "4px 10px", borderRadius: "999px",
        border: `1px solid ${r.color}`, color: r.color },
      text: `${r.name} ${b.owned}/${b.total}`,
    }));
  }

  return el("div.panel", { style: { marginBottom: "16px" } }, [
    el("div.spread", {}, [
      el("h2", { text: "🎨 Coleção" }),
      el("div.row", { style: { gap: "12px", alignItems: "center" } }, [
        el("span.muted", { html: `🪙 <b style="color:var(--warn)">${cs.coins.toLocaleString()}</b> moedas` }),
        navigate ? el("button.btn", { onclick: () => navigate("#/locker") }, ["Abrir Armário"]) : null,
      ]),
    ]),
    el("div.muted", { style: { margin: "4px 0 8px", fontSize: "13px" },
      text: `${cs.owned} de ${cs.total} itens desbloqueáveis coletados (${Math.round(frac * 100)}%)` }),
    progressBar(frac),
    chips,
  ]);
}
