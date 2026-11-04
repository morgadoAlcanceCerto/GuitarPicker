import { el, pageHead, select, slider, toast, download } from "../ui/components.js";
import { Store } from "../state.js";
import { Audio } from "../audio/engine.js";
import { INSTRUMENTS, instrumentOptions } from "../music/notes.js";
import { SKINS } from "../cosmetics/skins.js";
import { syncConfigured, isSignedIn, signIn, signOut, syncNow, lastSync, account } from "../cloud/sync.js";

export default async function settings(ctx) {
  const { el: root } = ctx;
  const s = Store.settings();

  root.appendChild(pageHead("Configurações", "Dispositivos, som e aparência. O app sempre mostra a entrada e a saída em uso."));

  // --- Devices ---
  const devPanel = el("div.panel", {}, [el("h2", { text: "Dispositivos de áudio" })]);
  root.appendChild(devPanel);

  const inputSel = select({ label: "Entrada (microfone)", options: [{ value: "", label: "Padrão do sistema" }], value: s.inputDeviceId,
    onchange: (v) => { Store.setSetting("inputDeviceId", v); if (Audio.micLive()) Audio.startMic(v); } });
  const outputSel = select({ label: "Saída (caixa de som / fone)", options: [{ value: "", label: "Padrão do sistema" }], value: s.outputDeviceId,
    onchange: (v) => Audio.setOutputDevice(v) });

  const micStatus = el("span.muted", { text: Audio.micLive() ? "Microfone ligado" : "Microfone desligado" });
  const testBtn = el("button.btn", { onclick: async () => {
    try {
      if (Audio.micLive()) { Audio.stopMic(); micStatus.textContent = "Microfone desligado"; testBtn.textContent = "Ligar microfone"; }
      else { await Audio.startMic(s.inputDeviceId); micStatus.textContent = "Microfone ligado"; testBtn.textContent = "Desligar microfone"; await refreshDevices(); }
    } catch (e) { toast("Não consegui acessar o microfone: " + e.message, "bad"); }
  }}, [Audio.micLive() ? "Desligar microfone" : "Ligar microfone"]);

  devPanel.append(
    el("div.grid", { style: { gridTemplateColumns: "1fr 1fr" } }, [inputSel, outputSel]),
    el("div.row", { style: { marginTop: "12px", alignItems: "center" } }, [testBtn, micStatus]),
    el("p.muted", { style: { marginTop: "8px", fontSize: "12px" },
      html: "Os nomes dos aparelhos aparecem depois que você permite o microfone. A escolha da saída de som só funciona nos navegadores que suportam (Chrome/Edge)." }),
  );

  async function refreshDevices() {
    const { inputs, outputs } = await Audio.listDevices();
    fill(inputSel.selectEl, inputs, s.inputDeviceId, "Padrão do sistema");
    fill(outputSel.selectEl, outputs, s.outputDeviceId, "Padrão do sistema");
  }
  function fill(sel, list, current, defLabel) {
    sel.innerHTML = "";
    sel.appendChild(el("option", { value: "", text: defLabel }));
    for (const d of list) {
      const o = el("option", { value: d.deviceId, text: d.label });
      if (d.deviceId === current) o.selected = true;
      sel.appendChild(o);
    }
  }
  refreshDevices();

  // --- Sound ---
  const soundPanel = el("div.panel", {}, [el("h2", { text: "Som e detecção" })]);
  root.appendChild(soundPanel);
  soundPanel.append(
    el("div.grid", { style: { gridTemplateColumns: "1fr 1fr" } }, [
      slider({ label: "Volume do acompanhamento", value: s.backingVolume, fmt: (v) => Math.round(v * 100) + "%",
        oninput: (v) => Store.setSetting("backingVolume", v) }),
      slider({ label: "Volume da voz guia", value: s.vocalVolume, fmt: (v) => Math.round(v * 100) + "%",
        oninput: (v) => Store.setSetting("vocalVolume", v) }),
      slider({ label: "Filtro de ruído do microfone (sensibilidade)", min: 0.002, max: 0.06, step: 0.002, value: s.micGate,
        fmt: (v) => v.toFixed(3), oninput: (v) => Store.setSetting("micGate", v) }),
      slider({ label: "Calibração do Lá 4 (Hz)", min: 415, max: 466, step: 1, value: s.a4, fmt: (v) => v + " Hz",
        oninput: (v) => Store.setSetting("a4", v) }),
      slider({ label: "Velocidade da pista de notas", min: 0.5, max: 2, step: 0.1, value: s.noteSpeed, fmt: (v) => v.toFixed(1) + "×",
        oninput: (v) => Store.setSetting("noteSpeed", v) }),
    ]),
  );

  // --- Appearance / defaults ---
  const apr = el("div.panel", {}, [el("h2", { text: "Aparência e padrões" })]);
  root.appendChild(apr);
  apr.append(
    el("div.grid", { style: { gridTemplateColumns: "1fr 1fr" } }, [
      select({ label: "Tema do app", value: s.theme, options: SKINS.map((sk) => ({ value: sk.id, label: sk.name })),
        onchange: (v) => { Store.setSetting("theme", v); document.documentElement.setAttribute("data-theme", v);
          const q = document.getElementById("theme-quick"); if (q) q.value = v; } }),
      select({ label: "Instrumento padrão", value: s.instrument,
        options: instrumentOptions(),
        onchange: (v) => Store.setSetting("instrument", v) }),
    ]),
    el("p.muted", { style: { margin: "12px 0 0", fontSize: "13px" },
      html: "Personalize seu <b>avatar</b>, seu <b>violão</b> e mais temas no Armário." }),
    el("div.row", { style: { marginTop: "8px" } }, [
      el("button.btn", { onclick: () => { location.hash = "#/locker"; } }, ["🎨 Abrir Armário"]),
    ]),
  );

  // --- Data ---
  const data = el("div.panel", {}, [el("h2", { text: "Dados" })]);
  root.appendChild(data);
  data.append(el("div.row", {}, [
    el("button.btn", { onclick: () => download("guitarpicker-data.json", Store.exportAll()) }, ["Exportar todos os dados"]),
    el("button.btn.danger", { onclick: () => {
      if (confirm("Apagar todos os dados deste aparelho (músicas, histórico, progresso, configurações)?")) {
        localStorage.removeItem("guitarpicker.v1"); location.reload();
      }
    }}, ["Apagar tudo"]),
  ]));

  // --- Cloud sync (Google Drive, opt-in) ---
  const cloud = el("div.panel", {}, [el("h2", { text: "Conta e sincronização (nuvem)" })]);
  root.appendChild(cloud);
  // The built-in client ID is origin-gated, so a fork deployed elsewhere lands here
  // and can paste its own ID rather than editing source and redeploying.
  const clientIdField = el("input.input", {
    type: "text", placeholder: "1234-abc.apps.googleusercontent.com",
    value: Store.settings().driveClientId || "",
    onchange: (e) => { Store.setSetting("driveClientId", e.target.value.trim()); location.reload(); },
  });
  const clientIdRow = el("details", { style: { marginTop: "12px" } }, [
    el("summary.muted", { style: { fontSize: "12px", cursor: "pointer" }, text: "Usar seu próprio ID de cliente OAuth do Google (cópias hospedadas)" }),
    el("p.muted", { style: { fontSize: "12px", lineHeight: "1.5", margin: "8px 0" },
      html: "O ID embutido só funciona no site oficial e no localhost. Tem uma cópia em outro endereço? Crie um cliente OAuth <b>Web</b> gratuito " +
        "(veja <code>docs/CLOUD-SYNC-SETUP.md</code>), autorize o seu endereço e cole o ID aqui. Em branco usa o embutido." }),
    clientIdField,
  ]);

  if (!syncConfigured()) {
    cloud.append(el("p.muted", { style: { fontSize: "13px", lineHeight: "1.5" },
      html: "A sincronização na nuvem <b>não está disponível neste endereço</b> — o app está rodando 100% no seu aparelho (sem conta, sem internet). " +
        "O ID do Google embutido só vale no site oficial; coloque o seu abaixo para ligar a sincronização aqui." }), clientIdRow);
  } else {
    const status = el("span.muted", {});
    const signinBtn = el("button.btn.primary", { onclick: doSignIn }, ["Entrar com o Google"]);
    const syncBtn = el("button.btn", { onclick: doSync }, ["⟳ Sincronizar agora"]);
    const signoutBtn = el("button.btn.ghost", { onclick: doSignOut }, ["Sair"]);
    cloud.append(
      el("p.muted", { style: { fontSize: "13px", lineHeight: "1.5" },
        html: "Sincronize suas <b>músicas, histórico, progresso e desbloqueios</b> numa pasta oculta e privada do app no seu próprio Google Drive. " +
          "As configurações do aparelho (microfone, saída, tema) ficam só aqui. Nada sai do aparelho até você entrar, e dá para sair quando quiser." }),
      el("div.row", { style: { alignItems: "center", gap: "10px" } }, [signinBtn, syncBtn, signoutBtn, status]),
      clientIdRow,
    );
    function refresh() {
      const on = isSignedIn();
      signinBtn.classList.toggle("hidden", on);
      syncBtn.classList.toggle("hidden", !on);
      signoutBtn.classList.toggle("hidden", !on);
      const who = account();
      status.textContent = on
        ? (who ? `${who.name}${who.email && who.email !== who.name ? ` (${who.email})` : ""}` : "Conectado ao Google Drive") +
          (lastSync() ? ` — sincronizado às ${new Date(lastSync()).toLocaleTimeString("pt-BR")}` : "")
        : "Não conectado — seus dados ficam neste aparelho.";
    }
    async function doSignIn() {
      signinBtn.textContent = "Entrando…";
      try { const r = await signIn(); toast(`Sincronizado — ${r.songs} músicas${r.pulled ? " (mescladas)" : ""}`, "good"); }
      catch (e) { toast("Falha ao entrar: " + e.message, "bad"); }
      finally { signinBtn.textContent = "Entrar com o Google"; refresh(); }
    }
    async function doSync() {
      syncBtn.textContent = "Sincronizando…";
      try { const r = await syncNow(); toast(`Sincronizado — ${r.songs} músicas${r.pulled ? " (mescladas)" : ""}`, "good"); }
      catch (e) { toast("Falha ao sincronizar: " + e.message, "bad"); }
      finally { syncBtn.textContent = "⟳ Sincronizar agora"; refresh(); }
    }
    function doSignOut() { signOut(); toast("Você saiu"); refresh(); }
    refresh();
  }

  // --- About & disclaimers ---
  const about = el("div.panel", {}, [el("h2", { text: "Sobre e avisos" })]);
  root.appendChild(about);
  about.append(
    el("p.muted", { style: { margin: "0 0 8px", fontSize: "13px", lineHeight: "1.5" },
      html: "<b>GuitarPicker</b> é um projeto gratuito e de código aberto, lançado sob a Licença MIT e oferecido <b>como está</b>, sem garantia de qualquer tipo. Esta é uma cópia traduzida para o português." }),
    el("p.muted", { style: { margin: "0 0 8px", fontSize: "13px", lineHeight: "1.5" },
      html: "O autor é desenvolvedor de software — <b>não é médico, professor de música, treinador nem advogado</b>. Nada aqui é aula profissional nem orientação médica, auditiva ou jurídica. Toque num volume confortável e proteja sua audição. Sem ligação com o Yousician ou qualquer outra empresa." }),
    el("p.muted", { style: { margin: "0 0 8px", fontSize: "13px", lineHeight: "1.5" },
      html: "<b>Privacidade:</b> tudo roda no seu navegador e funciona sem internet. Sem rastreamento e sem servidores deste projeto. O som do microfone é analisado no aparelho e nunca sai dele. " +
        "<b>A sincronização na nuvem é opcional e começa desligada</b> — se você ligar e entrar com o Google, suas músicas, histórico e progresso vão para uma pasta privada no <i>seu próprio</i> Google Drive (permissão mínima <code>drive.appdata</code>, mais seu nome e e-mail para mostrar qual conta está conectada); dá para sair quando quiser. Fora isso, seus dados ficam só neste navegador." }),
    el("p.muted", { style: { margin: "0 0 10px", fontSize: "13px", lineHeight: "1.5" },
      html: "As músicas embutidas são tradicionais / de domínio público e o glossário é original. Nenhum código, fonte, imagem ou áudio de terceiros vem junto." }),
    el("div.row", {}, [
      el("a.btn", { href: "https://github.com/adervec/GuitarPicker", target: "_blank", rel: "noopener" }, ["GitHub"]),
      el("a.btn", { href: "https://github.com/adervec/GuitarPicker/blob/main/LICENSE", target: "_blank", rel: "noopener" }, ["Licença MIT"]),
      el("a.btn", { href: "https://github.com/adervec/GuitarPicker/blob/main/CREDITS.md", target: "_blank", rel: "noopener" }, ["Créditos"]),
      el("a.btn", { href: "https://adervec.github.io", target: "_blank", rel: "noopener" }, ["Mais apps do autor"]),
    ]),
  );
}
