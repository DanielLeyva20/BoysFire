/*
  Restaura la base desde /backup/boysfire.bak y reconecta el usuario de la aplicación.
  Se ejecuta con sqlcmd (variables $(...)) desde deploy/setup-db.sh.
*/
RESTORE DATABASE [$(DB_NAME)]
    FROM DISK = N'/backup/boysfire.bak'
    WITH REPLACE, RECOVERY, STATS = 10,
         MOVE N'$(LOGICAL_DATA)' TO N'/var/opt/mssql/data/$(DB_NAME).mdf',
         MOVE N'$(LOGICAL_LOG)'  TO N'/var/opt/mssql/data/$(DB_NAME)_log.ldf';
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$(DB_APP_USER)')
    CREATE LOGIN [$(DB_APP_USER)]
        WITH PASSWORD = N'$(DB_APP_PASSWORD)', CHECK_POLICY = OFF, DEFAULT_DATABASE = [$(DB_NAME)];
ELSE
    ALTER LOGIN [$(DB_APP_USER)] WITH PASSWORD = N'$(DB_APP_PASSWORD)';
GO

USE [$(DB_NAME)];
GO

-- El usuario viene del respaldo con el identificador del servidor anterior: se vuelve a enlazar.
IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$(DB_APP_USER)')
    ALTER USER [$(DB_APP_USER)] WITH LOGIN = [$(DB_APP_USER)];
ELSE
    CREATE USER [$(DB_APP_USER)] FOR LOGIN [$(DB_APP_USER)];
GO

ALTER ROLE db_datareader ADD MEMBER [$(DB_APP_USER)];
ALTER ROLE db_datawriter ADD MEMBER [$(DB_APP_USER)];
GO
