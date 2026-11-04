// Recommended daily practice plan. Deterministic per calendar day (a stable
// hash of the date seeds which drill / song / game are featured), so the list
// is the same all day and rotates tomorrow.
import { DRILLS } from "./drills.js";
import { builtinSongs } from "./songs.js";
import { INSTRUMENTS } from "./notes.js";
import { gen } from "../ui/pt.js";

const GAMES = ["Ouvido para intervalos", "Reconhecer acordes", "Nomes das notas", "Montar escalas"];

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** The calendar day before a "YYYY-MM-DD" key. */
export function dayBefore(key) {
  const d = new Date(key);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Interpret a stored streak ({count,best,lastDay}) relative to `today`.
 * A streak is "alive" only if the last practice day was today or yesterday;
 * otherwise the current run is shown as 0 (broken) while `best` is preserved.
 */
export function streakStatus(streak, today = todayKey()) {
  const s = streak || { count: 0, best: 0, lastDay: "" };
  const alive = s.lastDay === today || s.lastDay === dayBefore(today);
  return {
    count: alive ? (s.count || 0) : 0,
    best: s.best || 0,
    practicedToday: s.lastDay === today,
  };
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Build today's recommended activities (4–5 items), tailored to `instrument`:
 * the song is one written for it, and "Tune up" only appears for instruments the
 * tuner can actually handle — a harmonica or a drum kit has no strings to check.
 */
export function dailyActivities(key = todayKey(), instrument = "acoustic-guitar") {
  const seed = hashStr(key);
  const all = builtinSongs();
  const mine = all.filter((s) => (s.instrument || "acoustic-guitar") === instrument);
  const songs = mine.length ? mine : all;
  const drill = DRILLS[seed % DRILLS.length];
  const song = songs[seed % songs.length];
  const game = GAMES[seed % GAMES.length];
  const tunable = (INSTRUMENTS[instrument]?.strings.length || 0) > 0;
  // Every drill is a pitch exercise, so an unpitched kit gets a shorter, honest
  // plan rather than a scale it cannot play. ponytail: add percussion drills
  // (rudiments against a click) and this branch goes away.
  const pitched = INSTRUMENTS[instrument]?.kind !== "percussion";

  const plan = [
    ...(tunable ? [{ id: "tune", icon: "🎚️", title: "Afinar", desc: "Confira todas as cordas antes de tocar.", hash: "#/tuner" }] : []),
    ...(pitched ? [{ id: "warmup", icon: "🏋️", title: `Aquecimento: ${drill.title}`, desc: drill.desc, hash: "#/training" }] : []),
    { id: "song", icon: "🎵", title: `Tocar: ${song.title}`, desc: `${song.artist}${song.genre ? " · " + gen(song.genre) : ""}`, hash: `#/play/${song.id}` },
    { id: "ear", icon: "🎮", title: `Jogo de teoria: ${game}`, desc: "Afie o ouvido e a teoria.", hash: "#/minigames" },
    { id: "learn", icon: "📖", title: "Aprender um termo", desc: "Descubra algo novo no glossário.", hash: "#/glossary" },
  ];
  // 4 or 5 items depending on the day (one fewer when there's nothing to tune).
  return plan.slice(0, 4 + (seed % 2));
}
