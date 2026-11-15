/*
  V9 · Cada revisión guarda su título, para mostrar el historial sin depender del código
  que la generó.
*/
ALTER TABLE ops.monitoring_check
    ADD title NVARCHAR(80) NOT NULL CONSTRAINT DF_monitoring_check_title DEFAULT (N'');
GO
