import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Garante que a chave da IA existe, senão avisa no console
if (!process.env.GEMINI_API_KEY) {
  console.error("ERRO: GEMINI_API_KEY não encontrada no .env.local");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    // Tenta usar o modelo Flash.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Você é o Game Master do RPG 'Astralis'.
      Gere 1 Missão Nova e 1 Item de Loja Exótico.
      
      Regras:
      - Responda APENAS com um JSON válido.
      - Sem blocos de código markdown (\`\`\`json).
      
      Estrutura JSON obrigatória:
      {
        "mission": {
          "title": "Texto", "description": "Texto", "rank": "S", 
          "xp_reward": 1000, "gold_reward": 500, "status": "open"
        },
        "shop_item": {
          "item_name": "Texto", "description": "Texto", 
          "price": 500, "quantity": 1
        }
      }
    `;

    console.log("Iniciando geração com IA...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    // Limpeza forçada do texto para evitar erros de JSON
    const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    console.log("IA respondeu. Processando JSON...");

    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error("A IA não devolveu um JSON válido:", text);
        return NextResponse.json({ error: "Erro de formato JSON da IA" }, { status: 500 });
    }

    // Salvando no Banco
    const { error: err1 } = await supabaseAdmin.from('missions').insert([data.mission]);
    if (err1) throw new Error("Erro ao salvar Missão: " + err1.message);

    const { error: err2 } = await supabaseAdmin.from('shop_items').insert([data.shop_item]);
    if (err2) throw new Error("Erro ao salvar Item: " + err2.message);

    console.log("Sucesso! Conteúdo gerado.");
    return NextResponse.json({ success: true, created: data });

  } catch (error) {
    console.error("ERRO FATAL NA API:", error);
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}