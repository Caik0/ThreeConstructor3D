# Construtor 3D

Editor 3D de módulos de marcenaria/cozinha no navegador — peças, paredes, pisos e vãos, com medidas em fórmulas, texturas por face e um catálogo de módulos reutilizáveis, no espírito do SketchUp.

Este repositório reúne os dois projetos que compõem a aplicação, lado a lado:

```
construtorWeb3d/
├── construtor_3d/       — front-end (React 19 + three.js)
└── construtor_3d_api/   — API (.NET 10 + EF Core + SQL Server)
```

- **[`construtor_3d`](construtor_3d)** — o editor em si: viewport 3D, árvore de elementos, painel de propriedades, importação de `.glb`, pintura de texturas, etc. Fala com a API por HTTP.
- **[`construtor_3d_api`](construtor_3d_api)** — guarda os projetos, o catálogo de módulos reutilizáveis, o catálogo de texturas e os usuários de cada conta. Orquestra, via Docker Compose, a si mesma, o front-end, o SQL Server, o Redis (provisionado, ainda sem uso) e um Nginx na frente dos dois.

Cada um tem seu próprio README com detalhes de stack, estrutura de pastas e comandos — este arquivo é só o mapa de como as duas peças se encaixam.

## Visão geral da arquitetura

```
Navegador → Nginx (porta 5173) ─┬─→ front-end (Vite dev server, HMR)
                                 └─→ /api → API (.NET, porta 5000) → SQL Server
```

O Nginx é quem o navegador acessa; ele serve o front-end e faz proxy de `/api` pra API, então os dois parecem a mesma origem (evita configurar CORS). Em desenvolvimento o front roda com hot reload (o container monta o código como volume); a API, não — uma mudança nela precisa de rebuild da imagem (ver "Rodando com Docker" abaixo).

## Principais funcionalidades

- **Editor 3D** no estilo SketchUp: desenhar paredes, criar peças por forma paramétrica (caixa, cilindro) ou importar `.glb`, agrupar/duplicar/mover, trena, balde de tinta.
- **Fórmulas e variáveis** por campo, por elemento e por face, com referência ao elemento pai (`Parent!campo`).
- **Grupos de face**: reúne faces de diferentes peças de um grupo pra pintar tudo de uma vez.
- **Catálogo de módulos**: salva uma peça/grupo à parte pra reaproveitar em outros projetos, com importação automática de `.glb` soltos numa pasta do servidor. A tela de módulos (e os diálogos de importar) têm **busca por nome** e abas por **categoria**; a tela de projetos também tem busca.
- **Grupos e classificações** dos módulos: cada módulo pertence a um grupo e a uma classificação (obrigatórios), cadastrados por empresa em `/admin/grupos` e `/admin/classificacoes` (duas telas, cada uma com abas Módulos e Componentes), com filtros na tela de módulos. Os componentes terão grupos e classificações próprios, separados dos de módulos.
- **Categorias** de peça/grupo — estrutura, ferragem e furação —, pra separar o que é chapa do que é dobradiça, puxador ou furo. Os módulos salvos herdam a categoria.
- **Furos e ferragens**: o botão **+ Furo** cria um furo passante (que atravessa o módulo) ou um furo numa face, e **+ Ferragem** insere uma ferragem do catálogo no elemento selecionado, com posição e rotação definidas antes de criar.
- **Substituir e preencher**: um elemento pode ser trocado por outro módulo da mesma categoria do catálogo (mantendo lugar, rotação, medidas, colisão, visibilidade e regra de repetição), e um vão de porta ou janela pode ser **preenchido** com um módulo (ou ficar vazio).
- **Cópia dinâmica**: um elemento (dobradiça, prateleira…) pode se repetir ao longo de um eixo conforme o tamanho do pai — por quantidade fixa ou por espaçamento —; cada cópia criada continua editável individualmente.
- **Seleção múltipla** (Ctrl+clique): mover, girar e excluir afetam todos os selecionados juntos, que colidem como um conjunto contra o resto.
- **Onde inserir**: ao criar um elemento (nova caixa/grupo), duplicar ou inserir um módulo, ele vira um fantasma translúcido que segue o cursor (no chão, em cima de outro módulo ou encostado numa parede) e o clique o fixa; Esc cancela. No celular, toca-se no lugar desejado.
- **Colagem**: o elemento pode ser configurado (junto dos eixos) para se grudar em superfícies horizontais, verticais, inclinadas ou quaisquer: ao ser aproximado de uma parede, de outro módulo ou do chão, ele gira para a base dele encostar, como no SketchUp.
- **Espelhos**: uma textura de categoria espelho reflete a cena de verdade, em peças e em modelos `.glb` importados. As texturas têm categoria (madeira, espelho, metálica…) para filtrar.
- **Configurações por usuário** (`/configuracoes`): teclas de atalho, botões do mouse (orbitar, pan…), passos de movimento/rotação, encaixe e unidade padrão (mm, cm ou m); ficam na conta, na API.
- **Unidade de exibição** (mm/cm/m) por projeto ou módulo: só máscara da interface — banco e contas seguem em mm/cm.
- **Grade do ambiente** liga/desliga por botão na barra de ferramentas.
- **Enquadrar** a câmera no elemento selecionado (ou no ambiente, sem seleção) em várias vistas: isométrica, topo, base, frente, fundo, esquerda e direita.
- **Construtor de paredes**: o segundo ponto se marca por clique; a partir dele a extensão da última parede passa a ser digitada. A "posição de construção" (centro, direita, esquerda) diz para que lado a espessura cresce, como no SketchUp; contorno aberto também ganha piso.
- **Página de ajuda** (`/ajuda`, também pelo botão **?** do editor): ferramentas, atalhos de teclado e mouse, fórmulas, módulos e o layout de celular/tablet, com busca. Ela cresce junto com o sistema — ver "Página de ajuda" no README do front.
- **Empresas**: toda conta pertence a uma empresa, que é a fronteira dos dados (usuários, módulos, texturas, projetos) e tem idioma e unidade padrão. O super admin da plataforma cadastra e bloqueia empresas (`/api/empresas`); não existe cadastro público. O super admin também pode **trocar para o ambiente de qualquer empresa** (seletor no menu lateral) (projetos de todos os usuários, módulos, usuários e configurações dela); o admin de uma empresa cria usuários e outros admins e ajusta as permissões de cada um.
- **Permissões por usuário**: cada ferramenta do editor pode ser liberada individualmente por conta, administrado pela tela `/admin/usuarios`, onde também ficam o cadastro pessoal e o bloqueio de cada usuário (ver a seção "Permissões de usuário" no README da API).

## Rodando o projeto

Pré-requisito: os dois repositórios clonados lado a lado, exatamente na estrutura mostrada acima — o `docker-compose.yml` (dentro de `construtor_3d_api`) builda o front a partir de `../construtor_3d`.

```bash
cd construtor_3d_api
# crie um .env aqui (DB_DATABASE, DB_USERNAME, DB_PASSWORD, REDIS_HOST, REDIS_PORT —
# ver o README da API pra um exemplo completo)
docker compose up -d --build
```

Isso sobe SQL Server, a API, o front-end (modo dev) e o Nginx. Acesse **http://localhost:5173**.

As migrações do banco rodam sozinhas no start da API — não precisa de nenhum passo manual pra subir pela primeira vez. Detalhes de configuração, endpoints, variáveis de ambiente e como rodar sem Docker estão no README de cada projeto:

- [`construtor_3d/README.md`](construtor_3d/README.md)
- [`construtor_3d_api/README.md`](construtor_3d_api/README.md)


