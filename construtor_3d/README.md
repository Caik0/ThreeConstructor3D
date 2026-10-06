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
│   ├── three/      — o viewport 3D do editor e as miniaturas de módulo
│   ├── ui/         — componentes de interface reutilizáveis
│   └── orcamento/  — módulo de orçamento (em construção)
├── lib/
│   ├── api/            — cliente HTTP e as chamadas por domínio (projetos, módulos, texturas...)
│   ├── hooks/           — hooks do TanStack Query por domínio
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
- A origem de peças, grupos e paredes fica no canto (frente-inferior-esquerda), como referência de posição — igual ao SketchUp.
- Campos numéricos aceitam contas (`60+1,8`) e fórmulas com referências a outros campos do mesmo elemento (`largura/2`) ou ao elemento pai (`Parent!largura/2`).
- Uma peça é uma forma paramétrica (caixa ou cilindro) **ou** um modelo importado (`.glb`), nunca os dois.

## Testes

Não há suíte de testes automatizados neste repositório no momento.
