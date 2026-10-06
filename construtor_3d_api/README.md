# Construtor 3D — API

API do **Construtor 3D**, um editor 3D de módulos de marcenaria/cozinha no navegador (peças, paredes, pisos e vãos), no espírito do SketchUp. Esta API guarda os projetos, o catálogo de módulos reutilizáveis e o catálogo de texturas de cada usuário; toda a modelagem 3D em si acontece no front-end ([`construtor_3d`](../construtor_3d), em three.js).

## Stack

- **.NET 10** / ASP.NET Core Web API
- **Entity Framework Core 10** + **SQL Server**
- Autenticação **JWT** (`Microsoft.AspNetCore.Authentication.JwtBearer`) + senhas com **BCrypt** (`BCrypt.Net-Next`)
- **Swashbuckle** (Swagger/OpenAPI, só em ambiente `Development`)
- **Docker Compose** orquestrando API, SQL Server, Redis, o front-end (React) e um Nginx na frente dos dois

## Arquitetura

- `Controllers/` — os endpoints da API (lista completa abaixo)
- `Models/` — entidades do EF Core e regras de validação de cada uma (`Formas.cs` espelha as mesmas regras de `src/lib/formas/formas.ts` no front, pra validar dos dois lados)
- `Dtos/` — os contratos de request/response de cada controller
- `Data/` — `AppDbContext` e conversores usados pelo EF Core
- `Services/` — infraestrutura: armazenamento de arquivos (`ArmazenamentoLocalArquivos`/`ArquivosElemento`), fila de importação por pasta (`ImportacaoPendente`), emissão de token (`TokenService`)
- `Migrations/` — histórico de migrações do EF Core

### Modelo de dados, em linhas gerais

| Entidade | O que é |
| --- | --- |
| `Usuario` | Uma conta (email guardado em minúsculas; senha só como hash BCrypt, nunca em texto). `Admin` dá acesso total; `Permissoes` é a lista de chaves granulares liberadas pra quem não é admin (ver "Permissões de usuário" abaixo) |
| `Projeto` | Um projeto do usuário; sempre tem dono (`UsuarioId` obrigatório) |
| `Elemento` | Um nó da árvore de montagem de um projeto — peça, grupo, parede, piso ou vão — como o Outliner do SketchUp |
| `Modulo` | Uma peça ou grupo salvo à parte, pra reaproveitar em outros projetos; guarda a árvore inteira em JSON (`Dados`) |
| `Textura` | Catálogo de imagens já usadas pelo usuário em alguma face, oferecidas como opção pronta no balde de tinta do editor |

Projetos e módulos de antes de existir login ficam com dono nulo (legado, acessíveis a qualquer conta até serem editados); `Textura` sempre tem dono, já que essa tabela nasceu depois da autenticação já existir.

### Arquivos: modelos 3D e texturas

Um `.glb` importado ou uma imagem de textura não ficam no banco: viram um arquivo em disco (`Services/ArmazenamentoLocalArquivos`), nomeado pelo hash SHA-256 do próprio conteúdo — o mesmo arquivo importado de novo nunca gera uma cópia nova. O banco guarda só a URL. Duas pastas na raiz do repositório (montadas como volume no Docker, pra sobreviver a um rebuild do container):

- **`media/`** — arquivos já processados, servidos em `/api/media/...`
- **`importar/`** — pasta "solte aqui": um `.glb` ou uma imagem colocados direto nela viram um módulo ou uma textura novos sozinhos, sem passar pela tela de importar do editor (ver `GET /api/modulos/pendentes` e `GET /api/texturas/pendentes`)

## Endpoints

### `/api/auth` — sem autenticação

| Método | Rota | O que faz |
| --- | --- | --- |
| POST | `/api/auth/cadastro` | Cria uma conta nova |
| POST | `/api/auth/login` | Autentica e devolve o token JWT |
| GET | `/api/auth/eu` | Dados do usuário autenticado (inclui `admin`/`permissoes`) |

### `/api/usuarios` — autenticado, só admin acessa

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/usuarios` | Lista todos os usuários |
| PUT | `/api/usuarios/{id}/permissoes` | Define `admin` e a lista de `permissoes` de um usuário |

### `/api/projetos` — autenticado, só o dono acessa

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/projetos` | Lista os projetos do usuário |
| GET | `/api/projetos/{id}` | Detalhe de um projeto |
| POST | `/api/projetos` | Cria um projeto (permissão `projetos.criar`) |
| PUT | `/api/projetos/{id}/elementos` | Salva a árvore de elementos inteira (o que não vier é removido) (permissão `projetos.editarElementos`) |
| DELETE | `/api/projetos/{id}` | Exclui o projeto e os elementos dele, em cascata (permissão `projetos.excluir`) |

