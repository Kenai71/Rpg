# Vallen RPG — Diretrizes do Projeto

## Arquitetura e Manuais de RPG
- O aplicativo Next.js (App Router) fica em `rpg/`, com camada de dados/transações em `rpg/lib/rpg-service.js`, catálogo de armas e itens em `rpg/lib/dnd-catalog.js`, regras D&D 5.5e/5e em `rpg/lib/dnd-rules.js` e constantes em `rpg/lib/constants.js`.
- **Biblioteca Oficial de Manuais (`rpg/livros/`):** Todos os PDFs de referência são organizados estritamente na pasta `rpg/livros/`:
  1. `Escudo do DM 5.5e 2024.pdf`
  2. `LIVRO DO JOGADOR D&D 5.5e - 2024.pdf`
  3. `LIVRO DO MESTRE (DM) D&D 5.5e - 2024.pdf`
  4. `dd-5e-guia-do-mestre-biblioteca-elfica.pdf`
  5. `dd-5e-livro-do-jogador-fundo-branco-biblioteca-c3a9lfica.pdf`
- Autenticação e persistência usam **Firebase** (`mundo-rpg-b05b4`: Auth com Google + E-mail/Senha e Cloud Firestore).
- Nunca commitar `node_modules/`, `.next/`, `.vercel/` ou arquivos `.env*` (exceto `.env.example`).
- Em rotas serverless (`rpg/app/api/daily-generate/route.js`), definir `maxDuration`, evitar chamadas de ping redundantes e manter `firebase-admin` em `serverComponentsExternalPackages`.

## Design System & UX (Estilo Inspirado em vvd.world)
- **Cores & Temas Desacoplados:**
  - A troca de tema (roxo, verde, azul, vermelho) altera **EXCLUSIVAMENTE O PLANO DE FUNDO** (`--accent-rgb` para os gradientes cósmicos radiais em `.realm-backdrop` e `.vvd-mesh-bg`).
  - O sombreamento dos botões (hover, active, focus e bordas) e abas de navegação deve ser **SEMPRE NEUTRO** (`bg-white/10`, `border-white/15`, `hover:bg-white/15`, foco `ring-white/25`), sem adotar a cor roxa/verde/azul do tema.
  - Ícones de navegação, abas, cabeçalho e estatísticas **NÃO** mudam de cor com o tema e devem permanecer em tom cinza claro/médio neutro (`text-slate-300` / `#cbd5e1`).
- **Cards da Loja do Jogador (`PlayerShop.jsx`):**
  - Todas as bordas externas do card são circuladas/contornadas com a cor da raridade do item (`borderColor: rarityMeta.color`, ex: Épico = roxo `#a78bfa`, Raro = azul `#60a5fa`, Incomum = verde `#4ade80`, Lendário = dourado `#fbbf24`, Mítico = carmesim `#f87171`, Comum = slate `#94a3b8`) com leve brilho ambiente (`boxShadow: 0 0 16px -4px ${rarityMeta.color}33`).
  - No interior do card, não exibir a tag de raridade (`RarityBadge`) nem o badge "Runa OK"/"Runa Disponível", mantendo apenas o badge do tipo do item (`<Badge>{itemTypeLabel}</Badge>`: Arma, Armadura, etc.), nome em branco neutro (`text-white`), descrição limpa, preço e quantidade em estoque.
- **Identidade e Logo:** O logo oficial do Vallen RPG é um **Dado de 20 Lados (D20)** em tons off-white e cinza-prateado (`#ffffff`, `#f1f5f9`, `#cbd5e1`, `#94a3b8`), com facetas isométricas 3D, arestas metálicas nítidas e numeral 20 na face frontal.
- **Cena Visual Interativa 3D (`InteractiveD20Scene`):**
  - Renderiza um D20 tridimensional em Three.js WebGL com geometria icosaédrica pura de arestas e vértices retos, sem esferas ou bolinhas nas pontas.
  - Suporta dinamicamente carregamento de modelos 3D exportados pelo usuário (`/models/d20.glb`, `/models/d20.stl`, `/models/d20.obj`), rotação física 3D sensível ao cursor/arrasto com inércia, anéis orbitais rúnicos e partículas de poeira cósmica em profundidade. O arquivo original CAD `d20.SLDPRT` é preservado em `public/models/`.
