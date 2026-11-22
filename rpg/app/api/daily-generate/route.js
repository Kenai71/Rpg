import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';
import {
  DND_ENCOUNTERS_BY_TIER,
  enforceBatchItemUniqueness,
  enforceBatchMissionUniqueness,
  rollMissionRank,
  rollShopItemRarity,
} from '../../../lib/dnd-rules.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_ITEMS_PER_CALL = 15;
const MAX_MISSIONS_PER_CALL = 15;

const MODELS_TO_TRY = [
  { name: 'gemini-3.5-flash-lite', thinkingBudget: undefined },
  { name: 'gemini-3-flash-preview', thinkingBudget: undefined },
  { name: 'gemini-2.5-flash', thinkingBudget: 0 },
  { name: 'gemini-3.5-flash', thinkingBudget: undefined },
];

async function verifyBearerToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice(7).trim();
  if (!idToken) return null;

  if (process.env.CRON_SECRET && idToken === process.env.CRON_SECRET) {
    return { isCron: true, uid: 'cron' };
  }

  try {
    const admin = await getFirebaseAdmin();
    if (admin) {
      try {
        const decoded = await admin.adminAuth.verifyIdToken(idToken);
        const profileSnap = await admin.adminDb.collection('profiles').doc(decoded.uid).get();
        const role = profileSnap.exists ? profileSnap.data()?.role : 'player';
        return { uid: decoded.uid, isMaster: role === 'master', isCron: false };
      } catch (adminErr) {
        console.warn('verifyIdToken no admin falhou:', adminErr?.message);
      }
    }
  } catch (err) {
    console.warn('Erro ao obter admin no verifyBearerToken:', err?.message);
  }

  const webApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!webApiKey) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(webApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const user = data?.users?.[0];
    if (!user?.localId) return null;
    return { uid: user.localId, isMaster: true, isCron: false };
  } catch {
    return null;
  }
}

