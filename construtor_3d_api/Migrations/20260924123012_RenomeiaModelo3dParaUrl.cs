using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace construtor_3d_api.Migrations
{
    /// <inheritdoc />
    public partial class RenomeiaModelo3dParaUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Só adiciona a coluna nova aqui de propósito: a coluna Modelo3d (bytes) continua
            // existindo por enquanto, pro script de migração ler os dados antigos direto por SQL
            // antes de virarem arquivo. Uma migração seguinte (RemoveModelo3dAntigo) apaga essa
            // coluna depois de tudo migrado e conferido
            migrationBuilder.AddColumn<string>(
                name: "Modelo3dUrl",
                table: "Elementos",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Modelo3dUrl",
                table: "Elementos");
        }
    }
}
