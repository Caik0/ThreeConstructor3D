using System.Security.Claims;
using construtor_3d_api.Data;
using construtor_3d_api.Models;

namespace construtor_3d_api.Services;

// Checagem grossa de permissão, usada pelos poucos endpoints que têm uma ação própria pra isso
// (ver Models/Permissoes.cs). Sempre consulta o banco, nunca o JWT: o token dura 7 dias
// (TokenService.Validade) e uma permissão revogada por um admin precisa valer já na próxima
// chamada, não só no próximo login
public class PermissoesServico(AppDbContext context)
{
    public async Task<bool> TemAsync(ClaimsPrincipal principal, string chave)
    {
        var usuario = await context.Usuarios.FindAsync(UsuarioAtual.Id(principal));
        return usuario is not null && (usuario.Admin || (usuario.Permissoes?.Contains(chave) ?? false));
    }

    public async Task<bool> EhAdminAsync(ClaimsPrincipal principal)
    {
        var usuario = await context.Usuarios.FindAsync(UsuarioAtual.Id(principal));
        return usuario?.Admin ?? false;
    }
}
