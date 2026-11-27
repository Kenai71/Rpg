import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import {
  checkRateLimit,
  getClientIp,
  rateLimitErrorResponse,
  readSafeJsonBody,
  sanitizePromptInput,
  verifyApiBearerAuth,
} from '../../../lib/api-security';
import { DND_EXPANDED_WEAPONS, rollShopItemRarity } from '../../../lib/dnd-rules.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODELS_TO_TRY = [
  { name: 'gemini-3.5-flash-lite', thinkingBudget: undefined },
  { name: 'gemini-3-flash-preview', thinkingBudget: undefined },
  { name: 'gemini-2.5-flash', thinkingBudget: 0 },
  { name: 'gemini-3.5-flash', thinkingBudget: undefined },
];

// Pesos de raridade configuráveis por nível do baú (mantendo a mesma tabela de raridades do Vallen RPG)
const TIER_RARITY_WEIGHTS = {
  mixed: [
    { rarity: 'COMUM', weight: 52 },
    { rarity: 'INCOMUM', weight: 28 },
    { rarity: 'RARO', weight: 13.5 },
    { rarity: 'ÉPICO', weight: 4.5 },
    { rarity: 'LENDÁRIO', weight: 1.6 },
    { rarity: 'MÍTICO', weight: 0.4 },
  ],
  low: [
    { rarity: 'COMUM', weight: 72 },
    { rarity: 'INCOMUM', weight: 22 },
    { rarity: 'RARO', weight: 5 },
    { rarity: 'ÉPICO', weight: 1 },
  ],
  mid: [
    { rarity: 'COMUM', weight: 34 },
    { rarity: 'INCOMUM', weight: 34 },
    { rarity: 'RARO', weight: 21 },
    { rarity: 'ÉPICO', weight: 8 },
    { rarity: 'LENDÁRIO', weight: 2.5 },
    { rarity: 'MÍTICO', weight: 0.5 },
  ],
  high: [
    { rarity: 'COMUM', weight: 18 },
    { rarity: 'INCOMUM', weight: 22 },
    { rarity: 'RARO', weight: 26 },
    { rarity: 'ÉPICO', weight: 20 },
    { rarity: 'LENDÁRIO', weight: 11 },
    { rarity: 'MÍTICO', weight: 3 },
  ],
};

function rollLootRarity(tier = 'mixed') {
  const table = TIER_RARITY_WEIGHTS[tier];
  if (!table) return rollShopItemRarity();
  const total = table.reduce((acc, e) => acc + e.weight, 0);
  let r = Math.random() * total;
  for (const entry of table) {
    r -= entry.weight;
    if (r <= 0) return entry.rarity;
  }
  return 'COMUM';
}

// Categorias realistas de saque: bugigangas/restos/materiais + consumíveis + equipamentos
const EQUIPMENT_SUBTYPES = [
  { type: 'shield', hint: 'Escudo ou Broquel' },
  { type: 'body', hint: 'Armadura, Gibão ou Manto' },
  { type: 'head', hint: 'Elmo, Capuz ou Bandana' },
  { type: 'hands', hint: 'Luvas ou Braçadeiras' },
  { type: 'feet', hint: 'Botas ou Sandálias' },
  { type: 'waist', hint: 'Cinto ou Algibeira' },
  { type: 'neck', hint: 'Amuleto ou Pingente' },
  { type: 'ring', hint: 'Anel' },
];

