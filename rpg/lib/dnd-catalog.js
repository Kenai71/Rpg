/**
 * Catálogo e Repertório Expandido D&D 5.5e (2024) & D&D 5e
 *
 * Extraído e sistematizado diretamente dos manuais:
 * - Livro do Jogador D&D 5.5e (2024 Revision)
 * - Livro do Mestre (DM) D&D 5.5e (2024 Revision)
 * - Escudo do DM 5.5e (2024)
 * - Livro do Jogador D&D 5e
 * - Guia do Mestre D&D 5e
 *
 * Fornece repertório enciclopédico de armas com Maestrias 2024,
 * itens mágicos lendários, tabelas de tesouro, condições e encontros por rank.
 *
 * ZERO ÍCONES DE ESTRELA CONFORME AS DIRETRIZES DO PROJETO.
 */

// 1. Maestrias em Armas D&D 2024 (Weapon Mastery)
export const DND_2024_MASTERY_PROPERTIES = {
  Afligir: {
    name: 'Afligir (Vex)',
    description: 'Se acertar uma criatura e causar dano, ganha Vantagem na próxima jogada de ataque contra ela antes do fim do seu próximo turno.',
    trigger: 'Ao acertar e causar dano',
    typicalWeapons: ['Espada Curta', 'Rapieira', 'Machadinha', 'Arco Curto', 'Dardo', 'Besta de Mão', 'Pistola'],
  },
  Agil: {
    name: 'Ágil (Nick)',
    description: 'Ao realizar o ataque extra da propriedade Leve, pode fazê-lo como parte da ação Atacar em vez de gastar Ação Bônus.',
    trigger: 'Ataque adicional com arma Leve',
    typicalWeapons: ['Adaga', 'Cimitarra', 'Foice', 'Martelo Leve'],
  },
  Derrubar: {
    name: 'Derrubar (Topple)',
    description: 'Se acertar, força a criatura a fazer salvaguarda de Constituição (CD 8 + proficiência + modificador). Falha = condição Caído.',
    trigger: 'Ao acertar o ataque',
    typicalWeapons: ['Machado de Batalha', 'Malho', 'Tridente', 'Cajado', 'Lança de Montaria'],
  },
  Drenar: {
    name: 'Drenar (Sap)',
    description: 'Se acertar uma criatura, ela sofre Desvantagem na próxima jogada de ataque antes do início do seu próximo turno.',
    trigger: 'Ao acertar o ataque',
    typicalWeapons: ['Espada Longa', 'Maça', 'Lança', 'Maça Estrela', 'Mangual', 'Picareta de Guerra'],
  },
  Empurrar: {
    name: 'Empurrar (Push)',
    description: 'Se acertar uma criatura Grande ou menor, pode empurrá-la até 3 metros em linha reta para longe de você.',
    trigger: 'Ao acertar o ataque',
    typicalWeapons: ['Martelo de Guerra', 'Besta Pesada', 'Clava Grande', 'Lança Longa'],
  },
  Garantido: {
    name: 'Garantido (Graze)',
    description: 'Mesmo se errar a jogada de ataque, você causa dano à criatura igual ao seu modificador de atributo.',
    trigger: 'Ao errar o ataque',
    typicalWeapons: ['Espada Grande (Espadão)', 'Glaive'],
  },
  Lentidao: {
    name: 'Lentidão (Slow)',
    description: 'Se acertar e causar dano, reduz o Deslocamento da criatura em 3 metros até o início do seu próximo turno.',
    trigger: 'Ao acertar e causar dano',
    typicalWeapons: ['Arco Longo', 'Besta Leve', 'Chicote', 'Clava', 'Azagaia', 'Funda', 'Mosquete'],
  },
  Trespassar: {
    name: 'Trespassar (Cleave)',
    description: 'Se acertar um ataque corpo a corpo, pode fazer um segundo ataque contra outra criatura adjacente a até 1,5m que esteja ao seu alcance.',
    trigger: 'Ataque corpo a corpo certeiro',
    typicalWeapons: ['Machado Grande', 'Alabarda'],
  },
};

