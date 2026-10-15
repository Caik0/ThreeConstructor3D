using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace construtor_3d_api.Migrations
{
    /// <inheritdoc />
    public partial class ConverteAberturasEmElementos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "AberturaAltura",
                table: "Elementos",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "AberturaLargura",
                table: "Elementos",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AberturaTipo",
                table: "Elementos",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            // Vãos eram um campo (JSON) da própria parede; agora são elementos filhos dela. Antes
            // de descartar a coluna antiga, converte cada entrada dela numa linha nova em
            // Elementos, com PaiId apontando pra parede e a posição/medidas próprias de um vão
            migrationBuilder.Sql(
                """
                INSERT INTO Elementos (ProjetoId, PaiId, Tipo, Nome, PosicaoX, PosicaoY, PosicaoZ, Ordem, AberturaTipo, AberturaLargura, AberturaAltura)
                SELECT
                    e.ProjetoId,
                    e.Id,
                    'Abertura',
                    CASE WHEN JSON_VALUE(v.value, '$.Tipo') = 'porta' THEN 'Porta' ELSE 'Janela' END
                        + ' ' + CAST(ROW_NUMBER() OVER (
                            PARTITION BY e.Id, JSON_VALUE(v.value, '$.Tipo')
                            ORDER BY CAST(v.[key] AS int)) AS varchar(10)),
                    CAST(JSON_VALUE(v.value, '$.Deslocamento') AS float),
                    CAST(JSON_VALUE(v.value, '$.Peitoril') AS float),
                    0,
                    CAST(v.[key] AS int),
                    CASE WHEN JSON_VALUE(v.value, '$.Tipo') = 'porta' THEN 'Porta' ELSE 'Janela' END,
                    CAST(JSON_VALUE(v.value, '$.Largura') AS float),
                    CAST(JSON_VALUE(v.value, '$.Altura') AS float)
                FROM Elementos e
                CROSS APPLY OPENJSON(e.ParedeAberturas) v
                WHERE e.ParedeAberturas IS NOT NULL AND e.ParedeAberturas <> '[]';
                """);

            migrationBuilder.DropColumn(
                name: "ParedeAberturas",
                table: "Elementos");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ParedeAberturas",
                table: "Elementos",
                type: "nvarchar(max)",
                nullable: true);

            // Simétrico ao Up: reconstrói o JSON de cada parede a partir dos vãos dela antes de
            // apagá-los como elementos
            migrationBuilder.Sql(
                """
                UPDATE pai
                SET pai.ParedeAberturas = vaos.Json
                FROM Elementos pai
                CROSS APPLY (
                    SELECT
                        LOWER(v.AberturaTipo) AS Tipo,
                        v.PosicaoX AS Deslocamento,
                        v.AberturaLargura AS Largura,
                        v.AberturaAltura AS Altura,
                        v.PosicaoY AS Peitoril
                    FROM Elementos v
                    WHERE v.PaiId = pai.Id AND v.Tipo = 'Abertura'
                    ORDER BY v.Ordem
                    FOR JSON PATH
                ) AS vaos(Json)
                WHERE EXISTS (SELECT 1 FROM Elementos v2 WHERE v2.PaiId = pai.Id AND v2.Tipo = 'Abertura');

                DELETE FROM Elementos WHERE Tipo = 'Abertura';
                """);

            migrationBuilder.DropColumn(
                name: "AberturaAltura",
                table: "Elementos");

            migrationBuilder.DropColumn(
                name: "AberturaLargura",
                table: "Elementos");

            migrationBuilder.DropColumn(
                name: "AberturaTipo",
                table: "Elementos");
        }
    }
}
