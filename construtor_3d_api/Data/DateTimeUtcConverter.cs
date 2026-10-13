using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace construtor_3d_api.Data;

// datetime2 não guarda fuso: os valores são gravados em UTC e lidos de volta marcados como UTC
public class DateTimeUtcConverter : ValueConverter<DateTime, DateTime>
{
    public DateTimeUtcConverter()
        : base(v => v, v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
    {
    }
}
