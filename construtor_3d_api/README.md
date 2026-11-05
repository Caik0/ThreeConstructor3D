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
| `Empresa` | Cliente da plataforma e fronteira dos dados: usuários, módulos, texturas e projetos pertencem a uma empresa e nunca aparecem para outra. Guarda razão social, fantasia, `CpfCnpj` (Brasil) ou `DocumentoFiscal` (outros países), contatos, endereço, `Bloqueada`/`DataBloqueio`, versão, `PadraoMedida`, `EspacoArmazenamento` (bytes) e `IdiomaPadraoId` |
| `Idioma` | Tabela de domínio (`Cadastro.Idiomas`: pt-BR, en-US, es-ES), semeada pela migração; cada empresa tem um padrão |
| `Usuario` | Uma conta (sempre de uma `EmpresaId`) (email guardado em minúsculas; senha só como hash BCrypt, nunca em texto, com `UltimaAlteracaoSenha`; `Configuracoes` guarda em JSON as preferências do editor, até 16 KB). `Admin` é o administrador DA EMPRESA (acesso total dentro dela, só enxerga os usuários dela); `SuperAdmin` é o dono da plataforma (cadastra e bloqueia empresas); `Permissoes` é a lista de chaves granulares liberadas pra quem não é admin (ver "Permissões de usuário" abaixo). Cadastro pessoal opcional: `Telefone`, `Celular`, `CpfCnpj` (Brasil) ou `DocumentoFiscal` (outros países), `Cidade`, `Uf` (Brasil) ou `EstadoProvincia`, `Pais` (ISO alfa-2) e `Obs`. `Bloqueado` (com `DataBloqueio` e `MotivoBloqueio`) impede o login e derruba as sessões abertas do usuário |
| `Projeto` | Um projeto do usuário; sempre tem dono (`UsuarioId` obrigatório) |
| `GrupoModulo` / `ClassificacaoModulo` | Cadastros simples da empresa (`Cadastro.GruposModulo`, `Cadastro.ClassificacoesModulo`: nome único por empresa e a marca `Padrao`). Todo `Modulo` tem um de cada, obrigatório. Cada empresa nasce com os padrões "Geral" e "Sem classificação" (a migração criou para as já existentes e ligou os módulos antigos a eles); o padrão pode ser renomeado, não excluído. Os componentes terão grupos e classificações próprios, em outro par de tabelas (listas distintas das de módulo), no mesmo molde (`ICadastroDaEmpresa` + `CadastroDaEmpresaController`) |
| `Elemento` | Um nó da árvore de montagem de um projeto — peça, grupo, parede, piso ou vão — como o Outliner do SketchUp. Peças e grupos têm uma `Categoria` (estrutura, ferragem, furação) e uma `Colagem` (nenhuma, qualquer, horizontal, vertical, inclinada: a superfície em que o elemento se gruda no editor); um vão pode ter como filho o módulo que o preenche. Ver "Cópia dinâmica" logo abaixo |
| `Modulo` | Uma peça ou grupo salvo à parte, pra reaproveitar em outros projetos; guarda a árvore inteira em JSON (`Dados`) |
| `Textura` | Catálogo de imagens já usadas pelo usuário em alguma face, oferecidas como opção pronta no balde de tinta do editor; tem `Categoria` (geral, madeira, espelho, metálica…, ver `CategoriasDeTextura`) |

#### Convenções do banco

