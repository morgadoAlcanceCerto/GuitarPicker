// Drill generators + course definitions for the Training view.
import { newSong } from "./song-format.js";
import { scaleNotes, SCALES } from "./notes.js";
import { chordMidis } from "./theory.js";

function seqFromMidis(midis, bpm, beatsEach = 1) {
  const spb = 60 / bpm;
  return midis.map((m, i) => ({
    time: +(i * beatsEach * spb).toFixed(3),
    dur: +(beatsEach * spb * 0.9).toFixed(3),
    midi: Array.isArray(m) ? m : [m],
  }));
}

function scaleUpDown(rootMidi, scale, octaves = 1) {
  const ints = SCALES[scale] || SCALES.major;
  const up = [];
  for (let o = 0; o < octaves; o++) for (const i of ints) up.push(rootMidi + o * 12 + i);
  up.push(rootMidi + octaves * 12);
  return [...up, ...up.slice(0, -1).reverse()];
}

// Each drill: stable id, generator(bpm) -> notes
export const DRILLS = [
  {
    id: "drill-chromatic", title: "Aquecimento cromático", difficulty: "beginner",
    desc: "Escala cromática na região grave — dá independência aos dedos.",
    bpm: 80, gen: (bpm) => seqFromMidis([40, 41, 42, 43, 45, 46, 47, 48, 50, 51, 52, 53, 52, 51, 50, 48, 47, 46, 45, 43, 42, 41], bpm, 0.5),
  },
  {
    id: "drill-cmajor", title: "Escala de Dó maior", difficulty: "beginner",
    desc: "Suba e desça a escala de Dó maior, uma oitava.",
    bpm: 90, gen: (bpm) => seqFromMidis(scaleUpDown(48, "major", 1), bpm, 0.5),
  },
  {
    id: "drill-gmajor2", title: "Escala de Sol maior (2 oitavas)", difficulty: "intermediate",
    desc: "Sol maior em duas oitavas, para soltar a mão no braço todo.",
    bpm: 100, gen: (bpm) => seqFromMidis(scaleUpDown(43, "major", 2), bpm, 0.5),
  },
  {
    id: "drill-pentatonic", title: "Pentatônica de Lá menor", difficulty: "intermediate",
    desc: "A escala básica de solo — subindo e descendo.",
    bpm: 100, gen: (bpm) => seqFromMidis(scaleUpDown(45, "minor_pentatonic", 1), bpm, 0.5),
  },
  {
    id: "drill-chordchanges", title: "Troca de acordes G–C–D", difficulty: "beginner",
    desc: "Troque entre acordes abertos de forma limpa, no tempo.",
    bpm: 70, gen: (bpm) => {
      const items = [];
      for (const root of [43, 48, 50, 43, 48, 50, 43, 43]) items.push(chordMidis(root, "maj"));
      return seqFromMidis(items, bpm, 2);
    },
  },
  {
    id: "drill-bluespent", title: "Corrida na escala blues", difficulty: "advanced",
    desc: "Escala blues de Mi, rápida — precisão com velocidade.",
    bpm: 130, gen: (bpm) => seqFromMidis(scaleUpDown(40, "blues", 2), bpm, 0.25),
  },
];

export function getDrill(id) { return DRILLS.find((d) => d.id === id); }

export function buildDrillSong(drill, bpm) {
  return newSong({
    id: drill.id, title: drill.title + " — Exercício", artist: "Treino GuitarPicker",
    instrument: "acoustic-guitar", bpm: bpm || drill.bpm, difficulty: drill.difficulty,
    background: { type: "animated", value: "pulse" }, source: "drill",
    notes: drill.gen(bpm || drill.bpm),
  });
}

// Course progression: ordered steps referencing song ids or drill ids.
export const COURSES = [
  {
    id: "course-foundations", title: "Base do violão", level: "Iniciante",
    desc: "Das primeiras notas às primeiras músicas.",
    steps: [
      { id: "bi-twinkle", title: "Twinkle, Twinkle (melodia)", ref: "bi-twinkle" },
      { id: "drill-chromatic", title: "Aquecimento cromático", ref: "drill-chromatic" },
      { id: "drill-cmajor", title: "Escala de Dó maior", ref: "drill-cmajor" },
      { id: "bi-3chord", title: "Treino de três acordes", ref: "bi-3chord" },
      { id: "drill-chordchanges", title: "Troca de acordes G–C–D", ref: "drill-chordchanges" },
      { id: "bi-saints", title: "When the Saints (melodia)", ref: "bi-saints" },
    ],
  },
  {
    id: "course-songcraft", title: "Batida e repertório", level: "Iniciante+",
    desc: "Toque junto progressões completas e músicas tradicionais.",
    steps: [
      { id: "bi-popprog", title: "Progressão pop I–V–vi–IV", ref: "bi-popprog" },
      { id: "bi-auld", title: "Auld Lang Syne", ref: "bi-auld" },
      { id: "bi-amazing", title: "Amazing Grace", ref: "bi-amazing" },
      { id: "bi-ode", title: "Ode to Joy", ref: "bi-ode" },
    ],
  },
  {
    id: "course-lead", title: "Solo e improviso", level: "Intermediário",
    desc: "Escalas, pentatônicas e o blues de 12 compassos.",
    steps: [
      { id: "drill-pentatonic", title: "Pentatônica de Lá menor", ref: "drill-pentatonic" },
      { id: "drill-gmajor2", title: "Sol maior (2 oitavas)", ref: "drill-gmajor2" },
      { id: "bi-12bar", title: "12-Bar Blues in A", ref: "bi-12bar" },
      { id: "bi-rising", title: "House of the Rising Sun", ref: "bi-rising" },
      { id: "drill-bluespent", title: "Corrida na escala blues", ref: "drill-bluespent" },
    ],
  },
];
