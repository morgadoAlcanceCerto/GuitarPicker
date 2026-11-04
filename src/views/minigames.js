import { el, pageHead, clear, toast } from "../ui/components.js";
import { Store } from "../state.js";
import { Synth } from "../audio/synth.js";
import { INTERVALS, CHORD_TYPES, chordMidis } from "../music/theory.js";
import { NOTE_SHARP, KEY_SIGNATURES, scaleNotes, nameToMidi } from "../music/notes.js";

const QUESTIONS = 8;
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);

// each generator returns { prompt, choices:[str], answer:str, audio?:fn }
const GAMES = {
  interval_ear: {
    title: "Ouvido para intervalos", icon: "👂", desc: "Ouça duas notas — diga o intervalo.",
    gen() {
      const base = 55 + Math.floor(Math.random() * 8);
      const iv = rand(INTERVALS.filter((i) => i.semitones > 0));
      const wrong = shuffle(INTERVALS.filter((i) => i.short !== iv.short)).slice(0, 3);
      return {
        prompt: "Qual intervalo você ouviu?",
        choices: shuffle([iv, ...wrong].map((i) => i.name)),
        answer: iv.name,
        audio: () => { Synth.playMidi(base, { dur: 0.6 }); setTimeout(() => Synth.playMidi(base + iv.semitones, { dur: 0.6 }), 500); },
      };
    },
  },
  chord_ear: {
    title: "Tipo de acorde", icon: "🎹", desc: "Ouça um acorde — é maior, menor…?",
    gen() {
      const types = ["maj", "min", "dim", "aug", "dom7", "min7"];
      const t = rand(types), root = 52 + Math.floor(Math.random() * 8);
      const labels = { maj: "Maior", min: "Menor", dim: "Diminuto", aug: "Aumentado", dom7: "Sétima dominante", min7: "Menor com sétima" };
      const wrong = shuffle(types.filter((x) => x !== t)).slice(0, 3);
      return {
        prompt: "Que tipo de acorde é este?",
        choices: shuffle([t, ...wrong].map((x) => labels[x])),
        answer: labels[t],
        audio: () => chordMidis(root, t).forEach((m) => Synth.playMidi(m, { dur: 1.2 })),
      };
    },
  },
  interval_name: {
    title: "Nome do intervalo", icon: "📐", desc: "De uma nota a outra — diga o intervalo.",
    gen() {
      const base = rand(NOTE_SHARP);
      const iv = rand(INTERVALS.filter((i) => i.semitones > 0 && i.semitones <= 12));
      const target = NOTE_SHARP[(NOTE_SHARP.indexOf(base) + iv.semitones) % 12];
      const wrong = shuffle(INTERVALS.filter((i) => i.short !== iv.short)).slice(0, 3);
      return {
        prompt: `Qual é o intervalo subindo de ${base} até ${target}?`,
        choices: shuffle([iv, ...wrong].map((i) => i.name)),
        answer: iv.name,
      };
    },
  },
  key_sig: {
    title: "Armaduras de clave", icon: "🗝️", desc: "Quantos sustenidos ou bemóis?",
    gen() {
      const key = rand(Object.keys(KEY_SIGNATURES));
      const n = KEY_SIGNATURES[key];
      const fmtSig = (k, sharp) => k === 0 ? "Nenhum sustenido ou bemol" : sharp ? `${k} sustenido${k > 1 ? "s" : ""}` : `${k} ${k > 1 ? "bemóis" : "bemol"}`;
      const desc = fmtSig(Math.abs(n), n > 0);
      const opts = new Set([desc]);
      while (opts.size < 4) {
        const m = Math.floor(Math.random() * 8) - 0, sharp = Math.random() > 0.5;
        opts.add(fmtSig(m, sharp));
      }
      return { prompt: `Quantos sustenidos/bemóis tem ${key} maior?`, choices: shuffle([...opts]), answer: desc };
    },
  },
  scale_degree: {
    title: "Graus da escala", icon: "🪜", desc: "Ache a nota certa na escala.",
    gen() {
      const root = rand(NOTE_SHARP);
      const degree = 2 + Math.floor(Math.random() * 6); // 3rd..7th
      const pcs = scaleNotes(NOTE_SHARP.indexOf(root), "major");
      const answer = NOTE_SHARP[pcs[degree]];
      const ordinals = ["tônica", "2º grau", "3º grau", "4º grau", "5º grau", "6º grau", "7º grau"];
      const wrong = shuffle(NOTE_SHARP.filter((n) => n !== answer)).slice(0, 3);
      return { prompt: `Qual é o ${ordinals[degree]} da escala de ${root} maior?`, choices: shuffle([answer, ...wrong]), answer };
    },
  },
};

