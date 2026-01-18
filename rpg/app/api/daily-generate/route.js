import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// 1. Configuração
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    // Usando o modelo padrão e estável
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      // Força a resposta a ser JSON puro
      generationConfig: { responseMimeType: "application/json" }
    });

    console.log("Conectando ao Gemini 1.5 Flash...");

    // 2. O Prompt
    const prompt = `
      Você é o Mestre do RPG Astralis.
      Gere 2 Missões Novas e 10 Itens de Loja para hoje.

      Requisitos:
      - Missões com ranks variados (F a S) e recompensas justas.
      - Itens com raridades [Comum] a [Mítico] no nome.
      
      Responda APENAS com este JSON:
      {
        "missions": [
          { "title": "T", "description": "D", "rank": "F", "xp_reward": 100, "gold_reward": 50, "status": "open" }
        ],
        "shop_items": [
          { "item_name": "Nome [Raridade]", "description": "D", "price": 100, "quantity": 1 }
        ]
      }
    `;

    // 3. Geração
    const result = await model.generateContent(prompt);
    const text = result.response.text(); // O texto já vem limpo por causa do responseMimeType
    
    console.log("IA respondeu. Processando...");
    
    // 4. Parse e Salvamento
    let data = JSON.parse(text);

    // Validação de segurança se vier array vazio
    if (!data.missions || !data.shop_items) throw new Error("JSON incompleto");

    // Salvar Missões
    if (data.missions.length > 0) {
        const { error } = await supabaseAdmin.from('missions').insert(data.missions);
        if (error) console.error("Erro Supabase Missões:", error.message);
    }

    // Salvar Itens
    if (data.shop_items.length > 0) {
        const { error } = await supabaseAdmin.from('shop_items').insert(data.shop_items);
        if (error) console.error("Erro Supabase Itens:", error.message);
    }

    return NextResponse.json({ 
        success: true, 
        countMissions: data.missions.length, 
        countItems: data.shop_items.length 
    });

  } catch (error) {
    console.error("ERRO ROTA:", error);
    return NextResponse.json({ 
        error: "Falha ao gerar", 
        details: error.message 
    }, { status: 500 });
  }
}