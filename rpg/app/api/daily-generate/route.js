export const dynamic = 'force-dynamic'; // Garante que só roda quando chamado
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

  if (!model) return NextResponse.json({ error: "IA indisponível" }, { status: 500 });

  try {
    const prompt = `
      Seed: ${Date.now()}
      Você é Mestre de RPG Medieval.
      TAREFA: 2 Missões (Ranks F-S) e 10 Itens de Loja.
      
      JSON OBRIGATÓRIO:
      {
        "missions": [{"title": "T", "description": "D", "rank": "S", "xp_reward": 5000, "gold_reward": 2000, "status": "open"}],
        "shop_items": [{"item_name": "N", "description": "<RARO> D", "price": 100, "quantity": 1, "type": "waist"}]
      }
    `;

    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());

    if (data.missions?.length > 0) {
        const { error } = await supabaseAdmin.from('missions').insert(data.missions);
        if (error) throw new Error("Erro Missões: " + error.message);
    }

    if (data.shop_items?.length > 0) {
        const { error } = await supabaseAdmin.from('shop_items').insert(data.shop_items);
        if (error) throw new Error("Erro Itens: " + error.message);
    }

    return NextResponse.json({ success: true, count: data.shop_items.length });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}