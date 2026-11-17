# Astralis RPG — Diretrizes do Projeto

## Arquitetura e Manuais de RPG
- O aplicativo Next.js (App Router) fica em `rpg/`, com camada de dados/transações em `rpg/lib/rpg-service.js`, catálogo de armas e itens em `rpg/lib/dnd-catalog.js`, regras D&D 5.5e/5e em `rpg/lib/dnd-rules.js` e presets de mapas em `rpg/lib/map-presets.js`.
- **Biblioteca Oficial de Manuais (`rpg/livros/`):** Todos os PDFs de referência são organizados estritamente na pasta `rpg/livros/`:
  1. `Escudo do DM 5.5e 2024.pdf`
  2. `LIVRO DO JOGADOR D&D 5.5e - 2024.pdf`
  3. `LIVRO DO MESTRE (DM) D&D 5.5e - 2024.pdf`
  4. `dd-5e-guia-do-mestre-biblioteca-elfica.pdf`
  5. `dd-5e-livro-do-jogador-fundo-branco-biblioteca-c3a9lfica.pdf`
- Autenticação e persistência usam **Firebase** (`mundo-rpg-b05b4`: Auth com Google + E-mail/Senha e Cloud Firestore).
- Nunca commitar `node_modules/`, `.next/`, `.vercel/` ou arquivos `.env*` (exceto `.env.example`).
- Em rotas serverless (`rpg/app/api/daily-generate/route.js`), definir `maxDuration`, evitar chamadas de ping redundantes e manter `firebase-admin` em `serverComponentsExternalPackages`.

## Sistema de Mapas Táticos e Mesa Virtual (VTT)
- **Mesa & Mapas para Mestrar (`MasterMapManager.jsx`, `PlayerMapView.jsx` & `TacticalMapCanvas.jsx`):**
  - **Upload de Imagens em Alta Fidelidade (Sem Bordas Cortadas):** O Mestre pode subir qualquer imagem de mapa (PNG, JPG, WebP). O compressor client-side preserva proporção original até 1920px (qualidade 0.85) sob 820KB para o Firestore. O canvas tático calcula o aspecto natural da imagem e aplica `object-contain` em dimensões dinâmicas, garantindo exibição de 100% do mapa sem qualquer corte de bordas.
  - **Zoom com Scroll do Mouse sem Rolar a Página:** Listener nativo com `{ passive: false }` e `e.preventDefault()` no canvas do mapa. O scroll do mouse dentro da área tática aumenta ou diminui o zoom suavemente (35% a 350%) sem deslocar o scroll vertical da página, funcionando perfeitamente tanto para o Mestre quanto para o Jogador.
  - **Interface do Jogador Focada e Imersiva:** Removida a barra superior redundante da tela do jogador (`PlayerMapView.jsx`), permitindo que a mesa tática ocupe a visão limpa e imersiva do cenário.
  - **Ajuste Instantâneo à Tela (Fit View):** Botão `Maximize2` na barra de ferramentas enquadra o mapa inteiro no viewport com um clique.
  - **Barra de Ferramentas Minimalista (Apenas Ícones):** A barra superior não exibe textos redundantes ("Mover", "Régua", "Sinalizar", "Fixado", "Livre"), apresentando exclusivamente ícones limpos (`Move`, `Ruler`, `Crosshair`, `Lock`/`Unlock`, `Grid`, `Maximize2`, `Shield`, `Dices`) com tooltips explicativos e contador de cargas.
  - **Transição e Alternância de Mapas:** Seletor em carrossel horizontal com navegação por setas (`ChevronLeft`/`ChevronRight`), miniaturas, títulos, contador de tokens e status. O Mestre pode inspecionar qualquer mapa em privado antes de publicá-lo.
  - **Ativação Instantânea:** Botão "Ativar p/ Jogadores" promove o mapa a `is_active: true`, sincronizando a visão de todos os jogadores em tempo real.
  - **Exclusão Segura de Mapas:** Botão de exclusão (`Trash2`) com confirmação. Executa `deleteMapWithTokens(mapId)` que remove o mapa e todos os seus tokens em lote atômico no Firestore, promovendo outro mapa a principal caso o ativo tenha sido excluído.
  - **Fixação e Escala:** Trava de mapa (`is_locked: true`) impede arrasto acidental do cenário durante a movimentação dos tokens. Suporte a grade quadrada tática (5ft / 1.5m) ou sem grade.
