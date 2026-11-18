/**
 * Regras, Equilíbrio D&D 5.5e (2024) & Motor de Machine Learning / NLP para Unicidade de Armas
 *
 * Baseado estritamente nos 5 manuais organizados em /rpg/livros/:
 * 1. LIVRO DO JOGADOR D&D 5.5e (2024 Revision) - Armas, Maestrias, Equipamento
 * 2. LIVRO DO MESTRE (DM) D&D 5.5e (2024 Revision) - Tesouros, Itens Mágicos, Tiers
 * 3. Escudo do DM 5.5e (2024) - Condições, DCs, Perigos, Ações de Combate
 * 4. Livro do Jogador D&D 5e - Armas e Regras Clássicas
 * 5. Guia do Mestre D&D 5e - Encontros, Recompensas e Economia de PO
 *
 * Motor de Unicidade Semântica (TF-IDF + Similaridade de Cosseno + Vetores de Arquétipo):
 * - Escala a complexidade, profundidade narrativa e exclusividade mecânica proporcionalmente à raridade:
 *   COMUM -> INCOMUM -> RARO -> ÉPICO -> LENDÁRIO -> MÍTICO.
 * - Calcula vetores de termos (TF) e similaridade de cosseno entre descrições de armas.
 * - Detecta descrições repetidas ou genéricas (especialmente em ÉPICO, LENDÁRIO e MÍTICO) e
 *   seleciona automaticamente o arquétipo de maior distância semântica (menor similaridade de cosseno).
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

// Dados base por categoria e raridade (sem fixar uma única passiva repetitiva)
export const WEAPON_DAMAGE_DICE_BY_RARITY = {
  dagger: {
    COMUM: '1d4 perfurante',
    INCOMUM: '1d6 perfurante (+1 no acerto)',
    RARO: '1d8 perfurante (+1 no ataque)',
    ÉPICO: '1d10 perfurante (+2 no ataque)',
    LENDÁRIO: '2d6 perfurante (+3 no ataque)',
    MÍTICO: '2d8+4 perfurante (+4 no ataque)',
  },
  shortsword: {
    COMUM: '1d4 cortante/perfurante',
    INCOMUM: '1d6 cortante/perfurante (+1 no acerto)',
    RARO: '1d8 cortante/perfurante (+1 no ataque)',
    ÉPICO: '1d10 cortante/perfurante (+2 no ataque)',
    LENDÁRIO: '2d8 cortante/perfurante (+3 no ataque)',
    MÍTICO: '2d10+4 cortante/perfurante (+4 no ataque)',
  },
  longsword: {
    COMUM: '1d6 (versátil 1d8) cortante',
    INCOMUM: '1d8 (versátil 1d10) cortante (+1 no acerto)',
    RARO: '1d10 (versátil 1d12) cortante (+1 no ataque)',
    ÉPICO: '1d12 cortante (+2 no ataque)',
    LENDÁRIO: '2d8 (versátil 2d10) cortante (+3 no ataque)',
    MÍTICO: '3d6+4 (versátil 2d12+4) cortante (+4 no ataque)',
  },
  greatsword: {
    COMUM: '1d10 cortante/contundente',
    INCOMUM: '2d6 cortante/contundente (+1 no acerto)',
    RARO: '2d8 cortante/contundente (+1 no ataque)',
    ÉPICO: '2d10 cortante/contundente (+2 no ataque)',
    LENDÁRIO: '2d12 cortante/contundente (+3 no ataque)',
    MÍTICO: '4d6+5 cortante/contundente (+4 no ataque)',
  },
  ranged: {
    COMUM: '1d6 perfurante',
    INCOMUM: '1d8 perfurante (+1 em precisão)',
    RARO: '1d10 perfurante (+1 no ataque)',
    ÉPICO: '1d12 perfurante (+2 no ataque)',
    LENDÁRIO: '2d8 perfurante (+3 no ataque)',
    MÍTICO: '2d10+4 perfurante (+4 no ataque)',
  },
};

export const WEAPON_DAMAGE_SCALE = WEAPON_DAMAGE_DICE_BY_RARITY;

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

// ============================================================================
// BANCO MULTIDIMENSIONAL DE ARQUÉTIPOS POR RARIDADE (PARA SÍNTESE & DIVERSIDADE ML)
// ============================================================================

const COMMON_CRAFT_TRAITS = [
  'Forjada em ferro temperado de guarnição com cabo revestido em couro cru.',
  'Lâmina de aço carbono equilibrada em bigorna militar para combate direto.',
  'Construção robusta de oficina fronteiriça, sem adornos ou encantamentos.',
  'Peça padronizada de infantaria com têmpera simples a óleo e guarda de bronze.',
  'Acabamento rústico em aço cinzento, confiável para aventureiros iniciantes.',
  'Empunhadura firme de freixo envernizado e metal polido em pedra de amolar.',
];

const UNCOMMON_CRAFT_TRAITS = [
  'Banho de prata alquímica que brilha suavemente diante de criaturas sombrias e metamorfos.',
  'Gravada com runas de equilíbrio anão que reduzem o peso e ampliam a precisão do golpe.',
  'Liga de aço élfico flexível que não perde o fio mesmo contra couraças espessas.',
  'Temperada em óleo de salamandra com contrapeso de safira bruta no pomo.',
  'Metal dobrado doze vezes pelos mestres ferreiros da Cidadela, conferindo resposta imediata.',
  'Incrustada com filigranas de cobre condutor que estabilizam a trajetória de cada ataque.',
];

const RARE_ELEMENTAL_ARCHETYPES = [
  {
    id: 'solar_fire',
    bonus: '+1d6 de dano de Fogo Solar',
    trait: 'Canaliza brasas da Forja de Muspelheim; ao acertar, incendeia o ar ao redor e ilumina 6m.',
  },
  {
    id: 'stygian_frost',
    bonus: '+1d6 de dano de Frio Glacial',
    trait: 'Coberta por geada eterna de Stygia; recobre a armadura do alvo com cristais que reduzem seu deslocamento em 1,5m.',
  },
  {
    id: 'astral_lightning',
    bonus: '+1d6 de dano Elétrico',
    trait: 'Conduz arcos voltaicos azuis; ataques contra inimigos usando armadura metálica recebem +2 na rolagem de acerto.',
  },
  {
    id: 'seismic_thunder',
    bonus: '+1d6 de dano Trovejante',
    trait: 'Ressoa como um sino de guerra ao impacto, empurrando o oponente 1,5m para trás com ondas sonoras.',
  },
  {
    id: 'venom_fang',
    bonus: '+1d6 de dano de Veneno',
    trait: 'Sulcos capilares secretam toxina de wyvern que enfraquece a resistência física do inimigo.',
  },
  {
    id: 'celestial_radiance',
    bonus: '+1d6 de dano Radiante',
    trait: 'Abençoada em altar solar; causa +1d8 adicional contra mortos-vivos e criaturas abissais.',
  },
  {
    id: 'umbral_necrotic',
    bonus: '+1d6 de dano Necrótico',
    trait: 'Absorve o calor ao redor da lâmina, drenando o vigor do alvo e concedendo 3 PV temporários ao portador em crítico.',
  },
  {
    id: 'psychic_resonance',
    bonus: '+1d6 de dano Psíquico',
    trait: 'Forjada em cristal ressonante do Plano Astral; vibra na mente do adversário dificultando sua concentração.',
  },
  {
    id: 'acid_vitriol',
    bonus: '+1d6 de dano Ácido',
    trait: 'Exsuda vitríolo alquímico esmeralda que corrói escudos e reduz a CA do alvo em -1 até o próximo turno.',
  },
  {
    id: 'aether_force',
    bonus: '+1d4 de dano de Energia Pura',
    trait: 'Fio translúcido de força arcana condensada que atinge criaturas incorpóreas e etéreas sem penalidade.',
  },
];

const EPIC_TACTICAL_ARCHETYPES = [
  {
    id: 'crimson_hemorrhage',
    mechanic: 'inflige Sangramento (1d6 de perda por turno) e abre feridas que impedem cura mágica por 1 rodada',
    lore: 'Técnica Ativa — Hemorragia Carmesim: ao acertar dois golpes seguidos no mesmo alvo, detona o sangue derramado causando +2d6 necrótico.',
  },
  {
    id: 'thunder_concussion',
    mechanic: 'aplica Atordoado por 1 rodada em acertos críticos (ou falha em CD 15 de Constituição)',
    lore: 'Técnica Ativa — Martelo do Trovão: 1x por combate pode bater no chão criando onda sísmica de 3m que deixa inimigos Caídos.',
  },
  {
    id: 'hellfire_brand',
    mechanic: 'aplica Queimadura Contínua (1d6 de fogo/turno) e marca o alvo com brasas visíveis na escuridão',
    lore: 'Técnica Ativa — Pira do Julgamento: ataques contra alvos já em chamas ignoram resistência a fogo e somam +1d8.',
  },
  {
    id: 'chrono_slow',
    mechanic: 'inflige Lentidão (-3m de deslocamento e -2 na CA) ao distorcer a inércia do oponente',
    lore: 'Técnica Ativa — Passo da Ampulheta: ao abater ou atingir crítico, o portador ganha +3m de deslocamento sem provocar ataques de oportunidade.',
  },
  {
    id: 'mirage_blindness',
    mechanic: 'dispara um clarão prismático em acertos que aplica Cegueira Temporária até o próximo turno',
    lore: 'Técnica Ativa — Reflexo Espelhado: concede Vantagem no próximo ataque contra qualquer inimigo cego ou desorientado.',
  },
  {
    id: 'plague_curse',
    mechanic: 'inocula Veneno Virulento e aplica Amaldiçoado (-1d4 nas jogadas de ataque do alvo)',
    lore: 'Técnica Ativa — Colheita da Peste: quando um inimigo envenenado cai a 0 PV, a toxina salta para outro inimigo a até 3m.',
  },
  {
    id: 'glacial_shatter',
    mechanic: 'congela as articulações do inimigo aplicando Lentidão severa e +1d8 de dano de Frio',
    lore: 'Técnica Ativa — Estilhaçar Gelo: acertar um inimigo já com Lentidão quebra a crosta glacial causando +2d6 contundente.',
  },
  {
    id: 'spell_disruptor',
    mechanic: 'causa +1d8 de Energia e impõe Desvantagem imediata em testes de Concentração de conjuradores',
    lore: 'Técnica Ativa — Silêncio Rúnico: em acerto crítico, sela a voz do alvo por 1 rodada, impedindo magias com componente verbal.',
  },
];

const LEGENDARY_UNIQUE_ARCHETYPES = [
  {
    id: 'gravity_singularity',
    title: 'Singularidade Gravitacional',
    mechanic: '+1d10 de Energia Gravitacional e Campo de Atração (puxa inimigos a até 4,5m para perto do alvo atingido, deixando-os Caídos em falha de Força CD 17)',
    lore: 'Forjada ao redor do núcleo colapsado de um meteorito estelar. Uma vez por combate, pode inverter a gravidade num raio de 3m, suspendendo inimigos no ar.',
  },
  {
    id: 'chrono_rewind',
    title: 'Paradoxo do Relógio Quebrado',
    mechanic: '+1d10 Temporal e Fio de Cronos (1x por combate, permite rebobinar uma rolagem de ataque falha e transformá-la em acerto automático com dano máximo)',
    lore: 'Seus engastes contêm areia do Plano do Tempo. Sempre que o portador sofre um ataque, pode usar sua Reação para teleportar 4,5m para a posição em que estava no turno anterior.',
  },
  {
    id: 'spell_devourer',
    title: 'Devoradora de Arcanos',
    mechanic: 'Quebra-Magia (+2d6 contra conjuradores, destrói escudos mágicos instantaneamente e absorve feitiços de até 3º círculo)',
    lore: 'Criada pelos inquisidores de Karsus em metal nulo-mágico. Ao anular ou resistir a uma magia, converte a energia absorvida em +2d10 de dano no próximo golpe.',
  },
  {
    id: 'phantom_twin',
    title: 'Dança das Sombras Gêmeas',
    mechanic: 'Eco Espectral (cada ataque cria uma projeção sombria que repete o golpe causando +1d8 necrótico adicional e aplica Cegueira em crítico)',
    lore: 'Aço negro fundido com a própria sombra de um mestre assassino. Permite atravessar inimigos como fumaça sem provocar ataques de oportunidade.',
  },
  {
    id: 'solar_eclipse_duality',
    title: 'Veredito do Eclipse',
    mechanic: 'Postura Dual de Sol e Lua (em turnos pares causa +2d6 Radiante e cura um aliado a 3m em 1d8 PV; em turnos ímpares causa +2d6 Necrótico e aplica Lentidão)',
    lore: 'Duas lâminas gêmeas fundidas num único punho de ouro branco e obsidiana lunar durante um eclipse milenar.',
  },
  {
    id: 'titan_faultline',
    title: 'Cataclismo da Fenda Terrestre',
    mechanic: 'Impacto Tectônico (+1d12 contundente/fogo; golpes abrem rachaduras de magma de 6m que causam Queimadura Contínua e derrubam inimigos)',
    lore: 'Arrancada do coração de um Titã Primordial da Terra. O portador torna-se imune a ser empurrado ou derrubado enquanto empunhá-la.',
  },
  {
    id: 'telekinetic_swarm',
    title: 'Sinfonia das Mil Lâminas',
    mechanic: 'Fragmentação Telecinética (a arma se divide em segmentos flutuantes ligados por energia pura, ampliando o alcance em +3m e atingindo até 2 alvos por ação)',
    lore: 'Obra-prima psíquica dos Githzerai do Limbo; responde aos pensamentos do usuário e pode flutuar para defender seu portador concedendo +2 na CA.',
  },
  {
    id: 'abyssal_predator',
    title: 'Marca do Caçador Abissal',
    mechanic: 'Sentença de Caça (o primeiro acerto marca a presa; contra o alvo marcado, a margem de crítico é 19-20, ignora cobertura e causa +2d6 de Sangramento)',
    lore: 'Temperada no sangue de um lorde predador das Camadas Infinitas. O portador sente o batimento cardíaco do alvo marcado a até 1 km.',
  },
  {
    id: 'storm_chain_sovereign',
    title: 'Soberania da Tempestade Encadeada',
    mechanic: 'Relâmpago em Cadeia (+1d10 Elétrico que salta automaticamente para até 2 outros inimigos a 4,5m causando 1d8 elétrico e Atordoado em crítico)',
    lore: 'Forjada no pico mais alto do Monte Celestia a partir de um raio cristalizado. Concede resistência a dano elétrico e trovejante.',
  },
  {
    id: 'frost_mirror_queen',
    title: 'Trono do Inverno Eterno',
    mechanic: 'Zero Absoluto (+1d10 de Frio; reduz o deslocamento do alvo pela metade e, em acerto crítico, petrifica/congela o inimigo em gelo sólido por 1 rodada)',
    lore: 'Esculpida em gelo verdadeiro que jamais derrete nem sob fogo de dragão. Cria uma aura fria de 3m que extingue chamas mundanas e mágicas.',
  },
  {
    id: 'phoenix_cinder_heart',
    title: 'Coração da Fênix Renascida',
    mechanic: 'Chama Imortal (+2d6 de Fogo Sagrado e Queimadura Contínua; ao acertar, purifica 1 condição negativa do portador)',
    lore: 'No interior da guarda repousa uma pena viva de Fênix Astral. Emite calor reconfortante e explode numa onda de fogo curativo ao comando.',
  },
  {
    id: 'dragon_slayer_oath',
    title: 'Ruína dos Dragões Ancestrais',
    mechanic: 'Perfura-Escamas (ignora +3 da CA de armaduras naturais, causa +2d8 contra dragões/monstros grandes ou maiores e aplica Sangramento Profundo)',
    lore: 'Forjada a partir da presa de um Dragão Vermelho Ancião abatido na Primeira Era; vibra intensamente quando há tesouros ou dragões próximos.',
  },
  {
    id: 'void_dimensional_rift',
    title: 'Fenda do Horizonte de Eventos',
    mechanic: 'Corte Dimensional (fende o espaço ignorando resistências físicas e permite teleportar até 6m diretamente para trás do alvo atingido)',
    lore: 'Sua lâmina não reflete luz, mostrando apenas o céu estrelado do Plano Astral.',
  },
  {
    id: 'blood_emperor_scepter',
    title: 'Pacto do Imperador Carmesim',
    mechanic: 'Sifão Sanguíneo (+1d10 Necrótico, aplica Sangramento acumulativo e converte 25% de todo o dano causado em escudo de PV temporários)',
    lore: 'Relíquia ancestral da corte vampírica de Baróvia; quanto mais ferido estiver o portador, mais intenso é o brilho escarlate da arma.',
  },
];

const MYTHIC_ARTIFACT_ARCHETYPES = [
  {
    id: 'world_breaker_moradin',
    title: 'Artefato Primordial: Quebra-Mundos',
    mechanic: '+2d10 de impacto cósmico, ignora qualquer imunidade/resistência e aplica Atordoado em área de 3m em acertos críticos',
    lore: 'Passiva Mítica — Forja da Criação: Roubo de vida de 50% do dano causado e Fúria Imortal (se o portador cair a 0 PV, permanece de pé com 1 PV e libera uma onda divina de 4d10 uma vez ao dia).',
  },
  {
    id: 'chronos_eternity_edge',
    title: 'Artefato Temporal: Gume da Eternidade',
    mechanic: '+2d10 de dano de Força Temporal, margem de crítico 18-20 e aplica Paralisia Temporal no alvo em acertos críticos',
    lore: 'Passiva Mítica — Senhor do Fluxo: Concede uma Ação adicional completa no primeiro turno de cada combate e permite anular completamente um ataque letal recebido uma vez ao dia.',
  },
  {
    id: 'astral_nova_sovereign',
    title: 'Artefato Cósmico: Estrela Cadente de Mystra',
    mechanic: '+2d10 Radiante/Arcano, atravessa qualquer barreira mágica e silencia poderes arcanos do inimigo atingido',
    lore: 'Passiva Mítica — Coroa da Trama: Regenera 10 PV e 2 de Mana no início de cada turno do portador e reflete feitiços de alvo único de volta ao conjurador em rolagem 20.',
  },
  {
    id: 'abyssal_soul_harvester',
    title: 'Artefato Abissal: Ceifadora de Almas Primordial',
    mechanic: '+2d10 Necrótico, aplica Sangramento Abissal e Drenagem de Alma (cura o portador em 50% de todo o dano infligido)',
    lore: 'Passiva Mítica — Trono dos Caídos: Cada inimigo derrotado concede +1 permanente de dano no combate atual e ressuscita o portador com 50% dos PV caso tombado (1x/dia).',
  },
  {
    id: 'bahamut_platinum_wrath',
    title: 'Artefato Dracônico: Garra de Platina de Bahamut',
    mechanic: '+2d10 de energia Elemental Adaptativa (assume automaticamente o elemento ao qual o alvo é mais vulnerável) e derruba criaturas Colossais',
    lore: 'Passiva Mítica — Sopro do Deus Dragão: Concede imunidade a medo, +2 na CA e permite disparar um Sopro de Platina em cone de 9m (6d10 de dano) uma vez por combate.',
  },
  {
    id: 'ragnarok_twilight_spear',
    title: 'Artefato do Crepúsculo: Prelúdio do Ragnarok',
    mechanic: '+2d10 Trovejante/Fogo, nunca erra o primeiro ataque do combate e aplica Queimadura e Lentidão simultaneamente',
    lore: 'Passiva Mítica — Juramento dos Einherjar: Quando o portador está abaixo de 50% de PV, seus ataques causam +2d8 extra e aliados a 6m recebem Vantagem em ataques.',
  },
];

// ============================================================================
// MOTOR DE NLP / MACHINE LEARNING: TOKENIZAÇÃO, TF-IDF & SIMILARIDADE DE COSSENO
// ============================================================================

const PT_STOPWORDS = new Set([
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma',
  'uns', 'umas', 'por', 'para', 'com', 'sem', 'sob', 'sobre', 'entre', 'ate',
  'ao', 'aos', 'as', 'os', 'que', 'se', 'ou', 'e', 'a', 'o', 'seu', 'sua',
  'seus', 'suas', 'mais', 'menos', 'muito', 'como', 'quando', 'pelo', 'pela',
  'dano', 'maestria', 'ataque', 'acerto', 'arma', 'comum', 'incomum', 'raro',
  'epico', 'lendario', 'mitico',
]);

/**
 * Extrai tokens normalizados (stems semânticos de 5 caracteres) para vetorização NLP
 */
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

