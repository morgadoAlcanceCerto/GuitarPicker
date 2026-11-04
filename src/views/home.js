import { el, pageHead, stat, tag, progressBar, getVar, toast, select, clear } from "../ui/components.js";
import { Store } from "../state.js";
import { allSongs } from "../music/catalog.js";
import { INSTRUMENTS, instrumentOptions } from "../music/notes.js";
import { fmtTime } from "../ui/components.js";
import { dailyActivities, todayKey, streakStatus } from "../music/daily.js";
import { dif, gen } from "../ui/pt.js";
import { composeAvatar, composeGuitar, avatarLoadout, guitarLoadout } from "../cosmetics/index.js";

export default function home(ctx) {
  const { el: root, navigate } = ctx;
  const hist = Store.historyFor();
  const songs = allSongs();
  const inst = Store.settings().instrument;
  const prog = Store.progressFor(inst);
  const level = Math.floor(Math.sqrt(prog.xp || 0) / 3) + 1;
  const nextLevelXp = Math.pow((level) * 3, 2);
  const prevLevelXp = Math.pow((level - 1) * 3, 2);
  const levelFrac = (prog.xp - prevLevelXp) / (nextLevelXp - prevLevelXp || 1);

  const totalSessions = hist.length;
  const avgAcc = hist.length ? Math.round(hist.reduce((a, h) => a + h.accuracy, 0) / hist.length) : 0;
  const totalTime = hist.reduce((a, h) => a + (h.durationSec || 0), 0);
  const bestStreak = hist.reduce((a, h) => Math.max(a, h.maxStreak || 0), 0);

  // The tuner only handles instruments with open strings — same test it uses itself.
  const tunable = (INSTRUMENTS[inst]?.strings.length || 0) > 0;
  const fretted = INSTRUMENTS[inst]?.kind === "fretted";

  root.appendChild(pageHead("Bem-vindo de volta 🎵", "Continue de onde parou ou explore algo novo."));

  // hero / continue
  const recent = hist[0];
  const recentSong = recent && songs.find((s) => s.id === recent.songId);
  // Switching instrument here (not buried in Settings) is what keeps this page
  // about whatever you actually play; everything below keys off it.
  const instSel = select({
    label: "Instrumento atual", value: inst,
    options: instrumentOptions(),
    onchange: (v) => { Store.setSetting("instrument", v); clear(root); home(ctx); },
  });
  root.appendChild(el("div.panel", { style: { marginBottom: "16px" } }, [
    el("div.spread", {}, [
      el("div", {}, [
        instSel,
        el("div.muted", { style: { marginTop: "8px" }, text: `Nível ${level} · ${prog.xp || 0} XP` }),
        el("div", { style: { maxWidth: "320px", marginTop: "8px" } }, [progressBar(levelFrac)]),
      ]),
      el("div.row", {}, [
        recentSong && el("button.btn.primary.lg", { onclick: () => navigate(`#/play/${recentSong.id}`) },
          [`▶ Continuar: ${recentSong.title}`]),
        el("button.btn.lg", { onclick: () => navigate("#/library") }, ["Ver músicas"]),
        tunable
          ? el("button.btn.lg", { onclick: () => navigate("#/tuner") }, ["🎚️ Afinar"])
          : el("button.btn.lg", { onclick: () => navigate("#/instruments") }, ["📖 Guia do instrumento"]),
      ]),
    ]),
  ]));

  // today's recommended practice
  root.appendChild(buildDailyPanel(navigate, inst));

  // your setup (avatar + guitar + app skin)
  root.appendChild(el("div.panel", { style: { marginBottom: "16px" } }, [
    el("div.spread", {}, [
      el("div.row", { style: { alignItems: "center", gap: "18px" } }, [
        el("div", { style: { width: "92px", height: "108px", flex: "none" }, html: composeAvatar(avatarLoadout(), getVar("--accent")) }),
        // The only instrument art the Locker has is a guitar, so don't show it to
        // a drummer and call it "your instrument".
        fretted ? el("div", { style: { width: "66px", height: "150px", flex: "none" }, html: composeGuitar(guitarLoadout(), getVar("--accent")) }) : null,
        el("div", {}, [
          el("h3", { text: "Seu visual" }),
          el("div.muted", { text: fretted
            ? "Personalize seu avatar, seu violão e o tema do app."
            : "Personalize seu avatar e o tema do app." }),
        ]),
      ]),
      el("button.btn.primary", { onclick: () => navigate("#/locker") }, ["🎨 Personalizar"]),
    ]),
  ]));

  // stats
  root.appendChild(el("div.grid.cards", { style: { marginBottom: "16px" } }, [
    stat(totalSessions, "Sessões"),
    stat(avgAcc + "%", "Precisão média"),
    stat(fmtTime(totalTime), "Tempo tocado"),
    stat(bestStreak, "Melhor sequência"),
  ]));

  // quick start songs — yours first, topped up with the rest so the row is never
  // empty for an instrument with only a song or two.
  root.appendChild(el("h2", { text: "Volte a tocar" }));
  const forInst = songs.filter((s) => (s.instrument || "acoustic-guitar") === inst);
  const featured = [...forInst, ...songs.filter((s) => !forInst.includes(s))].slice(0, 6);
  root.appendChild(el("div.grid.cards", {}, featured.map((s) =>
    el("div.card", { onclick: () => navigate(`#/play/${s.id}`) }, [
      el("div.title", { text: s.title }),
      el("div.sub", { text: `${s.artist} · ${INSTRUMENTS[s.instrument]?.name || s.instrument}` }),
      el("div.row", { style: { gap: "6px", flexWrap: "wrap" } }, [tag(dif(s.difficulty), s.difficulty), s.genre ? tag(gen(s.genre)) : null]),
    ])
  )));

  // tips
  root.appendChild(el("div.panel", { style: { marginTop: "16px" } }, [
    el("h3", { text: "Primeiros passos" }),
    el("ul.muted", {}, [
      el("li", { html: "Abra as <b>Configurações</b> para escolher o microfone, a saída de som e um tema." }),
      el("li", { html: tunable
        ? "Use o <b>Afinador</b> antes de tocar — ele avisa quando uma corda está desafinada."
        : "Começando agora? O guia de <b>Instrumentos</b> mostra como segurar, as primeiras notas e os cuidados." }),
      el("li", { html: "Monte seu personagem e escolha um tema no <b>Armário</b>." }),
    ]),
  ]));
}

