/*
  Crea la base de datos y el usuario de la aplicación.
  Se ejecuta con sqlcmd (variables $(...)) desde el servicio db-init. Es idempotente.
  Las tablas NO van aquí: van en db/migrations (Flyway).
*/
IF DB_ID(N'$(DB_NAME)') IS NULL
    CREATE DATABASE [$(DB_NAME)];
GO

-- Las cargas son masivas y reproducibles desde los archivos de FIRMS.
ALTER DATABASE [$(DB_NAME)] SET RECOVERY SIMPLE;
GO

-- Las lecturas ven la última versión confirmada en vez de esperar: la API sigue respondiendo
-- mientras la armonización reemplaza las tablas (varios minutos) en una sola transacción.
IF (SELECT is_read_committed_snapshot_on FROM sys.databases WHERE name = N'$(DB_NAME)') = 0
    ALTER DATABASE [$(DB_NAME)] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$(DB_APP_USER)')
    CREATE LOGIN [$(DB_APP_USER)]
        WITH PASSWORD = N'$(DB_APP_PASSWORD)', CHECK_POLICY = OFF, DEFAULT_DATABASE = [$(DB_NAME)];
ELSE
    ALTER LOGIN [$(DB_APP_USER)] WITH PASSWORD = N'$(DB_APP_PASSWORD)';
GO

USE [$(DB_NAME)];
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$(DB_APP_USER)')
    CREATE USER [$(DB_APP_USER)] FOR LOGIN [$(DB_APP_USER)];
GO

-- La aplicación lee y escribe datos, pero no administra el servidor.
ALTER ROLE db_datareader ADD MEMBER [$(DB_APP_USER)];
ALTER ROLE db_datawriter ADD MEMBER [$(DB_APP_USER)];
GO
