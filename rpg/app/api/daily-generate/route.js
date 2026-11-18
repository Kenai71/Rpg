import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';
import {
  enforceBatchItemUniqueness,
  enforceMissionBalance,
  rollShopItemRarity,
} from '../../../lib/dnd-rules.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

async function generateWithGemini(apiKey, existingDescriptions = []) {
  const genAI = new GoogleGenerativeAI(apiKey);

  // Sorteia a raridade de cada um dos 10 itens (quanto maior a raridade, mais difícil aparecer na loja)
  const rolledRarities = Array.from({ length: 10 }, () => rollShopItemRarity());
  const raritySlotsList = rolledRarities.map((r, i) => `Item ${i + 1}: <${r}>`).join(', ');

  const recentHighRarityContext =
    existingDescriptions.length > 0
      ? `\nMEMÓRIA ANTI-REPETIÇÃO (NÃO repita nomes ou descrições parecidas com estes itens já existentes na loja):\n${existingDescriptions
          .slice(0, 12)
          .map((d, i) => `${i + 1}. ${String(d).slice(0, 160)}`)
          .join('\n')}\n`
      : '';

  const prompt = `Seed: ${Date.now()}-${Math.random()}. Você é Mestre especialista nos manuais oficiais D&D 5.5e (Revisão 2024) e D&D 5e em Português do Brasil.
Gere exatamente 2 Missões e 10 Itens variados para o Vallen RPG.
${recentHighRarityContext}
RARIDADES OBRIGATÓRIAS SORTEADAS PARA OS 10 ITENS DA LOJA (RESPEITE EXATAMENTE ESTA ORDEM):
${raritySlotsList}

DIRETRIZES DE ESCRITA NATURAL, MAESTRIAS ESCASSAS E EFEITOS DE STATUS:
1. ESCRITA FLUIDA E NATURAL:
- Escreva descrições claras, naturais e bem redigidas em português, sem colchetes artificiais "[...]", sem traços robóticos e sem termos em inglês como "(Vex)" ou "(Topple)".
- Toda descrição DEVE começar apenas com a tag da raridade sorteada: <COMUM>, <INCOMUM>, <RARO>, <ÉPICO>, <LENDÁRIO> ou <MÍTICO>.
- Quanto maior a raridade da arma, mais única e especial deve ser sua história e propriedade.

2. MAESTRIAS DE ARMA MAIS RARAS:
- Armas <COMUM> NUNCA possuem maestria.
- Armas <INCOMUM> e <RARO> raramente possuem maestria (a maioria não tem).
- A maestria "Derrubar" deve ser muito rara, aparecendo apenas ocasionalmente em armas pesadas de alta raridade.

3. EFEITOS DE STATUS OFICIAIS DO SITE ( DIFÍCIL DE VIR E ESCALONADO POR RARIDADE ):
- Os únicos efeitos de status permitidos são estes 10 do site:
  Sangramento, Atordoado, Caído (Prone), Queimando, Lentidão (-3m), Cegueira, Envenenado, Amaldiçoado, Abençoado, Invisível.
- Armas <COMUM> NUNCA têm efeito de status.
- Armas <INCOMUM> quase nunca têm efeito de status (90% sem efeito; se tiver, apenas Lentidão (-3m) ou Sangramento leve).
- Armas <RARO> têm baixa chance (~25%) de ter efeito de status (como Queimando, Sangramento, Lentidão (-3m) ou Envenenado).
- Armas <ÉPICO>, <LENDÁRIO> e <MÍTICO> têm efeitos de status mais fortes e raros (como Atordoado, Cegueira, Amaldiçoado, Abençoado, Invisível, Caído (Prone), Sangramento severo ou Queimando intenso).

4. ESCALONAMENTO DE DANO E PREÇO:
- <COMUM>: Dano 1d4, 1d6 ou 1d10. Sem bônus mágico. Preço: 30 a 100 G.
- <INCOMUM>: Dano 1d6, 1d8 ou 2d6 (+1 no acerto). Preço: 150 a 500 G.
- <RARO>: Dano 1d8, 1d10 ou 2d8 (+1 no ataque). Preço: 800 a 3.000 G.
- <ÉPICO>: Dano 1d10, 1d12 ou 2d10 (+2 no ataque). Preço: 4.000 a 15.000 G.
- <LENDÁRIO>: Dano 2d8, 2d10 ou 2d12 (+3 no ataque). Preço: 20.000 a 60.000 G.
- <MÍTICO>: Dano 2d10+4, 3d6+4 ou 4d6+5 (+4 no ataque). Preço: 75.000 a 200.000 G.
- Tipos permitidos: weapon, shield, head, face, neck, body, hands, waist, feet, ring, consumable.

5. MISSÕES (Tiers de Jogo do Guia do Mestre D&D):
- Rank F (100-250 XP | 40-100 G), Rank E (250-450 XP | 100-200 G), Rank D (500-800 XP | 250-450 G), Rank C (900-1.500 XP | 500-900 G), Rank B (1.600-2.800 XP | 1.000-1.800 G), Rank A (3.000-5.500 XP | 2.000-4.000 G), Rank S (6.000-12.000 XP | 5.000-10.000 G).

NUNCA use ícones de estrela ou símbolos de estrela.
Responda APENAS JSON válido no formato:
{"missions":[{"title":"","description":"","rank":"D","xp_reward":600,"gold_reward":350}],"shop_items":[{"item_name":"","description":"<COMUM> Forjada em ferro temperado com empunhadura firme de couro. Causa 1d6 de dano cortante.","price":65,"quantity":1,"type":"weapon"}]}`;

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

  const parsed = parseModelJson(resultText);

  const missions = Array.isArray(parsed?.missions)
    ? parsed.missions.map(enforceMissionBalance)
    : [];

  const rawItems = Array.isArray(parsed?.shop_items)
    ? parsed.shop_items.map((item, idx) => {
        const targetRarity = rolledRarities[idx] || rollShopItemRarity();
        const cleanBody = String(item.description || '')
          .replace(/^<(COMUM|INCOMUM|RARO|ÉPICO|LENDÁRIO|MÍTICO)>\s*/i, '')
          .trim();
        return {
          ...item,
          rarity: targetRarity,
          description: `<${targetRarity}> ${cleanBody}`,
        };
      })
    : [];

  const shop_items = enforceBatchItemUniqueness(rawItems, existingDescriptions);

  return { missions, shop_items };
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
    let existingDescriptions = [];
    if (isPost) {
      try {
        const bodyJson = await request.clone().json();
        if (Array.isArray(bodyJson?.existingDescriptions)) {
          existingDescriptions = bodyJson.existingDescriptions
            .map((d) => String(d || ''))
            .filter(Boolean);
        }
      } catch {}
    }

    if (admin && existingDescriptions.length === 0) {
      try {
        const existingSnap = await admin.adminDb.collection('shop_items').limit(30).get();
        existingSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data?.type === 'weapon' && data?.description) {
            existingDescriptions.push(`${data.item_name || ''}: ${data.description}`);
          }
        });
      } catch {}
    }

    const { missions, shop_items } = await generateWithGemini(apiKey, existingDescriptions);

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
          ...s,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();

      return NextResponse.json({
        success: true,
        persisted: true,
        countMissions: missions.length,
        countItems: shop_items.length,
      });
    }

    return NextResponse.json({
      success: true,
      persisted: false,
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