// Date-seeded daily practice checklist with per-day completion tracking.
// Each activity pays a few coins the first time it's checked off today, with a
// bonus when the whole list is finished. `reward` records what's been paid so
// re-checking can't farm coins.
const DAILY_COIN = 12, DAILY_BONUS = 40;
function buildDailyPanel(navigate, instrument) {
  const today = todayKey();
  const acts = dailyActivities(today, instrument);
  const saved = Store.settings().daily;
  const fresh = saved && saved.date === today;
  const done = new Set(fresh ? (saved.done || []) : []);
  const rewarded = new Set(fresh ? (saved.rewarded || []) : []);
  let bonusPaid = !!(fresh && saved.bonusPaid);

  const counter = el("span.muted");
  const bar = progressBar(0);
  const list = el("div.col", { style: { gap: "10px", marginTop: "12px" } });
  const streakChip = el("span.streak-chip");

  function paintStreak() {
    const ss = streakStatus(Store.settings().streak, today);
    streakChip.innerHTML = ss.count > 0
      ? `🔥 <b>${ss.count}</b> dia(s) seguidos${ss.best > ss.count ? ` · recorde ${ss.best}` : ""}`
      : "🔥 Comece sua sequência hoje!";
    streakChip.title = ss.practicedToday
      ? "Já praticou hoje — sequência garantida! Volte amanhã para aumentar."
      : "Toque uma música hoje — mesmo sem terminar, conta — para manter a sequência. Só marcar atividades não conta.";
    streakChip.classList.toggle("cold", ss.count === 0);
  }

  function persist() { Store.setSetting("daily", { date: today, done: [...done], rewarded: [...rewarded], bonusPaid }); }
  function refresh() {
    // Count only today's actual activities: switching instrument can drop "Tune up"
    // from the list while it's still ticked in storage, which would read "5 / 4".
    const n = acts.filter((a) => done.has(a.id)).length;
    counter.textContent = `${n} / ${acts.length} feitas`;
    if (bar.firstChild) bar.firstChild.style.width = (acts.length ? n / acts.length : 0) * 100 + "%";
    paintStreak();
  }
  function toggle(a, paint) {
    if (done.has(a.id)) { done.delete(a.id); }
    else {
      done.add(a.id);
      // NB: ticking an activity gives coins but does NOT touch the streak — only
      // actually playing a song does (Store.addHistory). Keeps it un-gameable.
      if (!rewarded.has(a.id)) { rewarded.add(a.id); Store.addCoins(DAILY_COIN); toast(`+${DAILY_COIN} 🪙 — ${a.title}`, "good"); }
      if (acts.every((x) => done.has(x.id)) && !bonusPaid) { bonusPaid = true; Store.addCoins(DAILY_BONUS); toast(`Prática do dia completa! +${DAILY_BONUS} 🪙 de bônus`, "good"); }
    }
    persist(); paint(); refresh();
  }

  for (const a of acts) {
    const check = el("button.btn");
    const paint = () => { check.textContent = done.has(a.id) ? "✓ Feito" : `Marcar feito +${DAILY_COIN}🪙`; check.classList.toggle("primary", done.has(a.id)); };
    check.addEventListener("click", () => toggle(a, paint));
    paint();
    list.appendChild(el("div.row", { style: { alignItems: "center", gap: "12px" } }, [
      el("div", { style: { flex: "1", minWidth: "180px" } }, [
        el("div", { html: `${a.icon} <b>${a.title}</b>` }),
        el("div.muted", { style: { fontSize: "12px" }, text: a.desc }),
      ]),
      el("button.btn.primary", { onclick: () => navigate(a.hash) }, ["Ir"]),
      check,
    ]));
  }
  refresh();

  return el("div.panel", { style: { marginBottom: "16px" } }, [
    el("div.spread", {}, [
      el("div.row", { style: { alignItems: "center", gap: "10px" } }, [
        el("h2", { text: "🗓️ Prática de hoje", style: { margin: "0" } }), streakChip,
      ]),
      el("span.muted", {}, [counter, el("span", { html: ` · complete tudo e ganhe +${DAILY_BONUS} 🪙` })]),
    ]),
    bar, list,
  ]);
}
