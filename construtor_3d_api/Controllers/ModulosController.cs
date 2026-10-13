using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using construtor_3d_api.Data;
using construtor_3d_api.Dtos;
using construtor_3d_api.Models;
using construtor_3d_api.Services;

namespace construtor_3d_api.Controllers;

// Peças e grupos salvos à parte de um projeto, pra poder ser importados em outros — como os
// componentes do SketchUp. Cada módulo guarda a árvore inteira (elemento + filhos) em JSON; não há
// edição de conteúdo aqui, só salvar (uma cópia independente do que estava no editor), renomear,
// listar e excluir. Importar num projeto é responsabilidade do editor: ele busca a árvore aqui e
// insere como elementos novos, do mesmo jeito que colar uma cópia. Mesma regra de dono de
// ProjetosController: um módulo sem dono é de antes do login existir e fica acessível a qualquer
// conta até ser editado, quando passa a pertencer a quem editou
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ModulosController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ArquivosElemento _arquivos;
    private readonly IArmazenamentoArquivos _armazenamento;
    private readonly ImportacaoPendente _pendentes;
    private readonly PermissoesServico _permissoes;

    private int UsuarioId => Services.UsuarioAtual.Id(User);

    private IQueryable<Modulo> Visiveis() =>
        _context.Modulos.Where(m => m.UsuarioId == null || m.UsuarioId == UsuarioId);

    private void Adotar(Modulo modulo) => modulo.UsuarioId ??= UsuarioId;

    // As mesmas opções de serialização da API (enums em texto, camelCase), usadas aqui à mão
    // porque `Dados` é gravado como um JSON cru, fora do pipeline de request/response do MVC
    private static readonly JsonSerializerOptions OpcoesJson = new()
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false) },
    };

    public ModulosController(
        AppDbContext context, ArquivosElemento arquivos, IArmazenamentoArquivos armazenamento,
        ImportacaoPendente pendentes, PermissoesServico permissoes)
    {
        _context = context;
        _arquivos = arquivos;
        _armazenamento = armazenamento;
        _pendentes = pendentes;
        _permissoes = permissoes;
    }

    // Envia o .glb original (inteiro, sem separar nada) pra virar arquivo e devolve a URL — usado
    // uma vez só por importação, antes de montar a árvore de peças/grupos: cada peça encontrada no
    // arquivo aponta pra essa mesma URL (ver Modelo3dNo). Assim o arquivo pesado não precisa ser
    // reenviado uma vez por peça, e nunca é duplicado (ArquivosElemento guarda pelo hash do
    // conteúdo — o mesmo arquivo importado de novo cai na mesma URL de sempre)
    [HttpPost("modelo3d")]
    public async Task<ActionResult<EnviarModelo3dResponse>> EnviarModelo3d(EnviarModelo3dRequest request)
    {
        if (!await _permissoes.TemAsync(User, Permissoes.ModulosGerenciar))
            return Forbid();

        if (Formas.ValidarModelo3d(request.Base64!) is string erro)
        {
            ModelState.AddModelError(nameof(request.Base64), erro);
            return ValidationProblem(ModelState);
        }

        var url = await _arquivos.ResolverModelo3d(request.Base64, null);
        return Ok(new EnviarModelo3dResponse(url!));
    }

    // Mesma coisa que EnviarModelo3d acima, mas via multipart em vez de JSON+base64: base64 infla
    // o arquivo em ~33% e obriga tanto o navegador quanto a API a montar tudo em memória de uma vez
    // só antes de processar. Pra um .glb até Modelo3dTamanhoMaximo (hoje 1 GB), isso é caro demais
    // — aqui o arquivo vai direto do stream da requisição pro disco (ver
    // ArmazenamentoLocalArquivos.SalvarStreamAsync), sem nunca precisar dele inteiro em memória.
    // Os atributos abaixo dão a esta rota, só a ela, um limite de corpo bem maior que o resto da
    // API (o Kestrel de Program.cs continua baixo pras rotas JSON de sempre)
    [HttpPost("modelo3d/upload")]
    [RequestSizeLimit(Formas.Modelo3dRequestTamanhoMaximo)]
    [RequestFormLimits(MultipartBodyLengthLimit = Formas.Modelo3dRequestTamanhoMaximo)]
    public async Task<ActionResult<EnviarModelo3dResponse>> EnviarModelo3dArquivo(IFormFile? arquivo)
    {
        if (!await _permissoes.TemAsync(User, Permissoes.ModulosGerenciar))
            return Forbid();

        if (arquivo is null)
        {
            ModelState.AddModelError(nameof(arquivo), "Nenhum arquivo enviado.");
            return ValidationProblem(ModelState);
        }

        await using var stream = arquivo.OpenReadStream();

        // Só os primeiros bytes, pra checar a assinatura glTF sem ler o arquivo inteiro agora —
        // SalvarStreamAsync lê o resto (stream.Position volta pro início logo abaixo)
        var primeirosBytes = new byte[4];
        var lidos = await stream.ReadAsync(primeirosBytes);

        if (Formas.ValidarModelo3dArquivo(arquivo.Length, primeirosBytes.AsSpan(0, lidos)) is string erro)
        {
            ModelState.AddModelError(nameof(arquivo), erro);
            return ValidationProblem(ModelState);
        }

        stream.Position = 0;
        var url = await _armazenamento.SalvarStreamAsync(stream, ".glb", ArmazenamentoLocalArquivos.PastaModelos3d);
        return Ok(new EnviarModelo3dResponse(url));
    }

    // Um .glb solto na pasta de importação, esperando virar módulo sozinho (ver ImportacaoPendente).
    // Quem separa em peças/grupos e calcula os tamanhos é o front (o mesmo código de sempre, ver
    // lib/modelo3d/importarGlb.ts) — aqui só lista o que está pendente
    [HttpGet("pendentes")]
    public ActionResult<List<ModuloPendenteResponse>> ListarPendentes() =>
        _pendentes.Listar("*.glb").Select(p => new ModuloPendenteResponse(p.Nome, p.Url)).ToList();

    // O front chama isso depois de processar um pendente (com sucesso ou não), pra ele sair da
    // fila e não ser oferecido de novo a cada visita à tela de módulos
    [HttpPost("pendentes/concluir")]
    public ActionResult ConcluirPendente(ConcluirPendenteRequest request)
    {
        var nome = request.Nome!;
        if (nome.Contains('/') || nome.Contains('\\') || nome.Contains(".."))
            return BadRequest();

        _pendentes.Concluir(nome, request.Sucesso);
        return NoContent();
    }

    [HttpGet]
    public async Task<List<ModuloResponse>> Listar()
    {
        var modulos = await Visiveis()
            .AsNoTracking()
            .OrderByDescending(m => m.CriadoEm)
            .ToListAsync();

        return modulos.Select(ParaResposta).ToList();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ModuloResponse>> Obter(int id)
    {
        var modulo = await Visiveis().AsNoTracking().FirstOrDefaultAsync(m => m.Id == id);
        return modulo is null ? NotFound() : ParaResposta(modulo);
    }

    [HttpPost]
    public async Task<ActionResult<ModuloResponse>> Criar(CriarModuloRequest request)
    {
        if (!await _permissoes.TemAsync(User, Permissoes.ModulosGerenciar))
            return Forbid();

        var elemento = request.Elemento!;

        if (!ValidarElementoRaiz(elemento))
            return ValidationProblem(ModelState);

        var modulo = new Modulo
        {
            UsuarioId = UsuarioId,
            Nome = request.Nome!.Trim(),
            Tipo = elemento.Tipo!.Value,
            Dados = JsonSerializer.Serialize(await _arquivos.ResolverArvore(elemento, UsuarioId), OpcoesJson),
            CriadoEm = DateTime.UtcNow,
        };

        _context.Modulos.Add(modulo);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(Obter), new { id = modulo.Id }, ParaResposta(modulo));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ModuloResponse>> Renomear(int id, RenomearModuloRequest request)
    {
        if (!await _permissoes.TemAsync(User, Permissoes.ModulosGerenciar))
            return Forbid();

        var modulo = await Visiveis().FirstOrDefaultAsync(m => m.Id == id);
        if (modulo is null)
            return NotFound();

        Adotar(modulo);
        modulo.Nome = request.Nome!.Trim();
        await _context.SaveChangesAsync();

        return ParaResposta(modulo);
    }

    // Substitui o conteúdo (a árvore inteira) de um módulo já salvo, ao editá-lo direto no editor
    // (com o mesmo id de sempre, sem afetar os projetos onde ele já foi importado — aquelas cópias
    // já são independentes)
    [HttpPut("{id:int}/elemento")]
    public async Task<ActionResult<ModuloResponse>> AtualizarConteudo(int id, AtualizarConteudoModuloRequest request)
    {
        if (!await _permissoes.TemAsync(User, Permissoes.ModulosGerenciar))
            return Forbid();

        var modulo = await Visiveis().FirstOrDefaultAsync(m => m.Id == id);
        if (modulo is null)
            return NotFound();

        var elemento = request.Elemento!;

        if (!ValidarElementoRaiz(elemento))
            return ValidationProblem(ModelState);

        Adotar(modulo);
        modulo.Tipo = elemento.Tipo!.Value;
        modulo.Dados = JsonSerializer.Serialize(await _arquivos.ResolverArvore(elemento, UsuarioId), OpcoesJson);
        await _context.SaveChangesAsync();

        return ParaResposta(modulo);
    }

    // Só peça ou grupo podem ser a raiz de um módulo; a subárvore inteira segue as mesmas regras
    // da árvore de um projeto (reaproveitadas de ArvoreElementos). Não há elementos existentes pra
    // casar por id: um módulo nunca referencia elementos de um projeto, é sempre uma árvore nova
    private bool ValidarElementoRaiz(ElementoRequest elemento)
    {
        if (elemento.Tipo is not (TipoElemento.Peca or TipoElemento.Grupo))
            ModelState.AddModelError("elemento.tipo", "Só peças e grupos podem ser salvos como módulo.");

        var total = ArvoreElementos.Validar(
            [elemento], "elemento", 1, new Dictionary<int, Elemento>(), new HashSet<int>(), ModelState);

        if (total > Formas.MaximoElementos)
            ModelState.AddModelError("elemento", $"Um módulo pode ter no máximo {Formas.MaximoElementos} elementos.");

        return ModelState.IsValid;
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Excluir(int id)
    {
        if (!await _permissoes.TemAsync(User, Permissoes.ModulosExcluir))
            return Forbid();

        var excluidos = await Visiveis().Where(m => m.Id == id).ExecuteDeleteAsync();
        return excluidos == 0 ? NotFound() : NoContent();
    }

    private static ModuloResponse ParaResposta(Modulo modulo) => new(
        modulo.Id,
        modulo.Nome,
        modulo.Tipo,
        modulo.CriadoEm,
        JsonSerializer.Deserialize<ElementoRequest>(modulo.Dados, OpcoesJson)!);
}
