/*
  V3 · Modelo armonizado.

  Idea central: MODIS (píxel ~1 km) y VIIRS (~375 m) no se pueden sumar tal cual.
    1. Cada foco se ubica en una celda H3 de ~1 km ("locus"). Varios focos del mismo
       grupo de satélites en la misma celda y día cuentan una sola vez → se elimina
       el sesgo por tamaño de píxel y los duplicados.
    2. Lo que queda (la distinta sensibilidad) se corrige con un factor de calibración
       por celda grande y mes, medido en los años en que ambos sensores coinciden.
    3. El resultado se expresa siempre en "equivalente VIIRS S-NPP".
*/

/* ── Celdas de la grilla H3 (jerarquía: locus r8 → mapa r5 → calibración r4) ── */
CREATE TABLE fire.grid_cell (
    h3_index         BIGINT        NOT NULL,   -- índice H3 de 64 bits
    resolution       TINYINT       NOT NULL,
    parent_h3_index  BIGINT        NULL,
    center_latitude  DECIMAL(8, 5) NOT NULL,
    center_longitude DECIMAL(8, 5) NOT NULL,
    region_id        INT           NULL,       -- región administrativa más fina que contiene el centro
    CONSTRAINT PK_grid_cell PRIMARY KEY (h3_index),
    CONSTRAINT FK_grid_cell_parent FOREIGN KEY (parent_h3_index) REFERENCES fire.grid_cell (h3_index),
    CONSTRAINT FK_grid_cell_region FOREIGN KEY (region_id) REFERENCES ref.region (region_id),
    CONSTRAINT CK_grid_cell_resolution CHECK (resolution BETWEEN 0 AND 15),
    CONSTRAINT CK_grid_cell_not_own_parent CHECK (parent_h3_index IS NULL OR parent_h3_index <> h3_index),
    CONSTRAINT CK_grid_cell_latitude CHECK (center_latitude BETWEEN -90 AND 90),
    CONSTRAINT CK_grid_cell_longitude CHECK (center_longitude BETWEEN -180 AND 180)
);
GO
CREATE INDEX IX_grid_cell_parent ON fire.grid_cell (parent_h3_index);
CREATE INDEX IX_grid_cell_region ON fire.grid_cell (region_id) WHERE region_id IS NOT NULL;
CREATE INDEX IX_grid_cell_resolution ON fire.grid_cell (resolution) INCLUDE (center_latitude, center_longitude);
GO

/* ── Foco de calor limpio y normalizado (1 a 1 con su registro crudo) ──── */
CREATE TABLE fire.hotspot (
    hotspot_id          BIGINT        NOT NULL,   -- = ingest.raw_hotspot.raw_hotspot_id
    satellite_id        TINYINT       NOT NULL,
    confidence_level_id TINYINT       NOT NULL,
    acq_datetime_utc    DATETIME2(0)  NOT NULL,
    -- Perú usa UTC−5 todo el año (sin horario de verano).
    acq_date_local      AS (CAST(DATEADD(HOUR, -5, acq_datetime_utc) AS DATE)) PERSISTED NOT NULL,
    latitude            DECIMAL(8, 5) NOT NULL,
    longitude           DECIMAL(8, 5) NOT NULL,
    is_daytime          BIT           NOT NULL,
    frp_mw              DECIMAL(8, 2) NULL,       -- potencia radiativa del fuego
    scan_km             DECIMAL(4, 2) NULL,       -- huella real del píxel
    track_km            DECIMAL(4, 2) NULL,
    h3_cell             BIGINT        NOT NULL,   -- celda locus (~1 km)
    geom                AS (geography::Point(latitude, longitude, 4326)),
    CONSTRAINT PK_hotspot PRIMARY KEY NONCLUSTERED (hotspot_id),
    CONSTRAINT FK_hotspot_raw FOREIGN KEY (hotspot_id) REFERENCES ingest.raw_hotspot (raw_hotspot_id),
    CONSTRAINT FK_hotspot_satellite FOREIGN KEY (satellite_id) REFERENCES ref.satellite (satellite_id),
    CONSTRAINT FK_hotspot_confidence FOREIGN KEY (confidence_level_id) REFERENCES ref.confidence_level (confidence_level_id),
    CONSTRAINT FK_hotspot_cell FOREIGN KEY (h3_cell) REFERENCES fire.grid_cell (h3_index),
    -- Una misma detección no puede entrar dos veces.
    CONSTRAINT UQ_hotspot_detection UNIQUE (satellite_id, acq_datetime_utc, latitude, longitude) WITH (DATA_COMPRESSION = PAGE),
    CONSTRAINT CK_hotspot_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT CK_hotspot_longitude CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT CK_hotspot_frp CHECK (frp_mw IS NULL OR frp_mw >= 0),
    CONSTRAINT CK_hotspot_pixel CHECK ((scan_km IS NULL OR scan_km > 0) AND (track_km IS NULL OR track_km > 0))
);
GO
-- El calendario, el mapa y la línea de tiempo siempre filtran por fecha.
CREATE UNIQUE CLUSTERED INDEX CIX_hotspot_date ON fire.hotspot (acq_date_local, hotspot_id) WITH (DATA_COMPRESSION = PAGE);
CREATE INDEX IX_hotspot_cell ON fire.hotspot (h3_cell, acq_date_local) WITH (DATA_COMPRESSION = PAGE);
GO