/**
 * Constrói vetor de frequência de termos (Term Frequency - TF)
 */
export function buildTermVector(text) {
  const tokens = tokenizeWeaponText(text);
  const vec = {};
  for (const tok of tokens) {
    vec[tok] = (vec[tok] || 0) + 1;
  }
  return vec;
}

/**
 * Calcula a Similaridade de Cosseno entre dois textos de descrição (0.0 = totalmente únicos, 1.0 = idênticos)
 */
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
    if (vecB[k]) {
      dot += vecA[k] * vecB[k];
    }
  }
  for (const k of keysB) {
    normB += vecB[k] * vecB[k];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/**
 * Hash determinístico baseado no nome e semente do item para distribuição uniforme de arquétipos
 */
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
 * Seleciona o arquétipo no banco de raridade que possui a MENOR similaridade de cosseno
 * (maior distância semântica) em relação às descrições já existentes no lote/loja.
 */
function selectMostUniqueArchetype(archetypes, itemName, comparisonDescriptions = []) {
  const baseIdx = hashStringSeed(itemName) % archetypes.length;
  if (!comparisonDescriptions || comparisonDescriptions.length === 0) {
    return archetypes[baseIdx];
  }

  let bestArchetype = archetypes[baseIdx];
  let lowestMaxSim = Infinity;

  for (let offset = 0; offset < archetypes.length; offset++) {
    const candidate = archetypes[(baseIdx + offset) % archetypes.length];
    const candidateText = `${candidate.title || ''} ${candidate.bonus || ''} ${candidate.mechanic || ''} ${candidate.trait || ''} ${candidate.lore || ''}`;

    let maxSimAgainstExisting = 0;
    for (const existingDesc of comparisonDescriptions) {
      const sim = computeCosineSimilarity(candidateText, existingDesc);
      if (sim > maxSimAgainstExisting) {
        maxSimAgainstExisting = sim;
      }
    }

    if (maxSimAgainstExisting < lowestMaxSim - 0.02) {
      lowestMaxSim = maxSimAgainstExisting;
      bestArchetype = candidate;
    }
  }

  return bestArchetype;
}

/**
 * Detecta se uma descrição de arma de alta raridade está genérica, repetitiva (ex: clichê "Corte Dimensional")
 * ou similar demais a outras armas existentes.
 */
function needsMLDiversification(bodyDesc, rarity, comparisonDescriptions = []) {
  const clean = String(bodyDesc || '').trim();
  const minExpectedLength = {
    COMUM: 35,
    INCOMUM: 65,
    RARO: 95,
    ÉPICO: 130,
    LENDÁRIO: 165,
    MÍTICO: 190,
  }[rarity] || 40;

  if (clean.length < minExpectedLength) return true;

  // Verifica se é o texto estático antigo repetido em armas lendárias/míticas
  if (
    /Corte Dimensional:\s*ignora armadura e resist[êe]ncias/i.test(clean) ||
    /Passiva M[íi]tica:\s*F[úu]ria Tit[âa]nica/i.test(clean) ||
    /Forjada nas chamas da forja an[ãa]/i.test(clean)
  ) {
    return true;
  }

  // Verifica similaridade de cosseno contra outras armas já geradas ou na loja
  if (comparisonDescriptions && comparisonDescriptions.length > 0) {
    const threshold = rarity === 'MÍTICO' ? 0.28 : rarity === 'LENDÁRIO' ? 0.32 : 0.42;
    for (const other of comparisonDescriptions) {
      if (computeCosineSimilarity(clean, other) > threshold) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Sintetiza uma descrição de arma única e escalonada por raridade usando seleção por distância semântica (ML)
 */
export function synthesizeUniqueWeaponDescription({
  name,
  rarity,
  scaleType,
  mastery,
  existingDesc = '',
  comparisonDescriptions = [],
}) {
  const baseDamage =
    WEAPON_DAMAGE_DICE_BY_RARITY[scaleType]?.[rarity] ||
    WEAPON_DAMAGE_DICE_BY_RARITY.longsword[rarity] ||
    '1d8 cortante';

  const seedIdx = hashStringSeed(`${name}_${Date.now()}_${Math.random()}`);

  if (rarity === 'COMUM') {
    const craft = COMMON_CRAFT_TRAITS[seedIdx % COMMON_CRAFT_TRAITS.length];
    return `Dano: ${baseDamage}. Maestria: ${mastery}. ${craft}`;
  }

  if (rarity === 'INCOMUM') {
    const craft = UNCOMMON_CRAFT_TRAITS[seedIdx % UNCOMMON_CRAFT_TRAITS.length];
    return `Dano: ${baseDamage}. Maestria: ${mastery}. ${craft}`;
  }

  if (rarity === 'RARO') {
    const arch = selectMostUniqueArchetype(
      RARE_ELEMENTAL_ARCHETYPES,
      name,
      comparisonDescriptions
    );
    return `Dano: ${baseDamage} (${arch.bonus}). Maestria: ${mastery}. ${arch.trait}`;
  }

  if (rarity === 'ÉPICO') {
    const arch = selectMostUniqueArchetype(
      EPIC_TACTICAL_ARCHETYPES,
      name,
      comparisonDescriptions
    );
    return `Dano: ${baseDamage}, ${arch.mechanic}. Maestria: ${mastery}. ${arch.lore}`;
  }

  if (rarity === 'LENDÁRIO') {
    const arch = selectMostUniqueArchetype(
      LEGENDARY_UNIQUE_ARCHETYPES,
      name,
      comparisonDescriptions
    );
    return `Dano: ${baseDamage} — [${arch.title}]: ${arch.mechanic}. Maestria: ${mastery}. ${arch.lore}`;
  }

  if (rarity === 'MÍTICO') {
    const arch = selectMostUniqueArchetype(
      MYTHIC_ARTIFACT_ARCHETYPES,
      name,
      comparisonDescriptions
    );
    return `Dano: ${baseDamage} — [${arch.title}]: ${arch.mechanic}. Maestria: ${mastery}. ${arch.lore}`;
  }

  return `Dano: ${baseDamage}. Maestria: ${mastery}. ${existingDesc}`.trim();
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
 * Normaliza e enriquece itens gerados assegurando equilíbrio D&D 5.5e / 5e
 * e unicidade progressiva por raridade (ML / Similaridade de Cosseno).
 */
export function enforceItemBalance(item, comparisonDescriptions = []) {
  const rawDesc = String(item.description || '').trim();
  const rarityMatch = rawDesc.match(/<(COMUM|INCOMUM|RARO|ÉPICO|LENDÁRIO|MÍTICO)>/i);
  const rarity = rarityMatch
    ? rarityMatch[1].toUpperCase()
    : String(item.rarity || 'COMUM').toUpperCase();

  const type = String(item.type || 'consumable').toLowerCase();
  const name = String(item.item_name || 'Equipamento Forjado').trim();

  // Limpa descrições prévias da tag de raridade para reformatar
  let bodyDesc = rawDesc.replace(/^<(COMUM|INCOMUM|RARO|ÉPICO|LENDÁRIO|MÍTICO)>\s*/i, '').trim();

  if (type === 'weapon') {
    const lowerName = name.toLowerCase();
    const matchedWeapon = DND_EXPANDED_WEAPONS.find((w) =>
      lowerName.includes(w.name.toLowerCase())
    );
    const mastery = matchedWeapon ? matchedWeapon.mastery : 'Afligir (Vex)';
    const scaleType = classifyWeaponScaleType(name);

    // Avalia se a descrição precisa de síntese/diversificação por ML
    if (needsMLDiversification(bodyDesc, rarity, comparisonDescriptions)) {
      bodyDesc = synthesizeUniqueWeaponDescription({
        name,
        rarity,
        scaleType,
        mastery,
        existingDesc: bodyDesc,
        comparisonDescriptions,
      });
    } else {
      const hasDice = /\d+d\d+/i.test(bodyDesc);
      if (!hasDice) {
        const damageFormula = WEAPON_DAMAGE_DICE_BY_RARITY[scaleType]?.[rarity] || '1d8 cortante';
        bodyDesc = `Dano: ${damageFormula}. Maestria: ${mastery}. ${bodyDesc}`.trim();
      } else if (!bodyDesc.toLowerCase().includes('maestria')) {
        bodyDesc = `${bodyDesc} (Maestria: ${mastery})`.trim();
      }
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
 * Processa um lote inteiro de itens aplicando deduplicação sequencial por Similaridade de Cosseno
 * contra o histórico existente da loja e contra os próprios itens do lote.
 */
export function enforceBatchItemUniqueness(items = [], existingDescriptions = []) {
  const memoryCorpus = [...existingDescriptions];
  return items.map((item) => {
    const balanced = enforceItemBalance(item, memoryCorpus);
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
