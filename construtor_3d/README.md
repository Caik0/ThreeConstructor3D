# Construtor 3D

Editor 3D de módulos de marcenaria/cozinha no navegador — peças, paredes, pisos e vãos, com medidas em fórmulas, texturas por face e um catálogo de módulos reutilizáveis, no espírito do SketchUp. Este é o front-end; ele fala com a API em [`construtor_3d_api`](../construtor_3d_api).

## Stack

- **React 19** + **TypeScript**
- **Vite 8** — dev server e build
- **three.js** — o viewport 3D (edição e miniaturas de módulo)
- **Zustand** — estado global (autenticação, editor, orçamento)
- **TanStack Query** — dados vindos da API (cache, mutações)
- **React Router** — rotas
- **React Hook Form** + **Zod** — formulários e validação
- **Oxlint** — lint

## Estrutura

```
src/
├── components/
│   ├── layout/     — layouts (público, autenticado, dashboard) e o guard de rota
│   ├── three/      — o viewport 3D do editor e as miniaturas de módulo. `ModuloViewport/` guarda o componente (`ModuloViewport.tsx`: criação e sincronização da cena, ferramentas) e, na mesma pasta, os módulos de apoio sem React: `colisao`, `malhas`, `paredes`, `desenhos`, `construtorParedes`, `vistas`, `utilitarios`, `constantes` e `tipos`
│   ├── ui/         — componentes de interface reutilizáveis
│   └── orcamento/  — módulo de orçamento (em construção)
├── lib/
│   ├── api/            — cliente HTTP e as chamadas por domínio (projetos, módulos, texturas...)
│   ├── hooks/           — hooks do TanStack Query por domínio
│   ├── busca/           — busca por texto que ignora maiúsculas e acentos (usada nas listas)
│   ├── formas/          — parâmetros e geometria das formas paramétricas (caixa, cilindro)
│   ├── modelo3d/        — importação e leitura de arquivos .glb
│   ├── projetos/        — tipos e regras de validação da árvore de elementos
│   ├── medidas/         — conversão de unidades (mm ↔ cm) e fórmulas dos campos
│   ├── transformacoes/  — posição/rotação/escala
│   ├── textura/         — conversão e validação de imagens de textura
│   ├── tema/            — tema claro/escuro
│   └── auth/            — sessão e autenticação
├── pages/
│   ├── auth/       — login e cadastro
│   ├── public/     — home, projetos, módulos, sobre, serviços, status
│   ├── dashboard/  — orçamentos, perfil
│   └── editor/     — o editor 3D em si (ProjetoEditor, ModuloEditor)
├── router/         — definição das rotas
└── store/          — stores do Zustand (autenticação, editor, orçamento)
```

## Rodando o projeto

### Com Docker (recomendado)

Este front-end é pensado pra subir junto com a API, pelo `docker-compose.yml` que fica no repositório dela. Os dois repositórios precisam estar lado a lado na mesma pasta:

```
construtorWeb3d/
├── construtor_3d/       (este repositório)
└── construtor_3d_api/
```

Veja o README de [`construtor_3d_api`](../construtor_3d_api) pra subir a stack inteira (`docker compose up -d --build`, rodado de lá). O front sobe em modo dev (com hot reload) e fica acessível em **http://localhost:5173**, atrás de um Nginx que também faz proxy de `/api` pra API.

### Local, sem Docker

Precisa do **Node 22+** e **Yarn**.

```bash
yarn install
yarn dev
```

