using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using construtor_3d_api.Data;
using construtor_3d_api.Dtos;
using construtor_3d_api.Models;
using construtor_3d_api.Services;

namespace construtor_3d_api.Controllers;

// Um projeto só aparece, abre ou aceita mudanças de quem é o dono (UsuarioId) — pra qualquer
// outra conta, é como se não existisse. Todo projeto nasce com dono (Criar); não há projeto sem
// dono no banco (os que existiam de antes do login foram atribuídos a uma conta na migração)
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ProjetosController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ArquivosElemento _arquivos;
    private readonly PermissoesServico _permissoes;

    public ProjetosController(AppDbContext context, ArquivosElemento arquivos, PermissoesServico permissoes)
    {
        _context = context;
        _arquivos = arquivos;
        _permissoes = permissoes;
    }

    private int UsuarioId => Services.UsuarioAtual.Id(User);

    private IQueryable<Projeto> Visiveis() => _context.Projetos.Where(p => p.UsuarioId == UsuarioId);

    [HttpGet]
    public async Task<List<ProjetoResumoResponse>> Listar()
    {
        return await Visiveis()
            .AsNoTracking()
            .OrderByDescending(p => p.AtualizadoEm)
            .Select(p => new ProjetoResumoResponse(
                p.Id,
                p.Nome,
                p.Descricao,
                p.PontoPartida,
                p.Elementos.Count(e => e.Tipo == TipoElemento.Peca),
                p.CriadoEm,
                p.AtualizadoEm))
            .ToListAsync();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProjetoResponse>> Obter(int id)
    {
        var projeto = await Visiveis()
            .AsNoTracking()
            .Include(p => p.Elementos)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (projeto is null)
            return NotFound();

        return ParaResposta(projeto, projeto.Elementos);
    }

    [HttpPost]
    public async Task<ActionResult<ProjetoResponse>> Criar(CriarProjetoRequest request)
    {
        if (!await _permissoes.TemAsync(User, Permissoes.ProjetosCriar))
            return Forbid();

        // As anotações do DTO já foram validadas pelo [ApiController]; aqui os obrigatórios
        // existem. A planta é opcional: sem ela, o projeto nasce sem ambiente definido, como um
        // módulo (LarguraAmbiente/AlturaAmbiente/ProfundidadeAmbiente ficam nulas)
        var planta = request.Planta;

        var agora = DateTime.UtcNow;
        var projeto = new Projeto
        {
            UsuarioId = UsuarioId,
            Nome = request.Nome!.Trim(),
            Descricao = string.IsNullOrWhiteSpace(request.Descricao) ? null : request.Descricao.Trim(),
            PontoPartida = request.PontoPartida!.Value,
            LarguraAmbiente = planta?.X,
            AlturaAmbiente = planta?.Z,
            ProfundidadeAmbiente = planta?.Y,
            CriadoEm = agora,
            AtualizadoEm = agora,
            // O projeto nasce sem peças: a planta só define o tamanho do ambiente no editor
        };

        _context.Projetos.Add(projeto);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(Obter), new { id = projeto.Id }, ParaResposta(projeto, projeto.Elementos));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Excluir(int id)
    {
        if (!await _permissoes.TemAsync(User, Permissoes.ProjetosExcluir))
            return Forbid();

        // Os elementos do projeto são apagados em cascata pelo banco
        var excluidos = await Visiveis().Where(p => p.Id == id).ExecuteDeleteAsync();
        return excluidos == 0 ? NotFound() : NoContent();
    }

    [HttpPut("{id:int}/elementos")]
    public async Task<ActionResult<ProjetoResponse>> SalvarElementos(int id, SalvarElementosRequest request)
    {
        if (!await _permissoes.TemAsync(User, Permissoes.ProjetosEditarElementos))
            return Forbid();

        var projeto = await Visiveis()
            .Include(p => p.Elementos)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (projeto is null)
            return NotFound();

        var existentes = projeto.Elementos.ToDictionary(e => e.Id);
        var idsMantidos = new HashSet<int>();
        // Sem teto de elementos aqui (ao contrário de um módulo, ver ModulosController): um
        // projeto pode nascer de uma importação de .glb inteira (planta, móveis etc.), facilmente
        // acima de Formas.MaximoElementos — e como todo salvamento reenvia a árvore inteira, um
        // teto aqui deixaria qualquer edição depois de uma importação grande impossível de salvar
        ArvoreElementos.Validar(request.Elementos!, "elementos", 1, existentes, idsMantidos, ModelState);

        if (Formas.ValidarVariaveisGlobais(request.VariaveisGlobais) is string erroVariaveis)
            ModelState.AddModelError(nameof(request.VariaveisGlobais), erroVariaveis);

        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        // Elementos salvos que não vieram na árvore foram removidos no editor
        var removidos = projeto.Elementos.Where(e => !idsMantidos.Contains(e.Id)).ToList();

        await using var transacao = await _context.Database.BeginTransactionAsync();

        await AplicarArvore(projeto, request.Elementos!, null, existentes);
        projeto.VariaveisGlobais = request.VariaveisGlobais is { Count: > 0 } ? request.VariaveisGlobais : null;

        // O auto-relacionamento não tem cascata no SQL Server: primeiro os removidos saem da árvore
        // e só depois são apagados, para nenhuma exclusão violar a chave do pai
        foreach (var removido in removidos)
            removido.Pai = null;

        projeto.AtualizadoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _context.Elementos.RemoveRange(removidos);
        await _context.SaveChangesAsync();
        await transacao.CommitAsync();

        return ParaResposta(projeto, projeto.Elementos.Except(removidos));
    }

    private async Task AplicarArvore(
        Projeto projeto,
        List<ElementoRequest> elementos,
        Elemento? pai,
        Dictionary<int, Elemento> existentes)
    {
        for (var i = 0; i < elementos.Count; i++)
        {
            var dados = elementos[i];
            var elemento = dados.Id is int elementoId ? existentes[elementoId] : new Elemento();

            if (dados.Id is null)
                projeto.Elementos.Add(elemento);

            var peca = dados.Tipo == TipoElemento.Peca;
            var parede = dados.Tipo == TipoElemento.Parede;
            var piso = dados.Tipo == TipoElemento.Piso;
            var grupo = dados.Tipo == TipoElemento.Grupo;
            var abertura = dados.Tipo == TipoElemento.Abertura;

            elemento.Pai = pai;
            elemento.Tipo = dados.Tipo!.Value;
            elemento.Nome = dados.Nome!.Trim();
            // O editor sempre envia o campo; o padrão aqui só vale para chamadas diretas à API
            elemento.Colisao = dados.Colisao ?? true;
            elemento.Visivel = dados.Visivel ?? true;
            // Peça: Forma OU Modelo3d, nunca os dois (garantido pela validação em ArvoreElementos).
            // O arquivo em si vira um arquivo à parte (ArquivosElemento), nunca fica no banco;
            // dados.Modelo3d tanto pode ser a URL de um arquivo já salvo (releitura, ou uma peça
            // existente ecoando o que já tinha) quanto o conteúdo novo (base64) de uma importação
            elemento.TipoForma = peca ? dados.Forma?.Tipo : null;
            elemento.ParametrosForma = peca ? dados.Forma?.Parametros : null;
            elemento.Modelo3dUrl = peca ? await _arquivos.ResolverModelo3d(dados.Modelo3d, elemento.Modelo3dUrl) : null;
            elemento.Modelo3dNo = peca ? dados.Modelo3dNo : null;
            // O Tamanho, ao contrário do arquivo, é reenviado a cada salvamento (redimensionar em 3
            // eixos independentes uma peça de modelo3d, ou um grupo, muda esse campo) — só fica de
            // fora quando o tipo nem tem tamanho fixo (peça de forma, parede, piso, vão)
            var temTamanhoFixo = grupo || (peca && elemento.Modelo3dUrl is not null);
            if (!temTamanhoFixo)
            {
                elemento.TamanhoX = null;
                elemento.TamanhoZ = null;
                elemento.TamanhoY = null;
            }
            else if (dados.Tamanho is not null)
            {
                elemento.TamanhoX = dados.Tamanho.X;
                elemento.TamanhoZ = dados.Tamanho.Y;
                elemento.TamanhoY = dados.Tamanho.Z;
            }
            // dados.Tamanho ausente com tamanho fixo (só uma peça de modelo3d já existente, chamada
            // direto na API sem reenviar o tamanho): mantém o que já estava gravado
            elemento.ParedeComprimento = parede ? dados.Parede!.Comprimento : null;
            elemento.ParedeAltura = parede ? dados.Parede!.Altura : null;
            elemento.ParedeEspessura = parede ? dados.Parede!.Espessura : null;
            elemento.AberturaTipo = abertura ? dados.Abertura!.Tipo : null;
            elemento.AberturaLargura = abertura ? dados.Abertura!.Largura : null;
            elemento.AberturaAltura = abertura ? dados.Abertura!.Altura : null;
            elemento.PisoVertices = piso ? dados.Piso!.Vertices!.Select(p => new[] { p.X, p.Y, p.Z }).ToList() : null;
            elemento.PisoEspessura = piso ? dados.Piso!.Espessura : null;
            elemento.PosicaoX = dados.Posicao!.X;
            elemento.PosicaoZ = dados.Posicao.Y;
            elemento.PosicaoY = dados.Posicao.Z;
            elemento.RotacaoX = dados.Rotacao?.X ?? 0;
            elemento.RotacaoZ = dados.Rotacao?.Y ?? 0;
            elemento.RotacaoY = dados.Rotacao?.Z ?? 0;
            elemento.Ordem = i;
            elemento.Formulas = dados.Formulas is { Count: > 0 } ? dados.Formulas : null;
            elemento.VariaveisFormulas = dados.VariaveisFormulas is { Count: > 0 } ? dados.VariaveisFormulas : null;
            elemento.VariaveisPorFaceFormulas = dados.VariaveisPorFaceFormulas is { Count: > 0 } ? dados.VariaveisPorFaceFormulas : null;
            elemento.Travados = dados.Travados is { Count: > 0 } ? dados.Travados.Distinct().ToList() : null;
            elemento.Texturas = await _arquivos.ResolverTexturas(dados.Texturas, UsuarioId);
            elemento.GruposDeFace = dados.GruposDeFace is { Count: > 0 } ? dados.GruposDeFace : null;
            elemento.ReferenciaEstavel = string.IsNullOrWhiteSpace(dados.ReferenciaEstavel) ? null : dados.ReferenciaEstavel;
            elemento.IdUnico = string.IsNullOrWhiteSpace(dados.IdUnico) ? null : dados.IdUnico.Trim();
            elemento.IdSequencial = string.IsNullOrWhiteSpace(dados.IdSequencial) ? null : dados.IdSequencial.Trim();
            elemento.VerticesParede = grupo && dados.VerticesParede is { Count: > 0 }
                ? dados.VerticesParede.Select(p => new[] { p.X, p.Y, p.Z }).ToList()
                : null;
            elemento.VerticesParedeFechado = grupo && (dados.VerticesParedeFechado ?? false);

            if ((grupo || parede || peca) && dados.Filhos is not null)
                await AplicarArvore(projeto, dados.Filhos, elemento, existentes);
        }
    }

    private static ProjetoResponse ParaResposta(Projeto projeto, IEnumerable<Elemento> elementos) => new(
        projeto.Id,
        projeto.Nome,
        projeto.Descricao,
        projeto.PontoPartida,
        projeto is { LarguraAmbiente: double x, AlturaAmbiente: double z, ProfundidadeAmbiente: double y }
            ? new TamanhoDto(x, y, z)
            : null,
        projeto.VariaveisGlobais,
        MontarArvore(elementos),
        projeto.CriadoEm,
        projeto.AtualizadoEm);

    private static List<ElementoResponse> MontarArvore(IEnumerable<Elemento> elementos)
    {
        var porPai = elementos.ToLookup(e => e.PaiId);

        List<ElementoResponse> Filhos(int? paiId) => porPai[paiId]
            .OrderBy(e => e.Ordem)
            .Select(e => new ElementoResponse(
                e.Id,
                e.Tipo,
                e.Nome,
                new PosicaoDto(e.PosicaoX, e.PosicaoZ, e.PosicaoY),
                new RotacaoDto(e.RotacaoX, e.RotacaoZ, e.RotacaoY),
                e.Colisao,
                e.Visivel,
                e.TipoForma is TipoForma tipo ? new FormaDto(tipo, e.ParametrosForma) : null,
                e.Modelo3dUrl,
                e.Modelo3dNo,
                e is { TamanhoX: double x, TamanhoZ: double y, TamanhoY: double z } ? new TamanhoDto(x, y, z) : null,
                e is { ParedeComprimento: double c, ParedeAltura: double a, ParedeEspessura: double esp }
                    ? new ParedeDto(c, a, esp)
                    : null,
                e.PisoVertices is not null && e.PisoEspessura is double espessuraPiso
                    ? new PisoDto(e.PisoVertices.Select(p => new PosicaoDto(p[0], p[1], p[2])).ToList(), espessuraPiso)
                    : null,
                e is { AberturaTipo: TipoAbertura tipoAbertura, AberturaLargura: double larguraAbertura, AberturaAltura: double alturaAbertura }
                    ? new AberturaDto(tipoAbertura, larguraAbertura, alturaAbertura)
                    : null,
                e.Formulas,
                e.VariaveisFormulas,
                e.VariaveisPorFaceFormulas,
                e.Travados,
                e.Texturas,
                e.GruposDeFace,
                e.ReferenciaEstavel,
                e.IdUnico,
                e.IdSequencial,
                e.VerticesParede?.Select(p => new PosicaoDto(p[0], p[1], p[2])).ToList(),
                e.VerticesParede is not null ? e.VerticesParedeFechado : null,
                Filhos(e.Id)))
            .ToList();

        return Filhos(null);
    }
}