const JUNK_AND_MATERIAL_SEEDS = [
  { name: 'Teia de Aranha Grudenta', desc: 'Fios espessos e viscosos retirados de um canto úmido. Pode servir para alquimia básica ou apenas grudar nos dedos.', qty: 2 },
  { name: 'Graveto Retorcido', desc: 'Um galho seco e torto sem nenhum poder mágico aparente, mas útil para acender uma fogueira improvisada.', qty: 1 },
  { name: 'Pedra Lisa de Rio', desc: 'Uma pedra comum arredondada pela correnteza. Boa para atirar com funda ou marcar um caminho na masmorra.', qty: 3 },
  { name: 'Osso Roído', desc: 'Restos antigos de alguma criatura infeliz. Talvez agrade a um cão faminto ou sirva de amuleto macabro.', qty: 1 },
  { name: 'Dente Lasca de Goblin', desc: 'Um dente torto e amarelado guardado como troféu duvidoso por saqueadores.', qty: 2 },
  { name: 'Pedaço de Corda Puída', desc: 'Cerca de dois metros de corda de cânhamo gasta e desfiada, suporta pouco peso.', qty: 1 },
  { name: 'Frasco de Vidro Rachado', desc: 'Um pequeno frasco vazio com cheiro adocicado de poção velha e uma trinca na lateral.', qty: 1 },
  { name: 'Pena Negra de Corvo', desc: 'Uma pena escura perfeitamente preservada, procurada por escribas e feiticeiros.', qty: 2 },
  { name: 'Chave de Ferro Enferrujada', desc: 'Uma chave antiga coberta de ferrugem. Ninguém sabe qual fechadura ela ainda abre.', qty: 1 },
  { name: 'Toco de Vela Derretida', desc: 'Meia vela de sebo que ainda garante cerca de vinte minutos de chama fraca.', qty: 2 },
  { name: 'Cogumelo Luminescente Seco', desc: 'Fungo subterrâneo que emite um brilho esverdeado bem fraco no escuro.', qty: 2 },
  { name: 'Pó de Carvão', desc: 'Punhado de carvão triturado enrolado em trapo. Útil para esfregar em pergaminhos ou camuflagem.', qty: 1 },
  { name: 'Botão de Latão Amassado', desc: 'Um botão antigo com brasão apagado pelo tempo. Vale quase nada, mas conta uma história.', qty: 1 },
  { name: 'Casca de Besouro Gigante', desc: 'Fragmento rígido e brilhante de carapaça, aproveitável por artesãos.', qty: 1 },
  { name: 'Saco de Pregos Tortos', desc: 'Um punhado de pregos de ferro enferrujados chacoalhando num retalho de pano.', qty: 1 },
  { name: 'Cachimbo de Madeira Quebrado', desc: 'Cheira a erva de taverna barata e tem o bocal rachado.', qty: 1 },
];

const CONSUMABLE_FALLBACKS = [
  { name: 'Poção de Cura Menor', rarity: 'COMUM', desc: 'Líquido rubi adocicado que restaura 2d4+2 pontos de vida ao ser ingerido.' },
  { name: 'Ração de Viagem Seca', rarity: 'COMUM', desc: 'Carne seca, biscoito duro e frutas desidratadas suficientes para um dia de marcha.' },
  { name: 'Tocha de Breu', rarity: 'COMUM', desc: 'Ilumina 6 metros com luz plena e mais 6 metros com penumbra por 1 hora.' },
  { name: 'Antídoto Herbal', rarity: 'INCOMUM', desc: 'Concede vantagem em testes de resistência contra venenos por 1 hora.' },
  { name: 'Elixir de Foco Arcano', rarity: 'RARO', desc: 'Recupera 2 pontos de mana e aguça a concentração em magias por 10 minutos.' },
  { name: 'Bálsamo Regenerador Élfico', rarity: 'ÉPICO', desc: 'Unguento aromático que cura 4d4+4 PV e remove Sangramento ou Envenenado.' },
];

