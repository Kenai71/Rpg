import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Força a rota a ser dinâmica (não roda no Build)
export const dynamic = 'force-dynamic';

const MODELS_TO_TRY = ["gemini-2.0-flash-exp", "gemini-2.5-flash", "gemini-1.5-flash"];

export async function GET(request) {
  // 1. Pega as chaves APENAS AGORA (dentro da função)
  const apiKey = process.env.GEMINI_API_KEY;
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey || !sbUrl || !sbKey) {
    return NextResponse.json({ error: "Chaves de API faltando no servidor Vercel." }, { status: 500 });
  }

  // 2. Inicializa as ferramentas
  const genAI = new GoogleGenerativeAI(apiKey);
  const supabaseAdmin = createClient(sbUrl, sbKey);

  // 3. Tenta conectar na IA
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

  if (!model) return NextResponse.json({ error: "IA indisponível no momento." }, { status: 500 });

  try {
    const prompt = `
      Seed: ${Date.now()}
      RPG Medieval.
      TAREFA: 2 Missões e 10 Itens de Loja.
      JSON OBRIGATÓRIO:
      {
        "missions": [{"title": "T", "description": "D", "rank": "F", "xp_reward": 100, "gold_reward": 50, "status": "open"}],
        "shop_items": [{"item_name": "N", "description": "<COMUM> D", "price": 10, "quantity": 1, "type": "consumable"}]
      }
      Tipos: head, face, neck, body, hands, waist, feet, ring, consumable.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const data = JSON.parse(text);

    // 4. Salvar no Banco
    if (data.missions?.length > 0) {
        await supabaseAdmin.from('missions').insert(data.missions);
    }
    if (data.shop_items?.length > 0) {
        await supabaseAdmin.from('shop_items').insert(data.shop_items);
    }

    return NextResponse.json({ success: true, count: data.shop_items.length });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}