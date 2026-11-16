/**
 * Regras e Sistema de Equilíbrio D&D 5.5e (2024) & D&D 5e
 *
 * Baseado estritamente nos 5 manuais organizados em /rpg/livros/:
 * 1. LIVRO DO JOGADOR D&D 5.5e (2024 Revision) - Armas, Maestrias, Equipamento
 * 2. LIVRO DO MESTRE (DM) D&D 5.5e (2024 Revision) - Tesouros, Itens Mágicos, Tiers
 * 3. Escudo do DM 5.5e (2024) - Condições, DCs, Perigos, Ações de Combate
 * 4. Livro do Jogador D&D 5e - Armas e Regras Clássicas
 * 5. Guia do Mestre D&D 5e - Encontros, Recompensas e Economia de PO
 *
 * Sistema de Raridade Escalonado Solicitado:
 * - COMUM: Dado base rebaixado/inicial (ex: 1d4, 1d6, 1d10), sem bônus mágico.
 * - INCOMUM: Dado padrão do livro (ex: 1d6, 1d8 versátil 1d10, 2d6) + Bônus +1 ou Maestria em Arma 2024.
 * - RARO: Dado aumentado (ex: 1d8, 1d10, 2d8) + Bônus +1/+2 + Maestria + Efeito Elemental (+1d4/+1d6 fogo, gelo, elétrico, etc.).
 * - ÉPICO: Dado elevado (ex: 1d10, 1d12, 2d10) + Bônus +2/+3 + Maestria + Efeito de Status no Inimigo (Sangramento, Atordoado, Queimadura, Lentidão).
 * - LENDÁRIO: Dado massivo (ex: 2d8, 2d10, 2d12, 3d6) + Bônus +3 + Status Severo + Propriedade Lendária (Corte Dimensional, Crítico 19-20).
 * - MÍTICO: Dado supremo (ex: 2d10+4, 3d8, 4d6) + Passiva Única Mítica (Roubo de vida 50%, Ressurreição 1 PV, Explosão divina).
 *
 * ZERO ÍCONES DE ESTRELA UTILIZADOS EM CONFORMIDADE COM AS DIRETRIZES DO PROJETO.
 */

import {
  DND_2024_MASTERY_PROPERTIES,
  DND_EXPANDED_WEAPONS,
  DND_MAGIC_ITEMS_CATALOG,
  DND_ENCOUNTERS_BY_TIER,
} from './dnd-catalog';

export {
  DND_2024_MASTERY_PROPERTIES,
  DND_EXPANDED_WEAPONS,
  DND_MAGIC_ITEMS_CATALOG,
  DND_ENCOUNTERS_BY_TIER,
};

