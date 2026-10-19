using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace construtor_3d_api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveModelo3dAntigo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A coluna antiga (bytes) já foi lida e convertida em arquivo por
            // POST /api/manutencao/migrar-media (ver RenomeiaModelo3dParaUrl); com tudo migrado e
            // conferido, agora sim ela sai
            migrationBuilder.DropColumn(
                name: "Modelo3d",
                table: "Elementos");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "Modelo3d",
                table: "Elementos",
                type: "varbinary(max)",
                nullable: true);
        }
    }
}
