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
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "No API Key" }, { status: 500 });

  let model = null;
  for (const name of MODELS_TO_TRY) {
    try {
      const m = genAI.getGenerativeModel({ model: name, generationConfig: { responseMimeType: "application/json" } });
      await m.generateContent("Test");
      model = m; break;
    } catch (e) {}
  }
  if (!model) return NextResponse.json({ error: "No Model Available" }, { status: 500 });

  try {
    const prompt = `
      Você é o Mestre de um RPG de FANTASIA MEDIEVAL.
      Gere 2 Missões e 10 Itens de Loja.

      REGRAS DE ITENS:
      1. Descrição: DEVE começar com a raridade entre tags: <COMUM>, <INCOMUM>, <RARO>, <ÉPICO>, <LENDÁRIO>, <MÍTICO>.
      2. Nome: Limpo (Ex: "Cinto de Couro").
      3. Type (Tipo) - Escolha um:
         - "face" (Máscara, Óculos, Brinco Mágico)
         - "head" (Capacete, Elmo, Chapéu, Coroa)
         - "neck" (Colar, Amuleto, Pingente)
         - "body" (IMPORTANTE: Apenas Armaduras Completas. Ex: "Armadura de Placas", "Túnica de Mago", "Traje de Ladino")
         - "hands" (Luvas, Manoplas, Braceletes)
         - "waist" (Cinto, Faixa, Algibeira)
         - "feet" (Botas, Sapatos, Grevas)
         - "ring" (Anel)
         - "consumable" (Poção, Pergaminho)
      
      Responda JSON:
      {
        "missions": [
          { "title": "...", "description": "...", "rank": "S", "xp_reward": 15000, "gold_reward": 8000, "status": "open" }
        ],
        "shop_items": [
          { "item_name": "Nome", "description": "<RARO> Descrição...", "price": 1000, "quantity": 1, "type": "waist" }
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());

    if (data.missions?.length) await supabaseAdmin.from('missions').insert(data.missions);
    if (data.shop_items?.length) await supabaseAdmin.from('shop_items').insert(data.shop_items);

    return NextResponse.json({ success: true, count: data.shop_items.length });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}