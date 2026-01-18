import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const MODELS_TO_TRY = ["gemini-2.0-flash-exp", "gemini-2.5-flash", "gemini-1.5-flash"];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Chave API faltando" }, { status: 500 });
  }

  // 1. Tentar conectar com algum modelo
  let model = null;
  for (const name of MODELS_TO_TRY) {
    try {
      const m = genAI.getGenerativeModel({ 
        model: name, 
        generationConfig: { responseMimeType: "application/json" } 
      });
      await m.generateContent("Ping");
      model = m; break;
    } catch (e) {}
  }

  if (!model) return NextResponse.json({ error: "IA indisponível. Verifique a chave API." }, { status: 500 });

  try {
    // Adicionamos Date.now() para forçar conteúdo novo sempre
    const prompt = `
      Seed: ${Date.now()}
      Você é Mestre de RPG Medieval. Gere conteúdo novo.
      
      TAREFA:
      - 2 Missões (Ranks F a S).
      - 10 Itens de Loja.
      
      ESTRUTURA OBRIGATÓRIA (JSON):
      {
        "missions": [
          { "title": "T", "description": "D", "rank": "S", "xp_reward": 5000, "gold_reward": 2000, "status": "open" }
        ],
        "shop_items": [
          { "item_name": "N", "description": "<RARO> Desc...", "price": 100, "quantity": 1, "type": "waist" }
        ]
      }
      
      Tipos de Item (type): head, face, neck, body, hands, waist, feet, ring, consumable.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const data = JSON.parse(text);

    // Validação
    if (!data.missions || !data.shop_items) throw new Error("JSON incompleto da IA");

    // 2. SALVAR NO BANCO COM TRATAMENTO DE ERRO REAL
    if (data.missions.length > 0) {
        const { error } = await supabaseAdmin.from('missions').insert(data.missions);
        if (error) throw new Error("Erro ao salvar Missões: " + error.message);
    }

    if (data.shop_items.length > 0) {
        const { error } = await supabaseAdmin.from('shop_items').insert(data.shop_items);
        // Se der erro aqui (ex: coluna 'type' faltando), o código para e avisa você
        if (error) throw new Error("Erro ao salvar Itens: " + error.message);
    }

    return NextResponse.json({ 
        success: true, 
        countMissions: data.missions.length, 
        countItems: data.shop_items.length 
    });

  } catch (error) {
    console.error("ERRO API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}