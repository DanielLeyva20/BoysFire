/*
  V7 · Prevención: riesgo de incendio por zona y recomendaciones.

  El riesgo es un indicador por reglas, no una predicción. Para cada provincia se toma el
  clima (Open-Meteo) y se suman puntos por factor; los distritos usan el clima de su
  provincia con su propia temporada y sus propios focos; departamentos y país se resumen
  a partir de sus provincias.
*/
CREATE SCHEMA risk AUTHORIZATION dbo;
GO

/* ── Niveles de riesgo ─────────────────────────────────────────────────── */
CREATE TABLE ref.risk_level (
    risk_level_id TINYINT      NOT NULL,   -- ordenado: 1 < 2 < 3
    code          VARCHAR(10)  NOT NULL,
    name_es       NVARCHAR(30) NOT NULL,
    min_score     TINYINT      NOT NULL,   -- puntaje desde el que se alcanza el nivel
    CONSTRAINT PK_risk_level PRIMARY KEY (risk_level_id),
    CONSTRAINT UQ_risk_level_code UNIQUE (code),
    CONSTRAINT UQ_risk_level_min_score UNIQUE (min_score)
);
GO

/* ── Factores que suman puntos ─────────────────────────────────────────── */
CREATE TABLE ref.risk_factor (
    risk_factor_id TINYINT       NOT NULL,
    code           VARCHAR(20)   NOT NULL,
    name_es        NVARCHAR(60)  NOT NULL,
    description_es NVARCHAR(200) NOT NULL,
    unit           NVARCHAR(20)  NULL,       -- unidad del valor observado
    CONSTRAINT PK_risk_factor PRIMARY KEY (risk_factor_id),
    CONSTRAINT UQ_risk_factor_code UNIQUE (code)
);
GO

/* ── Recomendaciones: por factor activo o desde un nivel de riesgo ─────── */
CREATE TABLE ref.recommendation (
    recommendation_id SMALLINT IDENTITY (1, 1) NOT NULL,
    risk_factor_id    TINYINT       NULL,
    min_risk_level_id TINYINT       NULL,
    text_es           NVARCHAR(300) NOT NULL,
    sort_order        TINYINT       NOT NULL,
    CONSTRAINT PK_recommendation PRIMARY KEY (recommendation_id),
    CONSTRAINT FK_recommendation_factor FOREIGN KEY (risk_factor_id) REFERENCES ref.risk_factor (risk_factor_id),
    CONSTRAINT FK_recommendation_level FOREIGN KEY (min_risk_level_id) REFERENCES ref.risk_level (risk_level_id),
    -- Exactamente uno de los dos disparadores.
    CONSTRAINT CK_recommendation_trigger CHECK (
        (risk_factor_id IS NOT NULL AND min_risk_level_id IS NULL)
        OR (risk_factor_id IS NULL AND min_risk_level_id IS NOT NULL)
    )
);
GO

/* ── Ejecuciones del cálculo ───────────────────────────────────────────── */
CREATE TABLE risk.refresh_run (
    refresh_run_id INT IDENTITY (1, 1) NOT NULL,
    started_at     DATETIME2(0)   NOT NULL CONSTRAINT DF_refresh_run_started_at DEFAULT (SYSUTCDATETIME()),
    finished_at    DATETIME2(0)   NULL,
    status         VARCHAR(10)    NOT NULL CONSTRAINT DF_refresh_run_status DEFAULT ('RUNNING'),
    weather_points SMALLINT       NULL,
    assessments    INT            NULL,
    error_message  NVARCHAR(2000) NULL,
    CONSTRAINT PK_refresh_run PRIMARY KEY (refresh_run_id),
    CONSTRAINT CK_refresh_run_status CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
    CONSTRAINT CK_refresh_run_closed CHECK (
        (status = 'RUNNING' AND finished_at IS NULL) OR (status <> 'RUNNING' AND finished_at IS NOT NULL)
    )
);
GO

/* ── Clima diario por provincia (pronóstico) ───────────────────────────── */
CREATE TABLE risk.weather_day (
    region_id         INT           NOT NULL,   -- provincia
    forecast_date     DATE          NOT NULL,
    temperature_max_c DECIMAL(4, 1) NOT NULL,
    humidity_min_pct  TINYINT       NOT NULL,
    wind_max_kmh      DECIMAL(5, 1) NOT NULL,
    gust_max_kmh      DECIMAL(5, 1) NOT NULL,
    precipitation_mm  DECIMAL(6, 1) NOT NULL,
    days_without_rain TINYINT       NOT NULL,   -- días seguidos sin lluvia útil hasta esa fecha
    fetched_at        DATETIME2(0)  NOT NULL,
    CONSTRAINT PK_weather_day PRIMARY KEY (region_id, forecast_date),
    CONSTRAINT FK_weather_day_region FOREIGN KEY (region_id) REFERENCES ref.region (region_id),
    CONSTRAINT CK_weather_day_values CHECK (
        humidity_min_pct <= 100 AND wind_max_kmh >= 0 AND gust_max_kmh >= 0 AND precipitation_mm >= 0
    )
);
GO

