import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const MODELS_TO_TRY = ["gemini-2.0-flash-exp", "gemini-2.5-flash", "gemini-1.5-flash"];

export async function GET(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey || !sbUrl || !sbKey) {
    return NextResponse.json({ error: "Chaves de API faltando." }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const supabaseAdmin = createClient(sbUrl, sbKey);

  let model = null;
  for (const name of MODELS_TO_TRY) {
    try {
      const m = genAI.getGenerativeModel({ model: name, generationConfig: { responseMimeType: "application/json" } });
      await m.generateContent("Ping");
      model = m; break;
    } catch (e) {}
  }

  if (!model) return NextResponse.json({ error: "IA indisponível." }, { status: 500 });

  try {
    const prompt = `
      Seed: ${Date.now()}
      Você é Mestre de um RPG de Fantasia. Crie conteúdo NOVO e CRIATIVO.
      
      TAREFA:
      1. Gere 2 Missões Variadas.
      2. Gere 10 Itens de Loja.
      
      REGRAS PARA ITENS:
      - Crie uma grande variedade: Espadas, Katanas, Arcos, Bestas (Arbalest), Machados, Adagas, Cajados, Escudos, Armaduras, Acessórios.
      - RARIDADE: <COMUM>, <INCOMUM>, <RARO>, <ÉPICO>, <LENDÁRIO>.
      - EFEITOS ÚNICOS: Se o item for RARO ou superior, adicione um efeito passivo criativo na descrição (Ex: "Causa dano de fogo", "Aumenta velocidade", "Brilha no escuro").
      
      ESTRUTURA JSON OBRIGATÓRIA:
      {
        "missions": [
          { "title": "Título", "description": "História...", "rank": "D", "xp_reward": 500, "gold_reward": 300, "status": "open" }
        ],
        "shop_items": [
          { 
            "item_name": "Katana das Sombras", 
            "description": "<ÉPICO> Uma lâmina negra. Passiva: O primeiro ataque causa sangramento.", 
            "price": 2500, 
            "quantity": 1, 
            "type": "weapon" 
          }
        ]
      }
      
      TIPOS PERMITIDOS (type):
      - weapon (Qualquer arma: Espada, Arco, Cajado...)
      - shield (Escudos)
      - head, face, neck, body, hands, waist, feet, ring, consumable.
    `;

    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());

    if (data.missions?.length > 0) await supabaseAdmin.from('missions').insert(data.missions);
    if (data.shop_items?.length > 0) await supabaseAdmin.from('shop_items').insert(data.shop_items);

    return NextResponse.json({ success: true, count: data.shop_items.length });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}