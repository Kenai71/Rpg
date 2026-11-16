import { GoogleGenerativeAI } from '@google/generative-ai';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';

const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

async function verifyBearerToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice(7).trim();
  if (!idToken) return null;

  // Se houver Cron Secret configurado
  if (process.env.CRON_SECRET && idToken === process.env.CRON_SECRET) {
    return { isCron: true, uid: 'cron' };
  }

  // Verifica via Firebase Admin se configurado
  const admin = getFirebaseAdmin();
  if (admin) {
    try {
      const decoded = await admin.adminAuth.verifyIdToken(idToken);
      const profileSnap = await admin.adminDb.collection('profiles').doc(decoded.uid).get();
      const role = profileSnap.exists ? profileSnap.data()?.role : 'player';
      return { uid: decoded.uid, isMaster: role === 'master', isCron: false };
    } catch {
      return null;
    }
  }

  // Fallback seguro: valida o ID token diretamente na API oficial do Firebase Identity Toolkit
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

async function generateWithGemini(apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  let model = null;

  for (const name of MODELS_TO_TRY) {
    try {
      const candidate = genAI.getGenerativeModel({
        model: name,
        generationConfig: { responseMimeType: 'application/json' },
      });
      await candidate.generateContent('Responda apenas {}');
      model = candidate;
      break;
    } catch {
      // Tenta próximo modelo compatível
    }
  }

  if (!model) {
    throw new Error('Nenhum modelo Gemini disponível respondeu no momento.');
  }

  const prompt = `
    Seed: ${Date.now()}
    Você é Mestre de um RPG de Fantasia Medieval. Crie conteúdo NOVO, equilibrado e CRIATIVO em Português do Brasil.

    TAREFA:
    1. Gere exatamente 2 Missões Variadas.
    2. Gere exatamente 10 Itens de Loja.

    REGRAS PARA MISSÕES:
    - rank deve ser um de: "F", "E", "D", "C", "B", "A", "S".
    - xp_reward e gold_reward devem ser números inteiros coerentes com o rank.

    REGRAS PARA ITENS:
    - Variedade: Espadas, Katanas, Arcos, Bestas, Machados, Adagas, Cajados, Escudos, Armaduras, Acessórios, Poções.
    - RARIDADE na descrição: <COMUM>, <INCOMUM>, <RARO>, <ÉPICO>, <LENDÁRIO>.
    - Se o item for RARO ou superior, adicione um efeito passivo criativo na descrição.
    - TIPOS PERMITIDOS (type): weapon, shield, head, face, neck, body, hands, waist, feet, ring, consumable.

    ESTRUTURA JSON OBRIGATÓRIA:
    {
      "missions": [
        { "title": "Título", "description": "História e objetivo...", "rank": "D", "xp_reward": 500, "gold_reward": 300 }
      ],
      "shop_items": [
        {
          "item_name": "Katana das Sombras",
          "description": "<ÉPICO> Uma lâmina negra forjada na névoa. Passiva: O primeiro ataque causa sangramento.",
          "price": 2500,
          "quantity": 1,
          "type": "weapon"
        }
      ]
    }
  `;

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text());

  const missions = Array.isArray(parsed?.missions)
    ? parsed.missions.map((m) => ({
        title: String(m.title || 'Missão Sem Título').slice(0, 120),
        description: String(m.description || '').slice(0, 1800),
        rank: ['F', 'E', 'D', 'C', 'B', 'A', 'S'].includes(m.rank) ? m.rank : 'D',
        xp_reward: Math.max(50, Math.floor(Number(m.xp_reward) || 300)),
        gold_reward: Math.max(20, Math.floor(Number(m.gold_reward) || 150)),
      }))
    : [];

  const allowedTypes = [
    'weapon',
    'shield',
    'head',
    'face',
    'neck',
    'body',
    'hands',
    'waist',
    'feet',
    'ring',
    'consumable',
  ];

  const shop_items = Array.isArray(parsed?.shop_items)
    ? parsed.shop_items.map((item) => ({
        item_name: String(item.item_name || 'Relíquia Misteriosa').slice(0, 80),
        description: String(item.description || '<COMUM> Item forjado no reino.').slice(0, 900),
        price: Math.max(10, Math.floor(Number(item.price) || 100)),
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
        type: allowedTypes.includes(item.type) ? item.type : 'consumable',
      }))
    : [];

  return { missions, shop_items };
}

async function handleGenerate(request, isPost) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY não configurada no arquivo .env / Vercel.' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');
  const verified = await verifyBearerToken(authHeader);
  const admin = getFirebaseAdmin();

  if (isPost) {
    if (!verified) {
      return NextResponse.json(
        { error: 'Autenticação necessária para gerar conteúdo.' },
        { status: 401 }
      );
    }
    if (admin && !verified.isMaster && !verified.isCron) {
      return NextResponse.json(
        { error: 'Apenas Mestres podem gerar conteúdo diário.' },
        { status: 403 }
      );
    }
  } else {
    // GET: usado pelo Vercel Cron ou chamada autorizada
    if (process.env.CRON_SECRET && !verified?.isCron && !verified?.isMaster) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }
    if (!admin && !verified) {
      return NextResponse.json(
        {
          error:
            'FIREBASE_SERVICE_ACCOUNT_KEY não configurada para execução automática do Cron. Use o botão "Gerar Diária" logado no painel do Mestre ou configure a Service Account.',
        },
        { status: 501 }
      );
    }
  }

  try {
    const { missions, shop_items } = await generateWithGemini(apiKey);

    if (admin) {
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

    // Sem Admin SDK: retorna o conteúdo gerado para o cliente autenticado (Mestre) persistir no Firestore
    return NextResponse.json({
      success: true,
      persisted: false,
      countMissions: missions.length,
      countItems: shop_items.length,
      missions,
      shop_items,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao gerar conteúdo diário.' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return handleGenerate(request, false);
}

export async function POST(request) {
  return handleGenerate(request, true);
}