// 2. Diretório Oficial de Armas 2024 / 5e
export const DND_EXPANDED_WEAPONS = [
  // Armas Simples Corpo a Corpo
  { name: 'Adaga', category: 'Simples', type: 'weapon', baseDice: '1d4', damageType: 'Perfurante', mastery: 'Ágil (Nick)', costPO: 2, weightKg: 0.5, properties: ['Acuidade', 'Arremesso (6/18m)', 'Leve'] },
  { name: 'Azagaia', category: 'Simples', type: 'weapon', baseDice: '1d6', damageType: 'Perfurante', mastery: 'Lentidão (Slow)', costPO: 0.5, weightKg: 1, properties: ['Arremesso (9/36m)'] },
  { name: 'Cajado', category: 'Simples', type: 'weapon', baseDice: '1d6', damageType: 'Contundente', mastery: 'Derrubar (Topple)', costPO: 0.2, weightKg: 2, properties: ['Versátil (1d8)'] },
  { name: 'Clava', category: 'Simples', type: 'weapon', baseDice: '1d4', damageType: 'Contundente', mastery: 'Lentidão (Slow)', costPO: 0.1, weightKg: 1, properties: ['Leve'] },
  { name: 'Clava Grande', category: 'Simples', type: 'weapon', baseDice: '1d8', damageType: 'Contundente', mastery: 'Empurrar (Push)', costPO: 0.2, weightKg: 5, properties: ['Duas Mãos'] },
  { name: 'Foice', category: 'Simples', type: 'weapon', baseDice: '1d4', damageType: 'Cortante', mastery: 'Ágil (Nick)', costPO: 1, weightKg: 1, properties: ['Leve'] },
  { name: 'Lança', category: 'Simples', type: 'weapon', baseDice: '1d6', damageType: 'Perfurante', mastery: 'Drenar (Sap)', costPO: 1, weightKg: 1.5, properties: ['Arremesso (6/18m)', 'Versátil (1d8)'] },
  { name: 'Maça', category: 'Simples', type: 'weapon', baseDice: '1d6', damageType: 'Contundente', mastery: 'Drenar (Sap)', costPO: 5, weightKg: 2, properties: [] },
  { name: 'Machadinha', category: 'Simples', type: 'weapon', baseDice: '1d6', damageType: 'Cortante', mastery: 'Afligir (Vex)', costPO: 5, weightKg: 1, properties: ['Arremesso (6/18m)', 'Leve'] },
  { name: 'Martelo Leve', category: 'Simples', type: 'weapon', baseDice: '1d4', damageType: 'Contundente', mastery: 'Ágil (Nick)', costPO: 2, weightKg: 1, properties: ['Arremesso (6/18m)', 'Leve'] },

  // Armas Simples à Distância
  { name: 'Arco Curto', category: 'Simples', type: 'weapon', baseDice: '1d6', damageType: 'Perfurante', mastery: 'Afligir (Vex)', costPO: 25, weightKg: 1, properties: ['Duas Mãos', 'Munição (24/96m)'] },
  { name: 'Besta Leve', category: 'Simples', type: 'weapon', baseDice: '1d8', damageType: 'Perfurante', mastery: 'Lentidão (Slow)', costPO: 25, weightKg: 2.5, properties: ['Duas Mãos', 'Munição (24/96m)', 'Recarga'] },
  { name: 'Dardo', category: 'Simples', type: 'weapon', baseDice: '1d4', damageType: 'Perfurante', mastery: 'Afligir (Vex)', costPO: 0.05, weightKg: 0.15, properties: ['Acuidade', 'Arremesso (6/18m)'] },
  { name: 'Funda', category: 'Simples', type: 'weapon', baseDice: '1d4', damageType: 'Contundente', mastery: 'Lentidão (Slow)', costPO: 0.1, weightKg: 0.2, properties: ['Munição (9/36m)'] },

  // Armas Marciais Corpo a Corpo
  { name: 'Alabarda', category: 'Marcial', type: 'weapon', baseDice: '1d10', damageType: 'Cortante', mastery: 'Trespassar (Cleave)', costPO: 20, weightKg: 3, properties: ['Duas Mãos', 'Extensão', 'Pesada'] },
  { name: 'Chicote', category: 'Marcial', type: 'weapon', baseDice: '1d4', damageType: 'Cortante', mastery: 'Lentidão (Slow)', costPO: 2, weightKg: 1.5, properties: ['Acuidade', 'Extensão'] },
  { name: 'Cimitarra', category: 'Marcial', type: 'weapon', baseDice: '1d6', damageType: 'Cortante', mastery: 'Ágil (Nick)', costPO: 25, weightKg: 1.5, properties: ['Acuidade', 'Leve'] },
  { name: 'Espada Curta', category: 'Marcial', type: 'weapon', baseDice: '1d6', damageType: 'Perfurante', mastery: 'Afligir (Vex)', costPO: 10, weightKg: 1, properties: ['Acuidade', 'Leve'] },
  { name: 'Espada Grande', category: 'Marcial', type: 'weapon', baseDice: '2d6', damageType: 'Cortante', mastery: 'Garantido (Graze)', costPO: 50, weightKg: 3, properties: ['Duas Mãos', 'Pesada'] },
  { name: 'Espada Longa', category: 'Marcial', type: 'weapon', baseDice: '1d8', damageType: 'Cortante', mastery: 'Drenar (Sap)', costPO: 15, weightKg: 1.5, properties: ['Versátil (1d10)'] },
  { name: 'Katana', category: 'Marcial', type: 'weapon', baseDice: '1d8', damageType: 'Cortante', mastery: 'Afligir (Vex)', costPO: 30, weightKg: 1.4, properties: ['Acuidade', 'Versátil (1d10)'] },
  { name: 'Glaive', category: 'Marcial', type: 'weapon', baseDice: '1d10', damageType: 'Cortante', mastery: 'Garantido (Graze)', costPO: 20, weightKg: 3, properties: ['Duas Mãos', 'Extensão', 'Pesada'] },
  { name: 'Lança de Montaria', category: 'Marcial', type: 'weapon', baseDice: '1d10', damageType: 'Perfurante', mastery: 'Derrubar (Topple)', costPO: 10, weightKg: 3, properties: ['Extensão', 'Pesada'] },
  { name: 'Lança Longa', category: 'Marcial', type: 'weapon', baseDice: '1d10', damageType: 'Perfurante', mastery: 'Empurrar (Push)', costPO: 5, weightKg: 9, properties: ['Duas Mãos', 'Extensão', 'Pesada'] },
  { name: 'Maça Estrela', category: 'Marcial', type: 'weapon', baseDice: '1d8', damageType: 'Perfurante', mastery: 'Drenar (Sap)', costPO: 15, weightKg: 2, properties: [] },
  { name: 'Machado de Batalha', category: 'Marcial', type: 'weapon', baseDice: '1d8', damageType: 'Cortante', mastery: 'Derrubar (Topple)', costPO: 10, weightKg: 2.5, properties: ['Versátil (1d10)'] },
  { name: 'Machado Grande', category: 'Marcial', type: 'weapon', baseDice: '1d12', damageType: 'Cortante', mastery: 'Trespassar (Cleave)', costPO: 30, weightKg: 3.5, properties: ['Duas Mãos', 'Pesada'] },
  { name: 'Malho', category: 'Marcial', type: 'weapon', baseDice: '2d6', damageType: 'Contundente', mastery: 'Derrubar (Topple)', costPO: 10, weightKg: 5, properties: ['Duas Mãos', 'Pesada'] },
  { name: 'Mangual', category: 'Marcial', type: 'weapon', baseDice: '1d8', damageType: 'Contundente', mastery: 'Drenar (Sap)', costPO: 10, weightKg: 1, properties: [] },
  { name: 'Martelo de Guerra', category: 'Marcial', type: 'weapon', baseDice: '1d8', damageType: 'Contundente', mastery: 'Empurrar (Push)', costPO: 15, weightKg: 1, properties: ['Versátil (1d10)'] },
  { name: 'Picareta de Guerra', category: 'Marcial', type: 'weapon', baseDice: '1d8', damageType: 'Perfurante', mastery: 'Drenar (Sap)', costPO: 5, weightKg: 1, properties: ['Versátil (1d10)'] },
  { name: 'Rapieira', category: 'Marcial', type: 'weapon', baseDice: '1d8', damageType: 'Perfurante', mastery: 'Afligir (Vex)', costPO: 25, weightKg: 1, properties: ['Acuidade'] },
  { name: 'Tridente', category: 'Marcial', type: 'weapon', baseDice: '1d8', damageType: 'Perfurante', mastery: 'Derrubar (Topple)', costPO: 5, weightKg: 2, properties: ['Arremesso (6/18m)', 'Versátil (1d10)'] },

  // Armas Marciais à Distância
  { name: 'Arco Longo', category: 'Marcial', type: 'weapon', baseDice: '1d8', damageType: 'Perfurante', mastery: 'Lentidão (Slow)', costPO: 50, weightKg: 1, properties: ['Duas Mãos', 'Munição (45/180m)', 'Pesada'] },
  { name: 'Besta de Mão', category: 'Marcial', type: 'weapon', baseDice: '1d6', damageType: 'Perfurante', mastery: 'Afligir (Vex)', costPO: 75, weightKg: 1.5, properties: ['Leve', 'Munição (9/36m)', 'Recarga'] },
  { name: 'Besta Pesada', category: 'Marcial', type: 'weapon', baseDice: '1d10', damageType: 'Perfurante', mastery: 'Empurrar (Push)', costPO: 50, weightKg: 9, properties: ['Duas Mãos', 'Munição (30/120m)', 'Pesada', 'Recarga'] },
  { name: 'Mosquete', category: 'Marcial', type: 'weapon', baseDice: '1d12', damageType: 'Perfurante', mastery: 'Lentidão (Slow)', costPO: 500, weightKg: 5, properties: ['Duas Mãos', 'Munição (12/36m)', 'Recarga'] },
  { name: 'Pistola', category: 'Marcial', type: 'weapon', baseDice: '1d10', damageType: 'Perfurante', mastery: 'Afligir (Vex)', costPO: 250, weightKg: 1.5, properties: ['Munição (9/27m)', 'Recarga'] },
];

