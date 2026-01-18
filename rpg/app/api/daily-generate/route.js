import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Configurações do ambiente
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY 
);

export async function GET(request) {
  try {
    // Usando o modelo flash (mais rápido e barato)
    // Se der erro 404 mesmo após atualizar o npm, troque para "gemini-pro"
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Você é o Game Master (Mestre de Jogo) do RPG 'Astralis', um cenário que mistura fantasia medieval e sci-fi.
      
      Sua tarefa é criar conteúdo diário para os jogadores.
      Gere 1 (uma) Missão Nova e 1 (um) Item de Loja Exótico.

      Regras da Missão:
      - Título criativo e curto.
      - Descrição envolvente (máx 2 frases).
      - Ranks: F, E, D, C, B, A ou S.
      - XP e Gold proporcionais ao Rank (XP: 100-5000, Gold: 50-2000).

      Regras do Item:
      - Nome futurista ou mágico.
      - Preço entre 100 e 5000 gold.
      - Quantidade em estoque: 1 a 5.

      Responda ESTRITAMENTE com um JSON neste formato (sem markdown):
      {
        "mission": {
          "title": "String",
          "description": "String",
          "rank": "String",
          "xp_reward": Number,
          "gold_reward": Number,
          "status": "open"
        },
        "shop_item": {
          "item_name": "String",
          "description": "String",
          "price": Number,
          "quantity": Number
        }
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    // Limpeza para garantir que o texto venha sem formatação de código markdown
    const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error("Erro de Parse JSON:", text);
        return NextResponse.json({ error: "A IA não retornou um JSON válido.", raw: text }, { status: 500 });
    }

    // 1. Criar Missão no Banco
    const { error: missionError } = await supabaseAdmin
      .from('missions')
      .insert([data.mission]);

    if (missionError) {
      console.error("Erro Supabase Missão:", missionError);
      throw missionError;
    }

    // 2. Criar Item na Loja
    const { error: shopError } = await supabaseAdmin
      .from('shop_items')
      .insert([data.shop_item]);

    if (shopError) {
      console.error("Erro Supabase Loja:", shopError);
      throw shopError;
    }

    return NextResponse.json({ success: true, created: data });

  } catch (error) {
    console.error("Erro Geral na Rota:", error);
    return NextResponse.json({ error: error.message || error.toString() }, { status: 500 });
  }
}