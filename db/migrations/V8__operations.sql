/*
  V8 · Operación: reportes comunitarios, responsables locales, alertas, comunicaciones,
  respuestas y monitoreo de los datos.

  Una alerta nace de una regla (riesgo alto, focos activos o un reporte de la comunidad),
  se envía a los responsables de su zona, y guarda cada envío, cada respuesta y cada
  cambio de estado: es el registro de lo que se avisó, a quién y qué contestaron.
*/
CREATE SCHEMA ops AUTHORIZATION dbo;
GO

/* ── Tipos de reporte comunitario ──────────────────────────────────────── */
CREATE TABLE ref.report_type (
    report_type_id TINYINT      NOT NULL,
    code           VARCHAR(20)  NOT NULL,
    name_es        NVARCHAR(40) NOT NULL,
    CONSTRAINT PK_report_type PRIMARY KEY (report_type_id),
    CONSTRAINT UQ_report_type_code UNIQUE (code)
);
GO

/* ── Reporte de la comunidad ───────────────────────────────────────────── */
CREATE TABLE ops.community_report (
    report_id           INT IDENTITY (1, 1) NOT NULL,
    report_type_id      TINYINT        NOT NULL,
    latitude            DECIMAL(8, 5)  NOT NULL,
    longitude           DECIMAL(8, 5)  NOT NULL,
    region_id           INT            NULL,   -- distrito que contiene el punto
    description         NVARCHAR(500)  NULL,
    reporter_name       NVARCHAR(80)   NULL,
    reporter_contact    NVARCHAR(80)   NULL,   -- teléfono o correo; solo lo ven los operadores
    status              VARCHAR(12)    NOT NULL CONSTRAINT DF_community_report_status DEFAULT ('RECEIVED'),
    nearest_hotspot_id  BIGINT         NULL,   -- contraste con satélite
    nearest_hotspot_km  DECIMAL(6, 2)  NULL,
    created_at          DATETIME2(0)   NOT NULL CONSTRAINT DF_community_report_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at          DATETIME2(0)   NOT NULL CONSTRAINT DF_community_report_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_community_report PRIMARY KEY (report_id),
    CONSTRAINT FK_community_report_type FOREIGN KEY (report_type_id) REFERENCES ref.report_type (report_type_id),
    CONSTRAINT FK_community_report_region FOREIGN KEY (region_id) REFERENCES ref.region (region_id),
    CONSTRAINT FK_community_report_hotspot FOREIGN KEY (nearest_hotspot_id) REFERENCES fire.hotspot (hotspot_id),
    CONSTRAINT CK_community_report_status CHECK (status IN ('RECEIVED', 'VERIFYING', 'CONFIRMED', 'DISMISSED')),
    CONSTRAINT CK_community_report_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT CK_community_report_longitude CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT CK_community_report_distance CHECK (nearest_hotspot_km IS NULL OR nearest_hotspot_km >= 0)
);
GO
CREATE INDEX IX_community_report_status ON ops.community_report (status, created_at DESC);
GO

