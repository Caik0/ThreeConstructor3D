using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using construtor_3d_api.Data;
using construtor_3d_api.Services;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 40 * 1024 * 1024);

// A árvore de elementos chega aninhada; a profundidade padrão de validação (32) seria pouca
builder.Services.AddControllers(options => options.MaxValidationDepth = 64)
    .AddJsonOptions(options =>
        // Enums trafegam como texto em camelCase ("caixa", "modulos"), igual ao front
        options.JsonSerializerOptions.Converters.Add(
            new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false)));

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")
    )
);

builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<PermissoesServico>();

// Modelos 3D e texturas ficam em arquivo, não no banco (ver Services/ArquivosElemento e
// IArmazenamentoArquivos). Hoje é uma pasta local (um volume do Docker, pra sobreviver a um
// rebuild do container); um servidor FTP no lugar dela só precisa de uma segunda implementação
// de IArmazenamentoArquivos, sem mudar quem usa a interface
builder.Services.AddSingleton<IArmazenamentoArquivos, ArmazenamentoLocalArquivos>();
builder.Services.AddScoped<ArquivosElemento>();

// Pasta de importação: um .glb solto ali (arrastado direto pro disco) espera a tela de módulos
// abrir pra virar módulo sozinho — ver ImportacaoPendente e GET/POST /api/modulos/pendentes
builder.Services.AddSingleton<ImportacaoPendente>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Sem isso, o handler renomeia a claim "sub" para ClaimTypes.NameIdentifier antes de expor
        // o ClaimsPrincipal, e UsuarioAtual.Id (que procura por JwtRegisteredClaimNames.Sub) não
        // encontraria nada
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Emissor"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audiencia"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = TokenService.Chave(builder.Configuration),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// O init-db.sh só garante que o banco existe (CREATE DATABASE); quem cria/atualiza as tabelas
// é o EF aqui, toda vez que a API sobe — assim um volume novo (ou uma migration nova) fica em
// dia sem precisar rodar `dotnet ef database update` na mão
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Serve a mesma pasta que ArmazenamentoLocalArquivos grava, no caminho público que ela devolve
// nas URLs — assim um <img src> ou o GLTFLoader do three.js buscam o arquivo direto, sem passar
// pelo pipeline de controllers/JSON
var diretorioMedia = Path.GetFullPath(app.Configuration["Armazenamento:Diretorio"] ?? "media");
Directory.CreateDirectory(diretorioMedia);
// .glb não está nos tipos conhecidos por padrão — sem isso, o StaticFileMiddleware trata a
// extensão como desconhecida e devolve 404 em vez de servir o arquivo
var tiposDeArquivo = new FileExtensionContentTypeProvider();
tiposDeArquivo.Mappings[".glb"] = "model/gltf-binary";
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(diretorioMedia),
    RequestPath = ArmazenamentoLocalArquivos.CaminhoPublico,
    ContentTypeProvider = tiposDeArquivo,
});

// Idem pra pasta de importação (arquivos ainda não processados, ver ImportacaoPendente)
var diretorioImportacao = Path.GetFullPath(app.Configuration["Armazenamento:DiretorioImportacao"] ?? "importar");
Directory.CreateDirectory(diretorioImportacao);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(diretorioImportacao),
    RequestPath = ImportacaoPendente.CaminhoPublico,
    ContentTypeProvider = tiposDeArquivo,
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();