/* ── Evaluación de riesgo por región y día ─────────────────────────────── */
CREATE TABLE risk.assessment (
    region_id         INT          NOT NULL,
    assessment_date   DATE         NOT NULL,
    risk_level_id     TINYINT      NOT NULL,
    score             TINYINT      NOT NULL,
    weather_region_id INT          NULL,   -- provincia cuyo clima se usó (NULL si se resume de varias)
    computed_at       DATETIME2(0) NOT NULL,
    CONSTRAINT PK_assessment PRIMARY KEY (region_id, assessment_date),
    CONSTRAINT FK_assessment_region FOREIGN KEY (region_id) REFERENCES ref.region (region_id),
    CONSTRAINT FK_assessment_level FOREIGN KEY (risk_level_id) REFERENCES ref.risk_level (risk_level_id),
    CONSTRAINT FK_assessment_weather_region FOREIGN KEY (weather_region_id) REFERENCES ref.region (region_id)
);
GO
CREATE INDEX IX_assessment_date_level ON risk.assessment (assessment_date, risk_level_id) INCLUDE (score);
GO

/* ── Factores activos de cada evaluación ───────────────────────────────── */
CREATE TABLE risk.assessment_factor (
    region_id       INT           NOT NULL,
    assessment_date DATE          NOT NULL,
    risk_factor_id  TINYINT       NOT NULL,
    points          TINYINT       NOT NULL,
    observed_value  DECIMAL(8, 2) NULL,   -- evaluación directa: el valor medido
    affected_share  DECIMAL(5, 4) NULL,   -- evaluación resumida: fracción de provincias con el factor
    CONSTRAINT PK_assessment_factor PRIMARY KEY (region_id, assessment_date, risk_factor_id),
    CONSTRAINT FK_assessment_factor_assessment FOREIGN KEY (region_id, assessment_date)
        REFERENCES risk.assessment (region_id, assessment_date) ON DELETE CASCADE,
    CONSTRAINT FK_assessment_factor_factor FOREIGN KEY (risk_factor_id) REFERENCES ref.risk_factor (risk_factor_id),
    -- Exactamente uno de los dos valores, según cómo se evaluó la región.
    CONSTRAINT CK_assessment_factor_value CHECK (
        (observed_value IS NOT NULL AND affected_share IS NULL)
        OR (observed_value IS NULL AND affected_share IS NOT NULL)
    ),
    CONSTRAINT CK_assessment_factor_share CHECK (affected_share IS NULL OR affected_share BETWEEN 0 AND 1)
);
GO

/* ── Catálogos ─────────────────────────────────────────────────────────── */
INSERT INTO ref.risk_level (risk_level_id, code, name_es, min_score) VALUES
    (1, 'LOW',      N'Bajo',     0),
    (2, 'MODERATE', N'Moderado', 3),
    (3, 'HIGH',     N'Alto',     6);

INSERT INTO ref.risk_factor (risk_factor_id, code, name_es, description_es, unit) VALUES
    (1, 'STRONG_WIND',    N'Vientos fuertes',          N'Ráfagas que avivan y extienden el fuego.',                         N'km/h'),
    (2, 'DRY_VEGETATION', N'Vegetación seca',          N'Muchos días seguidos sin lluvia: el pasto y los rastrojos arden fácil.', N'días'),
    (3, 'DRY_AIR',        N'Aire seco',                N'Humedad baja: el combustible pierde agua y se enciende antes.',    N'%'),
    (4, 'HEAT',           N'Calor',                    N'Temperaturas altas que secan la vegetación.',                      N'°C'),
    (5, 'FIRE_SEASON',    N'Temporada de quemas',      N'Época del año en que esta zona suele tener más fuego.',            N'%'),
    (6, 'ACTIVE_FIRE',    N'Foco de calor detectado',  N'Satélites vieron focos de calor en la zona en los últimos días.',  N'focos');

INSERT INTO ref.recommendation (risk_factor_id, min_risk_level_id, text_es, sort_order) VALUES
    (1,    NULL, N'Evitar quemas y actividades que puedan generar chispas.', 10),
    (2,    NULL, N'Extremar precauciones con fuentes de fuego.', 20),
    (3,    NULL, N'No dejar fogatas ni residuos encendidos; tener agua o tierra a mano.', 30),
    (4,    NULL, N'Evitar trabajos con fuego en las horas de más calor (11:00 a 16:00).', 40),
    (5,    NULL, N'Reforzar la vigilancia y la preparación comunitaria.', 50),
    (6,    NULL, N'Revisar la zona y contrastar la información disponible.', 5),
    (NULL, 2,    N'Avisar a la comunidad del nivel de riesgo y acordar quién vigila.', 60),
    (NULL, 3,    N'Postergar toda quema agrícola hasta que baje el riesgo.', 1),
    (NULL, 3,    N'Ante humo o fuego visible, comunicarlo a las autoridades para su verificación (Bomberos: 116).', 2);
GO
