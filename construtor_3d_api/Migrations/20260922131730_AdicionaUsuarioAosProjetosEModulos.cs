using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace construtor_3d_api.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaUsuarioAosProjetosEModulos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "UsuarioId",
                table: "Projetos",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UsuarioId",
                table: "Modulos",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Projetos_UsuarioId",
                table: "Projetos",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Modulos_UsuarioId",
                table: "Modulos",
                column: "UsuarioId");

            migrationBuilder.AddForeignKey(
                name: "FK_Modulos_Usuarios_UsuarioId",
                table: "Modulos",
                column: "UsuarioId",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Projetos_Usuarios_UsuarioId",
                table: "Projetos",
                column: "UsuarioId",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Modulos_Usuarios_UsuarioId",
                table: "Modulos");

            migrationBuilder.DropForeignKey(
                name: "FK_Projetos_Usuarios_UsuarioId",
                table: "Projetos");

            migrationBuilder.DropIndex(
                name: "IX_Projetos_UsuarioId",
                table: "Projetos");

            migrationBuilder.DropIndex(
                name: "IX_Modulos_UsuarioId",
                table: "Modulos");

            migrationBuilder.DropColumn(
                name: "UsuarioId",
                table: "Projetos");

            migrationBuilder.DropColumn(
                name: "UsuarioId",
                table: "Modulos");
        }
    }
}
