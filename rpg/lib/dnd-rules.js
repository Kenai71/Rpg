/**
 * Regras, Equilíbrio D&D 5.5e (2024) & Motor de Geração e Unicidade de Armas (Vallen RPG)
 *
 * Diretrizes de Raridade, Maestrias, Status e Escrita Natural:
 * 1. Aparição na Loja Escalonada por Probabilidade:
 *    Quanto maior a raridade da arma/item, mais difícil de aparecer na loja
 *    (COMUM: 48%, INCOMUM: 30%, RARO: 15%, ÉPICO: 5%, LENDÁRIO: 1.6%, MÍTICO: 0.4%).
 * 2. Maestrias em Armas Escassas:
 *    Armas comuns nunca têm maestria; armas incomuns/raras raramente possuem maestria,
 *    e maestrias de controle pesado como "Derrubar" têm peso reduzido.
 * 3. Efeitos de Status Oficiais do Site Escalonados:
 *    Usa exclusivamente os 10 efeitos do sistema:
 *    - Sangramento
 *    - Atordoado
 *    - Caído (Prone)
 *    - Queimando
 *    - Lentidão (-3m)
 *    - Cegueira
 *    - Envenenado
 *    - Amaldiçoado
 *    - Abençoado
 *    - Invisível
 *    Não é fácil uma arma vir com efeito de status nas raridades baixas (COMUM 0%, INCOMUM 10%, RARO 28%),
 *    e a força/qualidade do efeito aumenta conforme a raridade sobe.
 * 4. Escrita Natural e Fluida:
 *    Descrições em português claro, imersivo e direto, sem colchetes robóticos ou termos artificiais.
 *
 * ZERO ÍCONES DE ESTRELA UTILIZADOS EM CONFORMIDADE COM AS DIRETRIZES DO PROJETO.
 */

import {
  DND_2024_MASTERY_PROPERTIES,
  DND_EXPANDED_WEAPONS,
  DND_MAGIC_ITEMS_CATALOG,
  DND_ENCOUNTERS_BY_TIER,
} from './dnd-catalog.js';

export {
  DND_2024_MASTERY_PROPERTIES,
  DND_EXPANDED_WEAPONS,
  DND_MAGIC_ITEMS_CATALOG,
  DND_ENCOUNTERS_BY_TIER,
};

// Probabilidade de aparição de itens na loja (quanto maior a raridade, mais difícil aparecer)
export const SHOP_RARITY_WEIGHTS = [
  { rarity: 'COMUM', weight: 48.0 },
  { rarity: 'INCOMUM', weight: 30.0 },
  { rarity: 'RARO', weight: 15.0 },
  { rarity: 'ÉPICO', weight: 5.0 },
  { rarity: 'LENDÁRIO', weight: 1.6 },
  { rarity: 'MÍTICO', weight: 0.4 },
];

export function rollShopItemRarity() {
  const rand = Math.random() * 100;
  let acc = 0;
  for (const entry of SHOP_RARITY_WEIGHTS) {
    acc += entry.weight;
    if (rand <= acc) return entry.rarity;
  }
  return 'COMUM';
}

// Dados base por categoria e raridade
export const WEAPON_DAMAGE_DICE_BY_RARITY = {
  dagger: {
    COMUM: '1d4 de dano perfurante',
    INCOMUM: '1d6 de dano perfurante (+1 no acerto)',
    RARO: '1d8 de dano perfurante (+1 no ataque)',
    ÉPICO: '1d10 de dano perfurante (+2 no ataque)',
    LENDÁRIO: '2d6 de dano perfurante (+3 no ataque)',
    MÍTICO: '2d8+4 de dano perfurante (+4 no ataque)',
  },
  shortsword: {
    COMUM: '1d4 de dano cortante',
    INCOMUM: '1d6 de dano cortante (+1 no acerto)',
    RARO: '1d8 de dano cortante (+1 no ataque)',
    ÉPICO: '1d10 de dano cortante (+2 no ataque)',
    LENDÁRIO: '2d8 de dano cortante (+3 no ataque)',
    MÍTICO: '2d10+4 de dano cortante (+4 no ataque)',
  },
  longsword: {
    COMUM: '1d6 de dano cortante (1d8 com duas mãos)',
    INCOMUM: '1d8 de dano cortante (+1 no acerto)',
    RARO: '1d10 de dano cortante (+1 no ataque)',
    ÉPICO: '1d12 de dano cortante (+2 no ataque)',
    LENDÁRIO: '2d8 de dano cortante (+3 no ataque)',
    MÍTICO: '3d6+4 de dano cortante (+4 no ataque)',
  },
  greatsword: {
    COMUM: '1d10 de dano pesado',
    INCOMUM: '2d6 de dano pesado (+1 no acerto)',
    RARO: '2d8 de dano pesado (+1 no ataque)',
    ÉPICO: '2d10 de dano pesado (+2 no ataque)',
    LENDÁRIO: '2d12 de dano pesado (+3 no ataque)',
    MÍTICO: '4d6+5 de dano pesado (+4 no ataque)',
  },
  ranged: {
    COMUM: '1d4 de dano perfurante à distância',
    INCOMUM: '1d8 de dano perfurante (+1 em precisão)',
    RARO: '1d10 de dano perfurante (+1 no ataque)',
    ÉPICO: '1d12 de dano perfurante (+2 no ataque)',
    LENDÁRIO: '2d8 de dano perfurante (+3 no ataque)',
    MÍTICO: '2d10+4 de dano perfurante (+4 no ataque)',
  },
};