function parseModelJson(rawText) {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

function buildShopPrompt({ count, rolledRarities, existingDescriptions }) {
  const staffTargetCount = Math.max(1, Math.round(count * 0.25));
  const raritySlotsList = rolledRarities
    .map((r, i) => `Item ${i + 1}: <${r}>`)
    .join(', ');

  const recentContext =
    existingDescriptions.length > 0
      ? `\nMEMÓRIA ANTI-REPETIÇÃO (NÃO repita nomes, efeitos ou descrições parecidas com estes itens já existentes na loja):\n${existingDescriptions
          .slice(0, 18)
          .map((d, i) => `${i + 1}. ${String(d).slice(0, 150)}`)
          .join('\n')}\n`
      : '';

  return `Seed: ${Date.now()}-${Math.random()}. Você é Mestre especialista nos manuais oficiais D&D 5.5e (Revisão 2024) e D&D 5e em Português do Brasil.
Gere exatamente ${count} Itens variados para a loja do Vallen RPG (incluindo armas marciais, CAJADOS ARCANOS, escudos, armaduras, anéis, acessórios e consumíveis).
${recentContext}
RARIDADES OBRIGATÓRIAS SORTEADAS PARA OS ${count} ITENS DA LOJA (RESPEITE EXATAMENTE ESTA ORDEM):
${raritySlotsList}

DISTRIBUIÇÃO DE CATEGORIAS (IMPORTANTE):
- Inclua obrigatoriamente pelo menos ${staffTargetCount} CAJADO(S) / BÁCULO(S) / BORDÃO(ÕES) / CETRO(S) mágico(s) ou arcano(s) (com "type": "weapon", ex: "Cajado de ...", "Báculo de ...", "Bordão Rúnico de ...", "Cetro de ...").
- Misture também espadas, katanas, adagas, machados, arcos, lanças, escudos, armaduras, anéis, amuletos e poções/consumíveis.
- Para CAJADOS/BÁCULOS/CETROS: NUNCA use palavras como "lâmina", "aço", "espada" ou "desembainhada". Escreva com lore de madeira nobre/ancestral, cristais, runas, foco arcano, bônus em ataques mágicos e CD de magias, e cargas arcanas diárias nas raridades altas.

DIRETRIZES DE ESCRITA NATURAL, MAESTRIAS E EFEITOS DE STATUS:
1. ESCRITA FLUIDA E NATURAL:
- Escreva descrições claras, naturais e bem redigidas em português, sem colchetes artificiais "[...]", sem traços robóticos e sem termos em inglês como "(Vex)" ou "(Topple)".
- Toda descrição DEVE começar apenas com a tag da raridade sorteada: <COMUM>, <INCOMUM>, <RARO>, <ÉPICO>, <LENDÁRIO> ou <MÍTICO>.

2. MAESTRIAS DE ARMA:
- Armas <COMUM> NUNCA possuem maestria.
- Armas <INCOMUM> e <RARO> raramente possuem maestria.
- Armas <ÉPICO>, <LENDÁRIO> e <MÍTICO> possuem maestrias fortes e propriedades marcantes.

3. EFEITOS DE STATUS OFICIAIS DO SITE (ESCALONADOS POR RARIDADE):
- Os únicos efeitos de status permitidos são estes 10 do site:
  Sangramento, Atordoado, Caído (Prone), Queimando, Lentidão (-3m), Cegueira, Envenenado, Amaldiçoado, Abençoado, Invisível.
- <COMUM>: NUNCA tem efeito de status.
- <INCOMUM>: quase nunca (90% sem efeito; se tiver, apenas Lentidão (-3m) ou Sangramento leve).
- <RARO>: baixa chance (~25%) com efeito moderado (Queimando, Sangramento, Lentidão (-3m) ou Envenenado).
- <ÉPICO>, <LENDÁRIO> e <MÍTICO>: efeitos de status poderosos e raros (Atordoado, Cegueira, Amaldiçoado, Abençoado, Invisível, Caído (Prone), Sangramento severo ou Queimando intenso).

4. ESCALONAMENTO DE DANO, PODER E PREÇO (ARMAS ÉPICAS, LENDÁRIAS E MÍTICAS DEVEM SER MUITO PODEROSAS E ÚNICAS):
- <COMUM>: Armas 1d4/1d6/1d10 (Cajado 1d6 versátil 1d8, foco arcano básico). Sem bônus mágico. Preço: 30 a 100 G.
- <INCOMUM>: Armas 1d6/1d8/2d6 (+1 acerto). Cajado 1d8 (+1 ataque mágico e +1 CD de magias). Preço: 150 a 500 G.
- <RARO>: Armas 1d8/1d10/2d8 (+1 ataque, +1d6 elemental). Cajado 1d10 (+1 ataque mágico, +1 CD, +1d6 elemental). Preço: 800 a 3.000 G.
- <ÉPICO>: Armas 1d12+2 / 2d6+2 / 2d10+2 (+2 ataque, +1d6 ou +1d8 elemental) + Habilidade Épica exclusiva (ex: crítico 19-20 contra feridos, onda de energia em 6m, +10 PV temporários em crítico, ou 6 cargas arcanas diárias em cajados com +2 ataque mágico e +2 CD). Preço: 4.000 a 15.000 G.
- <LENDÁRIO>: Armas 2d8+3 / 2d10+3 / 3d8+3 (+3 ataque, +2d6 ou +2d8 elemental) + Poder Lendário de elite (ex: margem de crítico 19-20, ignora resistências, teleporte 9m, contra-ataque reativo, drenar 25% do dano, ou 10 cargas arcanas diárias + vantagem contra magias em cajados com +3 ataque mágico e +2 CD). Preço: 20.000 a 60.000 G.
- <MÍTICO>: Artefatos supremos! Armas 3d8+5 / 3d10+5 / 4d10+6 (+4 ataque, +3d6 ou +3d8 primordial) + Passiva Mítica transformadora (margem de crítico 18-20, ignora resistências, roubo de vida 50%, Fúria Imortal 1 PV + 35 PV temp 1x/dia, explosão 4d8 em 6m, ou Cajados Míticos com +4 ataque mágico, +3 CD, 15 cargas primordiais, imune a Contra-Mágica e magia até 5º círculo grátis por combate). Preço: 75.000 a 200.000 G.
- Tipos permitidos: weapon, shield, head, face, neck, body, hands, waist, feet, ring, consumable.

NUNCA use ícones de estrela ou símbolos de estrela.
Responda APENAS JSON válido no formato:
{"shop_items":[{"item_name":"","description":"<COMUM> Esculpido em madeira de carvalho maciço. Causa 1d6 de dano contundente (versátil 1d8) e atua como foco arcano básico.","price":55,"quantity":1,"type":"weapon"}]}`;
}

function buildMissionsPrompt({ count, rolledRanks, existingMissionTitles }) {
  const rankSlotsList = rolledRanks
    .map((r, i) => {
      const cfg = DND_ENCOUNTERS_BY_TIER[r];
      return `Missão ${i + 1}: Rank ${r} (${cfg.tier} | XP ${cfg.minXp}-${cfg.maxXp} | Ouro ${cfg.minGold}-${cfg.maxGold})`;
    })
    .join('\n');

  const recentContext =
    existingMissionTitles.length > 0
      ? `\nMEMÓRIA ANTI-REPETIÇÃO (NÃO repita títulos ou tramas parecidas com estas missões já existentes):\n${existingMissionTitles
          .slice(0, 20)
          .map((t, i) => `${i + 1}. ${String(t).slice(0, 140)}`)
          .join('\n')}\n`
      : '';

  return `Seed: ${Date.now()}-${Math.random()}. Você é Mestre especialista nos manuais oficiais D&D 5.5e (Revisão 2024) e D&D 5e em Português do Brasil.
Gere exatamente ${count} Missões variadas, criativas e imersivas para o Mural da Guilda de Vallen RPG.
${recentContext}
RANKS OBRIGATÓRIOS SORTEADOS POR PROBABILIDADE (RESPEITE EXATAMENTE ESTA ORDEM E FAIXA DE RECOMPENSA):
${rankSlotsList}

DIRETRIZES PARA AS MISSÕES:
- Cada missão DEVE corresponder exatamente ao Rank sorteado acima (ameaças, escala do perigo, local e recompensas coerentes com o Tier D&D do Rank).
- Varie os tipos de contrato: caçada, escolta, investigação, resgate, purificação de cripta, expedição em ruína, infiltração, defesa de vila, relíquia arcana, confronto contra dragão/demônio em ranks altos.
- Escreva descrições envolventes em português natural (2 a 4 frases) detalhando o contratante, o local, o perigo e o objetivo.
- NUNCA use ícones de estrela ou símbolos de estrela.

Responda APENAS JSON válido no formato:
{"missions":[{"title":"","description":"","rank":"F","xp_reward":150,"gold_reward":70}]}`;
}

async function callGeminiWithFallback(apiKey, prompt) {
  const genAI = new GoogleGenerativeAI(apiKey);
  let resultText = null;
  let lastError = null;

  for (const cfg of MODELS_TO_TRY) {
    try {
      const genConfig = {
        responseMimeType: 'application/json',
      };
      if (cfg.thinkingBudget !== undefined) {
        genConfig.thinkingConfig = { thinkingBudget: cfg.thinkingBudget };
      }
      const model = genAI.getGenerativeModel({
        model: cfg.name,
        generationConfig: genConfig,
      });
      const result = await model.generateContent(prompt);
      resultText = result.response.text();
      if (resultText) break;
    } catch (err) {
      console.warn(`Tentativa com ${cfg.name} falhou:`, err?.message);
      lastError = err;
    }
  }

  if (!resultText) {
    const isQuotaError =
      lastError?.message?.includes('429') ||
      lastError?.message?.includes('limit exceeded') ||
      lastError?.message?.includes('QuotaFailure');
    throw new Error(
      isQuotaError
        ? 'Limite de requisições gratuitas diárias da API Gemini atingido. Aguarde a renovação da cota ou utilize uma chave com faturamento ativado.'
        : lastError?.message || 'Nenhum modelo Gemini disponível respondeu no momento.'
    );
  }

  return parseModelJson(resultText);
}

async function generateShopItemsWithGemini(apiKey, count, existingDescriptions = []) {
  const safeCount = Math.max(1, Math.min(MAX_ITEMS_PER_CALL, Math.floor(Number(count) || 10)));
  const rolledRarities = Array.from({ length: safeCount }, () => rollShopItemRarity());

  const prompt = buildShopPrompt({
    count: safeCount,
    rolledRarities,
    existingDescriptions,
  });

  const parsed = await callGeminiWithFallback(apiKey, prompt);
  const rawList = Array.isArray(parsed?.shop_items)
    ? parsed.shop_items
    : Array.isArray(parsed)
    ? parsed
    : [];

  const preparedItems = rawList.slice(0, safeCount).map((item, idx) => {
    const targetRarity = rolledRarities[idx] || rollShopItemRarity();
    const cleanBody = String(item.description || '')
      .replace(/^<(COMUM|INCOMUM|RARO|ÉPICO|LENDÁRIO|MÍTICO)>\s*/i, '')
      .trim();
    return {
      ...item,
      rarity: targetRarity,
      description: `<${targetRarity}> ${cleanBody}`,
    };
  });

  return enforceBatchItemUniqueness(preparedItems, existingDescriptions);
}

async function generateMissionsWithGemini(apiKey, count, existingMissionTitles = []) {
  const safeCount = Math.max(1, Math.min(MAX_MISSIONS_PER_CALL, Math.floor(Number(count) || 3)));
  const rolledRanks = Array.from({ length: safeCount }, () => rollMissionRank());

  const prompt = buildMissionsPrompt({
    count: safeCount,
    rolledRanks,
    existingMissionTitles,
  });

  const parsed = await callGeminiWithFallback(apiKey, prompt);
  const rawList = Array.isArray(parsed?.missions)
    ? parsed.missions
    : Array.isArray(parsed)
    ? parsed
    : [];

  return enforceBatchMissionUniqueness(
    rawList.slice(0, safeCount),
    rolledRanks,
    existingMissionTitles
  );
}

async function handleGenerate(request, isPost) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error:
          'A variável de ambiente GEMINI_API_KEY não foi encontrada na Vercel ou no arquivo .env. No painel da Vercel vá em Settings > Environment Variables, adicione GEMINI_API_KEY com sua chave e faça um novo Deploy.',
      },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');
  const verified = await verifyBearerToken(authHeader);
  const admin = await getFirebaseAdmin();

  if (isPost) {
    if (!verified) {
      return NextResponse.json(
        { success: false, error: 'Autenticação necessária para gerar conteúdo. Faça login como Mestre.' },
        { status: 401 }
      );
    }
    if (admin && !verified.isMaster && !verified.isCron) {
      return NextResponse.json(
        { success: false, error: 'Apenas usuários com perfil de Mestre podem gerar conteúdo diário.' },
        { status: 403 }
      );
    }
  } else {
    if (process.env.CRON_SECRET && !verified?.isCron && !verified?.isMaster) {
      return NextResponse.json({ success: false, error: 'Não autorizado para execução de cron.' }, { status: 401 });
    }
    if (!admin && !verified) {
      return NextResponse.json(
        {
          success: false,
          error:
            'FIREBASE_SERVICE_ACCOUNT_KEY não configurada para execução automática do Cron. Use o botão "Gerar Diária" logado no painel do Mestre.',
        },
        { status: 501 }
      );
    }
  }

  try {
    let mode = 'both';
    let count = null;
    let existingDescriptions = [];
    let existingMissionTitles = [];

    if (isPost) {
      try {
        const bodyJson = await request.clone().json();
        if (['shop', 'missions', 'both'].includes(bodyJson?.mode)) {
          mode = bodyJson.mode;
        }
        if (bodyJson?.count !== undefined) {
          count = Math.floor(Number(bodyJson.count) || 0);
        }
        if (Array.isArray(bodyJson?.existingDescriptions)) {
          existingDescriptions = bodyJson.existingDescriptions
            .map((d) => String(d || ''))
            .filter(Boolean);
        }
        if (Array.isArray(bodyJson?.existingMissionTitles)) {
          existingMissionTitles = bodyJson.existingMissionTitles
            .map((t) => String(t || ''))
            .filter(Boolean);
        }
      } catch {}
    }

    if (admin && (mode === 'shop' || mode === 'both') && existingDescriptions.length === 0) {
      try {
        const existingSnap = await admin.adminDb.collection('shop_items').limit(30).get();
        existingSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data?.description) {
            existingDescriptions.push(`${data.item_name || ''}: ${data.description}`);
          }
        });
      } catch {}
    }

    if (admin && (mode === 'missions' || mode === 'both') && existingMissionTitles.length === 0) {
      try {
        const existingSnap = await admin.adminDb.collection('missions').limit(30).get();
        existingSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data?.title) {
            existingMissionTitles.push(`${data.title}: ${data.description || ''}`);
          }
        });
      } catch {}
    }

    let missions = [];
    let shop_items = [];

    if (mode === 'shop') {
      shop_items = await generateShopItemsWithGemini(apiKey, count || 10, existingDescriptions);
    } else if (mode === 'missions') {
      missions = await generateMissionsWithGemini(apiKey, count || 3, existingMissionTitles);
    } else {
      const [genMissions, genItems] = await Promise.all([
        generateMissionsWithGemini(apiKey, 2, existingMissionTitles),
        generateShopItemsWithGemini(apiKey, 10, existingDescriptions),
      ]);
      missions = genMissions;
      shop_items = genItems;
    }

    if (admin) {
      const { FieldValue } = await import('firebase-admin/firestore');
      const batch = admin.adminDb.batch();
      missions.forEach((m) => {
        const ref = admin.adminDb.collection('missions').doc();
        batch.set(ref, {
          ...m,
          status: 'open',
          assigned_to: null,
          assigned_to_name: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      shop_items.forEach((s) => {
        const ref = admin.adminDb.collection('shop_items').doc();
        batch.set(ref, {
          item_name: s.item_name,
          description: s.description,
          price: s.price,
          quantity: s.quantity,
          type: s.type,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();

      return NextResponse.json({
        success: true,
        persisted: true,
        mode,
        countMissions: missions.length,
        countItems: shop_items.length,
        missions,
        shop_items,
      });
    }

    return NextResponse.json({
      success: true,
      persisted: false,
      mode,
      countMissions: missions.length,
      countItems: shop_items.length,
      missions,
      shop_items,
    });
  } catch (error) {
    console.error('Erro na geração via Gemini:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao gerar conteúdo diário.' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    return await handleGenerate(request, false);
  } catch (fatalError) {
    console.error('Fatal GET /api/daily-generate:', fatalError);
    return NextResponse.json(
      { success: false, error: fatalError?.message || 'Erro interno no servidor ao processar rotina diária.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    return await handleGenerate(request, true);
  } catch (fatalError) {
    console.error('Fatal POST /api/daily-generate:', fatalError);
    return NextResponse.json(
      { success: false, error: fatalError?.message || 'Erro interno no servidor ao gerar conteúdo com a IA.' },
      { status: 500 }
    );
  }
}