/* ── Qué grupo de satélites alimenta la serie cada día ─────────────────── */
-- Un día sin fila es un día sin observación (hueco), no un día sin fuego.
CREATE TABLE fire.observation_day (
    activity_date   DATE    NOT NULL,
    source_group_id TINYINT NOT NULL,
    CONSTRAINT PK_observation_day PRIMARY KEY (activity_date),
    CONSTRAINT FK_observation_day_group FOREIGN KEY (source_group_id) REFERENCES ref.source_group (source_group_id)
);
GO

/* ── Factor de calibración nacional por mes (base del ajuste) ──────────── */
CREATE TABLE fire.calibration_baseline (
    source_group_id TINYINT       NOT NULL,
    month_of_year   TINYINT       NOT NULL,
    source_loci     INT           NOT NULL,   -- celdas-día vistas por el grupo en el período común
    reference_loci  INT           NOT NULL,   -- celdas-día vistas por la referencia en el mismo período
    ratio           DECIMAL(9, 4) NOT NULL,
    CONSTRAINT PK_calibration_baseline PRIMARY KEY (source_group_id, month_of_year),
    CONSTRAINT FK_calibration_baseline_group FOREIGN KEY (source_group_id) REFERENCES ref.source_group (source_group_id),
    CONSTRAINT CK_calibration_baseline_month CHECK (month_of_year BETWEEN 1 AND 12),
    CONSTRAINT CK_calibration_baseline_counts CHECK (source_loci >= 0 AND reference_loci >= 0),
    CONSTRAINT CK_calibration_baseline_ratio CHECK (ratio > 0)
);
GO

/* ── Factor de calibración por celda (r4) y mes ───────────────────────── */
CREATE TABLE fire.calibration_factor (
    source_group_id TINYINT       NOT NULL,
    h3_cell         BIGINT        NOT NULL,
    month_of_year   TINYINT       NOT NULL,
    source_loci     INT           NOT NULL,
    reference_loci  INT           NOT NULL,
    ratio           DECIMAL(9, 4) NOT NULL,   -- por cuánto se multiplica el grupo para igualar a la referencia
    CONSTRAINT PK_calibration_factor PRIMARY KEY (source_group_id, h3_cell, month_of_year),
    CONSTRAINT FK_calibration_factor_baseline FOREIGN KEY (source_group_id, month_of_year)
        REFERENCES fire.calibration_baseline (source_group_id, month_of_year),
    CONSTRAINT FK_calibration_factor_cell FOREIGN KEY (h3_cell) REFERENCES fire.grid_cell (h3_index),
    CONSTRAINT CK_calibration_factor_counts CHECK (source_loci >= 0 AND reference_loci >= 0),
    CONSTRAINT CK_calibration_factor_ratio CHECK (ratio > 0)
);
GO

/* ── Actividad diaria observada por celda de mapa (r5) y satélite ──────── */
CREATE TABLE fire.daily_cell_activity (
    activity_date   DATE           NOT NULL,
    h3_cell         BIGINT         NOT NULL,
    satellite_id    TINYINT        NOT NULL,
    detection_count INT            NOT NULL,   -- focos limpios, cualquier confianza
    confident_count INT            NOT NULL,   -- focos con confianza nominal o alta
    frp_sum_mw      DECIMAL(12, 2) NOT NULL,
    frp_max_mw      DECIMAL(8, 2)  NOT NULL,
    CONSTRAINT PK_daily_cell_activity PRIMARY KEY (activity_date, h3_cell, satellite_id) WITH (DATA_COMPRESSION = PAGE),
    CONSTRAINT FK_daily_cell_activity_cell FOREIGN KEY (h3_cell) REFERENCES fire.grid_cell (h3_index),
    CONSTRAINT FK_daily_cell_activity_satellite FOREIGN KEY (satellite_id) REFERENCES ref.satellite (satellite_id),
    CONSTRAINT CK_daily_cell_activity_counts CHECK (detection_count > 0 AND confident_count BETWEEN 0 AND detection_count),
    CONSTRAINT CK_daily_cell_activity_frp CHECK (frp_sum_mw >= 0 AND frp_max_mw >= 0)
);
GO
CREATE INDEX IX_daily_cell_activity_cell ON fire.daily_cell_activity (h3_cell, activity_date) WITH (DATA_COMPRESSION = PAGE);
GO

