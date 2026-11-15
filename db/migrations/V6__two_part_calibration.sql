/*
  V6 · Calibración de dos partes.

  El factor único de V3 igualaba los totales mensuales, pero exageraba los días de pico:
  más de la mitad de lo que ve VIIRS ocurre donde MODIS no ve nada, y ese fuego
  "invisible" se cargaba entero sobre los días en que MODIS sí detectaba algo.

  Ahora el índice armonizado de un grupo es la suma de:
    · detectado → lo que el grupo vio, corregido según la intensidad local del fuego
                  (cuanto mayor el fuego, menor la ventaja de VIIRS).
    · fondo     → fuego pequeño que el grupo no alcanza a ver, estimado por zona y mes
                  y modulado por la actividad de cada día.
*/

DROP VIEW fire.v_calendar_day;
DROP VIEW fire.v_daily_region_index;
DROP VIEW fire.v_daily_cell_index;
GO
DROP TABLE fire.calibration_factor;
DROP TABLE fire.calibration_baseline;
GO

-- La columna guardaba el índice completo; ahora guarda solo la parte detectada.
-- Una columna usada por un CHECK no se puede renombrar: se quita y se vuelve a crear.
ALTER TABLE fire.daily_cell_harmonized DROP CONSTRAINT CK_daily_cell_harmonized_values;
ALTER TABLE fire.daily_region_harmonized DROP CONSTRAINT CK_daily_region_harmonized_values;
GO
EXEC sp_rename 'fire.daily_cell_harmonized.harmonized_index', 'detected_index', 'COLUMN';
EXEC sp_rename 'fire.daily_region_harmonized.harmonized_index', 'detected_index', 'COLUMN';
GO
ALTER TABLE fire.daily_cell_harmonized
    ADD CONSTRAINT CK_daily_cell_harmonized_values CHECK (active_loci > 0 AND detected_index >= 0);
ALTER TABLE fire.daily_region_harmonized
    ADD CONSTRAINT CK_daily_region_harmonized_values CHECK (active_loci > 0 AND detected_index >= 0);
GO

/* ── Respuesta a la intensidad: celdas equivalentes = coefficient × n ^ exponent ── */
-- n = celdas activas del grupo en una celda de calibración y un día.
CREATE TABLE fire.calibration_response (
    source_group_id  TINYINT       NOT NULL,
    coefficient      DECIMAL(9, 4) NOT NULL,
    exponent         DECIMAL(6, 4) NOT NULL,
    sample_cell_days INT           NOT NULL,
    CONSTRAINT PK_calibration_response PRIMARY KEY (source_group_id),
    CONSTRAINT FK_calibration_response_group FOREIGN KEY (source_group_id) REFERENCES ref.source_group (source_group_id),
    CONSTRAINT CK_calibration_response_values CHECK (coefficient > 0 AND exponent > 0 AND sample_cell_days > 0)
);
GO

/* ── Ajuste local de la respuesta por celda de calibración (r4) y mes ──── */
CREATE TABLE fire.calibration_factor (
    source_group_id TINYINT        NOT NULL,
    h3_cell         BIGINT         NOT NULL,
    month_of_year   TINYINT        NOT NULL,
    predicted_loci  DECIMAL(12, 2) NOT NULL,   -- lo que predice la respuesta general
    reference_loci  DECIMAL(12, 2) NOT NULL,   -- lo que vio la referencia por encima del fondo
    ratio           DECIMAL(9, 4)  NOT NULL,   -- corrección local; 1 = sin corrección
    CONSTRAINT PK_calibration_factor PRIMARY KEY (source_group_id, h3_cell, month_of_year),
    CONSTRAINT FK_calibration_factor_response FOREIGN KEY (source_group_id) REFERENCES fire.calibration_response (source_group_id),
    CONSTRAINT FK_calibration_factor_cell FOREIGN KEY (h3_cell) REFERENCES fire.grid_cell (h3_index),
    CONSTRAINT CK_calibration_factor_month CHECK (month_of_year BETWEEN 1 AND 12),
    CONSTRAINT CK_calibration_factor_values CHECK (predicted_loci >= 0 AND reference_loci >= 0 AND ratio > 0)
);
GO

/* ── Fondo: celdas equivalentes por día que el grupo no ve, por celda de mapa (r5) ── */
CREATE TABLE fire.background_cell_rate (
    source_group_id TINYINT        NOT NULL,
    h3_cell         BIGINT         NOT NULL,
    month_of_year   TINYINT        NOT NULL,
    daily_rate      DECIMAL(12, 6) NOT NULL,
    CONSTRAINT PK_background_cell_rate PRIMARY KEY (source_group_id, month_of_year, h3_cell),
    CONSTRAINT FK_background_cell_rate_response FOREIGN KEY (source_group_id) REFERENCES fire.calibration_response (source_group_id),
    CONSTRAINT FK_background_cell_rate_cell FOREIGN KEY (h3_cell) REFERENCES fire.grid_cell (h3_index),
    CONSTRAINT CK_background_cell_rate_month CHECK (month_of_year BETWEEN 1 AND 12),
    CONSTRAINT CK_background_cell_rate_value CHECK (daily_rate > 0)
);
GO

