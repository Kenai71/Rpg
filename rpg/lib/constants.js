export const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];

export const RANK_META = {
  F: { label: 'F', color: '#94a3b8', badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  E: { label: 'E', color: '#4ade80', badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  D: { label: 'D', color: '#60a5fa', badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  C: { label: 'C', color: '#a78bfa', badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  B: { label: 'B', color: '#f87171', badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  A: { label: 'A', color: '#fbbf24', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  S: { label: 'S', color: '#22d3ee', badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
};

export const RARITIES = [
  { name: 'COMUM', color: '#94a3b8', chance: 50, badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  { name: 'INCOMUM', color: '#4ade80', chance: 30, badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { name: 'RARO', color: '#60a5fa', chance: 15, badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  { name: 'ÉPICO', color: '#a78bfa', chance: 4, badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  { name: 'LENDÁRIO', color: '#fbbf24', chance: 0.9, badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { name: 'MÍTICO', color: '#f87171', chance: 0.1, badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
];

export const ITEM_TYPES = [
  { value: 'weapon', label: 'Arma' },
  { value: 'shield', label: 'Escudo' },
  { value: 'head', label: 'Cabeça' },
  { value: 'face', label: 'Rosto' },
  { value: 'neck', label: 'Pescoço' },
  { value: 'body', label: 'Armadura' },
  { value: 'hands', label: 'Mãos' },
  { value: 'waist', label: 'Cinto' },
  { value: 'feet', label: 'Pés' },
  { value: 'ring', label: 'Anel' },
  { value: 'consumable', label: 'Consumível' },
];

export const EQUIPMENT_SLOTS = [
  { key: 'head', label: 'Cabeça', acceptedType: 'head' },
  { key: 'face', label: 'Rosto', acceptedType: 'face' },
  { key: 'body', label: 'Armadura', acceptedType: 'body' },
  { key: 'neck', label: 'Pescoço', acceptedType: 'neck' },
  { key: 'weapon', label: 'Arma', acceptedType: 'weapon' },
  { key: 'hands', label: 'Mãos', acceptedType: 'hands' },
  { key: 'shield', label: 'Escudo', acceptedType: 'shield' },
  { key: 'waist', label: 'Cinto', acceptedType: 'waist' },
  { key: 'feet', label: 'Pés', acceptedType: 'feet' },
  { key: 'ring1', label: 'Anel 1', acceptedType: 'ring' },
  { key: 'ring2', label: 'Anel 2', acceptedType: 'ring' },
];

export const DEFAULT_EQUIPMENT = {
  face: null,
  head: null,
  neck: null,
  body: null,
  hands: null,
  waist: null,
  feet: null,
  ring1: null,
  ring2: null,
  weapon: null,
  shield: null,
};

export const XP_TABLE = [
  { lvl: 1, xp: 0 },
  { lvl: 2, xp: 300 },
  { lvl: 3, xp: 900 },
  { lvl: 4, xp: 2700 },
  { lvl: 5, xp: 6500 },
  { lvl: 6, xp: 14000 },
  { lvl: 7, xp: 23000 },
  { lvl: 8, xp: 34000 },
  { lvl: 9, xp: 48000 },
  { lvl: 10, xp: 64000 },
  { lvl: 11, xp: 85000 },
  { lvl: 12, xp: 100000 },
  { lvl: 13, xp: 120000 },
  { lvl: 14, xp: 140000 },
  { lvl: 15, xp: 165000 },
  { lvl: 16, xp: 195000 },
  { lvl: 17, xp: 225000 },
  { lvl: 18, xp: 265000 },
  { lvl: 19, xp: 305000 },
  { lvl: 20, xp: 355000 },
];

export const THEMES = [
  { id: 'purple', color: '#8b5cf6', label: 'Nebula Violet' },
  { id: 'green', color: '#10b981', label: 'Toxic Emerald' },
  { id: 'blue', color: '#0ea5e9', label: 'Cyber Sky' },
  { id: 'red', color: '#ef4444', label: 'Crimson Core' },
];

export const MISSION_STATUS_META = {
  open: { label: 'Aberta', badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  in_progress: { label: 'Em Andamento', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  completed: { label: 'Concluída', badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  failed: { label: 'Falhou', badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
};

export function calculateLevel(totalXp) {
  const safeXp = Math.max(0, Number(totalXp) || 0);
  let newLevel = 1;
  for (let i = 0; i < XP_TABLE.length; i += 1) {
    if (safeXp >= XP_TABLE[i].xp) {
      newLevel = XP_TABLE[i].lvl;
    } else {
      break;
    }
  }
  return newLevel;
}

export function getXpProgress(level, xp) {
  const curr = Math.max(1, Number(level) || 1);
  const safeXp = Math.max(0, Number(xp) || 0);
  if (curr >= 20) {
    return { percent: 100, text: `${safeXp} / MAX`, nextXp: safeXp };
  }
  const currData = XP_TABLE.find((l) => l.lvl === curr) || { xp: 0 };
  const nextData = XP_TABLE.find((l) => l.lvl === curr + 1) || { xp: 355000 };
  const span = Math.max(1, nextData.xp - currData.xp);
  const percent = Math.min(100, Math.max(0, ((safeXp - currData.xp) / span) * 100));
  return {
    percent,
    text: `${safeXp} / ${nextData.xp}`,
    nextXp: nextData.xp,
  };
}

export function getRankMeta(rank) {
  return RANK_META[rank?.toUpperCase()] || RANK_META.F;
}

export function getRarityFromItem(item) {
  if (!item) return 'COMUM';
  if (item.rarity) return String(item.rarity).toUpperCase();
  const match = item.description?.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim().toUpperCase();
  const itemName = item.name || item.item_name || '';
  if (itemName.includes('Runa')) {
    const parts = itemName.split(' ');
    if (parts[1]) return parts[1].trim().toUpperCase();
  }
  return 'COMUM';
}

export function getRarityMeta(rarityName) {
  const upper = String(rarityName || 'COMUM').toUpperCase();
  return RARITIES.find((r) => r.name === upper) || RARITIES[0];
}

export function cleanDescription(desc) {
  if (!desc) return 'Sem descrição adicional.';
  const cleaned = String(desc).replace(/<[^>]+>/, '').trim();
  return cleaned || 'Sem descrição adicional.';
}

export function formatDescriptionWithRarity(rarity, desc) {
  const clean = cleanDescription(desc);
  const safeDesc = clean === 'Sem descrição adicional.' ? '' : clean;
  const tag = `<${String(rarity || 'COMUM').toUpperCase()}>`;
  return safeDesc ? `${tag} ${safeDesc}` : tag;
}

export function getItemType(item) {
  if (!item) return 'consumable';
  if (item.type && ITEM_TYPES.some((t) => t.value === item.type)) return item.type;
  const name = String(item.name || item.item_name || '').toLowerCase();

  if (
    name.includes('espada') ||
    name.includes('katana') ||
    name.includes('adaga') ||
    name.includes('machado') ||
    name.includes('cajado') ||
    name.includes('bordão') ||
    name.includes('bordao') ||
    name.includes('báculo') ||
    name.includes('baculo') ||
    name.includes('cetro') ||
    name.includes('bastão') ||
    name.includes('bastao') ||
    name.includes('varinha') ||
    name.includes('lança') ||
    name.includes('arco') ||
    name.includes('besta') ||
    name.includes('arbalest') ||
    name.includes('arlabasta') ||
    name.includes('foice')
  ) {
    return 'weapon';
  }
  if (name.includes('escudo') || name.includes('broquel')) return 'shield';
  if (name.includes('anel')) return 'ring';
  if (name.includes('colar') || name.includes('amuleto') || name.includes('pingente')) return 'neck';
  if (name.includes('capacete') || name.includes('elmo') || name.includes('chapéu') || name.includes('coroa')) return 'head';
  if (name.includes('armadura') || name.includes('manto') || name.includes('túnica') || name.includes('traje')) return 'body';
  if (name.includes('luva') || name.includes('manopla') || name.includes('bracelete')) return 'hands';
  if (name.includes('bota') || name.includes('sapato') || name.includes('greva')) return 'feet';
  if (name.includes('cinto') || name.includes('faixa') || name.includes('algibeira')) return 'waist';
  if (name.includes('óculos') || name.includes('mascara') || name.includes('máscara') || name.includes('brinco')) return 'face';

  return 'consumable';
}

export function getItemTypeLabel(type) {
  return ITEM_TYPES.find((t) => t.value === type)?.label || 'Consumível';
}

export function rollGachaRarity() {
  const rand = Math.random() * 100;
  let accumulated = 0;
  for (const rarity of RARITIES) {
    accumulated += rarity.chance;
    if (rand <= accumulated) return rarity;
  }
  return RARITIES[0];
}