// 3. Catálogo de Itens Mágicos Autênticos (DMG 2024 & 5e)
export const DND_MAGIC_ITEMS_CATALOG = [
  // COMUNS
  { name: 'Poção de Cura Comum', rarity: 'COMUM', type: 'consumable', price: 50, desc: 'Recupera 2d4+2 pontos de vida instantaneamente quando ingerida.' },
  { name: 'Corda da Escalada', rarity: 'COMUM', type: 'consumable', price: 75, desc: 'Corda de 18 metros que sobe e se ancora sozinha ao comando vocal do usuário.' },
  { name: 'Vela da Revelação', rarity: 'COMUM', type: 'consumable', price: 60, desc: 'Emite luz suave que revela pegadas mágicas recentes num raio de 4,5 metros.' },

  // INCOMUNS
  { name: 'Espada Longa de Prata Alquímica', rarity: 'INCOMUM', type: 'weapon', price: 350, desc: 'Dano: 1d8 (versátil 1d10) cortante (+1 no acerto). Maestria Drenar. Efetiva contra licantropos e espectros.' },
  { name: 'Arco Curto dos Bosques Élficos', rarity: 'INCOMUM', type: 'weapon', price: 420, desc: 'Dano: 1d6 perfurante (+1 no acerto). Maestria Afligir. Disparos ignoram folhagem e camuflagem leve.' },
  { name: 'Armadura de Mithral', rarity: 'INCOMUM', type: 'body', price: 450, desc: 'Cota de placas flexível que não impõe Desvantagem em testes de Furtividade nem exige Força mínima.' },
  { name: 'Botas Élficas', rarity: 'INCOMUM', type: 'feet', price: 400, desc: 'Seus passos não produzem som algum e você tem Vantagem em testes de Furtividade.' },
  { name: 'Broche de Escudo Arcano', rarity: 'INCOMUM', type: 'neck', price: 380, desc: 'Concede resistência a dano de energia (força) e imunidade ao feitiço Mísseis Mágicos.' },

  // RAROS
  { name: 'Lâmina das Chamas (Flame Tongue)', rarity: 'RARO', type: 'weapon', price: 2200, desc: 'Dano: 1d10 cortante (+1 ataque, +1d6 dano de Fogo). Maestria Drenar. A lâmina irradia luz plena e inflige queimadura leve.' },
  { name: 'Espadão Glacial da Fenda', rarity: 'RARO', type: 'weapon', price: 2600, desc: 'Dano: 2d8 cortante (+1 ataque, +1d6 dano de Frio). Maestria Garantido. Golpes congelam superfícies e reduzem velocidade.' },
  { name: 'Arco Longo da Tempestade', rarity: 'RARO', type: 'weapon', price: 2400, desc: 'Dano: 1d10 perfurante (+1 ataque, +1d6 dano Elétrico). Maestria Lentidão. Flechas crepitam como relâmpagos.' },
  { name: 'Armadura de Adamante da Fortaleza', rarity: 'RARO', type: 'body', price: 2800, desc: 'Forjada em metal estelar impermeável. Qualquer acerto crítico sofrido pelo usuário torna-se um acerto normal.' },
  { name: 'Amuleto da Saúde Titânica', rarity: 'RARO', type: 'neck', price: 2500, desc: 'O valor de Constituição do portador torna-se 19 enquanto estiver equipado.' },
  { name: 'Anel de Proteção Rúnica', rarity: 'RARO', type: 'ring', price: 1800, desc: 'Concede bônus de +1 na Classe de Armadura (CA) e +1 em todas as salvaguardas.' },

  // ÉPICOS (MUITO RAROS)
  { name: 'Katana do Eclipse Sanguinário', rarity: 'ÉPICO', type: 'weapon', price: 8500, desc: 'Dano: 1d12 cortante (+2 ataque, Sangramento contínuo 1d6/turno). Maestria Afligir. Fere o fluxo vital com golpes lacerantes.' },
  { name: 'Malho do Trovão Sísmico', rarity: 'ÉPICO', type: 'weapon', price: 9200, desc: 'Dano: 2d10 contundente (+2 ataque, Atordoado por 1 rodada em crítico). Maestria Derrubar. Cada golpe ecoa ondas de choque.' },
  { name: 'Arco do Juramento Caçador (Oathbow)', rarity: 'ÉPICO', type: 'weapon', price: 11000, desc: 'Dano: 1d12 perfurante (+2 ataque, +2d6 contra o inimigo jurado). Maestria Lentidão. O alvo marcado não tem como se esconder.' },
  { name: 'Manto do Deslocamento Planar', rarity: 'ÉPICO', type: 'body', price: 7800, desc: 'Projeta uma ilusão deslocada do corpo do portador; ataques contra ele sofrem Desvantagem contínua.' },
  { name: 'Elmo da Presciência Arcana', rarity: 'ÉPICO', type: 'head', price: 6500, desc: 'Concede visão no escuro 36m, visão da verdade 9m e imunidade a ser surpreendido em combate.' },

  // LENDÁRIOS
  { name: 'Espada Vorpal da Destruição', rarity: 'LENDÁRIO', type: 'weapon', price: 38000, desc: 'Dano: 2d8 cortante (+3 ataque, Corte Dimensional: ignora resistências). Maestria Drenar. Em um 20 natural, decapita ou atordoa fatalmente.' },
  { name: 'Lâmina Solar Sagrada (Holy Avenger)', rarity: 'LENDÁRIO', type: 'weapon', price: 45000, desc: 'Dano: 2d8 radiante (+3 ataque, +2d10 contra ínferos/mortos-vivos). Maestria Drenar. Aura sagrada concede vantagem em salvaguardas a aliados a 3m.' },
  { name: 'Defensora Primordial', rarity: 'LENDÁRIO', type: 'weapon', price: 34000, desc: 'Dano: 2d8 cortante (+3 ataque). Maestria Drenar. Permite transferir parte do bônus de ataque diretamente para sua Classe de Armadura (CA).' },
  { name: 'Armadura da Fúria do Dragão Ancião', rarity: 'LENDÁRIO', type: 'body', price: 42000, desc: 'Armadura completa de escamas de dragão vermelho. Imunidade absoluta a dano de fogo e resistência a magias.' },

  // MÍTICOS / ARTEFATOS
  { name: 'Apocalipse dos Mundos — Machado de Moradin', rarity: 'MÍTICO', type: 'weapon', price: 120000, desc: 'Dano: 3d8+4 cortante (+4 ataque, Quebra-Mundos em área). Passiva Mítica: Roubo de vida de 50% e Fúria Imortal que previne a morte com 1 PV uma vez ao dia.' },
  { name: 'Olho Celestial de Selûne', rarity: 'MÍTICO', type: 'ring', price: 95000, desc: 'Artefato lunar ancestral. Regenera 10 PV por turno, concede imunidade a condições nocivas e conjura Luz Restauradora total.' },
];

