import { el, pageHead, tag, toast, download, pickFile, fmtTime, clear } from "../ui/components.js";
import { Store } from "../state.js";
import { allSongs, isBuiltin } from "../music/catalog.js";
import { parse, newSong, songDuration, serialize, uid } from "../music/song-format.js";
import { INSTRUMENTS, midiToName } from "../music/notes.js";
import { suggestCapo, transposeSong, keyName } from "../music/theory.js";
import { Synth } from "../audio/synth.js";
import { dif, gen } from "../ui/pt.js";

export default function library(ctx) {
  const { el: root, navigate } = ctx;
  let filter = { q: "", instrument: "all", difficulty: "all", genre: "all", karaoke: false };

  const actions = [
    el("button.btn", { onclick: importSong }, ["⬇ Importar"]),
    el("button.btn.primary", { onclick: () => navigate("#/editor") }, ["+ Nova música"]),
  ];
  root.appendChild(pageHead("Músicas", "Biblioteca de domínio público mais as suas criações. Importe, exporte, transponha e toque.", actions));

  // filter bar
  const search = el("input.input", { type: "search", placeholder: "Buscar título ou artista…",
    oninput: (e) => { filter.q = e.target.value.toLowerCase(); renderGrid(); } });
  const instSel = el("select.input", { onchange: (e) => { filter.instrument = e.target.value; renderGrid(); } },
    [el("option", { value: "all", text: "Todos os instrumentos" }),
     ...Object.entries(INSTRUMENTS).map(([id, i]) => el("option", { value: id, text: i.name }))]);
  const genreSel = el("select.input", { onchange: (e) => { filter.genre = e.target.value; renderGrid(); } },
    [el("option", { value: "all", text: "Todos os gêneros" }),
     ...[...new Set(allSongs().map((s) => s.genre).filter(Boolean))].sort().map((g) => el("option", { value: g, text: gen(g) }))]);
  const diffPills = el("div.pill-row", {}, ["all", "beginner", "intermediate", "advanced"].map((d) =>
    el(`span.pill${d === "all" ? ".active" : ""}`, { text: dif(d), "data-dif": d, onclick: (e) => {
      filter.difficulty = d; [...diffPills.children].forEach((p) => p.classList.toggle("active", p.dataset.dif === d)); renderGrid();
    } })));
  const karaokePill = el("span.pill", { text: "🎤 Karaokê", title: "Só músicas com letra", onclick: () => {
    filter.karaoke = !filter.karaoke; karaokePill.classList.toggle("active", filter.karaoke); renderGrid();
  } });
  root.appendChild(el("div.panel.tight", { style: { marginBottom: "16px" } }, [
    el("div.row", { style: { alignItems: "center" } }, [
      el("div", { style: { flex: "1", minWidth: "200px" } }, [search]), instSel, genreSel, diffPills,
      el("div.pill-row", {}, [karaokePill]),
    ]),
  ]));

  const grid = el("div.grid.cards");
  root.appendChild(grid);

  // storage / file-location info
  root.appendChild(el("div.panel", { style: { marginTop: "18px" } }, [
    el("h3", { text: "Onde ficam minhas músicas?" }),
    el("p.muted", { html:
      "Suas músicas ficam guardadas neste navegador, na chave <code>guitarpicker.v1</code>. " +
      "Use <b>Exportar</b> em qualquer música para salvar um arquivo <code>.json</code> (vai para a pasta Downloads), " +
      "e <b>Importar</b> para carregar de volta. As músicas de domínio público já vêm com o app e podem ser duplicadas para editar." }),
  ]));

  const modalHost = el("div");
  root.appendChild(modalHost);

  renderGrid();
  const off = Store.on((e) => { if (e.type === "songs") renderGrid(); });

  function list() {
    return allSongs().filter((s) => {
      if (s.source === "drill") return false; // drills live in Training
      if (filter.instrument !== "all" && s.instrument !== filter.instrument) return false;
      if (filter.difficulty !== "all" && s.difficulty !== filter.difficulty) return false;
      if (filter.genre !== "all" && s.genre !== filter.genre) return false;
      if (filter.karaoke && !(s.lyrics || []).length) return false;
      if (filter.q && !(`${s.title} ${s.artist}`.toLowerCase().includes(filter.q))) return false;
      return true;
    });
  }

  function renderGrid() {
    clear(grid);
    const songs = list();
    if (!songs.length) { grid.appendChild(el("p.muted", { text: "Nenhuma música com esses filtros." })); return; }
    for (const s of songs) {
      const card = el("div.card", { onclick: () => openDetail(s) }, [
        el("div.spread", {}, [
          el("div.title", { text: s.title }),
          isBuiltin(s.id) ? tag("domínio público") : tag(({ manual: "sua", import: "importada", listen: "gravada", custom: "sua" })[s.source] || s.source || "sua"),
        ]),
        el("div.sub", { text: `${s.artist} · ${INSTRUMENTS[s.instrument]?.name || s.instrument}` }),
        el("div.row", { style: { gap: "6px", flexWrap: "wrap" } }, [
          tag(dif(s.difficulty), s.difficulty),
          s.genre ? tag(gen(s.genre)) : null,
          tag(`tom ${s.key}`),
          s.capo ? tag(`capotraste ${s.capo}`) : null,
          (s.lyrics || []).length ? tag("🎤 karaokê") : null,
        ]),
        el("div.row", { style: { marginTop: "auto", gap: "6px" } }, [
          el("button.btn.primary", { style: { flex: "1" }, onclick: (ev) => { ev.stopPropagation(); navigate(`#/play/${s.id}`); } }, ["▶ Tocar"]),
          (s.lyrics || []).length ? el("button.btn", { title: "Karaokê", onclick: (ev) => { ev.stopPropagation(); navigate(`#/karaoke/${s.id}`); } }, ["🎤"]) : null,
        ]),
      ]);
      grid.appendChild(card);
    }
  }

  function openDetail(song) {
    const dur = songDuration(song);
    const capo = song.capo || suggestCapo((song.notes[0]?.midi[0] ?? 60) % 12).capo;
    let working = song;

    const keyLine = el("div.muted", {});
    function refreshKeyLine() {
      keyLine.textContent = `Tom ${working.key} · ${working.bpm} BPM · capotraste ${working.capo || capo} · ${working.notes.length} notas · ${fmtTime(songDuration(working))}`;
    }
    refreshKeyLine();

    const body = el("div.panel", { style: { maxWidth: "560px", width: "92%" }, onclick: (e) => e.stopPropagation() }, [
      el("div.spread", {}, [el("h2", { text: song.title }), el("button.btn.ghost", { onclick: close }, ["✕"])]),
      el("div.muted", { text: `${song.artist} · ${INSTRUMENTS[song.instrument]?.name || song.instrument}` }),
      keyLine,
      el("div.row", { style: { margin: "10px 0" } }, [
        tag(dif(song.difficulty), song.difficulty),
        song.audio?.backing ? tag("tem acompanhamento") : tag("🎺 banda sintetizada"),
        song.audio?.vocal ? tag("tem voz guia") : null,
        song.lyrics?.length ? tag("🎤 karaokê") : null,
        ...(song.parts || []).map((p) => tag("+ " + (INSTRUMENTS[p.instrument]?.name || p.instrument))),
      ]),
      el("div.panel.tight", { style: { background: "var(--panel-2)" } }, [
        el("div.spread", {}, [
          el("span.muted", { text: "Transpor (cria uma cópia em outro tom):" }),
          el("div.row", { style: { gap: "6px" } }, [
            el("button.btn", { onclick: () => doTranspose(-1) }, ["♭ −1"]),
            el("button.btn", { onclick: () => doTranspose(1) }, ["♯ +1"]),
            el("button.btn", { onclick: () => Synth.playMidi((song.notes[0]?.midi[0]) || 60, { instrument: song.instrument }) }, ["🔊 Ouvir"]),
          ]),
        ]),
      ]),
      el("div.row", { style: { marginTop: "14px" } }, [
        el("button.btn.primary", { onclick: () => navigate(`#/play/${working.id}`) }, ["▶ Tocar"]),
        song.lyrics?.length ? el("button.btn", { onclick: () => navigate(`#/karaoke/${working.id}`) }, ["🎤 Karaokê"]) : null,
        el("button.btn", { onclick: () => navigate(`#/editor/${working.id}`) },
          [isBuiltin(working.id) ? "✏ Editar uma cópia" : "✏ Editar"]),
        el("button.btn", { onclick: () => exportSong(working) }, ["⬆ Exportar"]),
        el("button.btn", { onclick: duplicate }, ["⧉ Duplicar"]),
        !isBuiltin(song.id) ? el("button.btn.danger", { onclick: del }, ["🗑 Excluir"]) : null,
      ]),
    ]);

    const modal = el("div.banner", { style: { background: "rgba(0,0,0,.5)", zIndex: "40" }, onclick: close }, [body]);
    clear(modalHost).appendChild(modal);

    function close() { clear(modalHost); }
    function doTranspose(semi) {
      const copy = newSong({ ...working, id: uid(), source: "manual",
        title: working.title.replace(/ \([+-]\d+\)$/, "") + ` (${semi > 0 ? "+" : ""}${semi})`,
        notes: transposeSong(working.notes, semi),
        // the whole arrangement moves, not just the part on screen
        parts: (working.parts || []).map((p) => ({ ...p, notes: transposeSong(p.notes, semi) })),
        voice: working.voice?.notes?.length ? { ...working.voice, notes: transposeSong(working.voice.notes, semi) } : working.voice,
        key: keyName(((noteToPc(working.key) + semi) % 12 + 12) % 12, /m$/.test(working.key)),
      });
      Store.saveSong(copy); working = copy; refreshKeyLine();
      toast(`Cópia transposta salva: ${copy.title}`, "good");
    }
    function duplicate() {
      const copy = newSong({ ...working, id: uid(), source: "manual", title: working.title + " (cópia)" });
      Store.saveSong(copy); toast("Duplicada nas suas músicas", "good"); renderGrid();
    }
    function del() {
      if (!confirm(`Excluir "${song.title}"?`)) return;
      Store.deleteSong(song.id); close(); toast("Excluída");
    }
  }

  function exportSong(song) {
    const safe = song.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "song";
    download(`${safe}.gpsong.json`, serialize(song));
    toast("Exportada para a pasta Downloads", "good");
  }

  async function importSong() {
    const picked = await pickFile(".json,.gpsong.json,application/json");
    if (!picked) return;
    try {
      const song = parse(picked.text);
      song.id = uid(); song.source = "import";
      Store.saveSong(song);
      toast(`"${song.title}" importada (de ${picked.name})`, "good");
    } catch (e) { toast("Falha ao importar: " + e.message, "bad"); }
  }

  return () => off();
}

function noteToPc(key) {
  const m = String(key).match(/^([A-Ga-g])([#b]?)/);
  if (!m) return 0;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()];
  return (base + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
}
