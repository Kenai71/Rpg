import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Configurações do ambiente
// IMPORTANTE: Adicione GEMINI_API_KEY e SUPABASE_SERVICE_ROLE_KEY no seu .env.local
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Chave secreta do Supabase (Settings > API)
);

export async function GET(request) {
  // Segurança básica para impedir acesso público não autorizado
  // Você pode passar ?secret=SEU_SEGREDO na URL se quiser proteger mais
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  // Defina uma senha simples no .env ou verifique aqui se quiser
  // if (secret !== process.env.CRON_SECRET) { ... }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
      Você é o Game Master (Mestre de Jogo) do RPG 'Astralis', um cenário que mistura fantasia medieval e sci-fi.
      
      Sua tarefa é criar conteúdo diário para os jogadores.
      Gere 1 (uma) Missão Nova e 1 (um) Item de Loja Exótico.

      Regras da Missão:
      - Título criativo e curto.
      - Descrição envolvente (máx 2 frases).
      - Ranks: F, E, D, C, B, A ou S.
      - XP e Gold proporcionais ao Rank.

      Regras do Item:
      - Nome futurista ou mágico.
      - Preço entre 100 e 5000 gold.
      - Quantidade em estoque: 1 a 5.

      Responda ESTRITAMENTE com um JSON neste formato:
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
    const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        return NextResponse.json({ error: "Erro ao fazer parse do JSON da IA", raw: text }, { status: 500 });
    }

    // 1. Criar Missão no Banco
    const { error: missionError } = await supabaseAdmin
      .from('missions')
      .insert([data.mission]);

    if (missionError) throw missionError;

    // 2. Criar Item na Loja
    const { error: shopError } = await supabaseAdmin
      .from('shop_items')
      .insert([data.shop_item]);

    if (shopError) throw shopError;

    return NextResponse.json({ success: true, created: data });

  } catch (error) {
    console.error("Erro na geração diária:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}