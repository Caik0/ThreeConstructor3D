namespace construtor_3d_api.Models;

// Convenção dos eixos dos elementos salvos (Projeto.ConvencaoEixos / Modulo.ConvencaoEixos)
public static class Convencao
{
    // Origem no canto da frente-esquerda, Y dos dados cresce pra trás
    public const int Legada = 1;

    // Origem no canto de trás-esquerda, Y dos dados cresce pra frente
    public const int Atual = 2;

    public const string MensagemDesatualizado =
        "Esta versão do editor está desatualizada (os eixos mudaram). Recarregue a página e tente salvar de novo.";
}
