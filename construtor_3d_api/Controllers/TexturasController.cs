using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using construtor_3d_api.Data;
using construtor_3d_api.Dtos;
using construtor_3d_api.Models;
using construtor_3d_api.Services;

namespace construtor_3d_api.Controllers;

// Catálogo de imagens de textura já usadas por este usuário em alguma face (peça, parede ou
// piso), pra oferecer como opção pronta no balde de tinta em vez de importar o mesmo arquivo de
// novo. Uma textura entra sozinha aqui assim que usada numa face (ver
// ArquivosElemento.ResolverTexturas) ou importada direto (Importar, abaixo) — sem uma ação
// separada de "salvar"
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TexturasController(AppDbContext context, ArquivosElemento arquivos, ImportacaoPendente pendentes) : ControllerBase
{
    private int UsuarioId => Services.UsuarioAtual.Id(User);

    [HttpGet]
    public async Task<List<TexturaResponse>> Listar()
    {
        return await context.Texturas
            .Where(t => t.UsuarioId == UsuarioId)
            .OrderByDescending(t => t.CriadoEm)
            .Select(t => new TexturaResponse(t.Id, t.Url, t.CriadoEm))
            .ToListAsync();
    }

    // Importa uma imagem direto pro catálogo, sem estar ligada a nenhuma face — usado pelo front
    // pra processar uma imagem solta na pasta de importação (ver pendentes, abaixo), do mesmo
    // jeito que EnviarModelo3d faz pro .glb de um módulo
    [HttpPost]
    public async Task<ActionResult<TexturaResponse>> Importar(ImportarTexturaRequest request)
    {
        var erro = Formas.EhCorSolida(request.Base64!) ? "Isto é uma cor, não uma imagem." : Formas.ValidarImagemTextura(request.Base64!);
        if (erro is not null)
        {
            ModelState.AddModelError(nameof(request.Base64), erro);
            return ValidationProblem(ModelState);
        }

        var url = await arquivos.ResolverTexturaUnica(request.Base64!, UsuarioId);
        var textura = await context.Texturas.SingleAsync(t => t.UsuarioId == UsuarioId && t.Url == url);
        return new TexturaResponse(textura.Id, textura.Url, textura.CriadoEm);
    }

    // Uma imagem (qualquer formato comum — o front recomprime pro final na hora de importar, ver
    // useImportacaoAutomaticaTexturas) solta na pasta de importação, esperando virar textura do
    // catálogo sozinha (ver ImportacaoPendente) — aqui só lista o que está pendente; quem importa
    // de fato é Importar, acima, chamado pelo front com os bytes já baixados
    [HttpGet("pendentes")]
    public ActionResult<List<TexturaPendenteResponse>> ListarPendentes() =>
        pendentes.Listar("*.jpg", "*.jpeg", "*.png", "*.webp", "*.gif", "*.bmp", "*.avif")
            .Select(p => new TexturaPendenteResponse(p.Nome, p.Url))
            .ToList();

    // O front chama isso depois de processar um pendente (com sucesso ou não), pra ele sair da
    // fila e não ser oferecido de novo a cada visita ao diálogo de escolher textura
    [HttpPost("pendentes/concluir")]
    public ActionResult ConcluirPendente(ConcluirTexturaPendenteRequest request)
    {
        var nome = request.Nome!;
        if (nome.Contains('/') || nome.Contains('\\') || nome.Contains(".."))
            return BadRequest();

        pendentes.Concluir(nome, request.Sucesso);
        return NoContent();
    }
}
