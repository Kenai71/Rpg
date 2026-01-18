import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Esta linha força o Vercel a não tentar rodar isso na construção do site
export const dynamic = 'force-dynamic';

const MODELS_TO_TRY = ["gemini-2.0-flash-exp", "gemini-2.5-flash", "gemini-1.5-flash"];

export async function GET(request) {
  // 1. Pega as chaves APENAS quando a rota é chamada (não no início do arquivo)
  const apiKey = process.env.GEMINI_API_KEY;
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Verificação de segurança
  if (!apiKey || !sbUrl || !sbKey) {
    return NextResponse.json({ error: "Chaves de API faltando no servidor." }, { status: 500 });
  }

  // 2. Inicializa as ferramentas agora (seguro)
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
      // Teste rápido
      await m.generateContent("Ping");
      model = m; break;
    } catch (e) {
      console.warn(`Modelo ${name} falhou, tentando próximo...`);
    }
  }

  if (!model) {
    return NextResponse.json({ error: "Nenhum modelo de IA disponível no momento." }, { status: 500 });
  }

  try {
    const prompt = `
      Seed Aleatória: ${Date.now()}
      Você é Mestre de RPG Medieval.
      
      TAREFA:
      - 2 Missões Variadas.
      - 10 Itens de Loja.
      
      JSON OBRIGATÓRIO:
      {
        "missions": [
          { "title": "Título", "description": "Desc", "rank": "F", "xp_reward": 100, "gold_reward": 50, "status": "open" }
        ],
        "shop_items": [
          { "item_name": "Nome", "description": "<COMUM> Desc", "price": 10, "quantity": 1, "type": "consumable" }
        ]
      }
      Tipos de item permitidos: head, face, neck, body, hands, waist, feet, ring, consumable.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    let data;
    
    try {
        data = JSON.parse(text);
    } catch (e) {
        return NextResponse.json({ error: "IA retornou JSON inválido", raw: text }, { status: 500 });
    }

    // 4. Salva no Banco
    if (data.missions?.length > 0) {
        const { error } = await supabaseAdmin.from('missions').insert(data.missions);
        if (error) throw new Error("Erro Supabase (Missões): " + error.message);
    }

    if (data.shop_items?.length > 0) {
        const { error } = await supabaseAdmin.from('shop_items').insert(data.shop_items);
        if (error) throw new Error("Erro Supabase (Itens): " + error.message);
    }

    return NextResponse.json({ 
        success: true, 
        countMissions: data.missions?.length || 0, 
        countItems: data.shop_items?.length || 0 
    });

  } catch (error) {
    console.error("ERRO GERAL:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}