Por padrão a aplicação chama a API em `/api` (caminho relativo — funciona quando os dois ficam atrás do mesmo Nginx). Rodando o front sozinho contra uma API em outro endereço, aponte pra ela num `.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

> A API não tem CORS configurado hoje — se `VITE_API_BASE_URL` apontar pra um endereço de origem diferente da página (outra porta já conta), o navegador vai bloquear as chamadas. Ver a observação sobre CORS no README de `construtor_3d_api`.

### Outros comandos

```bash
yarn build     # build de produção (tsc + vite build)
yarn preview   # serve o build de produção localmente
yarn lint      # oxlint
```

## Rotas principais

| Rota | Descrição |
| --- | --- |
| `/login`, `/cadastro` | Autenticação |
| `/projetos` | Lista de projetos |
| `/projetos/:id` | Editor de um projeto (tela cheia) |
| `/modulos` | Catálogo de módulos salvos |
| `/modulos/:id` | Editor de um módulo (tela cheia) |
| `/orcamentos` | Orçamentos |
| `/perfil` | Perfil do usuário |

Todas as rotas exigem login, exceto `/login` e `/cadastro`.

## Convenções do domínio

- Medidas são guardadas em milímetros; a interface exibe em centímetros.
- A origem de peças e grupos fica no canto **atrás-inferior-esquerdo** (as paredes têm a origem no meio da espessura). O X cresce para a direita, o Z para cima e o **Y para a frente** (em direção a quem olha). Projetos e módulos salvos antes dessa mudança (`convencaoEixos` 1: origem na frente, Y para trás) são convertidos automaticamente ao abrir, mantendo o mesmo desenho, e passam para a convenção nova no próximo Salvar — ver `src/lib/transformacoes/convencao.ts` e `src/lib/projetos/converterConvencao.ts`.
- Campos numéricos aceitam contas (`60+1,8`) e fórmulas com referências a outros campos do mesmo elemento (`largura/2`) ou ao elemento pai (`Parent!largura/2`).
- Uma peça é uma forma paramétrica (caixa ou cilindro) **ou** um modelo importado (`.glb`), nunca os dois.

## Conceitos do editor

Quase tudo abaixo vive em `src/store/editorStore.ts` (o estado do editor) e `src/components/three/ModuloViewport/` (o 3D).

- **Categoria** (`estrutura`, `ferragem`, `furacao`): só peças e grupos. Serve pra separar o catálogo de módulos por abas e pra filtrar na hora de substituir ou adicionar uma ferragem. Módulos antigos, sem categoria gravada, contam como estrutura.
- **Furos**: não existe um "tipo furo". Um furo é um **cilindro de categoria furação**, criado dentro do elemento selecionado — o passante atravessa o módulo; o de face é posicionado a partir da face escolhida e avança 0,5 mm pra fora dela (senão ficaria escondido dentro da peça). Não há recorte da malha (CSG): o furo é marcado, não escavado.
- **Ferragens**: módulos do catálogo com categoria ferragem; a modal "Nova ferragem" insere uma cópia no elemento selecionado, com posição e rotação definidas antes.
- **Substituir** troca um elemento (e o conteúdo dele) por outro módulo, mantendo pai, ordem, posição e rotação. **Preencher vão** coloca um módulo dentro de um vão de porta ou janela, ajustado à largura e à altura dele; o vão vazio continua sendo o padrão. Um vão preenchido não acompanha mudanças posteriores no tamanho do vão — preencha de novo.
- **Cópia dinâmica**: o elemento com `copias` configurado é o **modelo**; as cópias são irmãs dele, com `copiaDe` (a `referenciaEstavel` do modelo) e `indiceCopia`. A regra manda na **quantidade** e na **posição no eixo** da repetição; o resto (tamanho, medidas, textura) é de cada cópia e pode ser ajustado. As cópias são gravadas como elementos comuns e reconciliadas a **cada alteração** do estado (`regenerarCopias`, chamada pelo envelope de `set` do store): cria as que faltam, reposiciona as existentes, apaga as que sobram. Consequências: apagar uma cópia não é possível (a regra criaria outra), desligar a repetição apaga todas, e mudar o modelo depois não altera as cópias que já existem — o botão "Recriar cópias a partir do modelo" refaz tudo.
- **Seleção múltipla**: mover e girar com o gizmo afetam todos os selecionados (cada um sofre o mesmo movimento do principal; na rotação, giram em torno dele). O conjunto colide como um só contra o que está fora da seleção.
- **Colisão e encaixe**: a colisão usa caixas **orientadas** (giram com o elemento), então uma parede girada fora de ângulos retos colide pela forma real. **Grupos não são sólidos**: quem colide são as peças, paredes e pisos de dentro deles, cada um pela geometria própria — por isso um objeto de fora entra na sala (o grupo de paredes) e bate nas paredes, e entra no vão entre os painéis de um armário. Ligar a colisão num grupo, sozinho, não o torna um bloco; o que decide é a colisão de cada peça. O encaixe magnético (30 mm) ignora elementos girados fora de múltiplos de 90°; um armário reto contra uma parede a 89,26° sempre terá uma cunha de vão — a correção é acertar o ângulo da parede.
- **Enquadrar**: enquadra o elemento selecionado (ou o conjunto, com seleção múltipla); sem seleção, o grupo aberto ou o ambiente. O menu ao lado escolhe a vista (isométrica, topo, base, frente, fundo, esquerda, direita); ele é desenhado num portal no `<body>` porque o viewport é um contexto de empilhamento abaixo dos painéis laterais.
- **Construtor de paredes**: o segundo ponto se marca só por clique; a partir dele o campo **Extensão da última parede** altera o comprimento da parede já marcada, movendo o último ponto na mesma direção.

## Página de ajuda

`/ajuda` (e o botão **?** no topo do editor) explica ferramentas, atalhos e conceitos. O **?** do editor **salva o que estiver pendente**, abre a ajuda na mesma aba e deixa gravado de onde veio (`state.voltarPara`), então o "Voltar" da ajuda leva de volta ao projeto ou módulo; se o salvamento falhar, ele fica no editor. Aberta direto (cabeçalho do site), o voltar é "Início". Ela foi pensada pra **crescer junto com o sistema**:

- O conteúdo é **dado**, em `src/pages/public/Ajuda/conteudo.ts`: pra documentar algo, acrescente uma seção em `SECOES` (ou um bloco numa seção existente). O índice, a busca e os links `/ajuda#id-da-secao` se montam sozinhos. Os tipos de bloco (texto, passos, lista, dica, atalhos…) estão no próprio arquivo.
- **Ferramentas e suas teclas não se escrevem na ajuda**: vêm do registro `src/pages/editor/ProjetoEditor/ferramentas.tsx`, o mesmo que desenha a barra de ferramentas. Uma ferramenta nova só precisa da descrição em `DESCRICAO_DAS_FERRAMENTAS` — o compilador não deixa passar sem ela (o tipo é `Record<Ferramenta, string>`).
- **Atalhos de teclado** são texto em `conteudo.ts` e a tecla de verdade é ligada em `ProjetoEditor.tsx`, `ModuloEditor.tsx` e nos efeitos de Parede e Trena de `ModuloViewport.tsx` (todos têm um comentário apontando pra ajuda). **Regra do time: quem muda um atalho, uma ferramenta ou um botão atualiza a ajuda no mesmo commit.**
- Pra abrir a ajuda numa seção específica a partir de outro lugar, use `<LinkAjuda secao="atalhos" />` (`src/components/ui/LinkAjuda`); `antesDeAbrir` roda antes de sair da tela (o editor salva ali) e devolve `false` pra manter a pessoa onde está.

