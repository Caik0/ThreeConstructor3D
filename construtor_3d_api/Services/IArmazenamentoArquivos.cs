namespace construtor_3d_api.Services;

// Onde os arquivos grandes do projeto (modelos 3D importados, texturas) ficam guardados, fora do
// banco de dados. Hoje só existe a implementação local (ArmazenamentoLocalArquivos); uma segunda
// implementação (ex.: FTP) troca de lugar sem precisar mudar quem usa a interface
public interface IArmazenamentoArquivos
{
    /// <summary>
    /// Salva os bytes como um arquivo novo (nome único) dentro de `pasta` (ex.: "modelos3d",
    /// "texturas" — mantém cada tipo de arquivo separado) e devolve a URL pública dele, já pronta
    /// pra usar direto num &lt;img&gt; ou num carregador do three.js
    /// </summary>
    Task<string> SalvarAsync(byte[] dados, string extensao, string pasta);

    /// <summary>
    /// Mesma coisa que <see cref="SalvarAsync"/>, mas lendo `dados` como stream em vez de um
    /// array já pronto — usada pra arquivo grande (ver ModulosController.EnviarModelo3dArquivo),
    /// pra nunca precisar do arquivo inteiro em memória de uma vez só
    /// </summary>
    Task<string> SalvarStreamAsync(Stream dados, string extensao, string pasta);

    /// <summary>Remove o arquivo referenciado por uma URL devolvida por SalvarAsync. Silencioso
    /// se o arquivo já não existir (ex.: chamada em duplicidade)</summary>
    void Excluir(string url);
}
