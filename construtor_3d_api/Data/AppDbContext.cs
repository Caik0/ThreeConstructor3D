using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using construtor_3d_api.Models;

namespace construtor_3d_api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<Projeto> Projetos => Set<Projeto>();

    public DbSet<Elemento> Elementos => Set<Elemento>();

    public DbSet<Modulo> Modulos => Set<Modulo>();

    public DbSet<Textura> Texturas => Set<Textura>();

    public DbSet<Usuario> Usuarios => Set<Usuario>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>().HaveConversion<DateTimeUtcConverter>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var projeto = modelBuilder.Entity<Projeto>();

        projeto.Property(p => p.Nome).HasMaxLength(100);
        projeto.Property(p => p.Descricao).HasMaxLength(500);
        projeto.Property(p => p.PontoPartida).HasConversion<string>().HasMaxLength(20);
        projeto.Property(p => p.VariaveisGlobais).HasConversion(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<Dictionary<string, double>>(v, (JsonSerializerOptions?)null),
            new ValueComparer<Dictionary<string, double>?>(
                (a, b) => a == null ? b == null : b != null && a.Count == b.Count && !a.Except(b).Any(),
                v => v == null ? 0 : v.Aggregate(0, (hash, kv) => hash ^ HashCode.Combine(kv.Key, kv.Value)),
                v => v == null ? null : new Dictionary<string, double>(v)));
        projeto.HasMany(p => p.Elementos)
            .WithOne()
            .HasForeignKey(e => e.ProjetoId)
            .OnDelete(DeleteBehavior.Cascade);
        // Todo projeto tem dono (UsuarioId não é nulo): excluir a conta é bloqueado enquanto ela
        // tiver projetos, em vez de apagá-los ou deixá-los sem dono
        projeto.HasOne<Usuario>().WithMany().HasForeignKey(p => p.UsuarioId).OnDelete(DeleteBehavior.Restrict);

        var usuario = modelBuilder.Entity<Usuario>();
        usuario.Property(u => u.Nome).HasMaxLength(LimitesUsuario.NomeComprimentoMaximo);
        usuario.Property(u => u.Email).HasMaxLength(LimitesUsuario.EmailComprimentoMaximo);
        usuario.HasIndex(u => u.Email).IsUnique();
        // Default explícito pra migração preencher os usuários já cadastrados como não-admin
        usuario.Property(u => u.Admin).HasDefaultValue(false);
        usuario.Property(u => u.Permissoes).HasConversion(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null),
            new ValueComparer<List<string>?>(
                (a, b) => a == null ? b == null : b != null && a.SequenceEqual(b),
                v => v == null ? 0 : v.Aggregate(0, (hash, c) => HashCode.Combine(hash, c)),
                v => v == null ? null : v.ToList()));

        var elemento = modelBuilder.Entity<Elemento>();

        elemento.ToTable("Elementos");
        elemento.Property(e => e.Tipo).HasConversion<string>().HasMaxLength(20);
        elemento.Property(e => e.Nome).HasMaxLength(60);
        elemento.Property(e => e.ReferenciaEstavel).HasMaxLength(Formas.IdModuloComprimentoMaximo);
        elemento.Property(e => e.IdUnico).HasMaxLength(Formas.IdModuloComprimentoMaximo);
        elemento.Property(e => e.IdSequencial).HasMaxLength(Formas.IdModuloComprimentoMaximo);
        elemento.Property(e => e.Modelo3dUrl).HasMaxLength(300);
        elemento.Property(e => e.Modelo3dNo).HasMaxLength(60);
        // Default explícito (não só o inicializador C#) pra migração preencher os elementos já
        // salvos como visíveis, não ocultos
        elemento.Property(e => e.Visivel).HasDefaultValue(true);
        elemento.Property(e => e.TipoForma).HasConversion<string>().HasMaxLength(20);
        elemento.Property(e => e.AberturaTipo).HasConversion<string>().HasMaxLength(20);
        elemento.Property(e => e.ParametrosForma).HasConversion(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<Dictionary<string, double>>(v, (JsonSerializerOptions?)null),
            new ValueComparer<Dictionary<string, double>?>(
                (a, b) => a == null ? b == null : b != null && a.Count == b.Count && !a.Except(b).Any(),
                v => v == null ? 0 : v.Aggregate(0, (hash, kv) => hash ^ HashCode.Combine(kv.Key, kv.Value)),
                v => v == null ? null : new Dictionary<string, double>(v)));

        var conversorDicionarioDeTexto = new ValueComparer<Dictionary<string, string>?>(
            (a, b) => a == null ? b == null : b != null && a.Count == b.Count && !a.Except(b).Any(),
            v => v == null ? 0 : v.Aggregate(0, (hash, kv) => hash ^ HashCode.Combine(kv.Key, kv.Value)),
            v => v == null ? null : new Dictionary<string, string>(v));
        elemento.Property(e => e.Formulas).HasConversion(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<Dictionary<string, string>>(v, (JsonSerializerOptions?)null),
            conversorDicionarioDeTexto);
        elemento.Property(e => e.VariaveisFormulas).HasConversion(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<Dictionary<string, string>>(v, (JsonSerializerOptions?)null),
            conversorDicionarioDeTexto);
        var conversorDicionarioPorFace = new ValueComparer<Dictionary<string, Dictionary<string, string>>?>(
            (a, b) => a == null
                ? b == null
                : b != null && a.Count == b.Count
                    && a.All(kv => b.GetValueOrDefault(kv.Key) != null
                        && kv.Value.Count == b.GetValueOrDefault(kv.Key)!.Count
                        && !kv.Value.Except(b.GetValueOrDefault(kv.Key)!).Any()),
            v => v == null ? 0 : v.Aggregate(0, (hash, kv) =>
                HashCode.Combine(hash, kv.Key, kv.Value.Aggregate(0, (h2, kv2) => h2 ^ HashCode.Combine(kv2.Key, kv2.Value)))),
            v => v == null ? null : v.ToDictionary(kv => kv.Key, kv => new Dictionary<string, string>(kv.Value)));
        elemento.Property(e => e.VariaveisPorFaceFormulas).HasConversion(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, string>>>(v, (JsonSerializerOptions?)null),
            conversorDicionarioPorFace);
        elemento.Property(e => e.Texturas).HasConversion(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<Dictionary<string, string>>(v, (JsonSerializerOptions?)null),
            conversorDicionarioDeTexto);
        var conversorGruposDeFace = new ValueComparer<Dictionary<string, List<MembroGrupoDeFace>>?>(
            (a, b) => a == null
                ? b == null
                : b != null && a.Count == b.Count
                    && a.All(kv => b.GetValueOrDefault(kv.Key) != null && kv.Value.SequenceEqual(b.GetValueOrDefault(kv.Key)!)),
            v => v == null ? 0 : v.Aggregate(0, (hash, kv) =>
                HashCode.Combine(hash, kv.Key, kv.Value.Aggregate(0, (h2, membro) => HashCode.Combine(h2, membro)))),
            v => v == null ? null : v.ToDictionary(kv => kv.Key, kv => kv.Value.ToList()));
        elemento.Property(e => e.GruposDeFace).HasConversion(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<Dictionary<string, List<MembroGrupoDeFace>>>(v, (JsonSerializerOptions?)null),
            conversorGruposDeFace);
        elemento.Property(e => e.Travados).HasConversion(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null),
            new ValueComparer<List<string>?>(
                (a, b) => a == null ? b == null : b != null && a.SequenceEqual(b),
                v => v == null ? 0 : v.Aggregate(0, (hash, c) => HashCode.Combine(hash, c)),
                v => v == null ? null : v.ToList()));
        var conversorListaDeVertices = new ValueComparer<List<double[]>?>(
            (a, b) => a == null
                ? b == null
                : b != null && a.Count == b.Count && a.Zip(b).All(par => par.First.SequenceEqual(par.Second)),
            v => v == null ? 0 : v.Aggregate(0, (hash, p) => HashCode.Combine(hash, p[0], p[1], p[2])),
            v => v == null ? null : v.Select(p => (double[])p.Clone()).ToList());
        elemento.Property(e => e.VerticesParede).HasConversion(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<List<double[]>>(v, (JsonSerializerOptions?)null),
            conversorListaDeVertices);
        elemento.Property(e => e.PisoVertices).HasConversion(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<List<double[]>>(v, (JsonSerializerOptions?)null),
            conversorListaDeVertices);
        // SQL Server não aceita cascata em auto-relacionamento; a API remove os filhos explicitamente
        elemento.HasOne(e => e.Pai)
            .WithMany(e => e.Filhos)
            .HasForeignKey(e => e.PaiId)
            .OnDelete(DeleteBehavior.ClientSetNull);

        var modulo = modelBuilder.Entity<Modulo>();
        modulo.Property(m => m.Nome).HasMaxLength(60);
        modulo.Property(m => m.Tipo).HasConversion<string>().HasMaxLength(20);
        modulo.HasOne<Usuario>().WithMany().HasForeignKey(m => m.UsuarioId).OnDelete(DeleteBehavior.SetNull);

        var textura = modelBuilder.Entity<Textura>();
        textura.Property(t => t.Url).HasMaxLength(300);
        textura.HasIndex(t => new { t.UsuarioId, t.Url }).IsUnique();
        textura.HasOne<Usuario>().WithMany().HasForeignKey(t => t.UsuarioId).OnDelete(DeleteBehavior.Cascade);
    }
}
