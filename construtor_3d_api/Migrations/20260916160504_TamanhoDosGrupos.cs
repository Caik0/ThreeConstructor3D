using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace construtor_3d_api.Migrations
{
    /// <inheritdoc />
    public partial class TamanhoDosGrupos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "TamanhoX",
                table: "Elementos",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "TamanhoY",
                table: "Elementos",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "TamanhoZ",
                table: "Elementos",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TamanhoX",
                table: "Elementos");

            migrationBuilder.DropColumn(
                name: "TamanhoY",
                table: "Elementos");

            migrationBuilder.DropColumn(
                name: "TamanhoZ",
                table: "Elementos");
        }
    }
}