/* ── Responsables y autoridades de cada localidad ──────────────────────── */
CREATE TABLE ops.local_contact (
    contact_id       INT IDENTITY (1, 1) NOT NULL,
    region_id        INT           NOT NULL,
    full_name        NVARCHAR(80)  NOT NULL,
    role_name        NVARCHAR(80)  NOT NULL,   -- "Teniente gobernador", "Jefe de bomberos"…
    contact_kind     VARCHAR(10)   NOT NULL,
    phone            VARCHAR(20)   NULL,
    telegram_chat_id BIGINT        NULL,
    link_code        CHAR(8)       NOT NULL,   -- se envía al bot para enlazar su Telegram
    is_active        BIT           NOT NULL CONSTRAINT DF_local_contact_active DEFAULT (1),
    created_at       DATETIME2(0)  NOT NULL CONSTRAINT DF_local_contact_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_local_contact PRIMARY KEY (contact_id),
    CONSTRAINT FK_local_contact_region FOREIGN KEY (region_id) REFERENCES ref.region (region_id),
    CONSTRAINT UQ_local_contact_link_code UNIQUE (link_code),
    CONSTRAINT CK_local_contact_kind CHECK (contact_kind IN ('COMMUNITY', 'AUTHORITY'))
);
GO
CREATE INDEX IX_local_contact_region ON ops.local_contact (region_id) WHERE is_active = 1;
CREATE UNIQUE INDEX UQ_local_contact_chat ON ops.local_contact (telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
GO

/* ── Alerta ────────────────────────────────────────────────────────────── */
CREATE TABLE ops.alert (
    alert_id      INT IDENTITY (1, 1) NOT NULL,
    region_id     INT            NOT NULL,
    alert_type    VARCHAR(20)    NOT NULL,
    risk_level_id TINYINT        NOT NULL,
    title         NVARCHAR(120)  NOT NULL,
    message       NVARCHAR(1000) NOT NULL,
    status        VARCHAR(12)    NOT NULL CONSTRAINT DF_alert_status DEFAULT ('OPEN'),
    dedupe_key    VARCHAR(60)    NOT NULL,   -- una sola alerta por hecho (p. ej. "risk:62:2026-11-15")
    report_id     INT            NULL,
    created_at    DATETIME2(0)   NOT NULL CONSTRAINT DF_alert_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at    DATETIME2(0)   NOT NULL CONSTRAINT DF_alert_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_alert PRIMARY KEY (alert_id),
    CONSTRAINT FK_alert_region FOREIGN KEY (region_id) REFERENCES ref.region (region_id),
    CONSTRAINT FK_alert_level FOREIGN KEY (risk_level_id) REFERENCES ref.risk_level (risk_level_id),
    CONSTRAINT FK_alert_report FOREIGN KEY (report_id) REFERENCES ops.community_report (report_id),
    CONSTRAINT UQ_alert_dedupe UNIQUE (dedupe_key),
    CONSTRAINT CK_alert_type CHECK (alert_type IN ('HIGH_RISK', 'ACTIVE_FIRE', 'COMMUNITY_REPORT')),
    CONSTRAINT CK_alert_status CHECK (status IN ('OPEN', 'NOTIFIED', 'VERIFYING', 'CONFIRMED', 'DISMISSED', 'CLOSED')),
    -- Solo las alertas de reporte comunitario apuntan a un reporte, y siempre lo hacen.
    CONSTRAINT CK_alert_report CHECK (
        (alert_type = 'COMMUNITY_REPORT' AND report_id IS NOT NULL)
        OR (alert_type <> 'COMMUNITY_REPORT' AND report_id IS NULL)
    )
);
GO
CREATE INDEX IX_alert_status ON ops.alert (status, created_at DESC);
GO

/* ── Envío de una alerta a un responsable ──────────────────────────────── */
CREATE TABLE ops.alert_delivery (
    delivery_id         INT IDENTITY (1, 1) NOT NULL,
    alert_id            INT            NOT NULL,
    contact_id          INT            NOT NULL,
    channel             VARCHAR(10)    NOT NULL,
    status              VARCHAR(10)    NOT NULL,
    external_message_id VARCHAR(40)    NULL,
    error_message       NVARCHAR(500)  NULL,
    sent_at             DATETIME2(0)   NOT NULL CONSTRAINT DF_alert_delivery_sent_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_alert_delivery PRIMARY KEY (delivery_id),
    CONSTRAINT FK_alert_delivery_alert FOREIGN KEY (alert_id) REFERENCES ops.alert (alert_id),
    CONSTRAINT FK_alert_delivery_contact FOREIGN KEY (contact_id) REFERENCES ops.local_contact (contact_id),
    CONSTRAINT CK_alert_delivery_channel CHECK (channel IN ('TELEGRAM', 'SIMULATED')),
    CONSTRAINT CK_alert_delivery_status CHECK (status IN ('SENT', 'FAILED', 'SIMULATED')),
    -- Una alerta llega una sola vez a cada responsable.
    CONSTRAINT UQ_alert_delivery_contact UNIQUE (alert_id, contact_id)
);
GO

/* ── Respuesta de un responsable (por Telegram o registrada en el panel) ── */
CREATE TABLE ops.alert_response (
    response_id  INT IDENTITY (1, 1) NOT NULL,
    alert_id     INT           NOT NULL,
    contact_id   INT           NULL,   -- NULL: la registró un operador sin responsable asociado
    response     VARCHAR(12)   NOT NULL,
    channel      VARCHAR(10)   NOT NULL,
    note         NVARCHAR(500) NULL,
    responded_at DATETIME2(0)  NOT NULL CONSTRAINT DF_alert_response_responded_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_alert_response PRIMARY KEY (response_id),
    CONSTRAINT FK_alert_response_alert FOREIGN KEY (alert_id) REFERENCES ops.alert (alert_id),
    CONSTRAINT FK_alert_response_contact FOREIGN KEY (contact_id) REFERENCES ops.local_contact (contact_id),
    CONSTRAINT CK_alert_response_value CHECK (response IN ('RECEIVED', 'VERIFYING', 'CONFIRMED', 'FALSE_ALARM')),
    CONSTRAINT CK_alert_response_channel CHECK (channel IN ('TELEGRAM', 'PANEL'))
);
GO
CREATE INDEX IX_alert_response_alert ON ops.alert_response (alert_id, responded_at);
GO

/* ── Historial de estados de la alerta ─────────────────────────────────── */
CREATE TABLE ops.alert_status_change (
    change_id   INT IDENTITY (1, 1) NOT NULL,
    alert_id    INT           NOT NULL,
    from_status VARCHAR(12)   NULL,
    to_status   VARCHAR(12)   NOT NULL,
    actor       NVARCHAR(80)  NOT NULL,   -- "sistema", "operador" o el nombre del responsable
    note        NVARCHAR(500) NULL,
    changed_at  DATETIME2(0)  NOT NULL CONSTRAINT DF_alert_status_change_changed_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_alert_status_change PRIMARY KEY (change_id),
    CONSTRAINT FK_alert_status_change_alert FOREIGN KEY (alert_id) REFERENCES ops.alert (alert_id)
);
GO
CREATE INDEX IX_alert_status_change_alert ON ops.alert_status_change (alert_id, changed_at);
GO

/* ── Revisiones periódicas de los datos ────────────────────────────────── */
CREATE TABLE ops.monitoring_check (
    check_id   INT IDENTITY (1, 1) NOT NULL,
    check_code VARCHAR(30)    NOT NULL,
    status     VARCHAR(8)     NOT NULL,
    message    NVARCHAR(300)  NOT NULL,
    checked_at DATETIME2(0)   NOT NULL CONSTRAINT DF_monitoring_check_checked_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_monitoring_check PRIMARY KEY (check_id),
    CONSTRAINT CK_monitoring_check_status CHECK (status IN ('OK', 'WARNING', 'ERROR'))
);
GO
CREATE INDEX IX_monitoring_check_code ON ops.monitoring_check (check_code, checked_at DESC);
GO

/* ── Estado de las integraciones (p. ej. último mensaje leído de Telegram) ── */
CREATE TABLE ops.integration_state (
    state_key   VARCHAR(40)  NOT NULL,
    state_value VARCHAR(100) NOT NULL,
    updated_at  DATETIME2(0) NOT NULL CONSTRAINT DF_integration_state_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_integration_state PRIMARY KEY (state_key)
);
GO

INSERT INTO ref.report_type (report_type_id, code, name_es) VALUES
    (1, 'SMOKE',             N'Humo'),
    (2, 'VISIBLE_FIRE',      N'Fuego visible'),
    (3, 'AGRICULTURAL_BURN', N'Quema agrícola'),
    (4, 'OTHER',             N'Otro');
GO
