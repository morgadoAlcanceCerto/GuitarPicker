import { el, pageHead, tag, select, clear } from "../ui/components.js";
import { GLOSSARY, CATEGORIES } from "../music/glossary-data.js";
import { INTERVALS, CHORD_TYPES, chordMidis, chordName } from "../music/theory.js";
import { NOTE_SHARP, SCALES, scaleNotes, midiToName, nameToMidi, CIRCLE_OF_FIFTHS } from "../music/notes.js";
import { Synth } from "../audio/synth.js";

export default function glossary(ctx) {
  const { el: root } = ctx;
  root.appendChild(pageHead("Glossário e referência", "Um dicionário de música mais ferramentas de teoria — ouça intervalos, acordes e escalas."));

  // ---- interactive reference ----
  const ref = el("div.panel", {}, [el("h2", { text: "Referência interativa" })]);
  root.appendChild(ref);

  // Chord explorer
  let chordRoot = "C", chordType = "maj";
  const chordOut = el("div.muted");
  const rootSel = (val, on) => select({ value: val, options: NOTE_SHARP.map((n) => ({ value: n, label: n })), onchange: on });
  const cRoot = rootSel(chordRoot, (v) => { chordRoot = v; renderChord(); });
  const cType = select({ value: chordType, options: Object.keys(CHORD_TYPES).map((t) => ({ value: t, label: t })), onchange: (v) => { chordType = v; renderChord(); } });
  function renderChord() {
    const rootMidi = nameToMidi(chordRoot + "3");
    const midis = chordMidis(rootMidi, chordType);
    chordOut.textContent = `${chordName(rootMidi % 12, chordType)} = ${midis.map((m) => midiToName(m).full).join(" · ")}`;
  }
  renderChord();

  // Scale explorer
  let scaleRoot = "C", scaleType = "major";
  const scaleOut = el("div.muted");
  const sRoot = rootSel(scaleRoot, (v) => { scaleRoot = v; renderScale(); });
  const sType = select({ value: scaleType, options: Object.keys(SCALES).map((t) => ({ value: t, label: t.replace(/_/g, " ") })), onchange: (v) => { scaleType = v; renderScale(); } });
  function renderScale() {
    const pcs = scaleNotes(NOTE_SHARP.indexOf(scaleRoot), scaleType);
    scaleOut.textContent = pcs.map((pc) => NOTE_SHARP[pc]).join(" · ");
  }
  renderScale();

  ref.append(
    el("div.grid", { style: { gridTemplateColumns: "1fr 1fr" } }, [
      el("div.panel.tight", { style: { background: "var(--panel-2)" } }, [
        el("h3", { text: "Explorador de acordes" }),
        el("div.row", {}, [cRoot, cType, el("button.btn", { onclick: () => playChord() }, ["🔊 Tocar"])]),
        el("div", { style: { marginTop: "8px" } }, [chordOut]),
      ]),
      el("div.panel.tight", { style: { background: "var(--panel-2)" } }, [
        el("h3", { text: "Explorador de escalas" }),
        el("div.row", {}, [sRoot, sType, el("button.btn", { onclick: () => playScale() }, ["🔊 Tocar"])]),
        el("div", { style: { marginTop: "8px" } }, [scaleOut]),
      ]),
    ]),
  );

  function playChord() {
    const rootMidi = nameToMidi(chordRoot + "3");
    chordMidis(rootMidi, chordType).forEach((m) => Synth.playMidi(m, { dur: 1.1 }));
  }
  function playScale() {
    const base = nameToMidi(scaleRoot + "4");
    const pcs = scaleNotes(NOTE_SHARP.indexOf(scaleRoot), scaleType);
    const seq = [...pcs.map((pc) => base + ((pc - (base % 12) + 12) % 12)), base + 12];
    seq.forEach((m, i) => setTimeout(() => Synth.playMidi(m, { dur: 0.4 }), i * 230));
  }

  // Interval table
  const ivTable = el("table.data", {}, [
    el("tr", {}, [el("th", { text: "Intervalo" }), el("th", { text: "Semitons" }), el("th", { text: "" })]),
    ...INTERVALS.map((iv) => el("tr", {}, [
      el("td", { text: `${iv.name} (${iv.short})` }), el("td", { text: iv.semitones }),
      el("td", {}, [el("button.btn.ghost", { onclick: () => { Synth.playMidi(60); setTimeout(() => Synth.playMidi(60 + iv.semitones), 250); } }, ["▶"])]),
    ])),
  ]);
  ref.appendChild(el("details", { style: { marginTop: "14px" } }, [
    el("summary", { html: "<b>Intervalos</b> — clique em ▶ para ouvir cada um" }), ivTable,
  ]));

  // Circle of fifths
  ref.appendChild(el("details", {}, [
    el("summary", { html: "<b>Ciclo das quintas</b>" }),
    el("div.pill-row", { style: { marginTop: "8px" } }, CIRCLE_OF_FIFTHS.map((k) => el("span.pill", { text: k }))),
    el("p.muted", { style: { fontSize: "12px" }, text: "No sentido horário ganha sustenidos; no anti-horário, bemóis. Tons vizinhos têm quase as mesmas notas e soam bem juntos." }),
  ]));

  // ---- dictionary ----
  root.appendChild(pageHead("Dicionário", null));
  let q = "", catFilter = "all";
  const search = el("input.input", { type: "search", placeholder: "Buscar termos…", oninput: (e) => { q = e.target.value.toLowerCase(); renderTerms(); } });
  const cats = el("div.pill-row", {}, ["all", ...CATEGORIES].map((cat) =>
    el(`span.pill${cat === "all" ? ".active" : ""}`, { text: cat === "all" ? "todos" : cat, "data-cat": cat, onclick: () => {
      catFilter = cat; [...cats.children].forEach((p) => p.classList.toggle("active", p.dataset.cat === cat)); renderTerms(); } })));
  root.appendChild(el("div.panel.tight", { style: { marginBottom: "14px" } }, [
    el("div.row", { style: { alignItems: "center" } }, [el("div", { style: { flex: 1 } }, [search]), cats]),
  ]));
  const terms = el("div.grid.cards");
  root.appendChild(terms);

  function renderTerms() {
    clear(terms);
    const list = GLOSSARY.filter(([term, cat, def]) =>
      (catFilter === "all" || cat === catFilter) &&
      (!q || term.toLowerCase().includes(q) || def.toLowerCase().includes(q)));
    if (!list.length) { terms.appendChild(el("p.muted", { text: "Nenhum termo encontrado." })); return; }
    for (const [term, cat, def] of list) {
      terms.appendChild(el("div.card", { style: { cursor: "default" } }, [
        el("div.spread", {}, [el("div.title", { text: term }), tag(cat)]),
        el("div.sub", { text: def }),
      ]));
    }
  }
  renderTerms();
}
