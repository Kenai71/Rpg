import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Lista de modelos para tentar (do mais novo para o mais antigo)
const MODELS_TO_TRY = [
  "gemini-2.0-flash-exp",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest"
];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Chave API faltando no .env.local" }, { status: 500 });
  }

  // 1. TENTATIVA DE CONEXÃO INTELIGENTE
  let model = null;
  for (const modelName of MODELS_TO_TRY) {
    try {
      const testModel = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      });
      await testModel.generateContent("Teste"); // Ping rápido
      model = testModel;
      break; 
    } catch (error) {
      console.warn(`Tentativa falhou no modelo ${modelName}...`);
    }
  }

  if (!model) {
    return NextResponse.json({ error: "Nenhum modelo disponível. Verifique sua API Key." }, { status: 500 });
  }

  // 2. GERAÇÃO DO CONTEÚDO
  try {
    // Adicionamos Date.now() para garantir que o prompt seja sempre único
    // Isso impede que a IA repita respostas ou cacheie o resultado.
    const prompt = `
      Seed Aleatória: ${Date.now()}
      Você é o Game Master de um RPG de FANTASIA MEDIEVAL.
      Gere conteúdo NOVO e ÚNICO. Não se preocupe com limites, crie mais.
      
      TAREFA:
      1. Gere 2 Missões Novas.
      2. Gere 10 Itens de Loja Novos.

      REGRAS DE RETORNO (JSON):
      {
        "missions": [
          { 
            "title": "Título Criativo", 
            "description": "Descrição envolvente...", 
            "rank": "S", 
            "xp_reward": 5000, 
            "gold_reward": 2000, 
            "status": "open" 
          }
        ],
        "shop_items": [
          { 
            "item_name": "Nome do Item", 
            "description": "<RARO> Descrição com a raridade no inicio...", 
            "price": 500, 
            "quantity": 1,
            "type": "waist" 
          }
        ]
      }

      TIPOS DE ITEM PERMITIDOS (type):
      "head", "face", "neck", "body", "hands", "waist", "feet", "ring", "consumable".
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        return NextResponse.json({ error: "A IA retornou dados inválidos", raw: text }, { status: 500 });
    }

    // Validação
    const missions = data.missions || [];
    const items = data.shop_items || [];

    if (missions.length === 0 && items.length === 0) {
        return NextResponse.json({ error: "A IA gerou listas vazias." }, { status: 500 });
    }

    // Salvar no Banco
    if (missions.length > 0) {
        const { error } = await supabaseAdmin.from('missions').insert(missions);
        if (error) console.error("Erro ao salvar missões:", error.message);
    }

    if (items.length > 0) {
        const { error } = await supabaseAdmin.from('shop_items').insert(items);
        if (error) console.error("Erro ao salvar itens:", error.message);
    }

    // RETORNO CORRIGIDO: Agora enviamos countMissions e countItems
    return NextResponse.json({ 
      success: true, 
      countMissions: missions.length, 
      countItems: items.length 
    });

  } catch (error) {
    console.error("ERRO GERAL:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}