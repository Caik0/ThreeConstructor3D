namespace construtor_3d_api.Models;

// Nó da árvore de montagem do projeto, como grupos e geometria no Outliner do SketchUp
public class Elemento
{
    public int Id { get; set; }

    public int ProjetoId { get; set; }

    // Nulo para elementos na raiz do projeto
    public int? PaiId { get; set; }

    public Elemento? Pai { get; set; }

    public List<Elemento> Filhos { get; set; } = new();

    public TipoElemento Tipo { get; set; }

    public string Nome { get; set; } = string.Empty;

    // Elemento sólido para efeito de colisão: bloqueia o movimento contra outro elemento
    // também sólido. Ambos precisam ter Colisao=true para o par se bloquear
    public bool Colisao { get; set; }

    // Oculto não aparece na cena 3D nem pode ser clicado nela. Projetos antigos (coluna
    // adicionada depois) recebem true por padrão no banco, então continuam visíveis
    public bool Visivel { get; set; } = true;

    // Só peças têm forma (ou Modelo3d, ver abaixo); peças e grupos também podem conter outros
    // elementos
    public TipoForma? TipoForma { get; set; }

    // Medidas em mm por nome do parâmetro (ex.: largura, altura); gravado como JSON
    public Dictionary<string, double>? ParametrosForma { get; set; }

    // Peça importada de um arquivo .glb (glTF binário): a URL do arquivo ORIGINAL, sem nenhuma
    // separação — o mesmo arquivo é compartilhado por todas as peças vindas daquele import (ver
    // ArquivosElemento/IArmazenamentoArquivos; o arquivo em si nunca fica no banco). Uma peça tem
    // TipoForma+ParametrosForma OU Modelo3dUrl, nunca os dois — o tamanho dela vem de TamanhoX/Y/Z
    // (calculado uma vez, a partir da malha, no momento da importação; nunca muda depois)
    public string? Modelo3dUrl { get; set; }

    // Caminho da malha desta peça dentro do arquivo de Modelo3dUrl: índices dos nós separados por
    // ponto (ex.: "2.0.1" = scene.children[2].children[0].children[1]), na ordem em que apareciam
    // no arquivo original. É assim que várias peças apontam pro MESMO Modelo3dUrl e cada uma sabe
    // qual pedacinho dele é dela — a separação em partes só acontece na hora de exibir, no
    // navegador, nunca vira arquivo próprio em disco
    public string? Modelo3dNo { get; set; }

    // Grupos: medidas fixas da caixa do grupo, em mm, a partir da origem. Redimensionar o grupo
    // escala o conteúdo, mas alterar o conteúdo não muda essas medidas. Nulo em grupos antigos,
    // que recebem o tamanho do conteúdo ao serem abertos no editor. Peças com Modelo3d: o tamanho
    // fixo da malha importada (não editável, nunca é escalado)
    public double? TamanhoX { get; set; }

    public double? TamanhoZ { get; set; }

    public double? TamanhoY { get; set; }

    // Só paredes: medidas a partir da origem (comprimento no eixo local X, altura em Z,
    // espessura em Y), como uma peça em caixa, mas num tipo de elemento próprio
    public double? ParedeComprimento { get; set; }

    public double? ParedeAltura { get; set; }

    public double? ParedeEspessura { get; set; }

    // Só vãos (porta/janela): a posição/deslocamento e o peitoril já são os campos genéricos
    // PosicaoX/PosicaoZ, relativos à origem da parede-mãe (o Pai dele) — aqui só o que é próprio
    // do vão: o tipo e as medidas dele
    public TipoAbertura? AberturaTipo { get; set; }

    public double? AberturaLargura { get; set; }

    public double? AberturaAltura { get; set; }

    // Rotação em torno da origem, relativa ao pai, em graus (ordem X, Y, Z). Positivo é
    // anti-horário visto da ponta positiva do eixo, como no SketchUp
    public double RotacaoX { get; set; }

    public double RotacaoZ { get; set; }

    public double RotacaoY { get; set; }

    // Posição da origem relativa ao pai, em mm. Como no SketchUp, a origem é um canto:
    // a peça ocupa o sentido positivo dos três eixos a partir dela
    public double PosicaoX { get; set; }

    public double PosicaoZ { get; set; }

    public double PosicaoY { get; set; }

    // Ordem entre os irmãos
    public int Ordem { get; set; }

