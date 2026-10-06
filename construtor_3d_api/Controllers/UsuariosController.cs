using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using construtor_3d_api.Data;
using construtor_3d_api.Dtos;
using construtor_3d_api.Models;
using construtor_3d_api.Services;

namespace construtor_3d_api.Controllers;

// Tela de administração: só um usuário com Admin=true enxerga ou muda qualquer coisa aqui. Não há
// papel "meio-admin" pra gerenciar outros usuários — ou é admin (acesso total) ou não é
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UsuariosController(AppDbContext context, PermissoesServico permissoes) : ControllerBase
{
    private static UsuarioResponse ParaResposta(Usuario usuario) =>
        new(usuario.Id, usuario.Nome, usuario.Email, usuario.Admin, usuario.Permissoes, usuario.CriadoEm);

    [HttpGet]
    public async Task<ActionResult<List<UsuarioResponse>>> Listar()
    {
        if (!await permissoes.EhAdminAsync(User))
            return Forbid();

        var usuarios = await context.Usuarios.AsNoTracking().OrderBy(u => u.Nome).ToListAsync();
        return usuarios.Select(ParaResposta).ToList();
    }

    [HttpPut("{id:int}/permissoes")]
    public async Task<ActionResult<UsuarioResponse>> AtualizarPermissoes(int id, AtualizarPermissoesRequest request)
    {
        if (!await permissoes.EhAdminAsync(User))
            return Forbid();

        var usuario = await context.Usuarios.FindAsync(id);
        if (usuario is null)
            return NotFound();

        var chaves = (request.Permissoes ?? []).Distinct().ToList();
        var invalida = chaves.FirstOrDefault(c => !Permissoes.EhValida(c));
        if (invalida is not null)
        {
            ModelState.AddModelError(nameof(request.Permissoes), $"Permissão desconhecida: {invalida}.");
            return ValidationProblem(ModelState);
        }

        // Sem isso, um admin solitário poderia tirar o próprio acesso de administrador e travar o
        // sistema sem ninguém pra reverter (exceto via SQL direto)
        if (usuario.Admin && !request.Admin)
        {
            var outrosAdmins = await context.Usuarios.CountAsync(u => u.Id != id && u.Admin);
            if (outrosAdmins == 0)
            {
                ModelState.AddModelError(nameof(request.Admin), "Não é possível remover o último administrador.");
                return ValidationProblem(ModelState);
            }
        }

        usuario.Admin = request.Admin;
        usuario.Permissoes = chaves.Count > 0 ? chaves : null;
        await context.SaveChangesAsync();

        return ParaResposta(usuario);
    }
}