// Escalonamento de Dano por Raridade (Fiel ao pedido do usuário)
export const WEAPON_DAMAGE_SCALE = {
  // Armas leves/pequenas (Base livro: 1d4 ex: Adaga, Foice, Martelo Leve)
  dagger: {
    COMUM: '1d4 perfurante',
    INCOMUM: '1d6 perfurante (+1 no acerto)',
    RARO: '1d8 perfurante (+1 ataque, +1d4 de dano elemental)',
    ÉPICO: '1d10 perfurante (+2 ataque, Sangramento contínuo de 1d4/turno)',
    LENDÁRIO: '2d6 perfurante (+3 ataque, Sangramento Profundo e Crítico 19-20)',
    MÍTICO: '2d8+3 perfurante (+4 ataque, Dreno de Alma: cura o portador em 50% do dano)',
  },
  // Armas de uma mão médias (Base livro: 1d6 ex: Espada Curta, Cimitarra, Maça)
  shortsword: {
    COMUM: '1d4 perfurante/cortante',
    INCOMUM: '1d6 perfurante/cortante (+1 no acerto)',
    RARO: '1d8 perfurante/cortante (+1 ataque, +1d6 de dano elemental)',
    ÉPICO: '1d10 perfurante/cortante (+2 ataque, inflige Lentidão de -3m no alvo)',
    LENDÁRIO: '2d8 perfurante/cortante (+3 ataque, inflige Atordoamento por 1 rodada em acerto crítico)',
    MÍTICO: '2d10+3 perfurante/cortante (+4 ataque, Corte Tempestuoso que divide defesas e barreiras)',
  },
  // Armas versáteis / marciais (Base livro: 1d8 / versátil 1d10 ex: Espada Longa, Katana, Machado de Batalha, Martelo de Guerra)
  longsword: {
    COMUM: '1d6 (versátil 1d8) cortante',
    INCOMUM: '1d8 (versátil 1d10) cortante (+1 no acerto)',
    RARO: '1d10 (versátil 1d12) cortante (+1 ataque, +1d6 de dano elemental)',
    ÉPICO: '1d12 cortante (+2 ataque, inflige Sangramento e Queimadura Arcana)',
    LENDÁRIO: '2d8 (versátil 2d10) cortante (+3 ataque, Corte Dimensional: ignora armadura e resistências)',
    MÍTICO: '3d6+4 (versátil 2d12+4) cortante (+4 ataque, Passiva Mítica: Fúria Titânica e Ressurreição com 1 PV)',
  },
  // Armas de duas mãos pesadas (Base livro: 2d6 ou 1d12 ex: Espadão, Machado Grande, Malho)
  greatsword: {
    COMUM: '1d10 ou 2d4 cortante/contundente',
    INCOMUM: '2d6 ou 1d12 cortante/contundente (+1 no acerto)',
    RARO: '2d8 cortante/contundente (+1 ataque, +2d4 de dano elemental)',
    ÉPICO: '2d10 cortante/contundente (+2 ataque, Atordoa o alvo em impacto pesado)',
    LENDÁRIO: '2d12 ou 3d6 cortante/contundente (+3 ataque, Onda de Choque que derruba inimigos)',
    MÍTICO: '4d6+5 cortante/contundente (+4 ataque, Quebra-Mundos: dano destrutivo que racha a terra)',
  },
  // Armas à distância (Base livro: 1d8 ex: Arco Longo, Besta Pesada, Mosquete)
  ranged: {
    COMUM: '1d6 perfurante',
    INCOMUM: '1d8 perfurante (+1 em precisão)',
    RARO: '1d10 perfurante (+1 ataque, +1d6 perfurante/elemental)',
    ÉPICO: '1d12 perfurante (+2 ataque, Disparo Perfurante: inflige Sangramento)',
    LENDÁRIO: '2d8 perfurante (+3 ataque, Disparo Perfurador que transpassa barreiras arcanas)',
    MÍTICO: '2d10+4 perfurante (+4 ataque, Flechas Celestiais teleguiadas que cegam e fulminam)',
  },
};

// Efeitos de Status Oficiais D&D 5.5e / 5e
export const DND_STATUS_EFFECTS = [
  {
    name: 'Sangramento',
    description: 'O inimigo perde 1d4 a 1d8 PV no início de cada um dos seus turnos devido a ferimentos profundos.',
    minRarity: 'ÉPICO',
  },
  {
    name: 'Atordoado',
    description: 'Em acertos críticos ou impacto severo, o alvo fica atordoado por 1 rodada (incapaz de agir e falha em salvaguardas de For/Des).',
    minRarity: 'ÉPICO',
  },
  {
    name: 'Queimadura Contínua',
    description: 'Chamas arcanas aderem à armadura do alvo, causando 1d6 de dano de fogo recorrente a cada início de turno.',
    minRarity: 'ÉPICO',
  },
  {
    name: 'Lentidão',
    description: 'O impacto corta o fluxo motor do inimigo, reduzindo seu deslocamento pela metade e aplicando -2 na CA.',
    minRarity: 'ÉPICO',
  },
  {
    name: 'Cegueira Temporária',
    description: 'Um flash reluzente atinge os olhos do oponente; ataques contra ele têm vantagem e seus ataques têm desvantagem.',
    minRarity: 'ÉPICO',
  },
  {
    name: 'Corte Dimensional',
    description: 'A lâmina fende a malha do espaço, ignorando resistências a dano físico e armaduras pesadas do adversário.',
    minRarity: 'LENDÁRIO',
  },
  {
    name: 'Drenagem de Alma',
    description: 'Parte da essência vital do inimigo é extraída a cada golpe, curando o portador em 50% do dano causado.',
    minRarity: 'MÍTICO',
  },
];

// Faixas de Preço do Guia do Mestre (DMG Cap. 7)
export const DND_PRICE_RANGES = {
  COMUM: { min: 30, max: 100 },
  INCOMUM: { min: 150, max: 500 },
  RARO: { min: 800, max: 3000 },
  ÉPICO: { min: 4000, max: 15000 },
  LENDÁRIO: { min: 20000, max: 60000 },
  MÍTICO: { min: 75000, max: 200000 },
};