- **Roleta de Runas Arcanas (`RouletteModal`):**
  - A roleta exibe apenas o nome da raridade em cada fatia (centralizado verticalmente), sem porcentagens numéricas visíveis na roda.
  - Conta com física de desaceleração suave (curva cúbica), cliques mecânicos por sintetizador procedural Web Audio API, fanfarra arpejada na vitória, vibração háptica (`navigator.vibrate`) e sincronização exata com a transação Firestore (`openGachaGiftTx`).
- **Remoções de Interface:** Não exibir comandos de atalho `Ctrl+K` ou `⌘K` e não exibir o texto "Tempo Real" nos cabeçalhos de visualização do Mestre ou Jogador.
- **Atmosfera e Micro-Grade:** Fundo cósmico com malha de gradientes radiais suaves e micro-grade geométrica de pontos delicados (`0.8px`) com espaçamento aberto e equilibrado (`26px 26px` / `vvd-dot-grid`).
- **Alinhamento do Login:** Na divisão split-screen (desktop landscape), o lado esquerdo acolhe a cena interativa 3D e o lado direito acolhe a coluna de autenticação com o card posicionado levemente deslocado à esquerda da coluna (`md:landscape:ml-8 lg:landscape:ml-12 md:landscape:mr-auto`) para melhor equilíbrio visual.
- **Superfícies e Vidro:** Cartões e botões com acabamento tátil em vidro escurecido (`vvd-glass-card`, `vvd-glass-btn`, `surface-card`), bordas semitransparentes de `1px` (`rgba(255, 255, 255, 0.10)`) e realces especulares superiores (`inset 0 1px 0 rgba(255, 255, 255, 0.08)`).
- **Proibição Estrita:** Nunca utilizar ícones de estrela (`Star`, `Sparkles`, `Sparkle`, `★`, `☆`, `⭐`, `✨`, `🌟`) em nenhuma parte da aplicação. Substituto: `D20Icon`, `Hexagon`, `Gem`, `Zap`, `Flame`, `Shield`, `Sword`, `Compass`.

## Sistema de Regras e Equilíbrio D&D 5.5e (2024 Revision) & D&D 5e
- **Maestria em Armas Oficial 2024 (`Weapon Mastery` em `rpg/lib/dnd-catalog.js`):**
  - `Afligir (Vex)`: Vantagem na próxima jogada de ataque ao acertar e causar dano (Espada Curta, Rapieira, Machadinha, Arco Curto, Dardo, Besta de Mão, Pistola).
  - `Ágil (Nick)`: Ataque com arma Leve adicional faz parte da ação Atacar sem gastar Ação Bônus (Adaga, Cimitarra, Foice, Martelo Leve).
  - `Derrubar (Topple)`: Salvaguarda de Constituição ou condição Caído (Machado de Batalha, Malho, Tridente, Cajado, Lança de Montaria).
  - `Drenar (Sap)`: Desvantagem no próximo ataque do alvo antes do seu próximo turno (Espada Longa, Maça, Lança, Maça Estrela, Mangual, Picareta de Guerra).
  - `Empurrar (Push)`: Empurra criaturas Grandes ou menores em até 3m (Martelo de Guerra, Besta Pesada, Clava Grande, Lança Longa).
  - `Garantido (Graze)`: Causa dano igual ao modificador de atributo mesmo se errar o ataque (Espadão / Espada Grande, Glaive).
  - `Lentidão (Slow)`: Reduz o deslocamento do alvo em 3m até o início do seu próximo turno (Arco Longo, Besta Leve, Chicote, Clava, Azagaia, Funda, Mosquete).
  - `Trespassar (Cleave)`: Ataque adicional contra criatura adjacente a até 1,5m em acerto corpo a corpo (Machado Grande, Alabarda).
