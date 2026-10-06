using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace construtor_3d_api.Services;

// Lê o id do usuário autenticado a partir do token JWT (claim "sub"); usado em qualquer
// controller com [Authorize], hoje só o AuthController
public static class UsuarioAtual
{
    public static int Id(ClaimsPrincipal usuario) =>
        int.Parse(usuario.FindFirstValue(JwtRegisteredClaimNames.Sub)!);
}