- **Bonequinhos / Tokens de Personagens & Monstros:**
  - **Permissões de Movimentação Rigorosas:**
    * Jogadores só movem seu próprio bonequinho (`token.owner_id === auth.uid`).
    * Mestre move todos os bonequinhos (heróis, monstros e NPCs) livremente.
  - **Redimensionamento:** Mestre pode alterar tokens entre P (32px), M (44px), G (68px), GG (96px) e Colossal (128px). O texto de tamanho do token é omitido da visão do jogador para manter a modal limpa.
  - **Sincronização em Tempo Real & Edição de Máximos:** Modal tática reativa baseada em `selectedTokenId`, sincronizando instantaneamente com Firestore. O Mestre pode editar a Vida Atual (`hp`), Vida Máxima (`max_hp`), Mana Atual (`mana`), Mana Máxima (`max_mana`), Classe de Armadura (`ac`) e Iniciativa em tempo real com inputs diretos e botões rápidos (+1, -1, +5, -5, Total).
  - **Badges com Ícones de Efeitos de Status (Mestre & Jogador):** Cada condição D&D exibe um ícone oficial (`Droplet` para Sangramento, `Flame` para Queimadura, `Skull` para Veneno, `Zap` para Atordoado, `ArrowDown` para Caído, `Footprints` para Lentidão, `EyeOff` para Cegueira, `Ghost` para Amaldiçoado, `ShieldAlert` para Abençoado, `Eye` para Invisível).
    * Mini badges flutuam sobre o token no mapa com micro-escala ao passar o mouse (`hover:scale-105`).
    * Jogadores visualizam na modal todos os seus efeitos de status ativos com ícones e descrições claras, ou indicador de "Condição Normal".
    * Mestres contam com alternadores rápidos para aplicar ou retirar condições de qualquer entidade.
  - **Régua de Distância Tática:** Medição instantânea de distância em metros e pés conectando dois pontos na grade.
  - **Sinalizador Radar (Ping) com Rate Limit e Desduplicação:**
    * Limite estrito de 3 sinalizações a cada 15 segundos (não cumulativo, recarrega para 3 ao passar 15s).
    * Duração máxima de 5 segundos no mapa com contagem regressiva e fade out suave.
    * Desduplicação espacial (< 3%) e temporal (< 4.5s) elimina completamente ondas duplicadas no mapa.
  - **Rolador Rápido de Dados Integrado:** HUD flutuante para rolagem imediata de d4, d6, d8, d10, d12 e d20 com detecção de críticos e vibração háptica.
  - **Rolagem de Dados 3D na Mesa em Tempo Real (`TacticalDice3D.jsx`, `dice-audio.js` & `map_rolls`):**
    * **Modelos Poliedrais 3D Oficiais (Three.js WebGL):** Geometrias precisas e texturizadas com CanvasTexture 256x256 para d4 (Tetrahedron), d6 (Box), d8 (Octahedron), d10 (Trapezoedro Pentagonal customizado), d12 (Dodecahedron) e d20 (Icosahedron).
    * **Probabilidade Matemática e Faces 1:1:** Distribuição uniforme rigorosa (`Math.floor(Math.random() * sides) + 1`). Alinhamento por quaternions e interpolação esférica (SLERP) garantindo que a face correspondente ao resultado sorteado pouse voltada para cima em direção à câmera.
    * **Física de Queda e Rolagem Fluida:** Animação de gravidade com amortecimento de quiques (bounce damping), dispersão aleatória de rotação e ondas de impacto visual no plano do mapa.
    * **Efeitos Sonoros Procedurais (Web Audio API):**
      - Síntese nativa em tempo real com osciladores e filtros, sem arquivos de áudio externos ou risco de 404.
      - Impactos percussivos de madeira/resina nos quiques.
      - Som agradável de sucesso (arpejo pentatônico C5-E5-G5-B5-C6) em resultados máximos (20 no d20, 12 no d12, 10 no d10, 8 no d8, 6 no d6 e 4 no d4).
      - Som dramático de falha crítica (trítono dissonante Eb3 -> C3 -> Gb2 com filtro passa-baixa) para resultado 1 no d20.
    * **Sincronização em Tempo Real Multiusuário:** Coleção `map_rolls` no Firestore com regras autenticadas. Disparo instantâneo e compartilhado entre Mestre e Jogadores, com banner translúcido contendo o nome de quem rolou, cargo (Mestre/Jogador), tipo de dado e resultado destacado.
  - **Invisibilidade / Névoa:** Tokens de monstros podem ser ocultados dos jogadores até o momento do combate.
  - **Precisão Matemática de 100% nos Tokens (`TacticalMapCanvas.jsx` & `rpg-service.js`):**
    * **Coordenadas Sub-pixel e 4 Casas Decimais:** Precisão de 4 casas decimais (`0.0001%`), eliminando truncamentos numéricos que causavam pequenos saltos de pixels ao soltar o token no mapa.
    * **Limites Naturais da Imagem (0% a 100%):** Removido o clamping artificial de 1%-99%, permitindo posicionamento exato de 0% a 100% em qualquer borda ou canto do mapa. Correção do bug de zero falso (`x = 0`) na criação e movimentação de tokens no Firestore.
    * **Âncora Geométrica Perfeita (Desacoplamento de Labels):** A div externa do token possui dimensão estrita `tokenPx` x `tokenPx` com `-translate-x-1/2 -translate-y-1/2`. As barras de vida e nomes de jogadores/monstros foram desacopladas para `absolute top-full`, impedindo qualquer deslocamento vertical decorrente da altura de fontes ou textos entre diferentes navegadores.
    * **Arraste Fluido com Grab Offset:** O cursor rastreia o deslocamento do clique inicial em relação ao centro geométrico do token, eliminando qualquer salto ou deslocamento abrupto no início do movimento.
    * **Alinhamento e Aspect Ratio sem Letterboxing:** O canvas calcula e aplica as dimensões proporcionais da imagem (`object-fill` na textura interna), garantindo paridade matemática 1:1 absoluta das posições entre todas as telas, viewports e níveis de zoom de Mestres e Jogadores.