## Armadilhas conhecidas

- **Limite de contextos WebGL.** O navegador permite uns 16 contextos ao mesmo tempo e, ao passar disso, derruba o mais antigo — que era o do editor (tela branca, aviso `Too many active WebGL contexts` no console). Por isso as miniaturas de módulo **não** têm renderizador próprio: um único renderizador compartilhado gera cada miniatura como imagem, em fila, com cache (`ModuloMiniatura.tsx`). Não crie um `WebGLRenderer` por item de lista.
- **Erro num quadro mata o desenho.** O three.js só agenda o próximo quadro depois de executar o callback do laço de animação; uma exceção congela o canvas. O laço do viewport tem `try/catch` (o erro vai pro console, uma vez por mensagem) e o contexto perdido é tratado com `preventDefault`, pra poder ser restaurado.
- **Contrato com a API.** Os campos do front (`ElementoEntrada`/`Elemento`, em `src/lib/projetos/projetos.ts`) e os DTOs da API precisam ter o mesmo nome em camelCase — a API ignora o que não conhece, sem erro. Ver "Solução de problemas" no README da API.

## Depuração

- **Navegador:** a aba *Sources* abre qualquer arquivo de `src/` (o Vite serve sourcemaps) e aceita breakpoints; marque "Pause on caught exceptions" pra parar em erros que o código engole. A aba *Network* mostra o corpo de cada requisição e resposta — o jeito mais rápido de ver o que o front realmente manda e o que a API devolve.
- **Estado do editor:** tudo está no store do Zustand (`useEditorStore`, em `src/store/editorStore.ts`), com `elementos`, `filhos`, `selecionada` e `contexto`. Ele **não** é exposto no `window`: pra inspecionar, pare num breakpoint dentro de um arquivo que importe o store (aba *Sources*) e avalie `useEditorStore.getState()` no console, ou coloque um `console.log(useEditorStore.getState())` temporário.
- **WebGL:** a extensão *Spector.js* lista os contextos e as chamadas de desenho.
- **Celular:** o console do aparelho aparece no computador por `chrome://inspect`, com o celular ligado por cabo USB e a depuração USB ativada.
- **Back-end:** `docker logs -f construtor-3d-api` e o Swagger (ver o README da API).