- **Schemas:** `Seguranca` (acesso e identidade: `Empresas`, `Usuarios`), `Cadastro` (biblioteca reutilizável: `Idiomas`, `Texturas`, `Modulos`, `GruposModulo`, `ClassificacoesModulo`, `ConvencoesEixos`) e `Projeto` (o trabalho em si: `Principal` é o projeto, e `Ambiente`, `Variaveis` e `Elementos` são o que pertence a ele). O nome da tabela nunca repete o do schema (`Projeto.Principal`, não `Projeto.Projetos`). Tabelas filhas de outra tabela usam underscore (ex.: `Elementos_Parede`), nunca ponto.
- **Datas em toda tabela:** toda tabela tem `dt_criado_em` e `dt_atualizado_em` (interface `IAuditavel`). O banco tem `SYSUTCDATETIME()` como padrão e a API preenche ao salvar (`AppDbContext.CarimbarDatas`). Tabela nova: implemente `IAuditavel`.
- **Nome das colunas:** `<tipo>_<nome_em_snake_case>`, com `i` inteiro, `d` decimal/real, `b` booleano, `v` texto (varchar), `dt` data/hora e `j` JSON; chaves começam por `id` (`i_id`, `i_id_projeto`). A regra está em `Data/NomesDeColuna.cs`; as propriedades em C# mantêm os nomes de sempre. Ex.: `UPDATE Seguranca.Usuarios SET b_admin = 1 WHERE v_email = '...'`.
- **Projeto:** a planta do ambiente é `Projeto.Ambiente` (1:1, só existe com planta) e as variáveis globais são linhas de `Projeto.Variaveis` (nome único por projeto). A convenção dos eixos é a chave `i_id_convencao_eixos` para `Cadastro.ConvencoesEixos` (1 = Legada, 2 = Atual), em `Projeto.Principal` e `Cadastro.Modulos`.
- **Em andamento:** as demais colunas de `Elementos` (parede, piso, vão, modelo 3D, fórmulas, faces) ainda estão na própria tabela; vão para tabelas filhas numa próxima etapa.

#### Cópia dinâmica

Um elemento pode se repetir ao longo de um eixo conforme o tamanho do pai (dobradiças, prateleiras). São três colunas em `Elementos` (além da `ReferenciaEstavel`, que já existia), todas só pra peças e grupos:

- `Copias` (JSON) — no **modelo**: eixo, regra (`quantidade` ou `espacamento`), quantidade, espaçamento e margem final. O modelo precisa de `ReferenciaEstavel`.
- `CopiaDe` e `CopiaIndice` — em cada **cópia**: a `ReferenciaEstavel` do modelo e a posição na sequência. As cópias são elementos comuns, gravados e editáveis; quem cria, reposiciona e apaga as cópias conforme a regra é o editor (não a API), que só valida o formato (`Formas.ValidarCopias`, `ArvoreElementos`).

Projetos e módulos de antes de existir login ficam com dono nulo (legado, acessíveis a qualquer conta até serem editados); `Textura` sempre tem dono, já que essa tabela nasceu depois da autenticação já existir.

### Arquivos: modelos 3D e texturas

Um `.glb` importado ou uma imagem de textura não ficam no banco: viram um arquivo em disco (`Services/ArmazenamentoLocalArquivos`), nomeado pelo hash SHA-256 do próprio conteúdo — o mesmo arquivo importado de novo nunca gera uma cópia nova. O banco guarda só a URL. Duas pastas na raiz do repositório (montadas como volume no Docker, pra sobreviver a um rebuild do container):

- **`media/`** — arquivos já processados, servidos em `/api/media/...`
- **`importar/`** — pasta "solte aqui": um `.glb` ou uma imagem colocados direto nela viram um módulo ou uma textura novos sozinhos, sem passar pela tela de importar do editor (ver `GET /api/modulos/pendentes` e `GET /api/texturas/pendentes`)

## Endpoints

### `/api/auth` — sem autenticação

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/auth/eu` | Dados do usuário logado; `empresa` é a empresa em que a requisição age (ver "Super admin em outra empresa") |
| POST | `/api/auth/login` | Autentica e devolve o token JWT (com a empresa do usuário). Recusa (403) se a empresa está bloqueada. Não existe cadastro público: o admin da empresa cria usuários e o super admin cria empresas |
| GET | `/api/auth/eu` | Dados do usuário autenticado (inclui `admin`/`permissoes`) |

**Super admin em outra empresa:** o cabeçalho `X-Empresa-Id` faz o super admin agir na empresa indicada (ver `OnTokenValidated` em `Program.cs`): a claim `empresa` do token é trocada por ela só naquela requisição, então módulos, usuários e `/auth/eu` valem para essa empresa, e `/api/projetos` lista e abre os projetos de **todos** os usuários dela (cada item traz `donoNome`). Sem o cabeçalho ele age na própria empresa; para os demais usuários o cabeçalho é ignorado, e um id de empresa inexistente derruba a requisição (401). O super admin não aparece na lista de usuários dos admins de empresa e eles não conseguem editá-lo ou excluí-lo.

### `/api/empresas` — autenticado, só super admin

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/empresas` / `/api/empresas/{id}` | Lista / detalha (com a quantidade de usuários) |
| POST | `/api/empresas` | Cria a empresa **e o primeiro administrador dela** (`{ empresa, admin }`) |
| PUT | `/api/empresas/{id}` | Edita os dados da empresa |
| PUT | `/api/empresas/{id}/bloqueio` | `{ bloqueada, motivo }`: bloqueia (com o motivo opcional, mostrado no login recusado) ou libera; um bloqueio invalida também os tokens já emitidos |

