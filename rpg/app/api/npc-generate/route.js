import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import {
  checkRateLimit,
  getClientIp,
  rateLimitErrorResponse,
  readSafeJsonBody,
  sanitizePromptInput,
  verifyApiBearerAuth,
} from '../../../lib/api-security';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODELS_TO_TRY = [
  { name: 'gemini-3.5-flash-lite', thinkingBudget: undefined },
  { name: 'gemini-3-flash-preview', thinkingBudget: undefined },
  { name: 'gemini-2.5-flash', thinkingBudget: 0 },
  { name: 'gemini-3.5-flash', thinkingBudget: undefined },
];

const ATTITUDE_COLORS = {
  Aliado: '#34d399',
  Neutro: '#38bdf8',
  Misterioso: '#a78bfa',
  Hostil: '#fb7185',
};

const FALLBACK_NPCS = [
  {
    name: 'Mestre Bramir Pedraforte',
    profession: 'Ferreiro de Runas',
    race: 'Anão da Colina',
    attitude: 'Aliado',
    appearance: 'Barba grisalha trançada com argolas de latão, antebraços marcados por fagulhas antigas e avental de couro queimado.',
    personality: 'Fala pouco, testa a paciência dos aventureiros com humor seco, mas cumpre cada palavra jurada na bigorna.',
    story_hook: 'Recebeu uma encomenda anônima de algemas de ferro frio há três noites e suspeita que algo sombrio está prestes a acontecer na região.',
    secret: 'Guardou uma chave rúnica escondida dentro do cabo de um martelo velho a pedido de um antigo amigo desaparecido.',
    description: 'Veterano das forjas fronteiriças, Bramir conhece o aço de cada guarda, mercenário e contrabandista que passa pela região.',
    hp: 32,
    max_hp: 32,
    ac: 14,
    mana: 0,
    max_mana: 0,
    speed: 9,
    avatar_color: '#34d399',
  },
  {
    name: 'Lyra Vespera',
    profession: 'Cartógrafa e Informante',
    race: 'Meio-Elfa',
    attitude: 'Misterioso',
    appearance: 'Olhos cor de âmbar, capa azul-petróleo manchada de tinta nanquim e um estojo de tubos de mapa cruzando o peito.',
    personality: 'Observadora, fala com calma calculada e sempre responde uma pergunta com outra que revela o que ela realmente quer saber.',
    story_hook: 'Possui o único rascunho conhecido de uma passagem subterrânea ligada ao local atual da campanha e aceita trocá-lo por um favor.',
    secret: 'Trabalha secretamente para uma rede de arquivistas que vigia relíquias antigas antes que caiam nas mãos de cultistas.',
    description: 'Viajante incansável que mapeia ruínas esquecidas e vende rotas seguras — ou perigosamente lucrativas — para quem sabe pagar.',
    hp: 24,
    max_hp: 24,
    ac: 13,
    mana: 12,
    max_mana: 12,
    speed: 9,
    avatar_color: '#a78bfa',
  },
  {
    name: 'Irmão Cassian de Alvorada',
    profession: 'Herbalista e Curandeiro',
    race: 'Humano',
    attitude: 'Aliado',
    appearance: 'Túnica simples de linho cinza, dedos manchados de ervas esmagadas e um colar gasto com um pequeno almofariz de prata.',
    personality: 'Compassivo e atento aos detalhes, mas profundamente preocupado com os sinais recentes que vem tratando nos viajantes.',
    story_hook: 'Está cuidando de um sobrevivente febril que murmurou o nome de uma antiga ameaça diretamente ligada à história do grupo.',
    secret: 'No passado serviu como médico de campo de uma companhia mercenária infame e teme ser reconhecido por antigos aliados.',
    description: 'Mantém uma pequena botica onde acolhe feridos sem perguntar bandeiras, conhecendo venenos, maldições e boatos locais.',
    hp: 22,
    max_hp: 22,
    ac: 12,
    mana: 18,
    max_mana: 18,
    speed: 9,
    avatar_color: '#34d399',
  },
  {
    name: 'Vornak Olho-de-Cinza',
    profession: 'Mercador de Relíquias',
    race: 'Tiefling',
    attitude: 'Neutro',
    appearance: 'Chifres curtos polidos com anéis de cobre, sorriso afiado e casaco escuro cheio de bolsos costurados por dentro.',
    personality: 'Charmoso, dramático nas negociações e obcecado por objetos com histórias improváveis.',
    story_hook: 'Acabou de comprar um artefato estranho que parece pulsar perto dos heróis e quer descobrir seu valor real antes de revendê-lo.',
    secret: 'Está devendo uma soma perigosa a um sindicato local e pode trair um segredo se ficar acuado.',
    description: 'Comerciante itinerante capaz de encontrar quase qualquer item raro — pelo preço certo em ouro ou em informações.',
    hp: 26,
    max_hp: 26,
    ac: 13,
    mana: 8,
    max_mana: 8,
    speed: 9,
    avatar_color: '#38bdf8',
  },
];