function rollSlotKind(rarity, includeJunk) {
  // Raridades maiores (Raro+) tendem mais a equipamentos/tesouros; Comum/Incomum têm grande chance de objetos/tralhas/materiais!
  if (includeJunk && rarity === 'COMUM') {
    const r = Math.random();
    if (r < 0.62) return { type: 'misc', hint: 'Objeto cotidiano, material natural, resto de monstro ou bugiganga simples (ex: teia de aranha, graveto, pedra, osso, pena, prego, corda velha, cogumelo, chave enferrujada)' };
    if (r < 0.82) return { type: 'consumable', hint: 'Suprimento ou consumível simples (poção menor, tocha, ração, erva)' };
  } else if (includeJunk && rarity === 'INCOMUM') {
    const r = Math.random();
    if (r < 0.34) return { type: 'misc', hint: 'Material alquímico, relíquia curiosa ou componente de criatura (ex: presa, cristal fosco, teia prateada, âmbar, ingrediente raro)' };
    if (r < 0.62) return { type: 'consumable', hint: 'Poção, pergaminho ou elixir útil' };
  } else if (includeJunk && rarity === 'RARO' && Math.random() < 0.2) {
    return { type: 'misc', hint: 'Gema preciosa, componente arcano raro ou artefato curioso de valor' };
  }

  if (Math.random() < 0.45) {
    const w = DND_EXPANDED_WEAPONS[Math.floor(Math.random() * DND_EXPANDED_WEAPONS.length)];
    return { type: 'weapon', hint: `Arma (${w?.name || 'Adaga'})` };
  }
  const eq = EQUIPMENT_SUBTYPES[Math.floor(Math.random() * EQUIPMENT_SUBTYPES.length)];
  return { type: eq.type, hint: eq.hint };
}

function buildFallbackLoot({ count, tier, includeJunk, theme }) {
  const items = [];
  const usedNames = new Set();

  const goldByTier = {
    low: [10, 65],
    mixed: [25, 180],
    mid: [80, 420],
    high: [250, 1400],
  };
  const [minG, maxG] = goldByTier[tier] || goldByTier.mixed;
  const gold = Math.floor(minG + Math.random() * (maxG - minG));

  for (let i = 0; i < count; i += 1) {
    const rarity = rollLootRarity(tier);
    const slot = rollSlotKind(rarity, includeJunk);

    if (slot.type === 'misc') {
      const pool = JUNK_AND_MATERIAL_SEEDS.filter((j) => !usedNames.has(j.name));
      const pick = pool[Math.floor(Math.random() * pool.length)] || JUNK_AND_MATERIAL_SEEDS[i % JUNK_AND_MATERIAL_SEEDS.length];
      usedNames.add(pick.name);
      items.push({
        name: pick.name,
        rarity,
        type: 'misc',
        qty: pick.qty || 1,
        description: `<${rarity}> ${pick.desc}`,
      });
    } else if (slot.type === 'consumable') {
      const pick = CONSUMABLE_FALLBACKS[Math.floor(Math.random() * CONSUMABLE_FALLBACKS.length)];
      items.push({
        name: pick.name,
        rarity,
        type: 'consumable',
        qty: rarity === 'COMUM' ? Math.floor(1 + Math.random() * 2) : 1,
        description: `<${rarity}> ${pick.desc}`,
      });
    } else if (slot.type === 'weapon') {
      const w = DND_EXPANDED_WEAPONS[Math.floor(Math.random() * DND_EXPANDED_WEAPONS.length)];
      const bonus = rarity === 'COMUM' ? '' : rarity === 'INCOMUM' ? ' (+1 acerto)' : rarity === 'RARO' ? ' (+1 ataque, +1d4 elemental)' : ' (+2 ataque, +1d6 elemental)';
      items.push({
        name: `${w?.name || 'Espada Curta'} ${rarity === 'COMUM' ? 'Gasta' : 'do Saque'}`,
        rarity,
        type: 'weapon',
        qty: 1,
        description: `<${rarity}> Arma encontrada em ${theme || 'um baú antigo'}. Causa ${w?.damage || '1d6'}${bonus}.`,
      });
    } else {
      const eqLabel = EQUIPMENT_SUBTYPES.find((e) => e.type === slot.type)?.hint || 'Equipamento';
      items.push({
        name: `${eqLabel.split(',')[0]} de Aventureiro`,
        rarity,
        type: slot.type,
        qty: 1,
        description: `<${rarity}> Peça recuperada do saque (${theme || 'exploração'}), pronta para uso em campo.`,
      });
    }
  }

  return { gold, items };
}