## Design System & UX (Estilo Inspirado em vvd.world)
- **Padronização Universal de Inputs & Textareas:**
  - Todos os campos de digitação (`input`, `textarea`, `select`) e barras de pesquisa utilizam fundo escuro profundo (`#0c101b`), borda semitransparente neutra (`border-white/15`) e texto branco (`#ffffff`), com placeholder em tom cinza claro (`text-slate-400`).
  - É proibido qualquer estilo que resulte em campos de texto com fundo branco e caracteres invisíveis. O preenchimento automático do navegador (`-webkit-autofill`) é neutralizado com sombreamento escuro e texto branco permanente.
- **Cores & Temas Desacoplados:**
  - A troca de tema (roxo, verde, azul, vermelho) altera **EXCLUSIVAMENTE O PLANO DE FUNDO** (`--accent-rgb` para os gradientes cósmicos radiais em `.realm-backdrop` e `.vvd-mesh-bg`).
  - O sombreamento dos botões (hover, active, focus e bordas) e abas de navegação deve ser **SEMPRE NEUTRO** (`bg-white/10`, `border-white/15`, `hover:bg-white/15`, foco `ring-white/25`), sem adotar a cor roxa/verde/azul do tema.
  - Ícones de navegação, abas, cabeçalho e estatísticas **NÃO** mudam de cor com o tema e devem permanecer em tom cinza claro/médio neutro (`text-slate-300` / `#cbd5e1`).
- **Cards da Loja do Jogador (`PlayerShop.jsx`):**
  - Todas as bordas externas do card são circuladas/contornadas com a cor da raridade do item (Épico = roxo, Raro = azul, Incomum = verde, Lendário = dourado, Mítico = carmesim, Comum = slate) com leve brilho ambiente.
  - No interior do card, não exibir a tag de raridade (`RarityBadge`) nem o badge "Runa OK"/"Runa Disponível", mantendo apenas o badge do tipo do item (`<Badge>{itemTypeLabel}</Badge>`: Arma, Armadura, etc.), nome em branco neutro (`text-white`), descrição limpa, preço e quantidade em estoque.
- **Identidade e Logo:** O logo oficial do Astralis RPG é um **Dado de 20 Lados (D20)** em tons off-white e cinza-prateado (`#ffffff`, `#f1f5f9`, `#cbd5e1`, `#94a3b8`), com facetas isométricas 3D, arestas metálicas nítidas e numeral 20 na face frontal.
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
  - A rota utiliza contingência sequencial de modelos ativos de alta capacidade (`gemini-3.5-flash-lite` -> `gemini-3-flash-preview` -> `gemini-2.5-flash` -> `gemini-3.5-flash`), contornando limites de cota da camada gratuita (Free Tier).
  - Todo conteúdo gerado via Gemini é pós-validado pelas funções matemáticas `enforceItemBalance` e `enforceMissionBalance` de `rpg/lib/dnd-rules.js`, garantindo que fórmulas de dados, maestrias, status, orçamentos de XP e ouro estejam sempre nos intervalos corretos do sistema, sem alucinações.

## Segurança e Firestore Rules
- Manter PII (`email`, `provider`) estritamente isolada em `users_private/{uid}` e nunca armazenar PII em `profiles/{uid}`.
- **Regras Resilientes de Transação:** Evitar travas frágeis de `getAfter(...)` em transações de compra ou troca no cliente, pois falham e causam o erro *"Missing or insufficient permissions"*.
- **Compras Flexíveis na Loja:** A regra de `shop_items` deve permitir a compra de 1 ou mais itens (`request.resource.data.quantity < resource.data.quantity`), sem travar em `quantity == quantity - 1`.
- **Validação de Documentos de Jogo:** Evitar listas estritas e fechadas de chaves (`hasOnlyAllowedFields`) que rejeitem mapas com campos adicionais legítimos de metadados de itens ou tipos dinâmicos.
- Toda alteração em coleções ou transações em `rpg/lib/rpg-service.js` deve permanecer compatível com `rpg/firestore.rules`.
