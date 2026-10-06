namespace construtor_3d_api.Models;

public class Projeto
{
    public int Id { get; set; }

    // Dono do projeto; sempre preenchido (ver ProjetosController, que só cria projetos com dono e
    // só deixa o dono ver/mexer no projeto). Os poucos projetos de antes do login existir foram
    // atribuídos a uma conta na migração TornaProjetoUsuarioIdObrigatorio
    public int UsuarioId { get; set; }

    public string Nome { get; set; } = string.Empty;

    public string? Descricao { get; set; }

    public PontoPartida PontoPartida { get; set; }

    // Planta do ambiente, em mm: dimensão em que o editor abre o piso e a grade.
    // Nulo em projetos criados antes dela existir; as três colunas são sempre preenchidas juntas
    public double? LarguraAmbiente { get; set; }

    public double? AlturaAmbiente { get; set; }

    public double? ProfundidadeAmbiente { get; set; }

    // Nome -> valor, acessível de qualquer elemento do projeto com "Global!nome" (ver
    // ElementoRequest.Formulas/VariaveisFormulas no front). Ao contrário das fórmulas de um
    // elemento, aqui já é o número pronto: uma variável global não referencia nada (nem outra
    // variável global, nem um elemento), então não existe "fórmula ao vivo" pra guardar
    public Dictionary<string, double>? VariaveisGlobais { get; set; }

    // Todos os elementos do projeto, em qualquer nível da árvore
    public List<Elemento> Elementos { get; set; } = new();

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
