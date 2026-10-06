namespace construtor_3d_api.Models;

// Uma imagem de textura já usada por este usuário em alguma face (peça, parede ou piso), pra
// oferecer como opção pronta da próxima vez, em vez de importar o mesmo arquivo de novo — como o
// catálogo de Modulo, mas sem o passo explícito de "salvar": entra sozinha aqui assim que usada
// (ver ArquivosElemento.ResolverTexturas). Cor sólida não é uma Textura: fica só no campo do
// elemento (ver Formas.EhCorSolida), sem gerar arquivo nem linha aqui
public class Textura
{
    public int Id { get; set; }

    // Ao contrário de Modulo/Projeto, não existe Textura de antes do login (a tabela nasceu depois
    // que a autenticação já existia), então todo registro tem dono
    public int UsuarioId { get; set; }

    // A mesma URL pode se repetir noutro UsuarioId (o arquivo em si já é compartilhado por
    // conteúdo, ver ArmazenamentoLocalArquivos), mas nunca duas vezes pro mesmo usuário
    public string Url { get; set; } = string.Empty;

    public DateTime CriadoEm { get; set; }
}
