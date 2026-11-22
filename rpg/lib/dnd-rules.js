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

// Probabilidade de aparição de missões por Rank (quanto maior o rank, mais difícil acontecer)
export const MISSION_RANK_WEIGHTS = [
  { rank: 'F', weight: 34.0 },
  { rank: 'E', weight: 26.0 },
  { rank: 'D', weight: 18.0 },
  { rank: 'C', weight: 11.5 },
  { rank: 'B', weight: 6.5 },
  { rank: 'A', weight: 3.0 },
  { rank: 'S', weight: 1.0 },
];

export function rollMissionRank() {
  const rand = Math.random() * 100;
  let acc = 0;
  for (const entry of MISSION_RANK_WEIGHTS) {
    acc += entry.weight;
    if (rand <= acc) return entry.rank;
  }
  return 'F';
}

// Dados base por categoria e raridade (incluindo Cajados Arcanos e escala reforçada em Épico, Lendário e Mítico)
export const WEAPON_DAMAGE_DICE_BY_RARITY = {
  dagger: {
    COMUM: '1d4 de dano perfurante',
    INCOMUM: '1d6 de dano perfurante (+1 no acerto)',
    RARO: '1d8 de dano perfurante (+1 no ataque e +1d4 elemental)',
    ÉPICO: '1d10+2 de dano perfurante (+2 no ataque e +1d6 de dano elemental)',
    LENDÁRIO: '2d8+3 de dano perfurante (+3 no ataque e +2d6 de dano elemental)',
    MÍTICO: '3d8+5 de dano perfurante (+4 no ataque e +3d6 de dano primordial)',
  },
  shortsword: {
    COMUM: '1d4 de dano cortante',
    INCOMUM: '1d6 de dano cortante (+1 no acerto)',
    RARO: '1d8 de dano cortante (+1 no ataque e +1d4 elemental)',
    ÉPICO: '1d12+2 de dano cortante (+2 no ataque e +1d6 de dano elemental)',
    LENDÁRIO: '2d8+3 de dano cortante (+3 no ataque e +2d6 de dano elemental)',
    MÍTICO: '3d10+5 de dano cortante (+4 no ataque e +3d6 de dano primordial)',
  },
  longsword: {
    COMUM: '1d6 de dano cortante (1d8 com duas mãos)',
    INCOMUM: '1d8 de dano cortante (+1 no acerto)',
    RARO: '1d10 de dano cortante (+1 no ataque e +1d6 elemental)',
    ÉPICO: '2d6+2 de dano cortante (+2 no ataque e +1d6 de dano elemental)',
    LENDÁRIO: '2d10+3 de dano cortante (+3 no ataque e +2d6 de dano elemental)',
    MÍTICO: '3d10+5 de dano cortante (+4 no ataque e +3d8 de dano primordial)',
  },
  greatsword: {
    COMUM: '1d10 de dano pesado',
    INCOMUM: '2d6 de dano pesado (+1 no acerto)',
    RARO: '2d8 de dano pesado (+1 no ataque e +1d6 elemental)',
    ÉPICO: '2d10+2 de dano pesado (+2 no ataque e +1d8 de dano elemental)',
    LENDÁRIO: '3d8+3 de dano pesado (+3 no ataque e +2d8 de dano elemental)',
    MÍTICO: '4d10+6 de dano pesado (+4 no ataque e +3d8 de dano primordial)',
  },
  ranged: {
    COMUM: '1d4 de dano perfurante à distância',
    INCOMUM: '1d8 de dano perfurante (+1 em precisão)',
    RARO: '1d10 de dano perfurante (+1 no ataque e +1d6 elemental)',
    ÉPICO: '1d12+2 de dano perfurante (+2 no ataque e +1d6 de dano elemental)',
    LENDÁRIO: '2d10+3 de dano perfurante (+3 no ataque e +2d6 de dano elemental)',
    MÍTICO: '3d10+5 de dano perfurante (+4 no ataque e +3d6 de dano primordial)',
  },
  staff: {
    COMUM: '1d6 de dano contundente (versátil 1d8) e atua como foco arcano básico',
    INCOMUM: '1d8 de dano contundente ou arcano (+1 em ataques mágicos e +1 na CD de magias)',
    RARO: '1d10 de dano arcano (+1 em ataques mágicos, +1 na CD de magias e +1d6 elemental)',
    ÉPICO: '2d8+2 de dano arcano (+2 em ataques mágicos, +2 na CD de magias e +1d8 elemental)',
    LENDÁRIO: '2d10+3 de dano arcano (+3 em ataques mágicos, +2 na CD de magias e +2d6 elemental)',
    MÍTICO: '3d10+5 de dano arcano supremo (+4 em ataques mágicos, +3 na CD de magias e +3d8 primordial)',
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
  ÉPICO: 0.80, // 80% de chance (efeito tático forte)
  LENDÁRIO: 0.95, // 95% de chance (efeito de elite)
  MÍTICO: 1.0, // 100% de chance (efeito supremo)
};

// Chance de uma arma vir com propriedade de Maestria (escassa nas raridades menores, dominante nas altas)
export const MASTERY_CHANCE_BY_RARITY = {
  COMUM: 0.0, // Sem maestria
  INCOMUM: 0.12, // 12% de chance
  RARO: 0.24, // 24% de chance
  ÉPICO: 0.65, // 65% de chance
  LENDÁRIO: 0.90, // 90% de chance
  MÍTICO: 1.0, // 100% de chance
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
// REPERTÓRIO DEDICADO DE LORE E PODERES ARCANOS PARA CAJADOS (STAVES)
// ============================================================================

const STAFF_LORE_POOL = {
  COMUM: [
    'Esculpido em madeira de carvalho maciço e polido com óleo de linhaça para viajantes e aprendizes arcanos.',
    'Bordão simples de freixo resistente com anéis de latão nas extremidades para canalizar truques básicos.',
    'Cajado tradicional de cedro leve, equilibrado para longas caminhadas e conjurações cotidianas.',
    'Talhado à mão em nogueira antiga com pequenos sulcos que facilitam o foco da energia mágica.',
  ],
  INCOMUM: [
    'Entalhado em madeira prateada com um cristal de quartzo puro no topo que amplifica a concentração do conjurador.',
    'Bordão rúnico tratado com resinas alquímicas da Torre de Vallen, vibrando suavemente ao pronunciar palavras arcanas.',
    'Cajado de salgueiro encantado com filigranas de prata que estabilizam feitiços ofensivos e defensivos.',
    'Cetro de madeira de ébano incrustado com pedra-da-lua lapidada, elevando a precisão dos encantamentos.',
  ],
  RARO: [
    'Forjado com madeira petrificada de florestas antigas e coroado por uma gema elemental que pulsa poder bruto.',
    'Báculo gravado com sigilos antigos dos círculos elementais, canalizando fogo, gelo ou relâmpago com facilidade.',
    'Cajado abençoado pelos guardiões druídicos, cuja haste viva responde ao fluxo de mana ao redor do portador.',
    'Cetro arcano de marfim e cristal prismático que refrata a energia mágica em rajadas concentradas.',
  ],
  ÉPICO: [
    'Relíquia dos antigos arquimagos da Cidadela de Vallen, talhada no cerne de uma árvore ancestral atingida por energia planar.',
    'Báculo de obsidiana translúcida envolvido por anéis metálicos flutuantes que giram sempre que uma magia é preparada.',
    'Cajado de elite consagrado na Confluência Astral, capaz de armazenar grandes reservas de energia mágica pura.',
    'Cetro soberano moldado com safiras rúnicas e madeira estelar que ressoa em harmonia com feitiços devastadores.',
  ],
  LENDÁRIO: [
    'Obra-prima arcana esculpida a partir de um ramo vivo da Árvore-Mundo e coroada com um fragmento cristalizado da Trama.',
    'Báculo lendário empunhado pelo Grão-Arquimago na defesa de Vallen, irradiando uma aura capaz de dobrar magias inimigas.',
    'Cajado forjado com osso de dragão ancião e núcleo de éter puro, fazendo o ar crepitar em um raio de vários metros.',
    'Cetro imperial do Plano Astral que distorce a luz e a gravidade ao canalizar círculos superiores de magia.',
  ],
  MÍTICO: [
    'Artefato arcano primordial tecido diretamente da fonte original da Trama; sua simples presença realinha as linhas ley ao redor do conjurador.',
    'Báculo divino criado antes da queda dos impérios antigos, abrigando em seu topo uma singularidade luminosa de poder mágico infinito.',
    'Relíquia suprema dos senhores da magia ancestral, capaz de reescrever feitiços no ar e sustentar o portador contra a própria morte.',
    'Cajado cósmico nascido no coração de uma tempestade planar eterna, transformando cada conjuração em um cataclismo controlado.',
  ],
};

// ============================================================================
// PODERES EXCLUSIVOS DE ALTA RARIDADE (ÉPICO, LENDÁRIO E MÍTICO)
// ============================================================================

const HIGH_TIER_WEAPON_POWERS = {
  ÉPICO: [
    'Possui margem de crítico 19-20 contra inimigos feridos e concede 10 PV temporários ao portador sempre que acerta um crítico.',
    'Permite desferir uma onda de energia cortante em linha de 6m duas vezes por combate, causando +2d6 de dano adicional.',
    'Causa +2d6 de dano extra contra criaturas Grandes ou maiores e reduz a CA do alvo em 2 até o próximo turno em acertos críticos.',
    'Ao abater um inimigo, concede +3m de deslocamento e vantagem no próximo ataque realizado ainda na mesma rodada.',
    'Acumula energia de impacto: após dois acertos consecutivos no mesmo alvo, o terceiro golpe causa +2d8 de dano explosivo.',
    'Permite gastar sua Reação uma vez por rodada para aparar um golpe corpo a corpo ou projétil, somando +3 na CA contra aquele ataque.',
  ],
  LENDÁRIO: [
    'Possui margem de crítico 19-20, ignora resistências a dano físico e elemental e libera uma explosão de +3d6 em acertos críticos.',
    'Concede +2 na Classe de Armadura enquanto empunhada e permite um contra-ataque imediato com Reação sempre que um inimigo errar um golpe contra você.',
    'Drena 25% do dano causado como pontos de vida para o portador e impõe desvantagem nas salvaguardas contra seus efeitos.',
    'Permite realizar um teleporte instantâneo de até 9 metros após acertar um golpe decisivo, surgindo no flanco de qualquer inimigo visível.',
    'Duas vezes por combate, o portador pode liberar uma onda de choque de 3d8 em raio de 4,5m ao redor do alvo, derrubando inimigos próximos.',
    'Concede vantagem em testes de iniciativa e permite transformar qualquer acerto normal em acerto crítico uma vez por descanso curto.',
  ],
  MÍTICO: [
    'Passiva Mítica: margem de crítico 18-20, ignora resistências, drena 50% do dano causado como cura vital e ativa Fúria Imortal (uma vez ao dia impede a morte, deixando com 1 PV e 35 PV temporários).',
    'Passiva Mítica: margem de crítico 18-20 e explosão cataclísmica de 4d8 em área de 6m ao acertar crítico ou derrotar um inimigo, além de conceder um ataque extra livre por turno.',
    'Passiva Mítica: ignora resistências e escudos mágicos, envolve o portador em aura divina (+2 em ataques e salvaguardas para aliados a 6m) e regenera 12 PV no início de cada turno em combate.',
    'Passiva Mítica: dobra os dados de dano elemental em críticos (margem 18-20), concede imunidade a ser atordoado ou derrubado e permite negar completamente um golpe letal uma vez por combate.',
  ],
};

const HIGH_TIER_STAFF_POWERS = {
  ÉPICO: [
    'Armazena 6 cargas arcanas diárias: gaste 1 carga para adicionar +2d6 de dano elemental a uma magia ou 2 cargas para conjurar Escudo Arcano ou Passo Nebuloso sem gastar espaço.',
    'Concede vantagem em testes de Constituição para manter concentração e permite recuperar um espaço de magia de até 2º círculo uma vez por descanso curto.',
    'Amplia o alcance de todas as magias em 6 metros e, com 6 cargas diárias, permite ignorar resistência elemental do alvo ao conjurar.',
    'Possui 6 cargas recarregáveis ao amanhecer para potencializar feitiços de área (+1d8 em todos os alvos) ou restaurar 2d8+4 PV em um aliado a até 9m.',
  ],
  LENDÁRIO: [
    'Possui 10 cargas arcanas diárias, concede +2 na CA e vantagem em salvaguardas contra magias, além de permitir maximizar os dados de dano de uma magia uma vez por descanso.',
    'Com 10 cargas recarregáveis ao amanhecer, permite lançar Bola de Fogo, Relâmpago ou Muralha de Energia sem gastar espaço de magia e concede resistência a dano mágico.',
    'Absorve energia arcana hostil: uma vez por rodada como Reação, reduz pela metade o dano de uma magia recebida e converte o impacto em +2d8 de dano extra na próxima conjuração.',
    'Concede 10 cargas diárias, permite manter duas magias de concentração por até 2 rodadas e ignora resistências elementais em todas as conjurações.',
  ],
  MÍTICO: [
    'Passiva Mítica: possui 15 cargas arcanas primordiais, torna suas magias imunes a Contra-Mágica, concede margem de crítico 18-20 em ataques mágicos e permite lançar uma magia de até 5º círculo sem gastar espaço nem mana uma vez por combate.',
    'Passiva Mítica: 15 cargas diárias, barreira astral permanente (resistência a todo dano mágico e +25 PV temporários ao conjurar magias de 3º círculo ou superior) e Âncora da Trama (uma vez ao dia, ao chegar a 0 PV, restaura 40 PV e teleporta 9m para segurança).',
    'Passiva Mítica: 15 cargas primordiais, todas as magias ignoram resistências e desencadeiam uma reverberação arcana de 4d8 em 6m em acertos críticos (margem 18-20), além de restaurar 2 cargas sempre que um inimigo é abatido.',
    'Passiva Mítica: dobra a duração de magias de suporte, concede +3 na CA e vantagem contra todas as magias inimigas, e permite conjurar uma magia adicional como Ação Bônus gastando 3 das suas 15 cargas diárias.',
  ],
};

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
    lowerName.includes('cajado') ||
    lowerName.includes('bordão') ||
    lowerName.includes('bordao') ||
    lowerName.includes('báculo') ||
    lowerName.includes('baculo') ||
    lowerName.includes('cetro') ||
    lowerName.includes('bastão') ||
    lowerName.includes('bastao') ||
    lowerName.includes('varinha')
  ) {
    return 'staff';
  }
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
 * Sintetiza uma descrição de arma ou cajado arcano natural, bem escrita e escalonada por raridade:
 * - Suporte dedicado a Cajados Arcanos (lore mágica, bônus em CD/ataque mágico e cargas arcanas)
 * - Armas Épicas, Lendárias e Míticas recebem escalas superiores + poderes exclusivos deduplicados via ML
 * - Respeita a raridade de Maestria e dos 10 Efeitos de Status oficiais do site
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
  const isStaff = resolvedScale === 'staff';
  const baseDamage =
    WEAPON_DAMAGE_DICE_BY_RARITY[resolvedScale]?.[safeRarity] ||
    WEAPON_DAMAGE_DICE_BY_RARITY.longsword[safeRarity];

  const seedNum = hashStringSeed(`${name}_${safeRarity}_${comparisonDescriptions.length}_${Math.random()}`);

  const lorePool = isStaff
    ? STAFF_LORE_POOL[safeRarity] || STAFF_LORE_POOL.COMUM
    : {
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
  const masteryText = isStaff && ['COMUM', 'INCOMUM'].includes(safeRarity)
    ? null
    : rollRareWeaponMastery(safeRarity, seedNum);

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

  // Poder exclusivo de alta raridade (ÉPICO, LENDÁRIO e MÍTICO) deduplicado por Cosseno
  const powerPool = isStaff
    ? HIGH_TIER_STAFF_POWERS[safeRarity]
    : HIGH_TIER_WEAPON_POWERS[safeRarity];

  if (powerPool && powerPool.length > 0) {
    const specialPower = pickMostUniqueLore(
      powerPool,
      `${name}_power`,
      seedNum + 37,
      comparisonDescriptions
    );
    parts.push(specialPower);
  }

  return parts.join(' ');
}

function needsMLRewrite(bodyDesc, rarity, comparisonDescriptions = [], scaleType = 'longsword') {
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

  // Se for um cajado mas o texto falar de lâmina/aço/espada/cortante, reescreve com lore arcana real
  if (
    scaleType === 'staff' &&
    /\b(lâmina|lamina|espada|desembainhada|aço|aco|cortante)\b/i.test(clean)
  ) {
    return true;
  }

  // Em armas COMUNS, se vierem com maestria ou status forçado pela IA, reescreve
  if (rarity === 'COMUM' && /maestria|sangramento|atordoado|queimando|invis[íi]vel/i.test(clean)) {
    return true;
  }

  // Garante que armas ÉPICAS, LENDÁRIAS e MÍTICAS tenham riqueza e poder real digno da raridade
  if (rarity === 'ÉPICO' && clean.length < 110) return true;
  if (rarity === 'LENDÁRIO' && clean.length < 145) return true;
  if (rarity === 'MÍTICO' && clean.length < 175) return true;

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
    if (needsMLRewrite(bodyDesc, rarity, comparisonDescriptions, scaleType)) {
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
    description: `<${rarity}> ${bodyDesc}`.slice(0, 1400),
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
 * Aceita `forcedRank` opcional para impor exatamente o rank sorteado pela curva de probabilidade.
 */
export function enforceMissionBalance(mission, forcedRank = null) {
  const candidateRank = String(forcedRank || mission?.rank || '').toUpperCase();
  const rank = ['F', 'E', 'D', 'C', 'B', 'A', 'S'].includes(candidateRank)
    ? candidateRank
    : rollMissionRank();
  const tierConfig = DND_ENCOUNTERS_BY_TIER[rank];

  const rawXp = Number(mission?.xp_reward);
  const rawGold = Number(mission?.gold_reward);

  const defaultXp = Math.round(
    tierConfig.minXp + Math.random() * (tierConfig.maxXp - tierConfig.minXp)
  );
  const defaultGold = Math.round(
    tierConfig.minGold + Math.random() * (tierConfig.maxGold - tierConfig.minGold)
  );

  const clampedXp = Number.isFinite(rawXp) && rawXp > 0
    ? Math.max(tierConfig.minXp, Math.min(tierConfig.maxXp, rawXp))
    : defaultXp;
  const clampedGold = Number.isFinite(rawGold) && rawGold > 0
    ? Math.max(tierConfig.minGold, Math.min(tierConfig.maxGold, rawGold))
    : defaultGold;

  return {
    title: String(mission?.title || `Contrato de Rank ${rank}`).trim().slice(0, 120),
    description: String(
      mission?.description || `Missão de Rank ${rank} (${tierConfig.tier}) em conformidade com o Guia do Mestre D&D.`
    )
      .trim()
      .slice(0, 1800),
    rank,
    xp_reward: Math.floor(clampedXp),
    gold_reward: Math.floor(clampedGold),
  };
}

/**
 * Processa um lote de missões garantindo ranks sorteados por probabilidade
 * e removendo duplicatas muito semelhantes por Similaridade de Cosseno.
 */
export function enforceBatchMissionUniqueness(
  missions = [],
  rolledRanks = [],
  existingMissionSummaries = []
) {
  const corpus = [...existingMissionSummaries];
  const output = [];

  missions.forEach((rawMission, idx) => {
    const targetRank = rolledRanks[idx] || rollMissionRank();
    const balanced = enforceMissionBalance(rawMission, targetRank);
    const sig = `${balanced.title} ${balanced.description}`;

    const isExactDuplicate = corpus.some(
      (prev) => computeCosineSimilarity(sig, prev) > 0.72
    );

    if (!isExactDuplicate) {
      corpus.push(sig);
      output.push(balanced);
    } else {
      // Mantém a quantidade pedida ajustando o título com variação do tier para evitar clonagem exata
      const tier = DND_ENCOUNTERS_BY_TIER[targetRank];
      const threat = tier?.threats?.[idx % (tier.threats?.length || 1)] || 'Ameaça do Reino';
      const adjusted = {
        ...balanced,
        title: `${balanced.title} — ${threat}`.slice(0, 120),
      };
      corpus.push(`${adjusted.title} ${adjusted.description}`);
      output.push(adjusted);
    }
  });

  return output;
}
