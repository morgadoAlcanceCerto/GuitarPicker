// App skins = selectable colour themes. Each skin's `id` matches a
// `[data-theme="id"]` block in styles/themes.css. This module is the single
// source of truth for the theme list (used by Settings, the top-bar quick
// picker, and the Locker). `swatch` = [background, accent, accent2] preview.

export const SKINS = [
  // ---- originals -----------------------------------------------------------
  { id: "midnight", name: "Meia-noite", rarity: "common", desc: "Azul profundo, calma da madrugada.", swatch: ["#0b0f1a", "#6ea8fe", "#b388ff"] },
  { id: "dark", name: "Grafite escuro", rarity: "common", desc: "Grafite neutro com toque verde.", swatch: ["#121212", "#4caf50", "#80e27e"] },
  { id: "light", name: "Luz do dia", rarity: "common", desc: "Área de trabalho clara como papel.", swatch: ["#f3f5fb", "#2d6cdf", "#7a4ddb"] },
  { id: "sunset", name: "Pôr do sol", rarity: "uncommon", desc: "Laranjas do entardecer sobre ameixa.", swatch: ["#1a0f1e", "#ff7a59", "#ffb84d"] },
  { id: "forest", name: "Floresta", rarity: "uncommon", desc: "Verdes de musgo e cítricos.", swatch: ["#0c1410", "#4fd18b", "#c4e86a"] },
  { id: "contrast", name: "Alto contraste", rarity: "rare", desc: "Máxima legibilidade, para acessibilidade.", swatch: ["#000000", "#ffe600", "#00e5ff"] },

  // ---- new skins -----------------------------------------------------------
  { id: "neon", name: "Fliperama neon", rarity: "epic", desc: "Magenta elétrico e ciano sobre preto.", swatch: ["#08060f", "#ff2bd6", "#19f0ff"] },
  { id: "synthwave", name: "Synthwave", rarity: "epic", desc: "Clima retrô de pôr do sol em grade.", swatch: ["#1a0b2e", "#ff5f9e", "#ffb14e"] },
  { id: "vaporwave", name: "Vaporwave", rarity: "epic", desc: "Névoa rosa pastel e água.", swatch: ["#1f1633", "#f59ecb", "#7ef0e0"] },
  { id: "ocean", name: "Oceano profundo", rarity: "rare", desc: "Verde abissal e azul de correnteza.", swatch: ["#04161d", "#22c1c9", "#4aa3ff"] },
  { id: "arctic", name: "Ártico", rarity: "rare", desc: "Brancos gelados e azul geleira.", swatch: ["#0c1822", "#7fd6ff", "#cfe9ff"] },
  { id: "ember", name: "Brasa", rarity: "rare", desc: "Brasas acesas sobre carvão.", swatch: ["#160a08", "#ff6a3d", "#ffc24b"] },
  { id: "crimson", name: "Carmim", rarity: "rare", desc: "Vermelho de palco e dourado.", swatch: ["#160608", "#ff4757", "#ffb454"] },
  { id: "royal", name: "Realeza", rarity: "epic", desc: "Violeta real com detalhes dourados.", swatch: ["#0f0a1f", "#9b6bff", "#e7c25a"] },
  { id: "gold", name: "Ouro negro", rarity: "legendary", desc: "Obsidiana com ouro derretido.", swatch: ["#0c0b07", "#e7b53a", "#f6e27a"] },
  { id: "mahogany", name: "Mogno", rarity: "uncommon", desc: "Tons quentes de oficina de luthier.", swatch: ["#1b100b", "#c87f43", "#e0b06a"] },
  { id: "bubblegum", name: "Chiclete", rarity: "uncommon", desc: "Rosa doce e menta.", swatch: ["#241320", "#ff7ec0", "#5fe0c0"] },
  { id: "terminal", name: "Terminal", rarity: "rare", desc: "Tela verde de fósforo de monitor antigo.", swatch: ["#020a02", "#33ff66", "#9dff7a"] },
  { id: "mono", name: "Tinta mono", rarity: "uncommon", desc: "Tons de cinza, zero distração.", swatch: ["#101012", "#d8d8de", "#9a9aa2"] },
  { id: "slate", name: "Ardósia azul", rarity: "common", desc: "Azul-aço suave e âmbar.", swatch: ["#10151d", "#5e9bd6", "#e0a85a"] },

  // ---- daylight & warm sets ------------------------------------------------
  { id: "parchment", name: "Pergaminho", rarity: "common", desc: "Papel quente e tinta siena.", swatch: ["#f7f1e3", "#a3612b", "#2f6f5e"] },
  { id: "sakura", name: "Sakura", rarity: "uncommon", desc: "Rosa de flor sobre verde-sálvia.", swatch: ["#fdf2f6", "#d94f86", "#5f9e7d"] },
  { id: "espresso", name: "Espresso", rarity: "rare", desc: "Café torrado com creminho por cima.", swatch: ["#17100c", "#d9a05b", "#7fb08a"] },
  { id: "borealis", name: "Aurora boreal", rarity: "epic", desc: "Luzes do norte na noite polar.", swatch: ["#050b16", "#4dffa8", "#a86bff"] },
  { id: "coral", name: "Recife de coral", rarity: "rare", desc: "Verde de água rasa e coral.", swatch: ["#06171a", "#ff7f6b", "#ffd8a8"] },
  { id: "peacock", name: "Pavão", rarity: "legendary", desc: "Plumagem esmeralda com dourado.", swatch: ["#071019", "#17c9a3", "#e3b23c"] },
];

const BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));

export function getSkin(id) { return BY_ID[id] || SKINS[0]; }
export function skinIds() { return SKINS.map((s) => s.id); }