### `/api/modulos` — autenticado

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/modulos` | Lista os módulos salvos |
| GET | `/api/modulos/{id}` | Detalhe de um módulo |
| POST | `/api/modulos` | Salva uma peça/grupo como módulo novo (permissão `modulos.gerenciar`) |
| PUT | `/api/modulos/{id}` | Renomeia (permissão `modulos.gerenciar`) |
| PUT | `/api/modulos/{id}/elemento` | Substitui o conteúdo salvo (permissão `modulos.gerenciar`) |
| DELETE | `/api/modulos/{id}` | Exclui (permissão `modulos.excluir`) |
| POST | `/api/modulos/modelo3d` | Envia um `.glb` original inteiro e devolve a URL (uma vez por importação; as peças encontradas nele reaproveitam essa mesma URL) (permissão `modulos.gerenciar`) |
| GET | `/api/modulos/pendentes` | Lista `.glb` soltos na pasta `importar/` |
| POST | `/api/modulos/pendentes/concluir` | Tira um pendente da fila |

### `/api/texturas` — autenticado

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/texturas` | Catálogo de texturas do usuário |
| POST | `/api/texturas` | Importa uma imagem direto pro catálogo |
| GET | `/api/texturas/pendentes` | Lista imagens soltas na pasta `importar/` |
| POST | `/api/texturas/pendentes/concluir` | Tira uma pendente da fila |

### `/api/Health` — sem autenticação

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/Health` | Status da API e conectividade com o banco |

## Rodando o projeto

### Pré-requisitos

- Docker e Docker Compose
- Este repositório (`construtor_3d_api`) e o do front-end ([`construtor_3d`](../construtor_3d)) precisam estar lado a lado na mesma pasta — o `docker-compose.yml` daqui builda o front a partir de `../construtor_3d`:

  ```
  construtorWeb3d/
  ├── construtor_3d/       (front-end)
  └── construtor_3d_api/   (este repositório)
  ```

### Configuração

Crie um arquivo `.env` na raiz deste repositório:

```env
DB_DATABASE=construtor3d
DB_USERNAME=sa
DB_PASSWORD=<uma senha forte>
REDIS_HOST=redis
REDIS_PORT=6379
```

`appsettings.json` já traz a configuração de JWT (`Jwt:Emissor`/`Jwt:Audiencia`/`Jwt:Chave`) e dos diretórios de arquivo (`Armazenamento:Diretorio`/`Armazenamento:DiretorioImportacao`) — troque a chave do JWT antes de qualquer coisa que não seja uso local.

### Subindo com Docker (recomendado)

```bash
docker compose up -d --build
```

Isso sobe, nessa ordem: SQL Server, um serviço `init-db` que cria o banco (se ainda não existir), Redis, a API (porta `5000`), o front-end em modo dev (`yarn dev`) e um Nginx (porta `5173`) que serve o front e faz proxy de `/api` pra API. Acesse **http://localhost:5173**.

> O `init-db` só cria o banco vazio — as tabelas vêm das migrações do EF Core, aplicadas à parte (próxima seção). O Redis já sobe junto, mas hoje nenhum código da API o usa de fato — está provisionado pra um uso futuro (cache, sessão etc.), não pra algo que já funciona.

### Migrações do banco

Depois de subir os containers pela primeira vez (ou depois de puxar uma migração nova):

```bash
dotnet ef database update
```

Pra criar uma migração nova depois de mudar uma entidade em `Models/`:

```bash
dotnet ef migrations add NomeDaMigracao
```

### Rodando sem Docker

Precisa do SDK do .NET 10 e de um SQL Server acessível. Ajuste `ConnectionStrings:DefaultConnection` em `appsettings.Development.json` e rode:

```bash
dotnet run
```

O Swagger fica disponível em `/swagger` (só em ambiente `Development`).

### Uma observação sobre CORS

A API não tem CORS configurado — ela espera ser servida atrás do mesmo Nginx que serve o front (é assim que o `docker-compose.yml` monta tudo). Se for rodar o front separado (ex.: `yarn dev` direto, fora do Docker) apontando pra essa API, o navegador vai bloquear as chamadas por CORS a menos que isso seja configurado.

## Permissões de usuário

Cada ferramenta do editor (desenhar parede, pintar, duplicar, editar variáveis etc.) pode ser liberada individualmente por usuário — ver o catálogo completo em `Models/Permissoes.cs` (espelhado em `src/lib/permissoes/permissoes.ts` no front). A maioria das chaves só é checada no front (esconde a ferramenta); as que também têm um endpoint próprio (`projetos.criar/excluir/editarElementos`, `modulos.gerenciar/excluir`) são checadas de novo aqui na API, pelo `PermissoesServico`.

Um usuário com `Admin = true` tem acesso total e ignora a lista de `Permissoes`. Não há seed automático do primeiro admin — cadastre a conta normalmente pela tela e depois rode, uma vez, direto no SQL Server:

```sql
UPDATE Usuarios SET Admin = 1 WHERE Email = 'email-da-conta@exemplo.com';
```

A partir daí, esse usuário já enxerga a tela "Usuários" (`/admin/usuarios`) no front e pode gerenciar o acesso dos demais por lá, sem precisar mexer no banco de novo.

## Testes

Não há suíte de testes automatizados neste repositório no momento.