// 4. Catálogo de Ameaças, Monstros e Missões por Tier (DMG & Escudo do DM)
export const DND_ENCOUNTERS_BY_TIER = {
  F: {
    tier: 'Tier 1 Local Inicial (Nível 1)',
    threats: ['Ratos Gigantes da Esgoto', 'Bando de Ladrões da Estrada', 'Aranhas da Mina Abandonada', 'Cobras Constritoras do Brejo'],
    missionTemplates: [
      { title: 'Infestação nas Adegas da Guilda', goal: 'Eliminar os roedores gigantes que contaminaram o depósito de grãos da taverna.', type: 'Extermínio' },
      { title: 'Patrulha na Trilha das Carretas', goal: 'Proteger os comboios de suprimentos de salteadores de beira de estrada.', type: 'Escolta' },
    ],
    minXp: 100, maxXp: 250, minGold: 40, maxGold: 100,
  },
  E: {
    tier: 'Tier 1 Local Básico (Níveis 2-3)',
    threats: ['Kobolds Saqueadores', 'Bandos Goblins com Lobos', 'Zumbis e Esqueletos das Criptas', 'Bruxa da Cabana Pantanosa'],
    missionTemplates: [
      { title: 'O Cerco dos Goblins das Colinas', goal: 'Infiltrar o acampamento avançado dos goblins e neutralizar seus batedores.', type: 'Infiltração' },
      { title: 'A Vigília da Cripta Esquecida', goal: 'Conter os mortos-vivos erguidos por resíduos necromânticos no cemitério.', type: 'Purificação' },
    ],
    minXp: 250, maxXp: 450, minGold: 100, maxGold: 200,
  },
  D: {
    tier: 'Tier 1 Avançado (Níveis 4-5)',
    threats: ['Guerreiros Orcs com Chefes', 'Ogro Brutal das Pedreiras', 'Gárgulas da Abadia Caída', 'Carniçais Vorazes'],
    missionTemplates: [
      { title: 'A Fúria do Ogro das Minas de Ferro', goal: 'Derrubar o ogro que bloqueou a extração mineral e resgatar os mineiros.', type: 'Caçada' },
      { title: 'Bastilha das Gárgulas Ancestrais', goal: 'Recuperar o relicário arcano guardado pelas gárgulas no topo da ruína.', type: 'Recuperação' },
    ],
    minXp: 500, maxXp: 800, minGold: 250, maxGold: 450,
  },
  C: {
    tier: 'Tier 2 Regional (Níveis 6-8)',
    threats: ['Hidra das Sete Cabeças', 'Quimera dos Picos Nevados', 'Gigante da Colina Saqueador', 'Culto do Olho Aberto'],
    missionTemplates: [
      { title: 'A Hidra do Pântano Negro', goal: 'Enfrentar a hidra regenerativa nas profundezas das águas ácidas antes que atinja a vila.', type: 'Caçada' },
      { title: 'O Despertar do Culto Proibido', goal: 'Impedir o ritual de invocação profana no santuário subterrâneo.', type: 'Investigação' },
    ],
    minXp: 900, maxXp: 1500, minGold: 500, maxGold: 900,
  },
  B: {
    tier: 'Tier 2 Avançado (Níveis 9-11)',
    threats: ['Jovem Dragão das Cinzas', 'Vampiro Nobre em seu Feudo', 'Arquimago Necromante Renegado', 'Gigantes de Gelo/Fogo'],
    missionTemplates: [
      { title: 'As Asas Escarlates sobre a Fortaleza', goal: 'Defender a fortaleza ducal do ataque fulminante de um jovem dragão vermelho.', type: 'Defesa' },
      { title: 'A Mansão dos Sussurros de Sangue', goal: 'Invadir o castelo do senhor vampiro e consagrar seu sarcófago sombrio.', type: 'Expedição' },
    ],
    minXp: 1600, maxXp: 2800, minGold: 1000, maxGold: 1800,
  },
  A: {
    tier: 'Tier 3 Continental (Níveis 12-16)',
    threats: ['Dragão Adulto das Chamas', 'Covil do Beholder', 'Demônio Maior Balor', 'Fortaleza do Lich'],
    missionTemplates: [
      { title: 'O Olho Tirano do Subterrâneo', goal: 'Descer à fenda do Subterrâneo e desarticular a rede de pesadelo de um Beholder.', type: 'Assalto' },
      { title: 'O Filactério da Morte Eterna', goal: 'Localizar o filactério oculto do arquimago morto-vivo e destruí-lo no fogo sagrado.', type: 'Destruição' },
    ],
    minXp: 3000, maxXp: 5500, minGold: 2000, maxGold: 4000,
  },
  S: {
    tier: 'Tier 4 Multiversal (Níveis 17-20)',
    threats: ['Dragão Vermelho Ancião', 'Lorde Demônio do Abismo', 'Titã Ancestral Desperto', 'Avatar do Deus do Caos'],
    missionTemplates: [
      { title: 'A Fenda Cósmica do Cataclismo', goal: 'Surgir no epicentro da ruptura planar e enfrentar o Titã que rasga os limites da realidade.', type: 'Apocalipse' },
      { title: 'A Queda do Senhor do Abismo', goal: 'Banir o Príncipe dos Demônios de volta às fossas infinitas antes que o reino seja consumido.', type: 'Confronto Divino' },
    ],
    minXp: 6000, maxXp: 12000, minGold: 5000, maxGold: 10000,
  },
};
