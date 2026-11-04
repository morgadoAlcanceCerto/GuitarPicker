// Instruments guide view — renders src/music/instrument-guide.js (the same
// source that generates docs/INSTRUMENTS.md), with playable reference pitches.
import { el, pageHead, download, toast } from "../ui/components.js";
import { INSTRUMENTS, instrumentOptions } from "../music/notes.js";
import { GUIDE, instrumentFacts, harmonicaChart, buildInstrumentsMarkdown } from "../music/instrument-guide.js";
import { HARMONICA_BLOW, HARMONICA_DRAW } from "../music/notes.js";
import { Synth } from "../audio/synth.js";

export default function instruments(ctx) {
  const { el: root } = ctx;
  root.appendChild(pageHead("Instrumentos", "Todos os instrumentos do app — dados, guias de como tocar e o que o app oferece para cada um. Clique em ▶ para ouvir as notas de referência."));

  root.appendChild(el("div.panel.tight", { style: { marginBottom: "16px" } }, [
    el("div.row", {}, [
      el("span.muted", { style: { fontSize: "13px" }, text: "Os dados abaixo (afinações, extensões, tabelas de furos) vêm do próprio app — o guia sempre bate com o que o app toca." }),
      el("div", { style: { flex: "1" } }),
      el("button.btn", { title: "Salva o guia inteiro como arquivo Markdown", onclick: () => {
        download("INSTRUMENTS.md", buildInstrumentsMarkdown(), "text/markdown");
        toast("Guia salvo como INSTRUMENTS.md", "good");
      } }, ["⬇ Baixar em Markdown"]),
    ]),
  ]));

  // Grouped by family — a flat list of every instrument is a very long scroll.
  let lastGroup = null;
  for (const o of instrumentOptions()) {
    if (o.group !== lastGroup) {
      lastGroup = o.group;
      root.appendChild(el("h2", { text: o.group, style: { margin: "22px 0 10px" } }));
    }
    root.appendChild(panel(o.value));
  }

  function panel(id) {
    const g = GUIDE[id], f = instrumentFacts(id);
    const body = el("div", { style: { marginTop: "10px" } });

    // at a glance
    const glance = [
      ["Família", g.family],
      ["Extensão (no app)", f.range],
      f.strings.length ? ["Cordas", `${f.strings.length} — ${f.strings.map((s) => s.note).join(" ")}`] : null,
      f.inst.frets ? ["Trastes", String(f.inst.frets)] : null,
      ["Afinador", f.tuner ? "sim" + (f.tunings.length > 1 ? ` (${f.tunings.map((t) => t.name).join(", ")})` : "") : "—"],
      ["Dica de dedilhado", f.panel || "—"],
      ["Músicas embutidas", String(f.songs)],
    ].filter(Boolean);
    body.append(
      el("p", { text: g.overview }),
      el("table.data", {}, glance.map(([k, v]) => el("tr", {}, [el("th", { text: k }), el("td", { text: v })]))),
    );

    if (f.strings.length) {
      body.appendChild(el("h3", { style: { marginTop: "14px" }, text: "Cordas (da mais grave para a mais aguda)" }));
      body.appendChild(el("table.data", {}, [
        el("tr", {}, ["Corda", "Nota", "MIDI", "Frequência", ""].map((h) => el("th", { text: h }))),
        ...f.strings.map((s) => el("tr", {}, [
          el("td", { text: s.label }), el("td", { text: s.note }), el("td", { text: s.midi }),
          el("td", { text: s.freq.toFixed(1) + " Hz" }),
          el("td", {}, [el("button.btn.ghost", { title: "Ouvir esta corda solta", onclick: () => Synth.playMidi(s.midi, { dur: 1.2, instrument: id }) }, ["▶"])]),
        ])),
      ]));
      const alts = f.tunings.filter((t) => t.name !== "standard");
      if (alts.length) body.appendChild(el("p.muted", { style: { fontSize: "13px" },
        text: "Afinações alternativas: " + alts.map((t) => `${t.name} = ${t.notes}`).join(" · ") }));
    }

    if (id === "harmonica") {
      body.appendChild(el("h3", { style: { marginTop: "14px" }, text: "Tabela de furos (diatônica em C, afinação Richter)" }));
      body.appendChild(el("table.data", {}, [
        el("tr", {}, [el("th", { text: "Furo" }), ...harmonicaChart().map((h) => el("th", { text: String(h.hole) }))]),
        el("tr", {}, [el("th", { text: "Soprar ↑" }), ...HARMONICA_BLOW.map((m, i) => el("td", {}, [
          el("button.btn.ghost", { title: `Ouvir furo ${i + 1} soprado`, onclick: () => Synth.playMidi(m, { dur: 0.8, instrument: "harmonica" }) }, [harmonicaChart()[i].blow]),
        ]))]),
        el("tr", {}, [el("th", { text: "Puxar ↓" }), ...HARMONICA_DRAW.map((m, i) => el("td", {}, [
          el("button.btn.ghost", { title: `Ouvir furo ${i + 1} puxado`, onclick: () => Synth.playMidi(m, { dur: 0.8, instrument: "harmonica" }) }, [harmonicaChart()[i].draw]),
        ]))]),
      ]));
    }

    const section = (title, items, ordered) => {
      if (!items || !items.length) return;
      body.append(el("h3", { style: { marginTop: "14px" }, text: title }),
        el(ordered ? "ol" : "ul", {}, items.map((t) => el("li", { text: t }))));
    };
    section("Anatomia", g.anatomy);
    section("Como tocar", g.playing, true);
    section("Técnicas", g.techniques);
    section("Dicas para iniciantes", g.tips);
    if (g.care) { body.append(el("h3", { style: { marginTop: "14px" }, text: "Cuidados" }), el("p", { text: g.care })); }
    section("No GuitarPicker", [
      f.panel ? `A tela de tocar mostra uma dica de dedilhado (${f.panel}) para cada nota.` : "A tela de tocar avalia só pela nota — sem dica de dedilhado para este instrumento.",
      ...(g.inApp || []),
    ]);

    return el("details.panel", { style: { marginBottom: "14px" } }, [
      el("summary", { style: { cursor: "pointer" }, html: `<b style="font-size:17px">${INSTRUMENTS[id].name}</b> <span class="muted" style="font-size:13px"> — ${g.tagline}</span>` }),
      body,
    ]);
  }
}
