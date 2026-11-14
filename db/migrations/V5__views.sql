/*
  V5 · Vistas de lectura para la API.
  Resuelven las uniones repetitivas; no guardan datos.
*/

/* Foco con los códigos de sus catálogos. */
CREATE VIEW fire.v_hotspot AS
SELECT h.hotspot_id,
       h.acq_datetime_utc,
       h.acq_date_local,
       h.latitude,
       h.longitude,
       h.is_daytime,
       h.frp_mw,
       h.scan_km,
       h.track_km,
       h.h3_cell,
       sat.code AS satellite_code,
       sen.code AS sensor_code,
       cl.code  AS confidence_code
FROM fire.hotspot h
JOIN ref.satellite sat       ON sat.satellite_id = h.satellite_id
JOIN ref.sensor sen          ON sen.sensor_id = sat.sensor_id
JOIN ref.confidence_level cl ON cl.confidence_level_id = h.confidence_level_id;
GO

/* Serie armonizada oficial por región: un valor por cada día observado (0 si no hubo fuego). */
CREATE VIEW fire.v_daily_region_index AS
SELECT od.activity_date,
       r.region_id,
       od.source_group_id,
       COALESCE(h.active_loci, 0)      AS active_loci,
       COALESCE(h.harmonized_index, 0) AS harmonized_index
FROM fire.observation_day od
CROSS JOIN ref.region r
LEFT JOIN fire.daily_region_harmonized h
       ON h.region_id = r.region_id
      AND h.activity_date = od.activity_date
      AND h.source_group_id = od.source_group_id;
GO

/* Calendario: índice del día, lo normal para esa época y si el día es crítico. */
CREATE VIEW fire.v_calendar_day AS
SELECT i.activity_date,
       i.region_id,
       i.source_group_id,
       i.active_loci,
       i.harmonized_index,
       c.mean_index AS expected_index,
       c.p90_index,
       c.critical_threshold,
       CAST(CASE WHEN i.harmonized_index > c.critical_threshold THEN 1 ELSE 0 END AS BIT) AS is_critical
FROM fire.v_daily_region_index i
LEFT JOIN fire.region_climatology c
       ON c.region_id = i.region_id
      AND c.day_of_year = DATEPART(DAYOFYEAR, DATEFROMPARTS(2000, MONTH(i.activity_date), DAY(i.activity_date)));
GO

/* Serie armonizada oficial por celda de mapa (solo celdas con fuego). */
CREATE VIEW fire.v_daily_cell_index AS
SELECT h.activity_date,
       h.h3_cell,
       h.source_group_id,
       h.active_loci,
       h.harmonized_index
FROM fire.daily_cell_harmonized h
JOIN fire.observation_day od
  ON od.activity_date = h.activity_date
 AND od.source_group_id = h.source_group_id;
GO