`GET /api/idiomas` (qualquer usuário logado) lista os idiomas.

### `/api/usuarios` — autenticado, só admin acessa (e só vê os usuários da própria empresa)

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/usuarios` | Lista os usuários da empresa |
| POST | `/api/usuarios` | Cria um usuário na empresa; já aceita `admin` (cria um administrador), `permissoes` (ignoradas se for admin) e o bloco `dados` (cadastro pessoal; só vale o par do país: CPF/CNPJ e UF no Brasil, documento fiscal e estado/província fora) |
| PUT | `/api/usuarios/{id}` | Edita nome, e-mail e, se vier o bloco `dados`, o cadastro pessoal |
| PUT | `/api/usuarios/{id}/bloqueio` | `{ bloqueado, motivo }`: bloqueia ou libera o usuário (não bloqueia a si mesmo nem o último administrador); o login recusa com 403 e mostra o motivo |
| PUT | `/api/usuarios/{id}/permissoes` | Define `admin` e a lista de `permissoes` de um usuário |
| DELETE | `/api/usuarios/{id}` | Exclui o usuário e os projetos dele (elementos em cascata); módulos e texturas seguem a mesma regra de `Modulo`/`Textura` (ficam sem dono / são excluídos). Recusa excluir a própria conta de quem está chamando |

### `/api/projetos` — autenticado, só o dono acessa

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/projetos` | Lista os projetos do usuário |
| GET | `/api/projetos/{id}` | Detalhe de um projeto |
| POST | `/api/projetos` | Cria um projeto (permissão `projetos.criar`) |
| PUT | `/api/projetos/{id}/elementos` | Salva a árvore de elementos inteira (o que não vier é removido) (permissão `projetos.editarElementos`) |
| DELETE | `/api/projetos/{id}` | Exclui o projeto e os elementos dele, em cascata (permissão `projetos.excluir`) |

### `/api/grupos-modulo` e `/api/classificacoes-modulo` — autenticado

Mesmo contrato nos dois (`CadastroDaEmpresaController`): `GET` lista os da empresa (com `usos` = módulos que usam cada um; qualquer usuário, pois o editor precisa), `POST` cria e `PUT /{id}` renomeia (corpo `{ nome }`, nome único na empresa), `DELETE /{id}` exclui. Criar, renomear e excluir são só de administrador; o padrão e os itens em uso não podem ser excluídos.

### `/api/modulos` — autenticado

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/modulos` | Lista os módulos salvos |
| GET | `/api/modulos/{id}` | Detalhe de um módulo |
| POST | `/api/modulos` | Salva uma peça/grupo como módulo novo; `grupoId` e `classificacaoId` são obrigatórios e precisam ser da empresa (permissão `modulos.gerenciar`) |
| PUT | `/api/modulos/{id}` | Muda nome, grupo e classificação (permissão `modulos.gerenciar`) |
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

### `/api/configuracoes` — autenticado, cada usuário só a própria

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/configuracoes` | Preferências do editor (atalhos, mouse, passos, unidade padrão); `null` se nunca salvas |
| PUT | `/api/configuracoes` | Grava o objeto JSON enviado (o formato é definido e validado pelo front; máx. 16 KB) |

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

A API aplica as migrações pendentes **sozinha, toda vez que sobe** (`Database.Migrate()` no `Program.cs`) — com Docker ou sem. Não é preciso rodar nada à mão: depois de puxar uma migração nova, basta reconstruir e subir a API (ver "Solução de problemas" abaixo). O `dotnet ef database update` continua disponível pra aplicar sem subir a API.