- **Escalonamento de Dano e Efeitos por Raridade (`rpg/lib/dnd-rules.js`):**
  - **COMUM:** Dano base de entrada/rebaixado (Adaga 1d4, Espada Curta/Cimitarra 1d4, Espada Longa 1d6, Espadão 1d10, Machado Grande 1d10, Arco Curto 1d4, Arco Longo 1d6). Sem bônus mágico. Preço: 30 a 100 G.
  - **INCOMUM:** Dano oficial de livro (Espada Curta 1d6, Espada Longa 1d8 versátil 1d10, Espadão 2d6, Machado Grande 1d12, Arco Longo 1d8) + bônus de acerto +1 ou Maestria 2024. Preço: 150 a 500 G.
  - **RARO:** Dano ampliado (1d8, 1d10, 2d8) + bônus +1/+2 + Maestria 2024 + **Efeito Bônus Elemental** (+1d4 ou +1d6 de dano de Fogo, Frio, Relâmpago, Necrótico ou Radiante). Preço: 800 a 3.000 G.
  - **ÉPICO:** Dano de alto impacto (1d10, 1d12, 2d10) + bônus +2/+3 + Maestria 2024 + **Efeito de Status no Inimigo** (Sangramento [1d4 de perda por turno], Atordoado em crítico por 1 rodada, Queimadura Contínua, Lentidão [-3m deslocamento], Cegueira temporária). Preço: 4.000 a 15.000 G.
  - **LENDÁRIO:** Dano massivo (2d8, 2d10, 2d12, 3d6) + bônus +3 + **Status Severo + Efeito Lendário** (Corte Dimensional que ignora resistências a dano físico, Crítico com margem 19-20, Petrificação). Preço: 20.000 a 60.000 G.
  - **MÍTICO:** Dano supremo (2d10+4, 3d8, 4d6) + **Passiva Mítica Única** (Roubo de vida de 50% do dano, Ressurreição imediata com 1 PV, Explosão de luz divina). Preço: 75.000 a 200.000 G.
- **Missões Equilibradas por Rank (DMG Cap. 3 & Escudo do DM 2024):**
  - **Rank F:** Tier 1 Inicial (Nível 1) — 100 a 250 XP | 40 a 100 G.
  - **Rank E:** Tier 1 Básico (Níveis 2-3) — 250 a 450 XP | 100 a 200 G.
  - **Rank D:** Tier 1 Avançado (Níveis 4-5) — 500 a 800 XP | 250 a 450 G.
  - **Rank C:** Tier 2 Regional (Níveis 6-8) — 900 a 1.500 XP | 500 a 900 G.
  - **Rank B:** Tier 2 Avançado (Níveis 9-11) — 1.600 a 2.800 XP | 1.000 a 1.800 G.
  - **Rank A:** Tier 3 Continental (Níveis 12-16) — 3.000 a 5.500 XP | 2.000 a 4.000 G.
  - **Rank S:** Tier 4 Multiversal (Níveis 17-20) — 6.000 a 12.000 XP | 5.000 a 10.000 G.
- **Garantia de Aprendizado & Validação Matemática da IA:**
  - O prompt do Gemini (`rpg/app/api/daily-generate/route.js`) instrui expressamente o modelo com base nos livros de 2024 e 5e.
  - Todo conteúdo gerado via Gemini é pós-validado pelas funções matemáticas `enforceItemBalance` e `enforceMissionBalance` de `rpg/lib/dnd-rules.js`, garantindo que fórmulas de dados, maestrias, status, orçamentos de XP e ouro estejam sempre nos intervalos corretos do sistema, sem alucinações.

## Segurança e Firestore Rules
- Manter PII (`email`, `provider`) estritamente isolada em `users_private/{uid}` e nunca armazenar PII em `profiles/{uid}`.
- **Regras Resilientes de Transação:** Evitar travas frágeis de `getAfter(...)` em transações de compra ou troca no cliente, pois falham e causam o erro *"Missing or insufficient permissions"*.
- **Compras Flexíveis na Loja:** A regra de `shop_items` deve permitir a compra de 1 ou mais itens (`request.resource.data.quantity < resource.data.quantity`), sem travar em `quantity == quantity - 1`.
- **Validação de Documentos de Jogo:** Evitar listas estritas e fechadas de chaves (`hasOnlyAllowedFields`) que rejeitem mapas com campos adicionais legítimos de metadados de itens ou tipos dinâmicos.
- Toda alteração em coleções ou transações em `rpg/lib/rpg-service.js` deve permanecer compatível com `rpg/firestore.rules`.

## Ambiente Windows
- Em PowerShell com política de execução restrita para `.ps1`, executar comandos Node via `npm.cmd` e `npx.cmd`.
