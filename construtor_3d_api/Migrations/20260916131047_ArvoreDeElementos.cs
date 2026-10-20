using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace construtor_3d_api.Migrations
{
    /// <inheritdoc />
    public partial class ArvoreDeElementos : Migration
    {
        // Ordem ajustada à mão: as peças são copiadas para Elementos antes de a tabela Pecas ser apagada

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Elementos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProjetoId = table.Column<int>(type: "int", nullable: false),
                    PaiId = table.Column<int>(type: "int", nullable: true),
                    Tipo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Nome = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    TipoForma = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ParametrosForma = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PosicaoX = table.Column<double>(type: "float", nullable: false),
                    PosicaoY = table.Column<double>(type: "float", nullable: false),
                    PosicaoZ = table.Column<double>(type: "float", nullable: false),
                    Ordem = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Elementos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Elementos_Elementos_PaiId",
                        column: x => x.PaiId,
                        principalTable: "Elementos",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Elementos_Projetos_ProjetoId",
                        column: x => x.ProjetoId,
                        principalTable: "Projetos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Elementos_PaiId",
                table: "Elementos",
                column: "PaiId");

            migrationBuilder.CreateIndex(
                name: "IX_Elementos_ProjetoId",
                table: "Elementos",
                column: "ProjetoId");

            // Cada peça existente vira uma peça na raiz do projeto, no mesmo lugar e na mesma ordem
            migrationBuilder.Sql(
                """
                INSERT INTO Elementos (ProjetoId, PaiId, Tipo, Nome, TipoForma, ParametrosForma, PosicaoX, PosicaoY, PosicaoZ, Ordem)
                SELECT ProjetoId, NULL, N'Peca', Nome, TipoForma, ParametrosForma, PosicaoX, PosicaoY, PosicaoZ, Ordem
                FROM Pecas;
                """);

            migrationBuilder.DropTable(
                name: "Pecas");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Pecas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nome = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Ordem = table.Column<int>(type: "int", nullable: false),
                    ParametrosForma = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PosicaoX = table.Column<double>(type: "float", nullable: false),
                    PosicaoY = table.Column<double>(type: "float", nullable: false),
                    PosicaoZ = table.Column<double>(type: "float", nullable: false),
                    ProjetoId = table.Column<int>(type: "int", nullable: false),
                    TipoForma = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pecas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pecas_Projetos_ProjetoId",
                        column: x => x.ProjetoId,
                        principalTable: "Projetos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Pecas_ProjetoId",
                table: "Pecas",
                column: "ProjetoId");

            // Achata a árvore: grupos somem e cada peça recebe a posição no mundo (soma das posições dos pais)
            migrationBuilder.Sql(
                """
                WITH Caminho AS (
                    SELECT Id, PosicaoX AS X, PosicaoY AS Y, PosicaoZ AS Z
                    FROM Elementos
                    WHERE PaiId IS NULL
                    UNION ALL
                    SELECT e.Id, c.X + e.PosicaoX, c.Y + e.PosicaoY, c.Z + e.PosicaoZ
                    FROM Elementos e
                    JOIN Caminho c ON e.PaiId = c.Id
                )
                INSERT INTO Pecas (ProjetoId, Nome, TipoForma, ParametrosForma, PosicaoX, PosicaoY, PosicaoZ, Ordem)
                SELECT e.ProjetoId, e.Nome, e.TipoForma, e.ParametrosForma, c.X, c.Y, c.Z,
                       ROW_NUMBER() OVER (PARTITION BY e.ProjetoId ORDER BY e.Id) - 1
                FROM Elementos e
                JOIN Caminho c ON c.Id = e.Id
                WHERE e.Tipo = N'Peca';
                """);

            migrationBuilder.DropTable(
                name: "Elementos");
        }
    }
}