function parseModelJson(rawText) {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

export async function POST(request) {
  const ip = getClientIp(request);
  const ipRl = checkRateLimit(`loot:ip:${ip}`, { limit: 30, windowMs: 5 * 60_000 });
  if (!ipRl.allowed) return rateLimitErrorResponse(ipRl);

  const authHeader = request.headers.get('authorization');
  const verified = await verifyApiBearerAuth(authHeader);
  if (!verified) {
    return NextResponse.json(
      { success: false, error: 'Autenticação necessária para gerar baú de saque.' },
      { status: 401 }
    );
  }
  if (!verified.isMaster) {
    return NextResponse.json(
      { success: false, error: 'Apenas o Mestre pode gerar baús de saque.' },
      { status: 403 }
    );
  }

  const uidRl = checkRateLimit(`loot:uid:${verified.uid}`, { limit: 20, windowMs: 5 * 60_000 });
  if (!uidRl.allowed) return rateLimitErrorResponse(uidRl);

  const parsedBody = await readSafeJsonBody(request, 16 * 1024);
  if (!parsedBody.ok) {
    return NextResponse.json({ success: false, error: parsedBody.error }, { status: parsedBody.status });
  }
  const body = parsedBody.data;

  let theme = 'Baú de Masmorra Pós-Combate';
  let count = 6;
  let rarityTier = 'mixed';
  let includeJunk = true;

  if (typeof body?.theme === 'string' && body.theme.trim()) {
    theme = sanitizePromptInput(body.theme, 120) || theme;
  }
  if (body?.count !== undefined) {
    count = Math.max(2, Math.min(12, Math.floor(Number(body.count) || 6)));
  }
  if (['mixed', 'low', 'mid', 'high'].includes(body?.rarityTier)) {
    rarityTier = body.rarityTier;
  }
  if (body?.includeJunk !== undefined) {
    includeJunk = Boolean(body.includeJunk);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const fallback = buildFallbackLoot({ count, tier: rarityTier, includeJunk, theme });
    return NextResponse.json({ success: true, source: 'fallback', ...fallback });
  }

  const slots = Array.from({ length: count }, () => {
    const rarity = rollLootRarity(rarityTier);
    const kind = rollSlotKind(rarity, includeJunk);
    return { rarity, ...kind };
  });

  const slotsText = slots
    .map((s, idx) => `Item ${idx + 1}: <${s.rarity}> | type="${s.type}" | sugestão: ${s.hint}`)
    .join('\n');

  const prompt = `Seed: ${Date.now()}-${Math.random()}. Você é Mestre de D&D 5.5e (2024) em Português do Brasil criando um Baú de Saque realista após um combate ou exploração.
Tema/Local do baú: "${theme}"
Nível de riqueza do baú: "${rarityTier}"

Gere uma quantidade coerente de ouro ("gold", número inteiro) e EXATAMENTE ${count} itens seguindo rigorosamente a raridade e o tipo de cada slot abaixo:
${slotsText}

REGRAS IMPORTANTES:
1. Para slots com type="misc", gere objetos variados e realistas de RPG (NÃO apenas armas/armaduras!): teia de aranha, gravetos, pedras curiosas, ossos, dentes de monstros, frascos quebrados, chaves enferrujadas, penas, fungos, ingredientes alquímicos, trapos, bugigangas temáticas do local "${theme}". Alguns podem ser tralhas engraçadas/descartáveis para os jogadores decidirem se guardam ou jogam fora!
2. Para slots de armas/equipamentos/consumíveis, respeite o equilíbrio D&D 5.5e conforme a raridade (<COMUM> simples sem bônus mágico; <INCOMUM> +1; <RARO> +1 e efeito elemental; <ÉPICO>/<LENDÁRIO>/<MÍTICO> poderes memoráveis).
3. Toda "description" DEVE começar com a tag exata da raridade: <COMUM>, <INCOMUM>, <RARO>, <ÉPICO>, <LENDÁRIO> ou <MÍTICO>, seguida de 1 a 2 frases naturais em português.
4. "qty" deve ser inteiro entre 1 e 5 (ex: 3 pedras, 2 teias de aranha, 1 espada).
5. NUNCA use ícones ou símbolos de estrela.
6. Tipos permitidos: weapon, shield, head, face, neck, body, hands, waist, feet, ring, consumable, misc.

Responda APENAS JSON válido no formato:
{"gold":85,"items":[{"name":"Teia de Aranha Grudenta","type":"misc","rarity":"COMUM","qty":2,"description":"<COMUM> Fios pegajosos enrolados num canto do baú. Pode servir para alquimia simples ou ser jogado fora."}]}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    let resultText = null;
    for (const cfg of MODELS_TO_TRY) {
      try {
        const genConfig = { responseMimeType: 'application/json' };
        if (cfg.thinkingBudget !== undefined) {
          genConfig.thinkingConfig = { thinkingBudget: cfg.thinkingBudget };
        }
        const model = genAI.getGenerativeModel({
          model: cfg.name,
          generationConfig: genConfig,
        });
        const res = await model.generateContent(prompt);
        resultText = res.response.text();
        if (resultText) break;
      } catch (err) {
        console.warn(`Loot Gemini ${cfg.name} falhou:`, err?.message);
      }
    }

    if (!resultText) {
      const fallback = buildFallbackLoot({ count, tier: rarityTier, includeJunk, theme });
      return NextResponse.json({ success: true, source: 'fallback', ...fallback });
    }

    const parsed = parseModelJson(resultText);
    const validTypes = new Set([
      'weapon', 'shield', 'head', 'face', 'neck', 'body', 'hands', 'waist', 'feet', 'ring', 'consumable', 'misc',
    ]);
    const rawItems = Array.isArray(parsed?.items) ? parsed.items.slice(0, count) : [];

    if (rawItems.length === 0) {
      const fallback = buildFallbackLoot({ count, tier: rarityTier, includeJunk, theme });
      return NextResponse.json({ success: true, source: 'fallback', ...fallback });
    }

    const normalizedItems = rawItems.map((it, idx) => {
      const slot = slots[idx] || { rarity: 'COMUM', type: 'misc' };
      const rarity = ['COMUM', 'INCOMUM', 'RARO', 'ÉPICO', 'LENDÁRIO', 'MÍTICO'].includes(
        String(it?.rarity || '').toUpperCase()
      )
        ? String(it.rarity).toUpperCase()
        : slot.rarity;
      const type = validTypes.has(it?.type) ? it.type : slot.type;
      const cleanDesc = String(it?.description || '')
        .replace(/^<(COMUM|INCOMUM|RARO|ÉPICO|LENDÁRIO|MÍTICO)>\s*/i, '')
        .replace(/[\u2605\u2606\u2B50\u2728]|\uD83C\uDF1F/g, '')
        .trim();

      return {
        name: String(it?.name || 'Objeto Misterioso')
          .replace(/[\u2605\u2606\u2B50\u2728]|\uD83C\uDF1F/g, '')
          .trim()
          .slice(0, 90),
        type,
        rarity,
        qty: Math.max(1, Math.min(20, Math.floor(Number(it?.qty) || 1))),
        description: `<${rarity}> ${cleanDesc || 'Item encontrado no baú de saque.'}`,
      };
    });

    const gold = Math.max(0, Math.min(1000000, Math.floor(Number(parsed?.gold) || 0)));

    return NextResponse.json({
      success: true,
      source: 'gemini',
      gold,
      items: normalizedItems,
    });
  } catch (err) {
    console.warn('Fallback local para geração de baú de saque:', err?.message);
    const fallback = buildFallbackLoot({ count, tier: rarityTier, includeJunk, theme });
    return NextResponse.json({ success: true, source: 'fallback', ...fallback });
  }
}
