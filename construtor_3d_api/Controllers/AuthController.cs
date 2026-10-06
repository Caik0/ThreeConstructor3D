using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using construtor_3d_api.Data;
using construtor_3d_api.Dtos;
using construtor_3d_api.Models;
using construtor_3d_api.Services;

namespace construtor_3d_api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext context, TokenService tokenService) : ControllerBase
{
    private static UsuarioResponse ParaResponse(Usuario usuario) =>
        new(usuario.Id, usuario.Nome, usuario.Email, usuario.Admin, usuario.Permissoes, usuario.CriadoEm);

    [HttpPost("cadastro")]
    public async Task<ActionResult<AutenticacaoResponse>> Cadastrar(CadastroRequest dados)
    {
        var email = dados.Email.Trim().ToLowerInvariant();
        if (await context.Usuarios.AnyAsync(u => u.Email == email))
        {
            ModelState.AddModelError(nameof(dados.Email), "Este e-mail já está cadastrado.");
            return ValidationProblem(ModelState);
        }

        var usuario = new Usuario
        {
            Nome = dados.Nome.Trim(),
            Email = email,
            SenhaHash = BCrypt.Net.BCrypt.HashPassword(dados.Senha),
        };
        context.Usuarios.Add(usuario);
        await context.SaveChangesAsync();

        return Ok(new AutenticacaoResponse(tokenService.GerarToken(usuario), ParaResponse(usuario)));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AutenticacaoResponse>> Login(LoginRequest dados)
    {
        var email = dados.Email.Trim().ToLowerInvariant();
        var usuario = await context.Usuarios.SingleOrDefaultAsync(u => u.Email == email);

        // Mesma mensagem pra e-mail inexistente ou senha errada, pra não revelar quais e-mails
        // têm conta cadastrada
        if (usuario is null || !BCrypt.Net.BCrypt.Verify(dados.Senha, usuario.SenhaHash))
            return Unauthorized(new { title = "E-mail ou senha incorretos." });

        return Ok(new AutenticacaoResponse(tokenService.GerarToken(usuario), ParaResponse(usuario)));
    }

    [Authorize]
    [HttpGet("eu")]
    public async Task<ActionResult<UsuarioResponse>> Eu()
    {
        var usuario = await context.Usuarios.FindAsync(UsuarioAtual.Id(User));
        return usuario is null ? NotFound() : ParaResponse(usuario);
    }
}