/* ── Fondo por región ─────────────────────────────────────────────────── */
CREATE TABLE fire.background_region_rate (
    source_group_id TINYINT        NOT NULL,
    region_id       INT            NOT NULL,
    month_of_year   TINYINT        NOT NULL,
    daily_rate      DECIMAL(12, 6) NOT NULL,
    CONSTRAINT PK_background_region_rate PRIMARY KEY (region_id, source_group_id, month_of_year),
    CONSTRAINT FK_background_region_rate_response FOREIGN KEY (source_group_id) REFERENCES fire.calibration_response (source_group_id),
    CONSTRAINT FK_background_region_rate_region FOREIGN KEY (region_id) REFERENCES ref.region (region_id),
    CONSTRAINT CK_background_region_rate_month CHECK (month_of_year BETWEEN 1 AND 12),
    CONSTRAINT CK_background_region_rate_value CHECK (daily_rate > 0)
);
GO

/* ── Cuánto pesa el fondo cada día: más fuego visible, más fuego invisible ── */
CREATE TABLE fire.daily_background_scale (
    activity_date   DATE          NOT NULL,
    source_group_id TINYINT       NOT NULL,
    scale           DECIMAL(9, 4) NOT NULL,   -- promedia 1 dentro de cada mes
    CONSTRAINT PK_daily_background_scale PRIMARY KEY (activity_date, source_group_id),
    CONSTRAINT FK_daily_background_scale_response FOREIGN KEY (source_group_id) REFERENCES fire.calibration_response (source_group_id),
    CONSTRAINT CK_daily_background_scale_value CHECK (scale >= 0)
);
GO

/* Serie oficial por región: detectado + fondo, un valor por cada día observado. */
CREATE VIEW fire.v_daily_region_index AS
SELECT od.activity_date,
       r.region_id,
       od.source_group_id,
       COALESCE(h.active_loci, 0)                            AS active_loci,
       COALESCE(h.detected_index, 0)                         AS detected_index,
       CAST(COALESCE(b.daily_rate * s.scale, 0) AS DECIMAL(12, 4)) AS background_index,
       CAST(COALESCE(h.detected_index, 0) + COALESCE(b.daily_rate * s.scale, 0) AS DECIMAL(12, 4)) AS harmonized_index
FROM fire.observation_day od
CROSS JOIN ref.region r
LEFT JOIN fire.daily_region_harmonized h
       ON h.region_id = r.region_id
      AND h.activity_date = od.activity_date
      AND h.source_group_id = od.source_group_id
LEFT JOIN fire.daily_background_scale s
       ON s.activity_date = od.activity_date
      AND s.source_group_id = od.source_group_id
LEFT JOIN fire.background_region_rate b
       ON b.region_id = r.region_id
      AND b.source_group_id = od.source_group_id
      AND b.month_of_year = MONTH(od.activity_date);
GO

/* Calendario: índice del día, lo normal para esa época y si el día es crítico. */
CREATE VIEW fire.v_calendar_day AS
SELECT i.activity_date,
       i.region_id,
       i.source_group_id,
       i.active_loci,
       i.detected_index,
       i.background_index,
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

/* Serie oficial por celda de mapa: toda celda con fuego detectado o con fondo ese día. */
CREATE VIEW fire.v_daily_cell_index AS
SELECT od.activity_date,
       cell.h3_cell,
       od.source_group_id,
       COALESCE(h.active_loci, 0)                            AS active_loci,
       COALESCE(h.detected_index, 0)                         AS detected_index,
       CAST(COALESCE(b.daily_rate * s.scale, 0) AS DECIMAL(12, 4)) AS background_index,
       CAST(COALESCE(h.detected_index, 0) + COALESCE(b.daily_rate * s.scale, 0) AS DECIMAL(12, 4)) AS harmonized_index
FROM fire.observation_day od
CROSS APPLY (
    SELECT dh.h3_cell
    FROM fire.daily_cell_harmonized dh
    WHERE dh.activity_date = od.activity_date AND dh.source_group_id = od.source_group_id
    UNION
    SELECT br.h3_cell
    FROM fire.background_cell_rate br
    WHERE br.source_group_id = od.source_group_id AND br.month_of_year = MONTH(od.activity_date)
) cell
LEFT JOIN fire.daily_cell_harmonized h
       ON h.activity_date = od.activity_date
      AND h.h3_cell = cell.h3_cell
      AND h.source_group_id = od.source_group_id
LEFT JOIN fire.daily_background_scale s
       ON s.activity_date = od.activity_date
      AND s.source_group_id = od.source_group_id
LEFT JOIN fire.background_cell_rate b
       ON b.h3_cell = cell.h3_cell
      AND b.source_group_id = od.source_group_id
      AND b.month_of_year = MONTH(od.activity_date);
GO
