#!/bin/bash

set -e

echo "Aguardando SQL Server..."

until /opt/mssql-tools18/bin/sqlcmd \
    -S sqlserver,1433 \
    -U sa \
    -P "$MSSQL_SA_PASSWORD" \
    -C \
    -Q "SELECT 1" \
    >/dev/null 2>&1
do
    sleep 2
done

echo "SQL Server está pronto."

echo "Verificando banco $DB_DATABASE..."

/opt/mssql-tools18/bin/sqlcmd \
    -S sqlserver,1433 \
    -U sa \
    -P "$MSSQL_SA_PASSWORD" \
    -C \
    -Q "IF DB_ID(N'$DB_DATABASE') IS NULL CREATE DATABASE [$DB_DATABASE];"

echo "Banco $DB_DATABASE verificado."