export const WEAPON_DAMAGE_SCALE = WEAPON_DAMAGE_DICE_BY_RARITY;

// Os 10 Efeitos de Status Oficiais presentes no site
export const DND_STATUS_EFFECTS = [
  {
    id: 'bleeding',
    name: 'Sangramento',
    lowText: 'pode causar Sangramento leve (1d4 de dano no início do turno do alvo em acerto crítico)',
    midText: 'aplica Sangramento no inimigo atingido, causando 1d6 de perda de vida por turno',
    highText: 'abre cortes profundos que aplicam Sangramento severo de 2d6 por turno e dificultam a regeneração',
  },
  {
    id: 'burning',
    name: 'Queimando',
    lowText: 'tem chance em acerto crítico de deixar o alvo Queimando com 1d4 de dano de fogo',
    midText: 'envolve o inimigo em chamas, deixando-o Queimando com 1d6 de dano de fogo por 2 rodadas',
    highText: 'incendeia a alma e a armadura do oponente, deixando-o Queimando com 2d6 de dano de fogo contínuo',
  },
  {
    id: 'slowed',
    name: 'Lentidão (-3m)',
    lowText: 'entorpece o alvo em golpes certeiros, aplicando Lentidão (-3m) até o próximo turno',
    midText: 'aplica Lentidão (-3m) ao acertar, reduzindo a mobilidade e a reação do inimigo',
    highText: 'congela o ritmo de combate do adversário, aplicando Lentidão (-3m) e retirando sua reação na rodada',
  },
  {
    id: 'poisoned',
    name: 'Envenenado',
    lowText: 'inocula uma toxina fraca em crítico que deixa o alvo Envenenado por 1 turno',
    midText: 'secreta peçonha na lâmina que deixa o inimigo Envenenado (desvantagem em ataques) por 1 rodada',
    highText: 'aplica o efeito Envenenado com toxina abissal que enfraquece os ataques do alvo e causa +1d8 de dano',
  },
  {
    id: 'prone',
    name: 'Caído (Prone)',
    lowText: 'em impacto crítico pode desequilibrar o oponente, deixando-o Caído (Prone)',
    midText: 'desfere golpes de impacto que deixam o inimigo Caído (Prone) caso falhe em teste de Força (CD 14)',
    highText: 'libera uma onda de choque que derruba o adversário na condição Caído (Prone) em golpes pesados',
  },
  {
    id: 'blinded',
    name: 'Cegueira',
    lowText: 'emite um lampejo breve em crítico que aplica Cegueira até o início do próximo turno',
    midText: 'dispara um clarão no momento do corte que aplica Cegueira temporária no oponente atingido',
    highText: 'ofusca completamente os sentidos do inimigo, aplicando Cegueira por 1 rodada e abrindo sua guarda',
  },
  {
    id: 'cursed',
    name: 'Amaldiçoado',
    lowText: 'deixa um eco sombrio em crítico que torna o alvo Amaldiçoado (-1d4 no próximo ataque dele)',
    midText: 'marca o adversário com o efeito Amaldiçoado, reduzindo suas jogadas de ataque e salvaguardas em 1d4',
    highText: 'condena o inimigo com o efeito Amaldiçoado, reduzindo suas defesas e fazendo-o sofrer +1d8 de dano extra',
  },
  {
    id: 'stunned',
    name: 'Atordoado',
    lowText: 'em um 20 natural pode deixar o alvo brevemente Atordoado',
    midText: 'aplica o efeito Atordoado por 1 rodada ao atingir um acerto crítico contra o inimigo',
    highText: 'sobrecarrega os sentidos do oponente, deixando-o Atordoado por 1 rodada em acertos críticos ou golpes decisivos',
  },
  {
    id: 'blessed',
    name: 'Abençoado',
    lowText: 'concede brevemente o efeito Abençoado ao portador ao derrotar um inimigo',
    midText: 'envolve o portador com o efeito Abençoado (+1d4 em ataques e salvaguardas) após um acerto crítico',
    highText: 'mantém o portador sob o efeito Abençoado em combate, somando +1d4 em ataques e resistências e curando 1d6 de vida por acerto',
  },
  {
    id: 'invisible',
    name: 'Invisível',
    lowText: 'envolve o usuário em névoa sutil ao abater um alvo',
    midText: 'torna o portador Invisível por alguns instantes após realizar um acerto crítico',
    highText: 'dobra a luz ao redor do portador, tornando-o Invisível até o início do seu próximo turno sempre que acerta um crítico ou abate um inimigo',
  },
];

