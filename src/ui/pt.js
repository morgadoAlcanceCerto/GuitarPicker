// Tradução para exibição (pt-BR) de valores que o código usa como dado.
// Dificuldade e gênero continuam em inglês por dentro (filtros, banda, testes);
// só o que aparece na tela passa por aqui.
const DIF = { all: "todas", beginner: "iniciante", intermediate: "intermediário", advanced: "avançado" };
const GEN = {
  all: "todos", "Children's": "Infantil", Country: "Country", Folk: "Folclórica", Holiday: "Natal e festas",
  "Hymn/Gospel": "Hino / Gospel", Unknown: "Sem gênero", Classical: "Clássica", Blues: "Blues", Rock: "Rock",
  Pop: "Pop", Jazz: "Jazz", "Funk/Soul": "Funk / Soul", World: "Música do mundo", Electronic: "Eletrônica",
};
const AFIN = { standard: "padrão", "drop-d": "drop D", "drop-a": "drop A", "half-step-down": "meio tom abaixo", "open-g": "aberta em G", "open-d": "aberta em D", "double-c": "double C", tenor: "tenor", solo: "solo" };
export const afin = (t) => AFIN[t] || t;
export const dif = (d) => DIF[d] || d;
export const gen = (g) => GEN[g] || g;
