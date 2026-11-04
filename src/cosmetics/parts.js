// Shared building blocks for the cosmetics system: rarity tiers, colour
// palettes, and tiny SVG string helpers used to compose player avatars and
// guitar avatars. Pure data + string functions (no DOM), so this module also
// loads safely under the headless test shim.

export const RARITIES = {
  common: { id: "common", name: "Comum", color: "#9aa9c7", order: 0 },
  uncommon: { id: "uncommon", name: "Incomum", color: "#43d6a0", order: 1 },
  rare: { id: "rare", name: "Raro", color: "#5ea8ff", order: 2 },
  epic: { id: "epic", name: "Épico", color: "#b388ff", order: 3 },
  legendary: { id: "legendary", name: "Lendário", color: "#ffb454", order: 4 },
};
export function rarity(id) { return RARITIES[id] || RARITIES.common; }

// ---- Colour palettes -------------------------------------------------------

// Avatar skin tones. `shade` is a darker companion used for soft shadows.
export const SKIN_TONES = [
  { id: "porcelain", name: "Porcelana", hex: "#f6d8c6", shade: "#e6b8a2" },
  { id: "fair", name: "Claro", hex: "#f0c3a3", shade: "#d8a07d" },
  { id: "light", name: "Claro", hex: "#e7b189", shade: "#cd8f63" },
  { id: "tan", name: "Bronzeado", hex: "#cf9a6b", shade: "#b1794a" },
  { id: "olive", name: "Oliva", hex: "#b07e4f", shade: "#8c6038" },
  { id: "bronze", name: "Bronze", hex: "#9a6038", shade: "#7a4a29" },
  { id: "brown", name: "Castanho", hex: "#7a4a2b", shade: "#5d381f" },
  { id: "deep", name: "Escuro", hex: "#583626", shade: "#41271b" },
  { id: "ebony", name: "Ébano", hex: "#3d271c", shade: "#2c1c14" },
];

// Hair / facial-hair colours.
export const HAIR_COLORS = [
  { id: "black", name: "Preto", hex: "#1b1b21" },
  { id: "darkbrown", name: "Castanho-escuro", hex: "#382014" },
  { id: "brown", name: "Castanho", hex: "#5d3a1f" },
  { id: "chestnut", name: "Castanho-avermelhado", hex: "#7c4a26" },
  { id: "auburn", name: "Ruivo-escuro", hex: "#8c3722" },
  { id: "ginger", name: "Ruivo", hex: "#c4632a" },
  { id: "blonde", name: "Loiro", hex: "#d9b65c" },
  { id: "platinum", name: "Platinado", hex: "#e8e3d3" },
  { id: "gray", name: "Prateado", hex: "#bcc0c8" },
  { id: "white", name: "Branco", hex: "#f4f5f8" },
  { id: "red", name: "Carmim", hex: "#d23b46" },
  { id: "pink", name: "Rosa", hex: "#e673b2" },
  { id: "purple", name: "Roxo", hex: "#8b53d6" },
  { id: "blue", name: "Azul", hex: "#3f7bd6" },
  { id: "teal", name: "Azul-petróleo", hex: "#26b3a6" },
  { id: "green", name: "Verde", hex: "#46b35a" },
];

// Clothing / fabric colours.
export const CLOTH_COLORS = [
  { id: "charcoal", name: "Grafite", hex: "#2b3040" },
  { id: "slate", name: "Ardósia", hex: "#46506a" },
  { id: "indigo", name: "Índigo", hex: "#3a47a3" },
  { id: "royal", name: "Azul royal", hex: "#2f6cdf" },
  { id: "sky", name: "Céu", hex: "#5bb6e8" },
  { id: "teal", name: "Azul-petróleo", hex: "#1f9e93" },
  { id: "forest", name: "Floresta", hex: "#2f7d46" },
  { id: "lime", name: "Lima", hex: "#7bc043" },
  { id: "gold", name: "Dourado", hex: "#e0a72e" },
  { id: "orange", name: "Laranja", hex: "#e8732e" },
  { id: "rust", name: "Ferrugem", hex: "#b14a2a" },
  { id: "crimson", name: "Carmim", hex: "#d23048" },
  { id: "rose", name: "Rosé", hex: "#e3678f" },
  { id: "pink", name: "Chiclete", hex: "#f08cc4" },
  { id: "violet", name: "Violeta", hex: "#7a45c4" },
  { id: "plum", name: "Ameixa", hex: "#5e2a6b" },
  { id: "cream", name: "Creme", hex: "#ece3cf" },
  { id: "white", name: "Branco", hex: "#f3f5f8" },
  { id: "gray", name: "Cinza-claro", hex: "#9aa1b0" },
  { id: "black", name: "Preto", hex: "#16181f" },
];

// Guitar body colours, including natural wood tones and bold finishes.
export const GUITAR_COLORS = [
  { id: "wood-honey", name: "Mel", hex: "#cf9b54" },
  { id: "wood-amber", name: "Âmbar", hex: "#b5721f" },
  { id: "wood-mahogany", name: "Mogno", hex: "#7a3320" },
  { id: "wood-walnut", name: "Nogueira", hex: "#5a3a24" },
  { id: "wood-natural", name: "Natural", hex: "#e3c486" },
  { id: "black", name: "Preto", hex: "#17181d" },
  { id: "white", name: "Branco vintage", hex: "#eee8d8" },
  { id: "cream", name: "Creme", hex: "#e7d6a8" },
  { id: "red", name: "Vermelho bala", hex: "#cf2333" },
  { id: "wine", name: "Vinho", hex: "#7a1f2b" },
  { id: "orange", name: "Laranja vivo", hex: "#e8631f" },
  { id: "gold", name: "Gold Top", hex: "#caa23a" },
  { id: "green", name: "Verde corrida", hex: "#1f6e44" },
  { id: "seafoam", name: "Verde-água", hex: "#7fcfc0" },
  { id: "sonic", name: "Azul sônico", hex: "#8fb9e8" },
  { id: "lake", name: "Azul lago", hex: "#2f6cc4" },
  { id: "purple", name: "Névoa roxa", hex: "#6a3bb5" },
  { id: "pink", name: "Rosa concha", hex: "#e88fb0" },
  { id: "silver", name: "Glitter prateado", hex: "#c2c7d2" },
  { id: "copper", name: "Cobre", hex: "#b5703f" },
];

// ---- helpers ---------------------------------------------------------------

export function pickById(list, id) {
  return list.find((x) => x.id === id) || list[0];
}

// Clamp + parse a #rrggbb hex into [r,g,b].
function toRgb(hex) {
  hex = (hex || "#888888").trim();
  if (hex[0] === "#") hex = hex.slice(1);
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(r, g, b) {
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Shift a colour lighter (amt > 0) or darker (amt < 0), amt in -1..1.
export function shadeColor(hex, amt) {
  const [r, g, b] = toRgb(hex);
  if (amt >= 0) return toHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  const k = 1 + amt;
  return toHex(r * k, g * k, b * k);
}

// Mix two colours, t in 0..1 (0 = a, 1 = b).
export function mixColor(a, b, t) {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

// Wrap inner SVG markup in an <svg> document string that fills its container
// while preserving the viewBox aspect ratio.
export function svgDoc(viewBox, inner, cls = "") {
  return `<svg class="cos-svg${cls ? " " + cls : ""}" viewBox="${viewBox}" ` +
    `xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" ` +
    `style="display:block;width:100%;height:100%" role="img" focusable="false">${inner}</svg>`;
}