// Chance de uma arma possuir efeito de status de acordo com sua raridade
export const STATUS_EFFECT_CHANCE_BY_RARITY = {
  COMUM: 0.0, // Nunca tem efeito de status
  INCOMUM: 0.10, // 10% de chance (muito raro, e apenas efeito fraco)
  RARO: 0.28, // 28% de chance (difícil, efeito moderado)
  ÉPICO: 0.58, // 58% de chance (efeito tático forte)
  LENDÁRIO: 0.88, // 88% de chance (efeito de elite)
  MÍTICO: 1.0, // 100% de chance (efeito supremo)
};

// Chance de uma arma vir com propriedade de Maestria (escassa nas raridades menores)
export const MASTERY_CHANCE_BY_RARITY = {
  COMUM: 0.0, // Sem maestria
  INCOMUM: 0.12, // 12% de chance
  RARO: 0.24, // 24% de chance
  ÉPICO: 0.42, // 42% de chance
  LENDÁRIO: 0.68, // 68% de chance
  MÍTICO: 0.92, // 92% de chance
};

// Pesos das Maestrias (Derrubar e Trespassar são muito mais raras que as demais)
const WEIGHTED_MASTERIES = [
  { name: 'Afligir (vantagem no próximo ataque ao acertar)', weight: 24 },
  { name: 'Ágil (ataque leve adicional na mesma ação)', weight: 22 },
  { name: 'Drenar (impõe desvantagem no próximo ataque do alvo)', weight: 20 },
  { name: 'Lentidão (reduz o deslocamento do alvo em 3m)', weight: 14 },
  { name: 'Garantido (causa dano igual ao modificador mesmo se errar)', weight: 9 },
  { name: 'Empurrar (afasta o inimigo em até 3m no impacto)', weight: 6 },
  { name: 'Trespassar (atinge um segundo inimigo adjacente)', weight: 3 },
  { name: 'Derrubar (pode derrubar o alvo com teste de Constituição)', weight: 2 },
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

// ============================================================================
// REPERTÓRIO DE ORIGENS E HISTÓRIAS NATURAIS ESCALONADAS POR RARIDADE
// ============================================================================

const COMMON_LORE_POOL = [
  'Forjada em ferro temperado com empunhadura revestida em couro firme para uso diário.',
  'Peça de aço simples e bem equilibrada, saída das oficinas militares da fronteira.',
  'Acabamento rústico e resistente em aço cinzento, sem adornos ou encantamentos.',
  'Construída com madeira de freixo envernizada e metal polido em pedra de amolar.',
  'Equipamento padrão de patrulha com guarda reforçada em bronze batido.',
  'Armamento confiável de forja tradicional, ideal para aventureiros em início de jornada.',
];

const UNCOMMON_LORE_POOL = [
  'Recebeu um banho de prata alquímica que mantém o fio impecável mesmo após longos combates.',
  'Trabalhada por mestres ferreiros anões com contrapeso preciso no pomo para golpes mais certeiros.',
  'Forjada em liga leve de aço élfico, oferecendo manuseio ágil e resposta imediata.',
  'Temperada em óleo mineral aromático com finas gravuras de proteção ao longo da guarda.',
  'Metal dobrado várias vezes na bigorna real, garantindo dureza superior ao aço comum.',
  'Possui acabamento polido com filigranas de cobre que melhoram a estabilidade do ataque.',
];

const RARE_LORE_POOL = [
  'Abençoada nas forjas profundas de Vallen, onde o metal absorveu centelhas de energia elemental pura.',
  'Incrustada com uma gema canalizadora na guarda que desperta ao entrar em combate.',
  'Temperada nas águas geladas do norte e selada com cânticos antigos de batalha.',
  'O aço desta arma pulsa suavemente com o calor residual das cavernas vulcânicas onde foi moldada.',
  'Criada para os capitães da guarda real, combinando metalurgia avançada e encantamento de precisão.',
  'Forjada sob a luz de uma lua de sangue, mantendo um brilho sutil ao ser desembainhada.',
  'Construída com fragmentos de minério astral caído nas montanhas, vibrando ao atingir o inimigo.',
  'Banhada em resinas alquímicas raras que reagem ao impacto contra armaduras inimigas.',
];

const EPIC_LORE_POOL = [
  'Relíquia pertencente aos antigos campeões da Cidadela de Vallen, forjada para decidir cercos impossíveis.',
  'O metal escuro desta arma foi temperado em essência arcana condensada, deixando um rastro luminoso a cada golpe.',
  'Criada nos salões subterrâneos dos mestres rúnicos, sua estrutura canaliza poder diretamente para o ponto de impacto.',
  'Pertenceu a um lendário comandante de guilda; sua lâmina reconhece a tensão da batalha e amplifica a força do portador.',
  'Forjada com aço damasco encantado e núcleo de cristal ressonante que ecoa a cada investida.',
  'Arma de elite consagrada nos templos antigos, projetada para quebrar a linha de frente de exércitos inteiros.',
  'Moldada a partir de ligas raras do Subterrâneo, combinando leveza sobrenatural e poder destrutivo.',
  'Guardada por gerações nos cofres reais, desperta sua verdadeira força nas mãos de guerreiros experientes.',
];

const LEGENDARY_LORE_POOL = [
  'Obra-prima única forjada na Primeira Era a partir do núcleo de uma estrela cadente que atingiu as montanhas de Vallen, capaz de distorcer a gravidade ao redor do golpe.',
  'Relíquia histórica banhada nas areias do Plano do Tempo; conta a lenda que seu antigo portador jamais teve um golpe decisivo desviado.',
  'Forjada pelos arquimagos inquisidores em metal nulo-mágico raro, capaz de cortar feitiços e desfazer defesas arcanas no instante do impacto.',
  'Nascida durante um eclipse milenar através da fusão de ouro solar e obsidiana lunar, equilibrando luz curativa e sombra letal na mesma peça.',
  'Arrancada do coração de um Titã ancestral adormecido sob a crosta do mundo; cada golpe faz o solo tremer sob os pés dos inimigos.',
  'Forjada a partir da presa de um Dragão Ancião abatido nos picos de fogo, emanando uma presença majestosa que intimida qualquer criatura menor.',
  'Relíquia sombria da antiga corte real, cujo aço espelhado absorve a luz do ambiente e projeta ecos espectrais que acompanham o movimento do usuário.',
  'Abençoada no ponto mais alto do Monte Celestia por um raio cristalizado, conduzindo a fúria das tempestades em arcos voltaicos perfeitos.',
  'Esculpida em gelo verdadeiro das profundezas astrais que jamais derrete, envolvendo o campo de batalha numa bruma silenciosa e cortante.',
  'Guarda em seu interior uma pena viva de Fênix primordial, irradiando um calor sagrado que renova o vigor de quem a empunha.',
];

const MYTHIC_LORE_POOL = [
  'Artefato primordial forjado antes da divisão dos planos na própria Bigorna da Criação; sua simples presença altera a atmosfera do campo de batalha e concede ao portador uma fração do poder dos antigos deuses.',
  'Relíquia suprema do multiverso tecida com fios da própria Trama Arcana e fragmentos de eternidade; um armamento vivo que transcende a mortalidade e impede que seu campeão tombe diante da escuridão.',
  'Armamento divino empunhado na Guerra do Alvorecer contra os senhores do Abismo; cada golpe carrega o peso de eras inteiras, ignorando barreiras mundanas e restaurando a força vital de seu mestre.',
  'Artefato cósmico moldado a partir do horizonte de eventos de um sol colapsado; sua lâmina guarda o silêncio do espaço profundo e desperta um poder cataclísmico quando seu portador enfrenta perigo mortal.',
];

// ============================================================================
// MOTOR DE NLP / MACHINE LEARNING: TOKENIZAÇÃO & SIMILARIDADE DE COSSENO
// ============================================================================

const PT_STOPWORDS = new Set([
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma',
  'uns', 'umas', 'por', 'para', 'com', 'sem', 'sob', 'sobre', 'entre', 'ate',
  'ao', 'aos', 'as', 'os', 'que', 'se', 'ou', 'e', 'a', 'o', 'seu', 'sua',
  'seus', 'suas', 'mais', 'menos', 'muito', 'como', 'quando', 'pelo', 'pela',
  'dano', 'maestria', 'ataque', 'acerto', 'arma', 'causa', 'efeito',
]);

export function tokenizeWeaponText(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !PT_STOPWORDS.has(w))
    .map((w) => (w.length > 6 ? w.slice(0, 6) : w));
}

