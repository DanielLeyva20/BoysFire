/*
  V1 · Esquemas y catálogos de referencia.

  Esquemas:
    ref    → catálogos (sensores, satélites, niveles de confianza, regiones).
    ingest → datos tal como llegan de FIRMS y bitácora de ejecuciones.
    fire   → modelo armonizado: focos limpios, grilla, calibración y actividad diaria.
*/
CREATE SCHEMA ref AUTHORIZATION dbo;
GO
CREATE SCHEMA ingest AUTHORIZATION dbo;
GO
CREATE SCHEMA fire AUTHORIZATION dbo;
GO

-- El pipeline reconstruye las tablas derivadas con TRUNCATE, que exige ALTER.
GRANT ALTER ON SCHEMA::fire TO [${appuser}];
GO

/* ── Sensores ─────────────────────────────────────────────────────────── */
CREATE TABLE ref.sensor (
    sensor_id            TINYINT      NOT NULL,
    code                 VARCHAR(10)  NOT NULL,
    name                 NVARCHAR(80) NOT NULL,
    nominal_resolution_m SMALLINT     NOT NULL,
    CONSTRAINT PK_sensor PRIMARY KEY (sensor_id),
    CONSTRAINT UQ_sensor_code UNIQUE (code),
    CONSTRAINT CK_sensor_resolution CHECK (nominal_resolution_m > 0)
);
GO

/* ── Satélites (cada uno lleva un sensor) ─────────────────────────────── */
CREATE TABLE ref.satellite (
    satellite_id    TINYINT      NOT NULL,
    sensor_id       TINYINT      NOT NULL,
    code            VARCHAR(10)  NOT NULL,
    name            NVARCHAR(80) NOT NULL,
    data_start_date DATE         NOT NULL,
    CONSTRAINT PK_satellite PRIMARY KEY (satellite_id),
    CONSTRAINT UQ_satellite_code UNIQUE (code),
    CONSTRAINT FK_satellite_sensor FOREIGN KEY (sensor_id) REFERENCES ref.sensor (sensor_id)
);
GO

/* ── Nivel de confianza común a MODIS y VIIRS ─────────────────────────── */
CREATE TABLE ref.confidence_level (
    confidence_level_id TINYINT      NOT NULL,   -- ordenado: 1 < 2 < 3
    code                VARCHAR(10)  NOT NULL,
    name_es             NVARCHAR(30) NOT NULL,
    CONSTRAINT PK_confidence_level PRIMARY KEY (confidence_level_id),
    CONSTRAINT UQ_confidence_level_code UNIQUE (code),
    CONSTRAINT CK_confidence_level_id CHECK (confidence_level_id BETWEEN 1 AND 3)
);
GO

/* ── Tipo de detección según FIRMS (columna "type") ───────────────────── */
CREATE TABLE ref.detection_type (
    detection_type_id  TINYINT       NOT NULL,   -- mismo código que usa FIRMS
    code               VARCHAR(20)   NOT NULL,
    description_es     NVARCHAR(120) NOT NULL,
    is_vegetation_fire BIT           NOT NULL,
    CONSTRAINT PK_detection_type PRIMARY KEY (detection_type_id),
    CONSTRAINT UQ_detection_type_code UNIQUE (code)
);
GO

/* ── Grupos de satélites que pueden alimentar la serie armonizada ──────── */
CREATE TABLE ref.source_group (
    source_group_id TINYINT      NOT NULL,
    code            VARCHAR(10)  NOT NULL,
    name            NVARCHAR(80) NOT NULL,
    priority        TINYINT      NOT NULL,   -- 1 = se prefiere primero
    is_reference    BIT          NOT NULL,   -- la serie se expresa en unidades de este grupo
    CONSTRAINT PK_source_group PRIMARY KEY (source_group_id),
    CONSTRAINT UQ_source_group_code UNIQUE (code),
    CONSTRAINT UQ_source_group_priority UNIQUE (priority)
);
GO
-- Solo puede existir un grupo de referencia.
CREATE UNIQUE INDEX UQ_source_group_single_reference
    ON ref.source_group (is_reference) WHERE is_reference = 1;
GO

CREATE TABLE ref.source_group_satellite (
    source_group_id TINYINT NOT NULL,
    satellite_id    TINYINT NOT NULL,
    CONSTRAINT PK_source_group_satellite PRIMARY KEY (source_group_id, satellite_id),
    CONSTRAINT FK_sgs_source_group FOREIGN KEY (source_group_id) REFERENCES ref.source_group (source_group_id),
    CONSTRAINT FK_sgs_satellite FOREIGN KEY (satellite_id) REFERENCES ref.satellite (satellite_id)
);
GO

/* ── Regiones administrativas (país → departamento → provincia → distrito) ── */
CREATE TABLE ref.region_level (
    region_level_id TINYINT      NOT NULL,   -- 1 = país … 4 = distrito
    code            VARCHAR(12)  NOT NULL,
    name_es         NVARCHAR(30) NOT NULL,
    CONSTRAINT PK_region_level PRIMARY KEY (region_level_id),
    CONSTRAINT UQ_region_level_code UNIQUE (code)
);
GO

CREATE TABLE ref.region (
    region_id        INT IDENTITY (1, 1) NOT NULL,
    region_level_id  TINYINT       NOT NULL,
    parent_region_id INT           NULL,
    code             VARCHAR(10)   NOT NULL,   -- 'PE' o ubigeo del INEI
    name             NVARCHAR(100) NOT NULL,
    geom             GEOGRAPHY     NULL,
    CONSTRAINT PK_region PRIMARY KEY (region_id),
    CONSTRAINT UQ_region_code UNIQUE (code),
    CONSTRAINT FK_region_level FOREIGN KEY (region_level_id) REFERENCES ref.region_level (region_level_id),
    CONSTRAINT FK_region_parent FOREIGN KEY (parent_region_id) REFERENCES ref.region (region_id),
    -- Solo el país carece de padre.
    CONSTRAINT CK_region_parent CHECK (
        (region_level_id = 1 AND parent_region_id IS NULL)
        OR (region_level_id > 1 AND parent_region_id IS NOT NULL)
    )
);
GO
CREATE INDEX IX_region_parent ON ref.region (parent_region_id);
GO
CREATE SPATIAL INDEX SIX_region_geom ON ref.region (geom) USING GEOGRAPHY_AUTO_GRID;
GO
