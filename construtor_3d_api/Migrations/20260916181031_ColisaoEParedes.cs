using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace construtor_3d_api.Migrations
{
    /// <inheritdoc />
    public partial class ColisaoEParedes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Colisao",
                table: "Elementos",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "ParedeAltura",
                table: "Elementos",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "ParedeComprimento",
                table: "Elementos",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "ParedeEspessura",
                table: "Elementos",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Colisao",
                table: "Elementos");

            migrationBuilder.DropColumn(
                name: "ParedeAltura",
                table: "Elementos");

            migrationBuilder.DropColumn(
                name: "ParedeComprimento",
                table: "Elementos");

            migrationBuilder.DropColumn(
                name: "ParedeEspessura",
                table: "Elementos");
        }
    }
}
