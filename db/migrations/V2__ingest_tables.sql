/*
  V2 · Zona de aterrizaje: los registros de FIRMS tal como llegan, sin transformar.
  Todo lo armonizado (esquema fire) se puede reconstruir a partir de estas tablas.
*/

/* ── Lote de ingesta: un CSV de FIRMS o una respuesta de su API ────────── */
CREATE TABLE ingest.ingest_batch (
    batch_id       INT IDENTITY (1, 1) NOT NULL,
    source_name    VARCHAR(260) NOT NULL,   -- p. ej. "DL_FIRE_M-C61_848739.zip/fire_archive_M-C61_848739.csv"
    content_sha256 CHAR(64)     NOT NULL,   -- evita cargar dos veces el mismo contenido
    data_kind      VARCHAR(10)  NOT NULL,
    row_count      INT          NOT NULL,
    min_acq_date   DATE         NULL,
    max_acq_date   DATE         NULL,
    loaded_at      DATETIME2(0) NOT NULL CONSTRAINT DF_ingest_batch_loaded_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_ingest_batch PRIMARY KEY (batch_id),
    CONSTRAINT UQ_ingest_batch_sha256 UNIQUE (content_sha256),
    CONSTRAINT CK_ingest_batch_kind CHECK (data_kind IN ('ARCHIVE', 'NRT')),
    CONSTRAINT CK_ingest_batch_rows CHECK (row_count >= 0),
    CONSTRAINT CK_ingest_batch_dates CHECK (min_acq_date IS NULL OR max_acq_date >= min_acq_date)
);
GO

/* ── Foco de calor crudo (mismas columnas que entrega FIRMS) ───────────── */
CREATE TABLE ingest.raw_hotspot (
    raw_hotspot_id BIGINT IDENTITY (1, 1) NOT NULL,
    batch_id       INT           NOT NULL,
    latitude       DECIMAL(8, 5) NOT NULL,
    longitude      DECIMAL(8, 5) NOT NULL,
    brightness     DECIMAL(6, 2) NULL,       -- Kelvin
    scan           DECIMAL(4, 2) NULL,       -- km, tamaño del píxel a lo ancho del barrido
    track          DECIMAL(4, 2) NULL,       -- km, tamaño del píxel a lo largo de la órbita
    acq_date       DATE          NOT NULL,   -- UTC
    acq_time       CHAR(4)       NOT NULL,   -- HHMM en UTC
    satellite      VARCHAR(10)   NOT NULL,
    instrument     VARCHAR(10)   NOT NULL,
    confidence     VARCHAR(3)    NOT NULL,   -- MODIS: 0–100 · VIIRS: l / n / h
    version        VARCHAR(10)   NOT NULL,
    bright_t31     DECIMAL(6, 2) NULL,       -- Kelvin
    frp            DECIMAL(8, 2) NULL,       -- MW
    daynight       CHAR(1)       NOT NULL,
    type           TINYINT       NULL,       -- solo viene en el archivo histórico, no en NRT
    CONSTRAINT PK_raw_hotspot PRIMARY KEY (raw_hotspot_id) WITH (DATA_COMPRESSION = PAGE),
    CONSTRAINT FK_raw_hotspot_batch FOREIGN KEY (batch_id) REFERENCES ingest.ingest_batch (batch_id),
    CONSTRAINT FK_raw_hotspot_type FOREIGN KEY (type) REFERENCES ref.detection_type (detection_type_id),
    CONSTRAINT CK_raw_hotspot_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT CK_raw_hotspot_longitude CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT CK_raw_hotspot_acq_time CHECK (acq_time LIKE '[0-2][0-9][0-5][0-9]' AND acq_time < '2400'),
    CONSTRAINT CK_raw_hotspot_daynight CHECK (daynight IN ('D', 'N'))
);
GO
CREATE INDEX IX_raw_hotspot_batch ON ingest.raw_hotspot (batch_id) WITH (DATA_COMPRESSION = PAGE);
GO

/* ── Bitácora de ejecuciones del pipeline ─────────────────────────────── */
CREATE TABLE ingest.pipeline_run (
    pipeline_run_id INT IDENTITY (1, 1) NOT NULL,
    started_at      DATETIME2(0)   NOT NULL CONSTRAINT DF_pipeline_run_started_at DEFAULT (SYSUTCDATETIME()),
    finished_at     DATETIME2(0)   NULL,
    status          VARCHAR(10)    NOT NULL CONSTRAINT DF_pipeline_run_status DEFAULT ('RUNNING'),
    error_message   NVARCHAR(2000) NULL,
    CONSTRAINT PK_pipeline_run PRIMARY KEY (pipeline_run_id),
    CONSTRAINT CK_pipeline_run_status CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
    CONSTRAINT CK_pipeline_run_finished CHECK (finished_at IS NULL OR finished_at >= started_at),
    CONSTRAINT CK_pipeline_run_closed CHECK (
        (status = 'RUNNING' AND finished_at IS NULL) OR (status <> 'RUNNING' AND finished_at IS NOT NULL)
    )
);
GO

/* ── Métricas de cada ejecución (filas excluidas, calidad del ajuste…) ─── */
CREATE TABLE ingest.pipeline_run_metric (
    pipeline_run_id INT             NOT NULL,
    metric_code     VARCHAR(80)     NOT NULL,
    metric_value    DECIMAL(18, 4)  NOT NULL,
    CONSTRAINT PK_pipeline_run_metric PRIMARY KEY (pipeline_run_id, metric_code),
    CONSTRAINT FK_pipeline_run_metric_run FOREIGN KEY (pipeline_run_id)
        REFERENCES ingest.pipeline_run (pipeline_run_id) ON DELETE CASCADE
);
GO
