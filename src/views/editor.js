import { el, pageHead, select, toast, download, getVar, pickFile, fmtTime } from "../ui/components.js";
import { Store } from "../state.js";
import { findSong, isBuiltin } from "../music/catalog.js";
import { newSong, parseMelody, serialize, songDuration, uid, GENRES } from "../music/song-format.js";
import { INSTRUMENTS, instrumentOptions, midiToName, nameToMidi, freqToMidi } from "../music/notes.js";
import { ANIMATED_BACKGROUNDS, SOLID_SWATCHES } from "../ui/backgrounds.js";
import { Synth } from "../audio/synth.js";
import { dif, gen } from "../ui/pt.js";
import { Audio } from "../audio/engine.js";
import { detectPitch, PitchTracker } from "../audio/pitch.js";
import { parseLRC, toLRC } from "../music/lrc.js";
import { framesToNotes } from "../music/transcribe.js";
import { TrackPlayer } from "../audio/player.js";
import { escapeHTML as escHTML } from "../karaoke/render.js";

const CIRCLE_KEYS = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F", "Am", "Em", "Dm"];

export default function editor(ctx) {
  const { el: root, params, navigate } = ctx;
  let song;
  if (params[0]) {
    const existing = findSong(params[0]);
    song = existing ? newSong({ ...existing }) : newSong();
    if (existing && isBuiltin(existing.id)) { song.id = uid(); song.source = "manual"; song.title = existing.title + " (minha versão)"; }
  } else song = newSong();

  root.appendChild(pageHead(params[0] ? "Editar música" : "Nova música", "Preencha os dados, desenhe as notas na grade ou digite, anexe áudio e salve.", [
    el("button.btn", { onclick: play }, ["▶ Testar"]),
    el("button.btn", { onclick: exportSong }, ["⬆ Exportar"]),
    el("button.btn.primary", { onclick: save }, ["💾 Salvar"]),
  ]));

  // ---------- metadata ----------
  const f = {};
  function field(label, key, type = "text", opts) {
    if (type === "select") {
      const sel = select({ label, value: song[key], options: opts, onchange: (v) => { song[key] = key === "bpm" ? +v : v; if (key === "bpm") redraw(); } });
      f[key] = sel.selectEl; return sel;
    }
    const input = el("input.input", { type, value: song[key], oninput: (e) => {
      song[key] = type === "number" ? +e.target.value : e.target.value; if (key === "bpm") redraw();
    } });
    f[key] = input;
    return el("label.field", {}, [el("span", { text: label }), input]);
  }

  const meta = el("div.panel", {}, [
    el("h2", { text: "Dados" }),
    el("div.grid", { style: { gridTemplateColumns: "2fr 2fr 1fr 1fr" } }, [
      field("Título", "title"),
      field("Artista", "artist"),
      field("BPM", "bpm", "number"),
      field("Capotraste", "capo", "number"),
    ]),
    el("div.grid", { style: { gridTemplateColumns: "1fr 1fr 1fr 1fr" } }, [
      field("Instrumento", "instrument", "select", instrumentOptions()),
      field("Tom", "key", "select", CIRCLE_KEYS.map((k) => ({ value: k, label: k }))),
      field("Dificuldade", "difficulty", "select", ["beginner", "intermediate", "advanced"].map((d) => ({ value: d, label: dif(d) }))),
      field("Gênero", "genre", "select", GENRES.map((g) => ({ value: g, label: gen(g) }))),
    ]),
  ]);
  root.appendChild(meta);

  // ---------- background ----------
  const bgPanel = el("div.panel", {}, [el("h2", { text: "Fundo" })]);
  root.appendChild(bgPanel);
  const bgTypeSel = select({ label: "Tipo", value: song.background?.type || "solid",
    options: [{ value: "solid", label: "Cor sólida" }, { value: "animated", label: "Animado" }, { value: "slideshow", label: "Apresentação (imagens)" }],
    onchange: (v) => { song.background = { type: v, value: v === "slideshow" ? [] : (v === "animated" ? "aurora" : "") }; renderBgValue(); } });
  const bgValueWrap = el("div");
  bgPanel.append(el("div.grid", { style: { gridTemplateColumns: "1fr 2fr" } }, [bgTypeSel, bgValueWrap]));
  renderBgValue();
  function renderBgValue() {
    bgValueWrap.innerHTML = "";
    const t = song.background?.type;
    if (t === "animated") {
      bgValueWrap.appendChild(el("div.pill-row", {}, ANIMATED_BACKGROUNDS.map((b) =>
        el(`span.pill${song.background.value === b ? ".active" : ""}`, { text: ({ aurora: "aurora", waves: "ondas", starfield: "estrelas", pulse: "pulsar" })[b] || b, onclick: () => {
          song.background.value = b; renderBgValue(); } }))));
    } else if (t === "solid") {
      bgValueWrap.appendChild(el("div.pill-row", {}, SOLID_SWATCHES.map((sw) =>
        el("span.pill", { text: sw || "padrão do tema", style: sw ? { background: sw, color: "#fff" } : {},
          onclick: () => { song.background.value = sw; } }))));
    } else {
      bgValueWrap.appendChild(el("label.field", {}, [
        el("span", { text: "Adicionar imagens (passam atrás das notas)" }),
        el("input", { type: "file", accept: "image/*", multiple: true, onchange: (e) => loadImages(e.target.files) }),
      ]));
      bgValueWrap.appendChild(el("div.muted", { id: "slide-count", text: `${(song.background.value || []).length} imagem(ns)` }));
    }
  }
  function loadImages(files) {
    const arr = song.background.value = song.background.value || [];
    [...files].forEach((file) => { const r = new FileReader(); r.onload = () => { arr.push(r.result);
      bgValueWrap.querySelector("#slide-count").textContent = `${arr.length} imagem(ns)`; }; r.readAsDataURL(file); });
  }

  // ---------- audio ----------
  const audioPanel = el("div.panel", {}, [el("h2", { text: "Faixas de áudio (opcional)" }),
    el("p.muted", { text: "Anexe uma faixa de acompanhamento e/ou de voz. Elas ficam guardadas dentro do arquivo da música." })]);
  root.appendChild(audioPanel);
  function audioRow(kind, label) {
    const status = el("span.muted", { text: song.audio?.[kind] ? "anexado ✓" : "nenhum" });
    return el("div.row", { style: { alignItems: "center", marginTop: "8px" } }, [
      el("label.field", { style: { flex: "1" } }, [el("span", { text: label }),
        el("input", { type: "file", accept: "audio/*", onchange: (e) => {
          const file = e.target.files[0]; if (!file) return;
          const r = new FileReader(); r.onload = () => { (song.audio ||= {})[kind] = r.result; status.textContent = "anexado ✓"; }; r.readAsDataURL(file);
        } })]),
      status,
      el("button.btn.ghost", { onclick: () => { if (song.audio) song.audio[kind] = null; status.textContent = "nenhum"; } }, ["Limpar"]),
    ]);
  }
  audioPanel.append(audioRow("backing", "Acompanhamento"), audioRow("vocal", "Voz"));

  // ---------- quick notation ----------
  const notation = el("textarea.input", { rows: 3, style: { width: "100%", fontFamily: "var(--mono)" },
    placeholder: "Entrada rápida, ex.:  C4:1 E4:1 G4:2 C4+E4+G4:2 r:1   (NOTA:tempos, acordes com +, pausa = r)" });
  root.appendChild(el("div.panel", {}, [
    el("h2", { text: "Notas" }),
    el("div.spread", {}, [
      el("span.muted", { text: "Digite uma melodia ou desenhe na grade abaixo. A escolha Instrumento/Voz na grade define qual camada você edita. Clique numa nota para apagar." }),
      el("div.row", {}, [
        el("button.btn", { onclick: () => { notation.value = notesToNotation(activeNotes(), song.bpm); } }, ["⇣ Da grade"]),
        el("button.btn.primary", { onclick: applyNotation }, ["Aplicar notação"]),
      ]),
    ]),
    notation,
  ]));

  // ---------- piano roll ----------
  const ROW_H = 16, OCTAVES = 4, LOW = 36; // C2..C6
  const ROWS = OCTAVES * 12;
  let snap = 0.5; // beats
  let noteLen = 1; // beats
  let editLayer = "notes"; // which layer the roll/notation edits: "notes" (instrument) or "voice"
  const layerPills = el("div.pill-row", {}, [
    el("span.pill.active", { text: "Instrumento", title: "Editar a melodia do instrumento", onclick: () => setLayer("notes") }),
    el("span.pill", { text: "Voz", title: "Editar a melodia da voz do karaokê", onclick: () => setLayer("voice") }),
  ]);
  function setLayer(which) {
    editLayer = which === "voice" ? "voice" : "notes";
    [...layerPills.children].forEach((p) => p.classList.toggle("active",
      p.textContent === (editLayer === "voice" ? "Voz" : "Instrumento")));
    refreshVoice();
  }
  function activeNotes() {
    return editLayer === "voice" ? ((song.voice ||= { notes: [] }).notes) : song.notes;
  }
  const rollControls = el("div.row", { style: { alignItems: "center", marginBottom: "8px" } }, [
    el("span.muted", { style: { fontSize: "12px" }, text: "Editando:" }), layerPills,
    select({ label: "Encaixe", value: String(snap), options: [["1", "1 tempo"], ["0.5", "½"], ["0.25", "¼"]].map(([v, l]) => ({ value: v, label: l })),
      onchange: (v) => snap = +v }),
    select({ label: "Duração da nota nova", value: String(noteLen), options: [["2", "2 tempos"], ["1", "1 tempo"], ["0.5", "½"], ["0.25", "¼"]].map(([v, l]) => ({ value: v, label: l })),
      onchange: (v) => noteLen = +v }),
    el("div", { style: { flex: 1 } }),
    el("button.btn.ghost", { onclick: () => { if (editLayer === "voice") (song.voice ||= { notes: [] }).notes = []; else song.notes = []; refreshVoice(); } }, ["Limpar camada"]),
  ]);
  const scroller = el("div", { style: { overflowX: "auto", overflowY: "hidden" } });
  const canvas = el("canvas#roll-canvas", { height: ROWS * ROW_H });
  scroller.appendChild(canvas);
  root.appendChild(el("div.panel", {}, [rollControls, el("div.roll-wrap", {}, [scroller])]));

  const c = canvas.getContext("2d");
  const spb = () => 60 / (song.bpm || 90);
  const pxPerBeat = 46;
  function midiAtY(y) { return LOW + ROWS - 1 - Math.floor(y / ROW_H); }
  function yAtMidi(m) { return (LOW + ROWS - 1 - m) * ROW_H; }

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const midi = midiAtY(y);
    const beat = x / pxPerBeat;
    const arr = activeNotes();
    // delete if clicking an existing note in the active layer
    const hitIdx = arr.findIndex((n) => n.midi.includes(midi) &&
      beat >= n.time / spb() && beat <= (n.time + n.dur) / spb());
    if (hitIdx >= 0) { arr.splice(hitIdx, 1); refreshVoice(); return; }
    const snapped = Math.floor(beat / snap) * snap;
    arr.push({ time: +(snapped * spb()).toFixed(4), dur: +(noteLen * spb() * 0.92).toFixed(4), midi: [midi] });
    Synth.playMidi(midi, { dur: 0.3, instrument: song.instrument });
    refreshVoice();
  });

  function redraw() {
    const voiceEnd = (song.voice?.notes || []).reduce((m, n) => Math.max(m, n.time + (n.dur || 0)), 0);
    const beats = Math.max(16, Math.ceil((Math.max(songDuration(song), voiceEnd) / spb()) + 4));
    const w = beats * pxPerBeat;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = w + "px"; canvas.width = w * dpr; canvas.height = ROWS * ROW_H * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = getVar("--highway"); c.fillRect(0, 0, w, ROWS * ROW_H);
    // rows (highlight naturals / C lines)
    for (let r = 0; r < ROWS; r++) {
      const midi = LOW + ROWS - 1 - r; const pc = ((midi % 12) + 12) % 12;
      const isBlack = [1, 3, 6, 8, 10].includes(pc);
      c.fillStyle = isBlack ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)";
      c.fillRect(0, r * ROW_H, w, ROW_H);
      if (pc === 0) { c.strokeStyle = getVar("--line"); c.beginPath(); c.moveTo(0, r * ROW_H); c.lineTo(w, r * ROW_H); c.stroke();
        c.fillStyle = getVar("--muted"); c.font = "9px var(--mono)"; c.fillText(midiToName(midi).full, 2, r * ROW_H + 11); }
    }
    // beat gridlines
    for (let b = 0; b <= beats; b++) {
      c.strokeStyle = b % 4 === 0 ? getVar("--line") : "rgba(255,255,255,0.04)";
      c.beginPath(); c.moveTo(b * pxPerBeat, 0); c.lineTo(b * pxPerBeat, ROWS * ROW_H); c.stroke();
    }
    // notes — the inactive layer dim & thin, the active layer bright blocks on top
    const drawNotes = (notes, color, active) => {
      for (const n of (notes || [])) {
        const x = (n.time / spb()) * pxPerBeat, wRect = Math.max(8, (n.dur / spb()) * pxPerBeat);
        for (const m of n.midi) {
          if (m < LOW || m >= LOW + ROWS) continue;
          const y = yAtMidi(m);
          c.fillStyle = getVar(color);
          if (active) { c.globalAlpha = 1; roundRect(x + 1, y + 2, wRect - 2, ROW_H - 4, 4); c.fill(); }
          else { c.globalAlpha = 0.5; roundRect(x + 1, y + ROW_H / 2 - 2, wRect - 2, 4, 2); c.fill(); c.globalAlpha = 1; }
        }
      }
    };
    const voiceActive = editLayer === "voice";
    drawNotes(voiceActive ? song.notes : song.voice?.notes, voiceActive ? "--accent" : "--accent-2", false);
    drawNotes(voiceActive ? song.voice?.notes : song.notes, voiceActive ? "--accent-2" : "--accent", true);
  }
  function roundRect(x, y, w, h, r) { r = Math.min(r, h / 2, w / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // ---------- vocal melody (karaoke scoring target) ----------
  const cloneNotes = (ns) => (ns || []).map((n) => ({ time: n.time, dur: n.dur, midi: [...n.midi] }));
  const voiceStatus = el("span.muted");
  const humPanel = el("div.panel.tight.hidden", { style: { background: "var(--panel-2)", margin: "8px 0" } });
  function refreshVoice() {
    const n = song.voice?.notes?.length || 0;
    voiceStatus.textContent = n
      ? `${n} nota(s) de voz — avaliadas quando você canta no Karaokê`
      : "nenhuma — o Karaokê avalia pela melodia do instrumento";
    redraw();
  }
  function shiftVoice(semi) {
    const ns = song.voice?.notes || [];
    if (!ns.length) { toast("Copie das notas do instrumento primeiro", "bad"); return; }
    song.voice.notes = ns.map((n) => ({ ...n, midi: n.midi.map((m) => m + semi) }));
    refreshVoice();
  }
  root.appendChild(el("div.panel", {}, [
    el("div.spread", {}, [
      el("h2", { text: "Melodia da voz (pontuação do Karaokê)" }),
      el("div.row", { style: { gap: "6px", flexWrap: "wrap" } }, [
        el("button.btn", { onclick: () => { (song.voice ||= { notes: [] }).notes = cloneNotes(song.notes); setLayer("voice"); toast("Melodia copiada para a voz — agora editando a camada Voz", "good"); } }, ["⎘ Copiar das notas"]),
        el("button.btn", { onclick: startHum }, ["🎙️ Cantarolar para gravar"]),
        el("button.btn", { title: "Quem canta costuma ficar uma oitava acima do violão", onclick: () => shiftVoice(12) }, ["8va ▲"]),
        el("button.btn", { title: "Desce a voz uma oitava", onclick: () => shiftVoice(-12) }, ["8vb ▼"]),
        el("button.btn.ghost", { onclick: () => { song.voice = { notes: [] }; refreshVoice(); } }, ["Limpar"]),
      ]),
    ]),
    el("p.muted", { style: { fontSize: "12px" }, text: "A linha de notas avaliada quando você canta no Karaokê (aparece apagada na grade acima). Deixe vazio para avaliar pela melodia do instrumento." }),
    humPanel,
    voiceStatus,
  ]));
  refreshVoice();

  // hum-to-capture: sing the vocal line, transcribe it into voice.notes (shared transcriber)
  const humBuf = new Float32Array(2048);
  let humActive = false, humRaf = 0, humFrames = [], humStart = 0, humTracker = null;
  async function startHum() {
    if (humActive) return;
    try { await Audio.startMic(Store.settings().inputDeviceId); }
    catch (e) { toast("Falha no microfone: " + e.message, "bad"); return; }
    humActive = true; humFrames = []; humStart = performance.now(); humTracker = new PitchTracker();
    renderHum("0:00", "—"); humTick();
  }
  function humTick() {
    if (!humActive) return;
    if (Audio.readTimeDomain(humBuf)) {
      const set = Store.settings();
      const { freq } = detectPitch(humBuf, Audio.ctx().sampleRate, set.micGate);
      const t = (performance.now() - humStart) / 1000;
      const f = humTracker.push(freq, set.a4);
      humFrames.push({ t, freq: f });
      renderHum(fmtTime(t), f > 0 ? midiToName(freqToMidi(f, set.a4)).full : "—");
    }
    humRaf = requestAnimationFrame(humTick);
  }
  function stopHum(silent) {
    if (!humActive) { humPanel.classList.add("hidden"); return; }
    humActive = false; if (humRaf) cancelAnimationFrame(humRaf); humRaf = 0;
    Audio.stopMic(); humPanel.classList.add("hidden");
    if (silent) return;
    if (humFrames.length < 5) { toast("Não ouvi o suficiente — tente de novo, um pouco mais alto.", "bad"); return; }
    const notes = framesToNotes(humFrames, song.bpm, Store.settings().a4);
    if (!notes.length) { toast("Não achei notas claras — tente uma melodia limpa, uma nota por vez.", "bad"); return; }
    (song.voice ||= { notes: [] }).notes = notes;
    setLayer("voice");
    toast(`${notes.length} nota(s) de voz gravada(s)`, "good");
  }
  function renderHum(time, note) {
    humPanel.classList.remove("hidden");
    humPanel.innerHTML = "";
    humPanel.append(
      el("div.spread", {}, [
        el("div", { html: `<b>🎙️ Cantarolar para gravar</b> · <span class="muted">${time}</span>` }),
        el("button.btn.primary", { onclick: () => stopHum() }, ["■ Parar e transcrever"]),
      ]),
      el("div", { style: { fontSize: "28px", margin: "6px 0", minHeight: "30px" }, html: `<b>${escHTML(note)}</b>` }),
      el("p.muted", { style: { fontSize: "12px" }, text: "Cante ou cantarole a melodia; ao parar, ela vira a melodia da voz no andamento da música." }),
    );
  }

  // ---------- lyrics & karaoke ----------
  const lyricList = el("div.col", { style: { gap: "8px" } });
  const tapPanel = el("div.panel.tight.hidden", { style: { background: "var(--panel-2)", margin: "8px 0" } });
  root.appendChild(el("div.panel", {}, [
    el("div.spread", {}, [
      el("h2", { text: "Letra e karaokê (opcional)" }),
      el("div.row", { style: { gap: "6px", flexWrap: "wrap" } }, [
        el("button.btn", { onclick: addLine }, ["+ Verso"]),
        el("button.btn", { onclick: importLRC }, ["⬆ Importar .lrc"]),
        el("button.btn", { onclick: pasteLRC }, ["📋 Colar LRC"]),
        el("button.btn", { onclick: exportLRC }, ["⬇ Exportar .lrc"]),
        el("button.btn", { onclick: startTap }, ["🎤 Marcar no toque"]),
      ]),
    ]),
    el("p.muted", { style: { fontSize: "12px" }, html:
      "Os tempos são segundos desde o início da música. O tempo de cada palavra é dividido automaticamente em cada verso, " +
      "a menos que você marque no toque ou importe LRC avançado (marcas <code>&lt;mm:ss.xx&gt;</code> por palavra)." }),
    tapPanel,
    lyricList,
  ]));

  function addLine() { (song.lyrics ||= []).push({ time: 0, text: "" }); renderLyrics(); }
  function renderLyrics() {
    lyricList.innerHTML = "";
    const ls = song.lyrics || [];
    if (!ls.length) { lyricList.appendChild(el("div.muted", { text: "Ainda sem letra — adicione um verso, importe um .lrc ou marque no toque." })); return; }
    ls.forEach((l, i) => {
      const timed = Array.isArray(l.words) && l.words.length;
      lyricList.appendChild(el("div.row", { style: { alignItems: "center" } }, [
        el("input.input", { type: "number", step: "0.1", value: l.time, style: { width: "84px" },
          oninput: (e) => l.time = +e.target.value }),
        el("input.input", { value: l.text, style: { flex: 1 }, placeholder: "texto da letra",
          oninput: (e) => { l.text = e.target.value; if (l.words) delete l.words; } }),
        timed ? el("span.tag.beginner", { title: "tempo por palavra gravado", text: `${l.words.length}p` }) : el("span.tag", { text: "auto" }),
        timed ? el("button.btn.ghost", { title: "Apagar o tempo por palavra (volta ao automático)", onclick: () => { delete l.words; renderLyrics(); } }, ["↺"]) : null,
        el("button.btn.ghost", { onclick: () => { song.lyrics.splice(i, 1); renderLyrics(); } }, ["✕"]),
      ]));
    });
  }

  // ----- LRC import / export -----
  async function importLRC() {
    const picked = await pickFile(".lrc,.txt,text/plain");
    if (picked) applyLRC(picked.text, picked.name);
  }
  function pasteLRC() {
    const text = window.prompt("Cole a letra em LRC — aceita versos [mm:ss.xx] e marcas avançadas <mm:ss.xx> por palavra:");
    if (text != null) applyLRC(text, "texto colado");
  }
  function applyLRC(text, srcName) {
    try {
      const parsed = parseLRC(text);
      if (!parsed.length) { toast("Nenhum verso com tempo encontrado nesse LRC", "bad"); return; }
      song.lyrics = parsed; renderLyrics();
      toast(`${parsed.length} verso(s) importado(s) de ${srcName}`, "good");
    } catch (e) { toast("Não consegui ler o LRC: " + e.message, "bad"); }
  }
  function exportLRC() {
    if (!(song.lyrics || []).length) { toast("Sem letra para exportar", "bad"); return; }
    const safe = (song.title || "song").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "song";
    download(`${safe}.lrc`, toLRC(song.lyrics), "text/plain");
    toast(".lrc exportado para a pasta Downloads", "good");
  }

  // ----- tap-to-time: play along and tap each word to capture karaoke timing -----
  let tapFlat = [], tapPos = 0, tapActive = false, tapRAF = 0, tapStartMs = 0, tapPlayer = null, tapKey = null;
  function startTap() {
    const ls = song.lyrics || [];
    if (!ls.length) { toast("Adicione os versos (texto) primeiro e depois marque o tempo", "bad"); return; }
    tapFlat = [];
    ls.forEach((line) => String(line.text || "").trim().split(/\s+/).filter(Boolean)
      .forEach((tok, w) => tapFlat.push({ line, text: tok, first: w === 0 })));
    if (!tapFlat.length) { toast("Seus versos não têm texto para marcar", "bad"); return; }
    ls.forEach((l) => { l.words = []; });
    tapPos = 0; tapActive = true; tapStartMs = performance.now();
    try { if (song.audio?.backing) { tapPlayer = new TrackPlayer(); tapPlayer.load(song); tapPlayer.play(0); } } catch (e) { /* audio optional */ }
    tapKey = (e) => { if (e.code === "Space") { e.preventDefault(); stamp(); } };
    window.addEventListener("keydown", tapKey);
    renderTap(); tickTap();
  }
  function tapNow() {
    if (tapPlayer?.backing && !tapPlayer.backing.paused) return tapPlayer.backing.currentTime;
    return (performance.now() - tapStartMs) / 1000;
  }
  function tickTap() {
    if (!tapActive) return;
    const clk = tapPanel.querySelector("#tap-clock"); if (clk) clk.textContent = tapNow().toFixed(2) + "s";
    tapRAF = requestAnimationFrame(tickTap);
  }
  function stamp() {
    if (!tapActive) return;
    const item = tapFlat[tapPos];
    if (item) { const t = +tapNow().toFixed(3); item.line.words.push({ t, text: item.text }); if (item.first) item.line.time = t; }
    tapPos++;
    if (tapPos >= tapFlat.length) { stopTap(); return; }
    renderTap();
  }
  function stopTap(silent) {
    tapActive = false;
    if (tapRAF) { cancelAnimationFrame(tapRAF); tapRAF = 0; }
    if (tapKey) { window.removeEventListener("keydown", tapKey); tapKey = null; }
    if (tapPlayer) { try { tapPlayer.stop(); } catch (e) {} tapPlayer = null; }
    tapPanel.classList.add("hidden");
    if (!silent) { renderLyrics(); toast("Tempo das palavras gravado", "good"); }
  }
  function renderTap() {
    tapPanel.classList.remove("hidden");
    const cur = tapFlat[tapPos], nxt = tapFlat[tapPos + 1];
    tapPanel.innerHTML = "";
    tapPanel.append(
      el("div.spread", {}, [
        el("div", { html: `<b>🎤 Marcar no toque</b> · <span class="muted">palavra ${Math.min(tapPos + 1, tapFlat.length)}/${tapFlat.length} · <span id="tap-clock">0.00s</span></span>` }),
        el("button.btn.ghost", { onclick: () => stopTap() }, ["■ Parar"]),
      ]),
      el("div", { style: { fontSize: "22px", margin: "8px 0", minHeight: "28px" },
        html: cur ? `▶ <b>${escHTML(cur.text)}</b>${nxt ? ` <span class="muted">→ ${escHTML(nxt.text)}</span>` : ""}` : "Pronto — aperte Parar" }),
      el("button.btn.primary", { style: { width: "100%" }, onclick: stamp }, ["TOQUE — ou aperte Espaço"]),
      el("p.muted", { style: { fontSize: "12px", marginTop: "6px" }, text: "Toque junto e bata em cada palavra enquanto canta. O acompanhamento (se houver) toca sozinho." }),
    );
  }

  renderLyrics();
  redraw();

  // ---------- actions ----------
  function applyNotation() {
    const txt = notation.value.trim();
    if (!txt) return;
    try {
      const parsed = parseMelody(song.bpm, txt);
      if (editLayer === "voice") (song.voice ||= { notes: [] }).notes = parsed; else song.notes = parsed;
      refreshVoice(); toast(`Notas de ${editLayer === "voice" ? "voz" : "instrumento"} atualizadas pela notação`, "good");
    } catch (e) { toast("Não consegui ler a notação: " + e.message, "bad"); }
  }
  function save() {
    if (!song.title.trim()) { toast("Dê um título para a música primeiro", "bad"); return; }
    if (!song.notes.length) { toast("Adicione algumas notas primeiro", "bad"); return; }
    Store.saveSong(song);
    toast(`"${song.title}" salva`, "good");
    navigate("#/library");
  }
  function play() {
    if (!song.notes.length) { toast("Adicione notas antes de testar", "bad"); return; }
    Store.saveSong(song); navigate(`#/play/${song.id}`);
  }
  function exportSong() {
    const safe = (song.title || "song").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "song";
    download(`${safe}.gpsong.json`, serialize(song)); toast("Exportada", "good");
  }

  // stop tap-to-time and hum-capture (timers/listeners/mic) when leaving the view
  return () => { stopTap(true); stopHum(true); };
}

function notesToNotation(notes, bpm) {
  const spb = 60 / bpm;
  return notes.slice().sort((a, b) => a.time - b.time).map((n) => {
    const beats = Math.round((n.dur / spb / 0.92) * 4) / 4 || 1;
    const pitches = n.midi.map((m) => midiToName(m).full).join("+");
    return `${pitches}:${beats}`;
  }).join(" ");
}