/**
 * Normaliza e enriquece itens gerados para assegurar equilíbrio estrito e conformidade D&D 5.5e / 5e.
 */
export function enforceItemBalance(item) {
  const rawDesc = String(item.description || '').trim();
  const rarityMatch = rawDesc.match(/<(COMUM|INCOMUM|RARO|ÉPICO|LENDÁRIO|MÍTICO)>/i);
  const rarity = rarityMatch ? rarityMatch[1].toUpperCase() : 'COMUM';

  const type = String(item.type || 'consumable').toLowerCase();
  const name = String(item.item_name || 'Equipamento Forjado').trim();

  // Limpa descrições prévias da tag de raridade para reformatar
  let bodyDesc = rawDesc.replace(/^<(COMUM|INCOMUM|RARO|ÉPICO|LENDÁRIO|MÍTICO)>\s*/i, '').trim();

  // Se for arma, vincula com as regras de Maestria D&D 2024 e escalonamento de dados
  if (type === 'weapon') {
    const lowerName = name.toLowerCase();

    // Localizar arma equivalente no catálogo oficial
    const matchedWeapon = DND_EXPANDED_WEAPONS.find((w) =>
      lowerName.includes(w.name.toLowerCase())
    );
    const mastery = matchedWeapon ? matchedWeapon.mastery : 'Afligir (Vex)';

    const hasDice = /\d+d\d+/i.test(bodyDesc);
    if (!hasDice) {
      let scaleType = 'shortsword';
      if (lowerName.includes('adaga') || lowerName.includes('adaguinha') || lowerName.includes('foice')) {
        scaleType = 'dagger';
      } else if (
        lowerName.includes('longa') ||
        lowerName.includes('katana') ||
        lowerName.includes('batalha') ||
        lowerName.includes('guerra') ||
        lowerName.includes('rapieira')
      ) {
        scaleType = 'longsword';
      } else if (
        lowerName.includes('espadão') ||
        lowerName.includes('grande') ||
        lowerName.includes('malho')
      ) {
        scaleType = 'greatsword';
      } else if (
        lowerName.includes('arco') ||
        lowerName.includes('besta') ||
        lowerName.includes('dardo') ||
        lowerName.includes('mosquete') ||
        lowerName.includes('pistola')
      ) {
        scaleType = 'ranged';
      }

      const damageFormula = WEAPON_DAMAGE_SCALE[scaleType][rarity] || '1d6 cortante';
      bodyDesc = `Dano: ${damageFormula}. Maestria: ${mastery}. ${bodyDesc}`.trim();
    } else if (!bodyDesc.toLowerCase().includes('maestria')) {
      bodyDesc = `${bodyDesc} (Maestria: ${mastery})`.trim();
    }
  }

  // Preço balanceado conforme DMG
  const priceRange = DND_PRICE_RANGES[rarity] || DND_PRICE_RANGES.COMUM;
  const rawPrice = Number(item.price) || priceRange.min;
  const clampedPrice = Math.max(priceRange.min, Math.min(priceRange.max, rawPrice));

  return {
    ...item,
    item_name: name.slice(0, 80),
    description: `<${rarity}> ${bodyDesc}`.slice(0, 900),
    price: Math.floor(clampedPrice),
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    type,
  };
}

/**
 * Normaliza e enriquece missões geradas para assegurar equilíbrio estrito e conformidade D&D 5.5e / 5e.
 */
export function enforceMissionBalance(mission) {
  const rank = ['F', 'E', 'D', 'C', 'B', 'A', 'S'].includes(mission.rank) ? mission.rank : 'D';
  const tierConfig = DND_ENCOUNTERS_BY_TIER[rank];

  const rawXp = Number(mission.xp_reward) || tierConfig.minXp;
  const rawGold = Number(mission.gold_reward) || tierConfig.minGold;

  const clampedXp = Math.max(tierConfig.minXp, Math.min(tierConfig.maxXp, rawXp));
  const clampedGold = Math.max(tierConfig.minGold, Math.min(tierConfig.maxGold, rawGold));

  return {
    title: String(mission.title || 'Missão Sem Título').trim().slice(0, 120),
    description: String(mission.description || `Missão de Rank ${rank} em conformidade com o Guia do Mestre D&D.`).trim().slice(0, 1800),
    rank,
    xp_reward: Math.floor(clampedXp),
    gold_reward: Math.floor(clampedGold),
  };
}
