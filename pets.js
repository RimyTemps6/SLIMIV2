const skin = "#ffe3d3";
export const PETS = [
    { id: "rimuru", name: "Rimuru", emoji: "💧", description: "O slime que virou líder de Tempest", color: "#d8f5ff", personality: "Gentil, curioso e devorador de tudo",
        food: "suco de frutas", fun: "Hora de testar um novo skill", catch: "Vamos resolver isso juntos!", art: { type: "slime", color: "#5cc8f5" } },
    { id: "veldora", name: "Veldora", emoji: "🐉", description: "O Dragão da Tempestade", color: "#e9e2ff", personality: "Poderoso, dramático e muito leal",
        food: "mangá e doces", fun: "Kwahahaha, vamos brincar", catch: "Kwahahaha! Eu sou Veldora Tempest!", art: { type: "beast", kind: "dragon", color: "#2f3350", belly: "#8f93b8", accent: "#f0c050" } },
    { id: "ranga", name: "Ranga", emoji: "🐺", description: "O Lobo Estelar da Tempestade", color: "#dfe8ff", personality: "Fiel, protetor e orgulhoso",
        food: "carninha", fun: "Vamos correr pela floresta", catch: "Estarei sempre ao seu lado.", art: { type: "beast", kind: "wolf", color: "#3b4d78", belly: "#c9d6f2", accent: "#7fe0ff" } },
    { id: "milim", name: "Milim", emoji: "💗", description: "A Destroyer, cheia de energia", color: "#ffe0ef", personality: "Alegre, destemida e brincalhona",
        food: "mel e bolo", fun: "Vamos fazer uma guerrinha de brincadeira", catch: "Eu sou a Milim Nava! Vamos brincar!", art: { type: "chibi", hair: "#ff8fc7", skin, outfit: "#ff5c8a", eye: "#e0457b", twin: true } },
    { id: "shion", name: "Shion", emoji: "💜", description: "A secretária devota de Rimuru", color: "#ece3ff", personality: "Dedicada, forte e dona de cozinha duvidosa",
        food: "o seu prato favorito", fun: "Hora de treinar espada", catch: "Eu cuido de tudo para você!", art: { type: "chibi", hair: "#7a4bd0", skin, outfit: "#2f2f4f", eye: "#b03060", long: true, horn: "#efe6ff" } },
    { id: "benimaru", name: "Benimaru", emoji: "🔥", description: "O general ogro de cabelos rubros", color: "#ffe2e2", personality: "Calmo, elegante e estrategista",
        food: "saquê de maçã", fun: "Um duelo amistoso", catch: "Deixe o planejamento comigo.", art: { type: "chibi", hair: "#e0314b", skin, outfit: "#e9e9f5", eye: "#c0392b", long: true, horn: "#f5e9a8" } },
    { id: "shuna", name: "Shuna", emoji: "🌸", description: "A princesa ogra gentil", color: "#ffeaf2", personality: "Doce, cuidadosa e habilidosa",
        food: "chá e docinhos", fun: "Costurar algo bonito", catch: "Respire fundo, vai dar tudo certo.", art: { type: "chibi", hair: "#ffb0d0", skin, outfit: "#f6d5e6", eye: "#e07aa0", long: true, horn: "#fff3c9" } },
    { id: "gobta", name: "Gobta", emoji: "🍃", description: "O goblin que se acha herói", color: "#e4f6dc", personality: "Divertido, corajoso e bagunceiro",
        food: "javali assado", fun: "Missão heroica!", catch: "Gobta, o herói, chegou!", art: { type: "chibi", hair: "#3a4a2a", skin: "#86d26f", outfit: "#8b5a2b", eye: "#2b2f4a", ear: true } }
];
export const DEFAULT_PET = { level: 1, xp: 0, happiness: 80, energy: 90, satiety: 75 };
const LINES = {
    hungry: (p) => `Estou com fome… queria ${p.food}! 🍎`,
    sleepy: () => "Preciso descansar um pouquinho… 😴",
    eating: (p) => `Nham! ${p.food} é o melhor! 😋`,
    play: (p) => `${p.fun}! 🎉`,
    love: () => "Gosto tanto de você! 💖",
    happy: () => "Que dia feliz para brincar! ✨",
    idle: (p) => `“${p.catch}”`
};
export const say = (pet, mood) => (LINES[mood] || LINES.idle)(pet);
export function getMood(d, anim) {
    if (anim)
        return anim;
    if (d.satiety <= 25)
        return "hungry";
    if (d.energy <= 20)
        return "sleepy";
    if (d.happiness >= 85)
        return "love";
    if (d.happiness >= 60)
        return "happy";
    return "idle";
}
// Com o passar das horas: fome e tristeza aumentam, a energia se recupera.
export function applyDecay(d, now = Date.now()) {
    if (!d.updatedAt)
        return { ...d, updatedAt: now };
    const h = Math.min(48, (now - d.updatedAt) / 36e5);
    if (h < 0.1)
        return d;
    const satiety = Math.max(0, Math.round(d.satiety - h * 3));
    const happiness = Math.max(0, Math.round(d.happiness - h * (satiety < 30 ? 3 : 1.5)));
    const energy = Math.min(100, Math.round(d.energy + h * 4));
    return { ...d, satiety, happiness, energy, updatedAt: now };
}
export const todayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
// Rotinas diárias "resetam" todo dia; tarefas normais ficam concluídas.
export const isDone = (t) => (t.daily ? t.doneOn === todayStr() : Boolean(t.completed));
export const isLate = (t, now = new Date()) => !isDone(t) && Boolean(t.time) && t.time <= hhmm(now);
export const byTime = (a, b) => (a.time || "99:99").localeCompare(b.time || "99:99");