/* ── Índice armonizado diario por celda de mapa (r5) y grupo ───────────── */
-- Se guarda la estimación de cada grupo disponible; observation_day dice cuál es la oficial.
CREATE TABLE fire.daily_cell_harmonized (
    activity_date    DATE           NOT NULL,
    h3_cell          BIGINT         NOT NULL,
    source_group_id  TINYINT        NOT NULL,
    active_loci      INT            NOT NULL,   -- celdas de ~1 km con fuego ese día
    harmonized_index DECIMAL(12, 4) NOT NULL,   -- active_loci × factor de calibración
    CONSTRAINT PK_daily_cell_harmonized PRIMARY KEY (activity_date, h3_cell, source_group_id) WITH (DATA_COMPRESSION = PAGE),
    CONSTRAINT FK_daily_cell_harmonized_cell FOREIGN KEY (h3_cell) REFERENCES fire.grid_cell (h3_index),
    CONSTRAINT FK_daily_cell_harmonized_group FOREIGN KEY (source_group_id) REFERENCES ref.source_group (source_group_id),
    CONSTRAINT CK_daily_cell_harmonized_values CHECK (active_loci > 0 AND harmonized_index >= 0)
);
GO
CREATE INDEX IX_daily_cell_harmonized_cell ON fire.daily_cell_harmonized (h3_cell, activity_date) WITH (DATA_COMPRESSION = PAGE);
GO

/* ── Actividad diaria observada por región y satélite ──────────────────── */
CREATE TABLE fire.daily_region_activity (
    activity_date   DATE           NOT NULL,
    region_id       INT            NOT NULL,
    satellite_id    TINYINT        NOT NULL,
    detection_count INT            NOT NULL,
    confident_count INT            NOT NULL,
    frp_sum_mw      DECIMAL(12, 2) NOT NULL,
    frp_max_mw      DECIMAL(8, 2)  NOT NULL,
    CONSTRAINT PK_daily_region_activity PRIMARY KEY (region_id, activity_date, satellite_id),
    CONSTRAINT FK_daily_region_activity_region FOREIGN KEY (region_id) REFERENCES ref.region (region_id),
    CONSTRAINT FK_daily_region_activity_satellite FOREIGN KEY (satellite_id) REFERENCES ref.satellite (satellite_id),
    CONSTRAINT CK_daily_region_activity_counts CHECK (detection_count > 0 AND confident_count BETWEEN 0 AND detection_count),
    CONSTRAINT CK_daily_region_activity_frp CHECK (frp_sum_mw >= 0 AND frp_max_mw >= 0)
);
GO

/* ── Índice armonizado diario por región y grupo (alimenta el calendario) ── */
CREATE TABLE fire.daily_region_harmonized (
    activity_date    DATE           NOT NULL,
    region_id        INT            NOT NULL,
    source_group_id  TINYINT        NOT NULL,
    active_loci      INT            NOT NULL,
    harmonized_index DECIMAL(12, 4) NOT NULL,
    CONSTRAINT PK_daily_region_harmonized PRIMARY KEY (region_id, activity_date, source_group_id),
    CONSTRAINT FK_daily_region_harmonized_region FOREIGN KEY (region_id) REFERENCES ref.region (region_id),
    CONSTRAINT FK_daily_region_harmonized_group FOREIGN KEY (source_group_id) REFERENCES ref.source_group (source_group_id),
    CONSTRAINT CK_daily_region_harmonized_values CHECK (active_loci > 0 AND harmonized_index >= 0)
);
GO

/* ── Climatología: qué es "normal" en cada región para cada día del año ─── */
CREATE TABLE fire.region_climatology (
    region_id          INT            NOT NULL,
    day_of_year        SMALLINT       NOT NULL,   -- 1–366, contado sobre un año bisiesto
    sample_years       TINYINT        NOT NULL,
    mean_index         DECIMAL(12, 4) NOT NULL,
    p50_index          DECIMAL(12, 4) NOT NULL,
    p90_index          DECIMAL(12, 4) NOT NULL,
    p95_index          DECIMAL(12, 4) NOT NULL,
    critical_threshold DECIMAL(12, 4) NOT NULL,   -- un día es crítico si su índice lo supera
    CONSTRAINT PK_region_climatology PRIMARY KEY (region_id, day_of_year),
    CONSTRAINT FK_region_climatology_region FOREIGN KEY (region_id) REFERENCES ref.region (region_id),
    CONSTRAINT CK_region_climatology_day CHECK (day_of_year BETWEEN 1 AND 366),
    CONSTRAINT CK_region_climatology_order CHECK (
        mean_index >= 0 AND p50_index >= 0 AND p90_index >= p50_index AND p95_index >= p90_index
        AND critical_threshold >= p90_index
    )
);
GO