    // Fórmulas ao vivo dos campos numéricos (ex.: "posicaoX" -> "Parent!largura/2"), como nos
    // componentes dinâmicos do SketchUp; gravado como JSON. Nulo/vazio = sem fórmulas
    public Dictionary<string, string>? Formulas { get; set; }

    // Variáveis customizadas do elemento: nome -> texto digitado (número ou fórmula), gravado
    // como JSON. O valor resolvido não é persistido: o editor recalcula ao carregar o projeto
    public Dictionary<string, string>? VariaveisFormulas { get; set; }

    // Variáveis customizadas de uma face específica (pensado pra furação/ferragem no futuro):
    // face -> nome -> texto digitado, gravado como JSON. Mesmas faces de Texturas
    public Dictionary<string, Dictionary<string, string>>? VariaveisPorFaceFormulas { get; set; }

    // Campos travados (mesmas chaves das fórmulas, ex.: "largura", "posicaoX"): não mudam quando um
    // grupo pai é redimensionado e escala o conteúdo; gravado como JSON. Nulo = nenhum travado
    public List<string>? Travados { get; set; }

    // Texturas (imagens JPEG) por face da peça: face -> data URL "data:image/jpeg;base64,...";
    // gravado como JSON. Faces da caixa: direita/esquerda/topo/base/frente/fundo; do cilindro:
    // lateral/topo/base. Nulo = sem texturas
    public Dictionary<string, string>? Texturas { get; set; }

    // Só em grupos: grupos de face pra pintar de uma vez no balde de tinta (ex.: "Caixa" -> a face
    // "esquerda" da peça X + a "direita" da peça Y + a "fundo" da peça Z) — um grupo de módulos
    // (gaveteiro, armário) é pintado como um conjunto, então cada membro aponta pra uma face de um
    // DESCENDENTE deste grupo, não uma face dele mesmo. Nome do grupo -> lista de membros, gravado
    // como JSON. Nulo = nenhum grupo
    public Dictionary<string, List<MembroGrupoDeFace>>? GruposDeFace { get; set; }

    // Código interno gerado sozinho na hora em que o elemento entra num grupo de face pela
    // primeira vez (ver MembroGrupoDeFace) — nunca aparece na cena nem em lugar nenhum da
    // interface, ao contrário de IdUnico. Regenerado se o elemento for duplicado, como o IdUnico
    public string? ReferenciaEstavel { get; set; }

    // Etiqueta do módulo (só em peça/grupo), mostrada como rótulo flutuante sobre a peça no editor.
    // IdUnico é um código gerado uma vez e nunca reaproveitado (duplicar o elemento gera outro);
    // IdSequencial é o número de ordem entre os módulos do projeto, tipo "M-4". Os dois são livres
    // pra editar ou limpar, e nenhum dos dois entra em cálculo nenhum — é só identificação
    public string? IdUnico { get; set; }

    public string? IdSequencial { get; set; }

    // Só nos grupos criados pelo construtor de paredes: os cantos originalmente clicados
    // (cada um um array [x, y, z], em mm, relativos à origem do próprio grupo), gravados como
    // JSON, pra poder reabrir e editar depois — a geometria das paredes já esticada nas esquinas
    // não dá pra reconstruir isso. Nulo nas demais paredes/grupos
    public List<double[]>? VerticesParede { get; set; }

    // Se o contorno clicado estava fechado; só importa junto de VerticesParede
    public bool VerticesParedeFechado { get; set; }

    // Só pisos: o polígono que preenche a área interna de um contorno de paredes fechado (cada
    // canto um array [x, y, z], em mm, relativos à origem do próprio piso), gravado como JSON
    public List<double[]>? PisoVertices { get; set; }

    // Só pisos: espessura em mm, a partir da origem (que já é o topo do piso)
    public double? PisoEspessura { get; set; }
}

// Um membro de um grupo de face (ver Elemento.GruposDeFace): a face Face do elemento com essa
// Referencia, um descendente (direto ou não) do grupo dono dessa lista. Usa
// Elemento.ReferenciaEstavel — nunca mostrada na interface — em vez do IdUnico (que É mostrado
// como etiqueta flutuante sobre a peça; usá-lo aqui geraria rótulos indesejados só por uma peça
// ter entrado num grupo de face) ou do Id do elemento (não existe ainda pra um elemento recém-criado)
public record MembroGrupoDeFace(string Referencia, string Face);
