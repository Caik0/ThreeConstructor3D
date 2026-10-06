namespace construtor_3d_api.Models;

// Mesmas regras validadas no front (ver src/lib/auth/auth.ts)
public static class LimitesUsuario
{
    public const int NomeComprimentoMinimo = 2;
    public const int NomeComprimentoMaximo = 100;
    public const int EmailComprimentoMaximo = 200;
    public const int SenhaComprimentoMinimo = 8;
    // BCrypt trunca (e o .NET Identity recusa) senhas maiores que isso; 72 bytes é o limite dele
    public const int SenhaComprimentoMaximo = 72;
}