function parseModelJson(rawText) {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

function normalizeNpcOutput(raw, fallbackContext = {}) {
  const validAttitudes = ['Aliado', 'Neutro', 'Misterioso', 'Hostil'];
  const attitude = validAttitudes.includes(raw?.attitude)
    ? raw.attitude
    : validAttitudes.includes(fallbackContext.attitude)
    ? fallbackContext.attitude
    : 'Neutro';

  const maxHp = Math.max(4, Math.min(500, Math.round(Number(raw?.max_hp ?? raw?.hp) || 22)));
  const hp = Math.max(1, Math.min(maxHp, Math.round(Number(raw?.hp) || maxHp)));
  const ac = Math.max(8, Math.min(25, Math.round(Number(raw?.ac) || 12)));
  const maxMana = Math.max(0, Math.min(200, Math.round(Number(raw?.max_mana ?? raw?.mana) || 0)));
  const mana = Math.max(0, Math.min(maxMana, Math.round(Number(raw?.mana) || maxMana)));
  const speed = Math.max(3, Math.min(30, Math.round((Number(raw?.speed) || 9) * 10) / 10));

  return {
    name: String(raw?.name || 'Viajante Sem Nome').trim().slice(0, 100),
    profession: String(raw?.profession || fallbackContext.profession || 'Aventureiro Local').trim().slice(0, 120),
    race: String(raw?.race || fallbackContext.race || 'Humano').trim().slice(0, 80),
    attitude,
    appearance: String(raw?.appearance || '').trim().slice(0, 1200),
    personality: String(raw?.personality || '').trim().slice(0, 1200),
    story_hook: String(raw?.story_hook || '').trim().slice(0, 1600),
    secret: String(raw?.secret || '').trim().slice(0, 1600),
    description: String(raw?.description || '').trim().slice(0, 3000),
    hp,
    max_hp: maxHp,
    ac,
    mana,
    max_mana: maxMana,
    speed,
    avatar_color: ATTITUDE_COLORS[attitude] || '#38bdf8',
  };
}

function buildFallbackNpc({ storyContext, profession, attitude, race, existingNpcNames = [] }) {
  const used = new Set(existingNpcNames.map((n) => String(n || '').toLowerCase()));
  const pool = FALLBACK_NPCS.filter((n) => !used.has(n.name.toLowerCase()));
  const base = pool[Math.floor(Math.random() * pool.length)] || FALLBACK_NPCS[Math.floor(Math.random() * FALLBACK_NPCS.length)];

  const cleanContext = String(storyContext || '').trim();
  return normalizeNpcOutput(
    {
      ...base,
      profession: profession?.trim() || base.profession,
      race: race?.trim() || base.race,
      attitude: attitude || base.attitude,
      story_hook: cleanContext
        ? `Ligado diretamente a "${cleanContext.slice(0, 180)}": ${base.story_hook}`
        : base.story_hook,
      description: cleanContext
        ? `${base.description} Atualmente envolvido nos eventos de ${cleanContext.slice(0, 180)}.`
        : base.description,
    },
    { profession, attitude, race }
  );
}

export async function POST(request) {
  const ip = getClientIp(request);
  const ipRl = checkRateLimit(`npc:ip:${ip}`, { limit: 30, windowMs: 5 * 60_000 });
  if (!ipRl.allowed) return rateLimitErrorResponse(ipRl);

  const authHeader = request.headers.get('authorization');
  const verified = await verifyApiBearerAuth(authHeader);
  if (!verified) {
    return NextResponse.json(
      { success: false, error: 'Autenticação necessária para gerar NPC.' },
      { status: 401 }
    );
  }
  if (!verified.isMaster) {
    return NextResponse.json(
      { success: false, error: 'Apenas o Mestre pode gerar NPCs.' },
      { status: 403 }
    );
  }

  const uidRl = checkRateLimit(`npc:uid:${verified.uid}`, { limit: 20, windowMs: 5 * 60_000 });
  if (!uidRl.allowed) return rateLimitErrorResponse(uidRl);

  const parsedBody = await readSafeJsonBody(request, 24 * 1024);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { success: false, error: parsedBody.error },
      { status: parsedBody.status }
    );
  }
  const body = parsedBody.data;

  const storyContext = sanitizePromptInput(body?.storyContext, 1000);
  const profession = sanitizePromptInput(body?.profession, 100);
  const attitude = sanitizePromptInput(body?.attitude, 40);
  const race = sanitizePromptInput(body?.race, 60);
  const activeMapTitle = sanitizePromptInput(body?.activeMapTitle, 120);
  const missionHints = Array.isArray(body?.missionHints)
    ? body.missionHints.slice(0, 8).map((m) => sanitizePromptInput(m, 100)).filter(Boolean)
    : [];
  const existingNpcNames = Array.isArray(body?.existingNpcNames)
    ? body.existingNpcNames.slice(0, 30).map((n) => sanitizePromptInput(n, 80)).filter(Boolean)
    : [];

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    const fallback = buildFallbackNpc({ storyContext, profession, attitude, race, existingNpcNames });
    return NextResponse.json({ success: true, npc: fallback, source: 'fallback' });
  }

  const prompt = `Você é um Mestre especialista em D&D 5.5e (2024) criando um NPC memorável e 100% conectado à história atual da campanha.
Responda EXCLUSIVAMENTE com um JSON válido em português do Brasil (sem markdown, sem comentários fora do JSON).

CONTEXTO DA HISTÓRIA INFORMADO PELO MESTRE:
${storyContext || 'Uma aventura de fantasia medieval em andamento na guilda de Vallen.'}

INFORMAÇÕES ADICIONAIS DA MESA:
- Mapa atual: ${activeMapTitle || 'Não informado'}
- Missões recentes na campanha: ${missionHints.length > 0 ? missionHints.join(' | ') : 'Nenhuma informada'}
- Profissão desejada (se vazia, invente uma coerente com a história): ${profession || 'Livre — escolha a mais coerente'}
- Atitude/Papel desejado (Aliado | Neutro | Misterioso | Hostil): ${attitude || 'Escolha a mais interessante para a cena'}
- Raça/Ancestralidade desejada (se vazia, escolha uma de D&D 5.5e): ${race || 'Livre (Humano, Elfo, Anão, Tiefling, Meio-Orc, Gnomo, Draconato, Halfling, etc.)'}
- Nomes de NPCs já existentes (NUNCA repita): ${existingNpcNames.length > 0 ? existingNpcNames.join(', ') : 'Nenhum'}

RETORNE EXATAMENTE ESTA ESTRUTURA JSON:
{
  "name": "Nome completo marcante do NPC",
  "profession": "Profissão clara e curta (ex: Ferreiro, Taverneira, Alquimista, Capitão da Guarda)",
  "race": "Raça/Ancestralidade",
  "attitude": "Aliado" | "Neutro" | "Misterioso" | "Hostil",
  "appearance": "Descrição visual vívida de 2 frases (roupas, marcas, trejeito marcante)",
  "personality": "Como o NPC fala, age, o que valoriza ou teme (2 frases)",
  "story_hook": "Como exatamente esse NPC se conecta à história/cena informada e o que ele sabe ou oferece aos jogadores (2-3 frases)",
  "secret": "Um segredo exclusivo para o Mestre que pode gerar reviravolta (1-2 frases)",
  "description": "Resumo narrativo completo de apresentação quando os jogadores encontram este NPC (2-3 frases)",
  "hp": número inteiro realista para combate D&D (ex: 11 a 65),
  "max_hp": mesmo número inteiro do hp,
  "ac": número inteiro realista de Classe de Armadura (ex: 10 a 17),
  "mana": número inteiro (0 se não conjurador, ou 6 a 30 se conjurador),
  "max_mana": mesmo número inteiro da mana,
  "speed": 9
}`;

  const genAI = new GoogleGenerativeAI(apiKey);
  for (const modelCfg of MODELS_TO_TRY) {
    try {
      const generationConfig = {
        temperature: 0.92,
        responseMimeType: 'application/json',
      };
      if (modelCfg.thinkingBudget !== undefined) {
        generationConfig.thinkingConfig = { thinkingBudget: modelCfg.thinkingBudget };
      }

      const model = genAI.getGenerativeModel({
        model: modelCfg.name,
        generationConfig,
      });

      const result = await model.generateContent(prompt);
      const text = result?.response?.text?.();
      if (!text) continue;

      const parsed = parseModelJson(text);
      const npc = normalizeNpcOutput(parsed, { profession, attitude, race });
      return NextResponse.json({
        success: true,
        npc,
        model: modelCfg.name,
        source: 'ai',
      });
    } catch {
      continue;
    }
  }

  const fallback = buildFallbackNpc({ storyContext, profession, attitude, race, existingNpcNames });
  return NextResponse.json({ success: true, npc: fallback, source: 'fallback' });
}
