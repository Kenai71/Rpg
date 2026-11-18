import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';
import {
  enforceBatchItemUniqueness,
  enforceMissionBalance,
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
  const recentHighRarityContext =
    existingDescriptions.length > 0
      ? `\nMEMÓRIA ANTI-REPETIÇÃO (NÃO repita nomes, passivas ou descrições parecidas com estes itens já existentes na loja):\n${existingDescriptions
          .slice(0, 12)
          .map((d, i) => `${i + 1}. ${String(d).slice(0, 160)}`)
          .join('\n')}\n`
      : '';

  const prompt = `Seed: ${Date.now()}-${Math.random()}. Você é Mestre especialista nos manuais oficiais D&D 5.5e (Revisão 2024) e D&D 5e (Livro do Jogador, Livro do Mestre e Escudo do DM) em Português do Brasil.
Gere exatamente 2 Missões e 10 Itens variados para o Astralis RPG.
${recentHighRarityContext}
DIRETRIZES OFICIAIS D&D 5.5e (2024), D&D 5e & ESCALONAMENTO DE UNICIDADE POR RARIDADE:
1. ITENS & ARMAS (QUANTO MAIOR A RARIDADE, MAIS ÚNICA, COMPLEXA E EXCLUSIVA DEVE SER A ARMA):
- Toda descrição de item DEVE iniciar com a tag de raridade: <COMUM>, <INCOMUM>, <RARO>, <ÉPICO>, <LENDÁRIO> ou <MÍTICO>.
- Se o item for uma arma, inclua o Dano Escalonado e a Maestria em Arma Oficial 2024 (Afligir, Ágil, Derrubar, Drenar, Empurrar, Garantido, Lentidão ou Trespassar).
- PROIBIDO repetir clichês como "Corte Dimensional" em todas as armas lendárias. Cada arma de alta raridade DEVE pertencer a um arquétipo semântico distinto (Gravitacional, Temporal, Devoradora de Feitiços, Sombras Gêmeas, Eclipse Solar/Lunar, Tectônica, Telecinética, Predador Abissal, Tempestade Encadeada, Zero Absoluto, Fênix Astral, Caça-Dragões, Sifão Sanguíneo, Psíquica, etc.).
- ESCALONAMENTO DE DANO, PROFUNDIDADE NARRATIVA & MECÂNICAS EXCLUSIVAS:
  * <COMUM>: Descrição curta e direta de forja mundana (ferro, aço, madeira). Dano base (Espada Curta/Cimitarra 1d4, Espada Longa 1d6, Espadão 1d10, Adaga 1d4, Arco Curto 1d4, Arco Longo 1d6). Sem magia. Preço: 30 a 100 G.
  * <INCOMUM>: Obra-prima alquímica/rúnica (prata alquímica, aço élfico, têmpera anã). Dano padrão do livro (1d6, 1d8 versátil 1d10, 2d6, 1d12) + bônus +1 no acerto + Maestria 2024. Preço: 150 a 500 G.
  * <RARO>: Infusão Elemental/Planar distinta (+1d4/+1d6 de fogo solar, frio de Stygia, relâmpago astral, trovão sísmico, ácido, veneno, radiante, necrótico ou psíquico) + gatilho reativo de combate + bônus +1/+2 + Maestria 2024. Preço: 800 a 3.000 G.
  * <ÉPICO>: Relíquia de campeão com Efeito de Status Tático (Sangramento, Atordoado, Queimadura, Lentidão, Cegueira, Veneno, Amaldiçoado) + uma Técnica Ativa Nomeada exclusiva (ex: Hemorragia Carmesim, Passo da Ampulheta, Martelo do Trovão, Silêncio Rúnico) + bônus +2/+3. Preço: 4.000 a 15.000 G.
  * <LENDÁRIO>: Arma Nomeada Única no mundo com identidade própria, Lore histórico de criação e Passiva Lendária Exclusiva (ex: Singularidade Gravitacional que puxa inimigos, Rebobinamento Temporal de ataque falho, Quebra-Magia que absorve feitiços, Clone Espectral que repete o golpe, Postura Dual Sol/Lua, Fragmentação Telecinética com +3m de alcance, Relâmpago em Cadeia para 2 alvos). Dano: 2d8, 2d10, 2d12 ou 3d6 (+3 ataque). Preço: 20.000 a 60.000 G.
  * <MÍTICO>: Artefato Primordial Único do Multiverso com origem cosmológica, Dano Supremo (2d10+4, 3d8+4, 4d6+5, +4 ataque) e Dupla Passiva Mítica + Despertar Cataclísmico único. Preço: 75.000 a 200.000 G.
- Tipos de itens permitidos: weapon, shield, head, face, neck, body, hands, waist, feet, ring, consumable.
- Distribua raridades variadas entre os 10 itens (ex: 3 comuns, 2 incomuns, 2 raros, 1 épico, 1 lendário, 1 mítico/lendário).

2. MISSÕES (Tiers de Jogo e Encontros do Guia do Mestre D&D 2024/5e):
- Rank F: Ameaças locais menores (100-250 XP | 40-100 G)
- Rank E: Bandos de goblins/kobolds, defesa local (250-450 XP | 100-200 G)
- Rank D: Acampamentos orcs, ogros, criptas com carniçais (500-800 XP | 250-450 G)
- Rank C: Hidras, quimeras, gigantes da colina (900-1.500 XP | 500-900 G)
- Rank B: Jovens dragões, vampiros, arquimagos (1.600-2.800 XP | 1.000-1.800 G)
- Rank A: Dragões adultos, beholders, lichs (3.000-5.500 XP | 2.000-4.000 G)
- Rank S: Titãs ancestrais, dragões anciões, lordes abissais (6.000-12.000 XP | 5.000-10.000 G)
- Descrições de missões imersivas e objetivas (1 a 2 frases).

NUNCA use ícones de estrela ou símbolos de estrela.
Responda APENAS JSON válido no seguinte formato:
{"missions":[{"title":"","description":"","rank":"D","xp_reward":600,"gold_reward":350}],"shop_items":[{"item_name":"","description":"<LENDÁRIO> Dano: 2d8 cortante (+3 no ataque) — [Paradoxo do Relógio Quebrado]: +1d10 Temporal e permite rebobinar 1 ataque falho por combate. Maestria: Afligir (Vex). Seus engastes contêm areia do Plano do Tempo.","price":38000,"quantity":1,"type":"weapon"}]}`;

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

  const shop_items = Array.isArray(parsed?.shop_items)
    ? enforceBatchItemUniqueness(parsed.shop_items, existingDescriptions)
    : [];

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
