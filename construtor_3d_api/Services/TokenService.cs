using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using construtor_3d_api.Models;
using Microsoft.IdentityModel.Tokens;

namespace construtor_3d_api.Services;

// Emite e valida o JWT que autentica cada requisição (ver Program.cs, que registra esse mesmo
// esquema como o validador de token de toda a API)
public class TokenService(IConfiguration configuracao)
{
    public static readonly TimeSpan Validade = TimeSpan.FromDays(7);

    public static SymmetricSecurityKey Chave(IConfiguration configuracao)
    {
        var chave = configuracao["Jwt:Chave"]
            ?? throw new InvalidOperationException("Configuração Jwt:Chave ausente.");
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(chave));
    }

    public string GerarToken(Usuario usuario)
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, usuario.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var credenciais = new SigningCredentials(Chave(configuracao), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: configuracao["Jwt:Emissor"],
            audience: configuracao["Jwt:Audiencia"],
            claims: claims,
            expires: DateTime.UtcNow.Add(Validade),
            signingCredentials: credenciais);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