export default function minigames(ctx) {
  const { el: root } = ctx;
  clear(root);
  root.appendChild(pageHead("Jogos de teoria", "Testes rápidos para afiar o ouvido e a teoria. Bata seu recorde!"));

  const menu = el("div.grid.cards");
  root.appendChild(menu);
  const prog = Store.progressFor("theory");
  for (const [id, g] of Object.entries(GAMES)) {
    const best = prog.drills?.[id] || 0;
    menu.appendChild(el("div.card", { onclick: () => runGame(id) }, [
      el("div.title", { html: `${g.icon} ${g.title}` }),
      el("div.sub", { text: g.desc }),
      el("div.muted", { style: { fontSize: "12px", marginTop: "auto" }, text: `Recorde: ${best}/${QUESTIONS}` }),
    ]));
  }

  function runGame(id) {
    const g = GAMES[id];
    let qi = 0, correct = 0, locked = false;
    clear(root);
    const stage = el("div.panel", { style: { maxWidth: "640px", margin: "0 auto" } });
    root.appendChild(pageHead(g.title, g.desc, [el("button.btn.ghost", { onclick: () => minigames(ctx) }, ["← Jogos"])]));
    root.appendChild(stage);
    next();

    function next() {
      if (qi >= QUESTIONS) return finish();
      locked = false;
      const q = g.gen();
      clear(stage);
      stage.appendChild(el("div.spread", {}, [
        el("div.muted", { text: `Pergunta ${qi + 1} / ${QUESTIONS}` }),
        el("div.muted", { text: `Acertos: ${correct}` }),
      ]));
      stage.appendChild(el("h2", { style: { margin: "12px 0" }, text: q.prompt }));
      if (q.audio) {
        stage.appendChild(el("div.center", { style: { marginBottom: "14px" } }, [
          el("button.btn.lg.primary", { onclick: q.audio }, ["🔊 Ouvir de novo"]),
        ]));
        q.audio();
      }
      const choices = el("div.quiz-choices");
      q.choices.forEach((ch) => choices.appendChild(el("div.quiz-choice", { text: ch, onclick: (e) => answer(e.currentTarget, ch, q) })));
      stage.appendChild(choices);
    }

    function answer(node, choice, q) {
      if (locked) return; locked = true;
      const right = choice === q.answer;
      node.classList.add(right ? "correct" : "wrong");
      if (right) correct++;
      else {
        [...node.parentElement.children].forEach((c) => { if (c.textContent === q.answer) c.classList.add("correct"); });
      }
      qi++;
      setTimeout(next, right ? 650 : 1200);
    }

    function finish() {
      const prev = Store.progressFor("theory").drills?.[id] || 0;
      Store.recordDrill("theory", id, correct);
      clear(stage);
      const pct = Math.round((correct / QUESTIONS) * 100);
      stage.appendChild(el("div.center", {}, [
        el("div.big-grade", { text: pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "📚" }),
        el("h2", { text: `${correct} / ${QUESTIONS} certas (${pct}%)` }),
        correct > prev ? el("p", { style: { color: "var(--good)" }, text: "Novo recorde!" }) : el("p.muted", { text: `Recorde: ${Math.max(prev, correct)}` }),
        el("div.row", { style: { justifyContent: "center", marginTop: "10px" } }, [
          el("button.btn.primary", { onclick: () => runGame(id) }, ["Jogar de novo"]),
          el("button.btn", { onclick: () => minigames(ctx) }, ["← Jogos"]),
        ]),
      ]));
      if (correct > prev) toast("Novo recorde!", "good");
    }
  }
}