`Projeto.Principal` e `Cadastro.Modulos` (coluna `i_id_convencao_eixos`) dizem em que convenção de eixos os elementos foram salvos (1 = origem na frente e Y pra trás, o padrão dos registros antigos; 2 = origem atrás e Y pra frente). O front converte os registros em 1 ao ler, e todo salvamento exige `convencaoEixos: 2` (senão responde 400 pedindo para recarregar a página).

Pra criar uma migração nova depois de mudar uma entidade em `Models/`:

```bash
dotnet ef migrations add NomeDaMigracao
```

Gere a migração pela ferramenta, não à mão: o EF compara o modelo do código com o snapshot (`Migrations/AppDbContextModelSnapshot.cs`) e, se não baterem, a API **não sobe** (ver o primeiro item de "Solução de problemas"). Pra conferir antes de commitar: `dotnet ef migrations has-pending-model-changes`.

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

Um usuário com `Admin = true` tem acesso total **dentro da empresa dele** e ignora a lista de `Permissoes`; `SuperAdmin = true` é o dono da plataforma (acesso total, cadastra e bloqueia empresas). Como não há cadastro público nem seed, o primeiro super admin sai da migração `EmpresasEIdiomas`: os administradores que já existiam viram super admins, e todos os dados antigos foram para a "Empresa padrão". Para promover outra conta, rode direto no SQL Server:

```sql
UPDATE Seguranca.Usuarios SET b_admin = 1, b_super_admin = 1 WHERE v_email = 'email-da-conta@exemplo.com';
```

Quem já está em `/api/empresas` cria as empresas novas (com o primeiro admin de cada uma) e esse admin cria os usuários dela. A partir daí, quem é admin já enxerga a tela "Usuários" (`/admin/usuarios`) no front e pode gerenciar o acesso dos demais por lá, sem precisar mexer no banco de novo.

## Solução de problemas

**Uma mudança na API "não tem efeito".** A API não tem hot reload no Docker — o container roda a imagem construída. Depois de mudar código ou migração, reconstrua só ela:

```bash
docker compose up -d --build api
```

Pra confirmar que o que está rodando é o build novo, veja a coluna de criação em `docker ps -a` (o container deve ter sido criado depois da sua mudança).

**O Nginx responde 502 / a API cai ao subir.** Veja o motivo com `docker logs construtor-3d-api`. Se aparecer `PendingModelChangesWarning`, o modelo do código e o snapshot das migrações não batem: falta gerar a migração (`dotnet ef migrations add`) ou ela foi escrita à mão com diferenças (por exemplo, coluna obrigatória no modelo e anulável no snapshot).

**Um campo novo "não grava", sem nenhum erro.** O desserializador JSON da API **ignora campos que não conhece**. Se o front manda `indiceCopia` e o DTO se chama `CopiaIndice`, o valor simplesmente some — e, se a validação depende dele, o sintoma vira um "inválido" sem explicação. Confira que o nome (em camelCase) do campo é o mesmo em `ElementoEntrada`/`Elemento` (`src/lib/projetos/projetos.ts` no front) e em `ElementoRequest`/`ElementoResponse` (`Dtos/ProjetoDtos.cs`).

**Banco: conferir o que foi aplicado.** As migrações aplicadas ficam em `__EFMigrationsHistory`; a lista de colunas, em `INFORMATION_SCHEMA.COLUMNS`. Dá pra consultar sem instalar nada: `docker exec construtor-3d-sqlserver /opt/mssql-tools18/bin/sqlcmd ...` (a senha está no `.env`).

## Depuração

- **Logs:** `docker logs -f construtor-3d-api` (em Development o EF imprime cada comando SQL).
- **Endpoints:** o arquivo `construtor_3d_api.http` (extensão *REST Client* do VS Code) e o Swagger em `http://localhost:5000/swagger`, habilitado em Development.
- **Banco:** qualquer cliente SQL em `localhost,1433`, usuário `sa` e a senha do `.env`.
- **Passo a passo (F5):** a imagem do Docker é só de execução, sem depurador. Pra depurar com breakpoints, rode a API localmente (ver "Rodando sem Docker") apontando pro SQL Server do container em `localhost,1433`; como a API não tem CORS, o front precisa continuar acessando-a por um proxy (o Nginx ou um proxy do Vite).