export function buildTermVector(text) {
  const tokens = tokenizeWeaponText(text);
  const vec = {};
  for (const tok of tokens) {
    vec[tok] = (vec[tok] || 0) + 1;
  }
  return vec;
}

export function computeCosineSimilarity(textA, textB) {
  const vecA = buildTermVector(textA);
  const vecB = buildTermVector(textB);
  const keysA = Object.keys(vecA);
  const keysB = Object.keys(vecB);
  if (keysA.length === 0 || keysB.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const k of keysA) {
    normA += vecA[k] * vecA[k];
    if (vecB[k]) dot += vecA[k] * vecB[k];
  }
  for (const k of keysB) {
    normB += vecB[k] * vecB[k];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

function hashStringSeed(str) {
  let h = 2166136261;
  const s = String(str || 'vallen');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Sorteia uma maestria ponderada (Derrubar é muito rara) somente se a rolagem de probabilidade da raridade permitir
 */
function rollRareWeaponMastery(rarity, seedNum) {
  const chance = MASTERY_CHANCE_BY_RARITY[rarity] ?? 0;
  const roll01 = (seedNum % 1000) / 1000;
  if (roll01 >= chance) return null;

  const totalWeight = WEIGHTED_MASTERIES.reduce((acc, m) => acc + m.weight, 0);
  let target = ((seedNum >>> 4) % totalWeight);
  for (const m of WEIGHTED_MASTERIES) {
    if (target < m.weight) return m.name;
    target -= m.weight;
  }
  return WEIGHTED_MASTERIES[0].name;
}

/**
 * Sorteia um Efeito de Status Oficial do site de acordo com a raridade da arma:
 * - COMUM: nunca tem
 * - INCOMUM / RARO: difícil ter, e quando tem usa os efeitos básicos e mais fracos
 * - ÉPICO: chance moderada com efeitos táticos médios
 * - LENDÁRIO / MÍTICO: alta chance com os melhores efeitos de status do site
 */
function rollScaledStatusEffect(rarity, seedNum, comparisonDescriptions = []) {
  const chance = STATUS_EFFECT_CHANCE_BY_RARITY[rarity] ?? 0;
  const roll01 = ((seedNum >>> 3) % 1000) / 1000;
  if (roll01 >= chance) return null;

  // Filtra quais efeitos estão disponíveis para esta faixa de raridade
  let pool;
  if (rarity === 'INCOMUM') {
    // Apenas efeitos mais simples e em versão leve
    pool = DND_STATUS_EFFECTS.filter((s) =>
      ['slowed', 'bleeding', 'burning'].includes(s.id)
    );
  } else if (rarity === 'RARO') {
    pool = DND_STATUS_EFFECTS.filter((s) =>
      ['slowed', 'bleeding', 'burning', 'poisoned', 'prone'].includes(s.id)
    );
  } else if (rarity === 'ÉPICO') {
    pool = DND_STATUS_EFFECTS.filter((s) =>
      ['bleeding', 'burning', 'poisoned', 'prone', 'slowed', 'blinded', 'cursed'].includes(s.id)
    );
  } else {
    // LENDÁRIO e MÍTICO: acesso aos melhores efeitos (Atordoado, Invisível, Abençoado, Amaldiçoado, Cegueira, etc.)
    pool = DND_STATUS_EFFECTS;
  }

  // Escolhe o efeito menos repetido nas descrições recentes
  const startIdx = (seedNum >>> 7) % pool.length;
  let chosen = pool[startIdx];
  let bestScore = Infinity;

  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[(startIdx + i) % pool.length];
    const countInCorpus = comparisonDescriptions.filter((d) =>
      String(d).toLowerCase().includes(candidate.name.toLowerCase())
    ).length;
    if (countInCorpus < bestScore) {
      bestScore = countInCorpus;
      chosen = candidate;
    }
  }

  if (rarity === 'INCOMUM') return chosen.lowText;
  if (rarity === 'RARO' || rarity === 'ÉPICO') return chosen.midText;
  return chosen.highText;
}

/**
 * Seleciona a frase de lore mais distinta das já existentes usando Similaridade de Cosseno
 */
function pickMostUniqueLore(lorePool, itemName, seedNum, comparisonDescriptions = []) {
  const startIdx = (hashStringSeed(itemName) + seedNum) % lorePool.length;
  if (!comparisonDescriptions || comparisonDescriptions.length === 0) {
    return lorePool[startIdx];
  }

  let bestLore = lorePool[startIdx];
  let lowestMaxSim = Infinity;

  for (let i = 0; i < lorePool.length; i++) {
    const candidate = lorePool[(startIdx + i) % lorePool.length];
    let maxSim = 0;
    for (const existing of comparisonDescriptions) {
      const sim = computeCosineSimilarity(candidate, existing);
      if (sim > maxSim) maxSim = sim;
    }
    if (maxSim < lowestMaxSim - 0.01) {
      lowestMaxSim = maxSim;
      bestLore = candidate;
    }
  }

  return bestLore;
}

/**
 * Classifica a família de escala de dano de uma arma pelo nome
 */
export function classifyWeaponScaleType(name) {
  const lowerName = String(name || '').toLowerCase();
  if (
    lowerName.includes('adaga') ||
    lowerName.includes('punhal') ||
    lowerName.includes('foice') ||
    lowerName.includes('martelo leve')
  ) {
    return 'dagger';
  }
  if (
    lowerName.includes('espadão') ||
    lowerName.includes('espada grande') ||
    lowerName.includes('machado grande') ||
    lowerName.includes('malho') ||
    lowerName.includes('alabarda') ||
    lowerName.includes('glaive')
  ) {
    return 'greatsword';
  }
  if (
    lowerName.includes('arco') ||
    lowerName.includes('besta') ||
    lowerName.includes('dardo') ||
    lowerName.includes('mosquete') ||
    lowerName.includes('pistola') ||
    lowerName.includes('funda')
  ) {
    return 'ranged';
  }
  if (
    lowerName.includes('curta') ||
    lowerName.includes('cimitarra') ||
    lowerName.includes('clava') ||
    lowerName.includes('machadinha')
  ) {
    return 'shortsword';
  }
  return 'longsword';
}

/**
 * Sintetiza uma descrição de arma natural, bem escrita e escalonada por raridade:
 * - Respeita a raridade de Maestria (difícil vir com Derrubar ou outras maestrias)
 * - Respeita a raridade de Efeito de Status (usa os 10 status do site, mais fortes nas raridades altas e ausentes/raros nas baixas)
 * - Garante unicidade semântica via Similaridade de Cosseno (ML)
 */
export function synthesizeUniqueWeaponDescription({
  name,
  rarity,
  scaleType,
  comparisonDescriptions = [],
}) {
  const safeRarity = ['COMUM', 'INCOMUM', 'RARO', 'ÉPICO', 'LENDÁRIO', 'MÍTICO'].includes(rarity)
    ? rarity
    : 'COMUM';
  const resolvedScale = scaleType || classifyWeaponScaleType(name);
  const baseDamage =
    WEAPON_DAMAGE_DICE_BY_RARITY[resolvedScale]?.[safeRarity] ||
    WEAPON_DAMAGE_DICE_BY_RARITY.longsword[safeRarity];

  const seedNum = hashStringSeed(`${name}_${safeRarity}_${comparisonDescriptions.length}_${Math.random()}`);

  const lorePool =
    {
      COMUM: COMMON_LORE_POOL,
      INCOMUM: UNCOMMON_LORE_POOL,
      RARO: RARE_LORE_POOL,
      ÉPICO: EPIC_LORE_POOL,
      LENDÁRIO: LEGENDARY_LORE_POOL,
      MÍTICO: MYTHIC_LORE_POOL,
    }[safeRarity] || COMMON_LORE_POOL;

  const loreSentence = pickMostUniqueLore(
    lorePool,
    name,
    seedNum,
    comparisonDescriptions
  );

  const statusText = rollScaledStatusEffect(
    safeRarity,
    seedNum,
    comparisonDescriptions
  );
  const masteryText = rollRareWeaponMastery(safeRarity, seedNum);

  const parts = [loreSentence];

  if (statusText && masteryText) {
    parts.push(
      `Causa ${baseDamage}, ${statusText} e concede a maestria ${masteryText}.`
    );
  } else if (statusText) {
    parts.push(`Causa ${baseDamage} e ${statusText}.`);
  } else if (masteryText) {
    parts.push(`Causa ${baseDamage} e possui a maestria ${masteryText}.`);
  } else {
    parts.push(`Causa ${baseDamage}.`);
  }

  return parts.join(' ');
}

function needsMLRewrite(bodyDesc, rarity, comparisonDescriptions = []) {
  const clean = String(bodyDesc || '').trim();
  if (!clean || clean.length < 35) return true;

  // Detecta formatos robóticos antigos com colchetes, termos em inglês (Vex/Topple) ou clichês repetidos
  if (
    /\[.*?\]:/.test(clean) ||
    /\(Vex\)|\(Nick\)|\(Topple\)|\(Sap\)|\(Push\)|\(Graze\)|\(Slow\)|\(Cleave\)/i.test(clean) ||
    /Corte Dimensional:\s*ignora armadura/i.test(clean) ||
    /Técnica Ativa\s*—/i.test(clean)
  ) {
    return true;
  }

  // Em armas COMUNS ou INCOMUNS, se vierem sempre com maestria ou status forçado pela IA, reescreve
  if (rarity === 'COMUM' && /maestria|sangramento|atordoado|queimando|invis[íi]vel/i.test(clean)) {
    return true;
  }

  if (comparisonDescriptions && comparisonDescriptions.length > 0) {
    const threshold = rarity === 'MÍTICO' ? 0.28 : rarity === 'LENDÁRIO' ? 0.30 : 0.38;
    for (const existing of comparisonDescriptions) {
      if (computeCosineSimilarity(clean, existing) > threshold) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Normaliza e equilibra um item garantindo preço DMG, probabilidade real de raridade
 * e descrição fluida sem clichês repetidos.
 */
export function enforceItemBalance(item, comparisonDescriptions = []) {
  const rawDesc = String(item.description || '').trim();
  const rarityMatch = rawDesc.match(/<(COMUM|INCOMUM|RARO|ÉPICO|LENDÁRIO|MÍTICO)>/i);
  const rarity = rarityMatch
    ? rarityMatch[1].toUpperCase()
    : String(item.rarity || 'COMUM').toUpperCase();

  const type = String(item.type || 'consumable').toLowerCase();
  const name = String(item.item_name || 'Equipamento Forjado').trim();

  let bodyDesc = rawDesc.replace(/^<(COMUM|INCOMUM|RARO|ÉPICO|LENDÁRIO|MÍTICO)>\s*/i, '').trim();

  if (type === 'weapon') {
    const scaleType = classifyWeaponScaleType(name);
    if (needsMLRewrite(bodyDesc, rarity, comparisonDescriptions)) {
      bodyDesc = synthesizeUniqueWeaponDescription({
        name,
        rarity,
        scaleType,
        comparisonDescriptions,
      });
    }
  }

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
 * Processa um lote de itens da loja aplicando a tabela de probabilidades de raridade
 * (quanto maior a raridade, mais difícil aparecer) e deduplicação por Similaridade de Cosseno.
 */
export function enforceBatchItemUniqueness(
  items = [],
  existingDescriptions = [],
  enforceRarityRoll = false
) {
  const memoryCorpus = [...existingDescriptions];

  return items.map((item) => {
    let targetItem = { ...item };

    if (enforceRarityRoll && Array.isArray(item._forcedRarity)) {
      targetItem.rarity = item._forcedRarity;
    }

    const balanced = enforceItemBalance(targetItem, memoryCorpus);
    if (balanced.type === 'weapon') {
      memoryCorpus.push(balanced.description);
    }
    return balanced;
  });
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
