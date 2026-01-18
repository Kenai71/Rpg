import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    // Vamos direto no modelo mais estável e padrão do mercado hoje
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    console.log("Tentando conectar com Gemini 1.5 Flash...");
    
    // Teste de conexão simples (Ping)
    // Se a chave estiver errada, vai estourar o erro AQUI e mostrar na tela
    await model.generateContent("Teste de conexão."); 

    console.log("Conexão OK! Gerando missões...");

    const prompt = `
      Gere um JSON válido com 2 missões de RPG e 10 itens de loja.
      Formato JSON estrito:
      {
        "missions": [{"title": "T", "description": "D", "rank": "F", "xp_reward": 100, "gold_reward": 50, "status": "open"}],
        "shop_items": [{"item_name": "I [Comum]", "description": "D", "price": 10, "quantity": 1}]
      }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    
    const data = JSON.parse(text);

    // Salvar no Banco
    if (data.missions?.length) await supabaseAdmin.from('missions').insert(data.missions);
    if (data.shop_items?.length) await supabaseAdmin.from('shop_items').insert(data.shop_items);

    return NextResponse.json({ success: true, message: "Gerado com sucesso!" });

  } catch (error) {
    console.error("ERRO DETALHADO:", error);
    // Isso vai mostrar o motivo real do erro na sua tela
    return NextResponse.json({ 
      error: "Falha na IA", 
      reason: error.message, // Ex: "API Key not valid" ou "404 Not Found"
      hint: "Verifique se criou a chave em um PROJETO NOVO no Google AI Studio."
    }, { status: 500 });
  }
}