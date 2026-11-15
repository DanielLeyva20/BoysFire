/*
  V10 · El reporte comunitario recuerda cuál fue el foco de satélite más cercano, pero ya no
  lo exige como clave foránea: la armonización reconstruye fire.hotspot completa con TRUNCATE
  y SQL Server no lo permite en una tabla referenciada. Los identificadores de focos son los
  del registro crudo (ingest.raw_hotspot), que nunca se borra, así que la referencia no se pierde.
*/
ALTER TABLE ops.community_report DROP CONSTRAINT FK_community_report_hotspot;
GO
