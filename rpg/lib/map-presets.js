/**
 * Presets de Mapas de Batalha e Monstros Táticos para o Vallen RPG.
 * Fornece mapas de alta qualidade atmosféricos prontos para jogar e modelos de monstros/NPCs.
 *
 * ZERO ÍCONES DE ESTRELA CONFORME AS DIRETRIZES DO PROJETO.
 */

// Helper para gerar Data URIs de Mapas Táticos em SVG de alta fidelidade
function makeSvgMap(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

// 1. Catacumbas dos Reis Esquecidos (Masmorra Gótica)
const SVG_DUNGEON_CRYPT = makeSvgMap(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <radialGradient id="torch1" cx="15%" cy="20%" r="35%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="torch2" cx="85%" cy="80%" r="35%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dungeonTiles" width="60" height="60" patternUnits="userSpaceOnUse">
      <rect width="60" height="60" fill="#181c26"/>
      <path d="M 0 0 L 60 0 L 60 60 L 0 60 Z" fill="none" stroke="#2a3245" stroke-width="2"/>
      <rect x="4" y="4" width="52" height="52" fill="#1e2433" rx="3"/>
      <line x1="12" y1="18" x2="28" y2="18" stroke="#141822" stroke-width="1.5"/>
      <line x1="34" y1="42" x2="50" y2="42" stroke="#141822" stroke-width="1.5"/>
    </pattern>
  </defs>
  <rect width="1200" height="800" fill="url(#dungeonTiles)"/>
  <!-- Paredes e Colunas -->
  <rect x="0" y="0" width="1200" height="24" fill="#0c0e14" stroke="#374151" stroke-width="2"/>
  <rect x="0" y="776" width="1200" height="24" fill="#0c0e14" stroke="#374151" stroke-width="2"/>
  <rect x="0" y="0" width="24" height="800" fill="#0c0e14" stroke="#374151" stroke-width="2"/>
  <rect x="1176" y="0" width="24" height="800" fill="#0c0e14" stroke="#374151" stroke-width="2"/>
  <!-- Pilares Ancestrais -->
  <rect x="240" y="180" width="60" height="60" fill="#0c0e14" stroke="#4b5563" stroke-width="3" rx="4"/>
  <circle cx="270" cy="210" r="16" fill="#1f2937"/>
  <rect x="900" y="180" width="60" height="60" fill="#0c0e14" stroke="#4b5563" stroke-width="3" rx="4"/>
  <circle cx="930" cy="210" r="16" fill="#1f2937"/>
  <rect x="240" y="560" width="60" height="60" fill="#0c0e14" stroke="#4b5563" stroke-width="3" rx="4"/>
  <circle cx="270" cy="590" r="16" fill="#1f2937"/>
  <rect x="900" y="560" width="60" height="60" fill="#0c0e14" stroke="#4b5563" stroke-width="3" rx="4"/>
  <circle cx="930" cy="590" r="16" fill="#1f2937"/>
  <!-- Altar / Sarcófago Central -->
  <rect x="480" y="320" width="240" height="160" fill="#131722" stroke="#60a5fa" stroke-width="2" rx="8"/>
  <rect x="510" y="350" width="180" height="100" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" rx="4"/>
  <path d="M 540 400 L 660 400 M 600 370 L 600 430" stroke="#38bdf8" stroke-width="3"/>
  <!-- Iluminação de Tochas -->
  <rect width="1200" height="800" fill="url(#torch1)" pointer-events="none"/>
  <rect width="1200" height="800" fill="url(#torch2)" pointer-events="none"/>
</svg>`);

// 2. Taverna do Javali Saltitante (Interior de Madeira e Conforto)
const SVG_COZY_TAVERN = makeSvgMap(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <radialGradient id="fireplace" cx="12%" cy="50%" r="45%">
      <stop offset="0%" stop-color="#f97316" stop-opacity="0.45"/>
      <stop offset="40%" stop-color="#eab308" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <pattern id="woodPlanks" width="120" height="30" patternUnits="userSpaceOnUse">
      <rect width="120" height="30" fill="#2d1e16"/>
      <line x1="0" y1="30" x2="120" y2="30" stroke="#19110c" stroke-width="2"/>
      <line x1="120" y1="0" x2="120" y2="30" stroke="#19110c" stroke-width="2"/>
      <path d="M 15 15 Q 60 12 105 15" stroke="#3c291e" stroke-width="1" fill="none"/>
    </pattern>
  </defs>
  <rect width="1200" height="800" fill="url(#woodPlanks)"/>
  <!-- Lareira de Pedra na Parede Esquerda -->
  <rect x="0" y="320" width="70" height="160" fill="#374151" stroke="#1f2937" stroke-width="4" rx="4"/>
  <rect x="0" y="350" width="45" height="100" fill="#b91c1c" rx="4"/>
  <circle cx="20" cy="400" r="14" fill="#fbbf24"/>
  <!-- Balcão do Taberneiro -->
  <path d="M 220 100 L 520 100 L 520 220" fill="none" stroke="#5c3826" stroke-width="36" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M 220 100 L 520 100 L 520 220" fill="none" stroke="#854d0e" stroke-width="26" stroke-linejoin="round" stroke-linecap="round"/>
  <!-- Barris -->
  <circle cx="160" cy="80" r="18" fill="#451a03" stroke="#78350f" stroke-width="2"/>
  <circle cx="160" cy="125" r="18" fill="#451a03" stroke="#78350f" stroke-width="2"/>
  <circle cx="160" cy="170" r="18" fill="#451a03" stroke="#78350f" stroke-width="2"/>
  <!-- Mesas Redondas de Taverna -->
  <circle cx="400" cy="450" r="55" fill="#451a03" stroke="#78350f" stroke-width="4"/>
  <circle cx="400" cy="450" r="45" fill="#5c3826"/>
  <circle cx="750" cy="250" r="65" fill="#451a03" stroke="#78350f" stroke-width="4"/>
  <circle cx="750" cy="250" r="55" fill="#5c3826"/>
  <circle cx="850" cy="550" r="70" fill="#451a03" stroke="#78350f" stroke-width="4"/>
  <circle cx="850" cy="550" r="60" fill="#5c3826"/>
  <!-- Iluminação Acolhedora -->
  <rect width="1200" height="800" fill="url(#fireplace)" pointer-events="none"/>
</svg>`);

// 3. Clareira da Floresta Ancestral (Ermos com Riacho e Relva)
const SVG_FOREST_CLEARING = makeSvgMap(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <radialGradient id="sunbeams" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#fef08a" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grassTiles" width="80" height="80" patternUnits="userSpaceOnUse">
      <rect width="80" height="80" fill="#14301c"/>
      <circle cx="20" cy="30" r="12" fill="#1a3f25"/>
      <circle cx="65" cy="55" r="14" fill="#163821"/>
    </pattern>
  </defs>
  <rect width="1200" height="800" fill="url(#grassTiles)"/>
  <!-- Riacho de Água Cristalina -->
  <path d="M 0 550 Q 300 480 600 560 T 1200 450 L 1200 620 Q 900 700 600 660 T 0 700 Z" fill="#0284c7" opacity="0.85"/>
  <path d="M 0 565 Q 300 495 600 575 T 1200 465" stroke="#38bdf8" stroke-width="4" fill="none" opacity="0.6"/>
  <!-- Pedras de Travessia no Rio -->
  <ellipse cx="610" cy="610" rx="28" ry="18" fill="#64748b" stroke="#334155" stroke-width="2"/>
  <ellipse cx="670" cy="570" rx="24" ry="16" fill="#64748b" stroke="#334155" stroke-width="2"/>
  <ellipse cx="550" cy="630" rx="26" ry="18" fill="#64748b" stroke="#334155" stroke-width="2"/>
  <!-- Trilha de Terra Batida -->
  <path d="M 450 0 Q 550 250 480 500 T 520 800" stroke="#785028" stroke-width="64" fill="none" opacity="0.75" stroke-linecap="round"/>
  <!-- Copas de Árvores Gigantescas nos Cantos -->
  <circle cx="100" cy="100" r="120" fill="#0a2312" opacity="0.9"/>
  <circle cx="1100" cy="120" r="140" fill="#0a2312" opacity="0.9"/>
  <circle cx="110" cy="720" r="130" fill="#0a2312" opacity="0.9"/>
  <circle cx="1120" cy="700" r="150" fill="#0a2312" opacity="0.9"/>
  <!-- Luz Solar Filtrada -->
  <rect width="1200" height="800" fill="url(#sunbeams)" pointer-events="none"/>
</svg>`);

// 4. Santuário de Obsidiana Arcana (Ruínas Místicas)
const SVG_OBSIDIAN_THRONE = makeSvgMap(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <radialGradient id="arcaneGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.35"/>
      <stop offset="50%" stop-color="#3b82f6" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="800" fill="#0b0d14"/>
  <!-- Pisos Hexagonais / Rúnicos -->
  <circle cx="600" cy="400" r="320" fill="#101422" stroke="#2e3856" stroke-width="3"/>
  <circle cx="600" cy="400" r="260" fill="#13192c" stroke="#8b5cf6" stroke-width="2" stroke-dasharray="12 6"/>
  <circle cx="600" cy="400" r="180" fill="#182038" stroke="#38bdf8" stroke-width="2"/>
  <!-- Círculos de Invocação e Pentagrama Estilizado -->
  <polygon points="600,220 771,344 706,545 494,545 429,344" fill="none" stroke="#a78bfa" stroke-width="2.5" opacity="0.8"/>
  <polygon points="600,580 429,456 494,255 706,255 771,456" fill="none" stroke="#38bdf8" stroke-width="1.5" opacity="0.6"/>
  <!-- Monólitos de Obsidiana nos Cantos -->
  <rect x="180" y="140" width="40" height="40" fill="#05070a" stroke="#8b5cf6" stroke-width="3" rx="4"/>
  <rect x="980" y="140" width="40" height="40" fill="#05070a" stroke="#8b5cf6" stroke-width="3" rx="4"/>
  <rect x="180" y="620" width="40" height="40" fill="#05070a" stroke="#8b5cf6" stroke-width="3" rx="4"/>
  <rect x="980" y="620" width="40" height="40" fill="#05070a" stroke="#8b5cf6" stroke-width="3" rx="4"/>
  <!-- Brilho Arcano Central -->
  <rect width="1200" height="800" fill="url(#arcaneGlow)" pointer-events="none"/>
</svg>`);

// 5. Ponte de Magma das Profundezas (Subterrâneo Vulcânico)
const SVG_LAVA_CAVERN = makeSvgMap(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <radialGradient id="lavaGlow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#ef4444" stop-opacity="0.45"/>
      <stop offset="60%" stop-color="#f97316" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="800" fill="#120e10"/>
  <!-- Fenda de Lava Incandescente -->
  <path d="M 400 0 Q 300 350 420 800 L 780 800 Q 900 450 800 0 Z" fill="#b91c1c"/>
  <path d="M 460 0 Q 360 360 480 800 L 720 800 Q 820 440 740 0 Z" fill="#ea580c"/>
  <path d="M 520 0 Q 450 380 540 800 L 660 800 Q 750 420 680 0 Z" fill="#facc15" opacity="0.9"/>
  <!-- Margens Rochosas de Basalto -->
  <path d="M 0 0 L 400 0 Q 300 350 420 800 L 0 800 Z" fill="#1c1917" stroke="#292524" stroke-width="4"/>
  <path d="M 1200 0 L 800 0 Q 900 450 780 800 L 1200 800 Z" fill="#1c1917" stroke="#292524" stroke-width="4"/>
  <!-- Ponte de Pedra de Basalto Cruzando a Lava -->
  <rect x="350" y="340" width="500" height="120" fill="#262626" stroke="#525252" stroke-width="3" rx="6"/>
  <line x1="350" y1="340" x2="850" y2="340" stroke="#737373" stroke-width="6"/>
  <line x1="350" y1="460" x2="850" y2="460" stroke="#737373" stroke-width="6"/>
  <!-- Iluminação de Magma -->
  <rect width="1200" height="800" fill="url(#lavaGlow)" pointer-events="none"/>
</svg>`);

// 6. Arena dos Campeões da Guilda (Fosso de Areia Tático)
const SVG_GLADIATOR_ARENA = makeSvgMap(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <radialGradient id="arenaLight" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#fef08a" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- Perímetro de Muralhas de Pedra -->
  <rect width="1200" height="800" fill="#1e222d"/>
  <!-- Fosso Circular de Areia Dourada -->
  <ellipse cx="600" cy="400" rx="520" ry="340" fill="#71502b" stroke="#374151" stroke-width="12"/>
  <ellipse cx="600" cy="400" rx="500" ry="320" fill="#8c6636"/>
  <ellipse cx="600" cy="400" rx="460" ry="290" fill="#a47740"/>
  <!-- Linhas e Círculo Central de Duelo -->
  <circle cx="600" cy="400" r="140" fill="none" stroke="#543c22" stroke-width="3" stroke-dasharray="10 5"/>
  <line x1="600" y1="110" x2="600" y2="690" stroke="#543c22" stroke-width="2.5" stroke-dasharray="14 7"/>
  <line x1="140" y1="400" x2="1060" y2="400" stroke="#543c22" stroke-width="2.5" stroke-dasharray="14 7"/>
  <!-- Portões de Ferro das Feras -->
  <rect x="60" y="360" width="30" height="80" fill="#0f172a" stroke="#cbd5e1" stroke-width="3"/>
  <rect x="1110" y="360" width="30" height="80" fill="#0f172a" stroke="#cbd5e1" stroke-width="3"/>
  <rect width="1200" height="800" fill="url(#arenaLight)" pointer-events="none"/>
</svg>`);

// Presets de Mapas de Batalha de Alta Fidelidade (100% Offline e Instantâneos)
export const MAP_PRESETS = [
  {
    id: 'dungeon-crypt',
    title: 'Catacumbas dos Reis Esquecidos',
    category: 'Masmorra',
    description: 'Corredores góticos de pedra ancestral com pilares entalhados e sarcófago cerimonial.',
    gridType: 'square',
    gridSize: 48,
    gridOpacity: 0.28,
    imageUrl: SVG_DUNGEON_CRYPT,
  },
  {
    id: 'cozy-tavern',
    title: 'Taverna do Javali Saltitante',
    category: 'Interior',
    description: 'Taberna acolhedora com piso de carvalho rústico, mesas, lareira e balcão de mogno.',
    gridType: 'square',
    gridSize: 44,
    gridOpacity: 0.25,
    imageUrl: SVG_COZY_TAVERN,
  },
  {
    id: 'forest-clearing',
    title: 'Clareira da Floresta Ancestral',
    category: 'Ermos',
    description: 'Trilha de terra batida cercada por carvalhos gigantescos e riacho cristalino.',
    gridType: 'square',
    gridSize: 50,
    gridOpacity: 0.3,
    imageUrl: SVG_FOREST_CLEARING,
  },
  {
    id: 'obsidian-throne',
    title: 'Santuário de Obsidiana Arcana',
    category: 'Ruínas',
    description: 'Plataforma ritualística de pedra negra polida com círculos de invocação e runas místicas.',
    gridType: 'square',
    gridSize: 52,
    gridOpacity: 0.32,
    imageUrl: SVG_OBSIDIAN_THRONE,
  },
  {
    id: 'lava-cavern',
    title: 'Ponte de Magma das Profundezas',
    category: 'Subterrâneo',
    description: 'Fenda vulcânica onde uma ponte de basalto cruza rios de lava incandescente.',
    gridType: 'square',
    gridSize: 46,
    gridOpacity: 0.35,
    imageUrl: SVG_LAVA_CAVERN,
  },
  {
    id: 'gladiator-arena',
    title: 'Arena dos Campeões da Guilda',
    category: 'Urbano',
    description: 'Fosso de areia delimitado por muralhas fortificadas, portões de ferro e marcas de duelo.',
    gridType: 'square',
    gridSize: 48,
    gridOpacity: 0.25,
    imageUrl: SVG_GLADIATOR_ARENA,
  },
];

// Presets de Inimigos e NPCs rápidos para o Mestre invocar no mapa
export const MONSTER_TOKEN_PRESETS = [
  {
    name: 'Goblin Espreitador',
    type: 'monster',
    color: '#ef4444',
    size: 'S',
    hp: 7,
    max_hp: 7,
    ac: 15,
    mana: 0,
    max_mana: 0,
    conditions: [],
  },
  {
    name: 'Orc Guerreiro',
    type: 'monster',
    color: '#f97316',
    size: 'M',
    hp: 15,
    max_hp: 15,
    ac: 13,
    mana: 0,
    max_mana: 0,
    conditions: [],
  },
  {
    name: 'Esqueleto Guardião',
    type: 'monster',
    color: '#94a3b8',
    size: 'M',
    hp: 13,
    max_hp: 13,
    ac: 13,
    mana: 0,
    max_mana: 0,
    conditions: [],
  },
  {
    name: 'Cultista das Trevas',
    type: 'monster',
    color: '#a855f7',
    size: 'M',
    hp: 22,
    max_hp: 22,
    ac: 12,
    mana: 16,
    max_mana: 16,
    conditions: [],
  },
  {
    name: 'Ogro Esmagador',
    type: 'monster',
    color: '#d97706',
    size: 'L',
    hp: 59,
    max_hp: 59,
    ac: 11,
    mana: 0,
    max_mana: 0,
    conditions: [],
  },
  {
    name: 'Dragão Jovem das Cinzas',
    type: 'monster',
    color: '#dc2626',
    size: 'H',
    hp: 136,
    max_hp: 136,
    ac: 18,
    mana: 40,
    max_mana: 40,
    conditions: [],
  },
  {
    name: 'Guarda da Cidade',
    type: 'npc',
    color: '#3b82f6',
    size: 'M',
    hp: 16,
    max_hp: 16,
    ac: 16,
    mana: 0,
    max_mana: 0,
    conditions: [],
  },
  {
    name: 'Mercador Errante',
    type: 'npc',
    color: '#10b981',
    size: 'M',
    hp: 10,
    max_hp: 10,
    ac: 10,
    mana: 5,
    max_mana: 5,
    conditions: [],
  },
];

// Condições de D&D 5.5e / 5e aplicáveis nos tokens com ícones correspondentes
export const TOKEN_CONDITIONS = [
  { id: 'sangramento', label: 'Sangramento', color: '#ef4444', icon: 'Droplet' },
  { id: 'atordoado', label: 'Atordoado', color: '#f59e0b', icon: 'Zap' },
  { id: 'caido', label: 'Caído (Prone)', color: '#a855f7', icon: 'ArrowDown' },
  { id: 'queimando', label: 'Queimando', color: '#f97316', icon: 'Flame' },
  { id: 'lentidao', label: 'Lentidão (-3m)', color: '#3b82f6', icon: 'Footprints' },
  { id: 'cego', label: 'Cegueira', color: '#64748b', icon: 'EyeOff' },
  { id: 'envenenado', label: 'Envenenado', color: '#10b981', icon: 'Skull' },
  { id: 'amaldicoado', label: 'Amaldiçoado', color: '#8b5cf6', icon: 'Ghost' },
  { id: 'abencoado', label: 'Abençoado', color: '#fbbf24', icon: 'ShieldAlert' },
  { id: 'invisivel', label: 'Invisível', color: '#06b6d4', icon: 'Eye' },
];

// Dimensões em pixels para os tamanhos oficiais de criatura
export const TOKEN_SIZES = {
  S: { label: 'Pequeno (P)', px: 32, scale: 0.8 },
  M: { label: 'Médio (M)', px: 44, scale: 1.0 },
  L: { label: 'Grande (G - 2x2)', px: 68, scale: 1.6 },
  H: { label: 'Enorme (GG - 3x3)', px: 96, scale: 2.3 },
  G: { label: 'Colossal (4x4)', px: 128, scale: 3.0 },
};
