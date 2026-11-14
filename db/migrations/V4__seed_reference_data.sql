/*
  V4 · Datos de los catálogos.
  Los identificadores son fijos: el código Python (boysfire/domain/catalogs.py) los refleja.
*/
INSERT INTO ref.sensor (sensor_id, code, name, nominal_resolution_m) VALUES
    (1, 'MODIS', N'Moderate Resolution Imaging Spectroradiometer', 1000),
    (2, 'VIIRS', N'Visible Infrared Imaging Radiometer Suite', 375);

INSERT INTO ref.satellite (satellite_id, sensor_id, code, name, data_start_date) VALUES
    (1, 1, 'TERRA',  N'Terra',                  '2000-11-01'),
    (2, 1, 'AQUA',   N'Aqua',                   '2002-07-04'),
    (3, 2, 'SNPP',   N'Suomi NPP',              '2012-01-20'),
    (4, 2, 'NOAA20', N'NOAA-20 (JPSS-1)',       '2018-04-01'),
    (5, 2, 'NOAA21', N'NOAA-21 (JPSS-2)',       '2024-01-17');

INSERT INTO ref.confidence_level (confidence_level_id, code, name_es) VALUES
    (1, 'LOW',     N'Baja'),
    (2, 'NOMINAL', N'Nominal'),
    (3, 'HIGH',    N'Alta');

INSERT INTO ref.detection_type (detection_type_id, code, description_es, is_vegetation_fire) VALUES
    (0, 'VEGETATION', N'Presunto incendio de vegetación',                 1),
    (1, 'VOLCANO',    N'Volcán activo',                                   0),
    (2, 'STATIC',     N'Fuente fija en tierra (industria, mechero de gas)', 0),
    (3, 'OFFSHORE',   N'Detección en el mar',                             0);

-- La serie armonizada se expresa en unidades de VIIRS S-NPP (la serie VIIRS más larga).
INSERT INTO ref.source_group (source_group_id, code, name, priority, is_reference) VALUES
    (1, 'SNPP',   N'VIIRS S-NPP',          1, 1),
    (2, 'NOAA20', N'VIIRS NOAA-20',        2, 0),
    (3, 'NOAA21', N'VIIRS NOAA-21',        3, 0),
    (4, 'MODIS',  N'MODIS Terra + Aqua',   4, 0),
    (5, 'AQUA',   N'MODIS Aqua (solo)',    5, 0),
    (6, 'TERRA',  N'MODIS Terra (solo)',   6, 0);

INSERT INTO ref.source_group_satellite (source_group_id, satellite_id) VALUES
    (1, 3),
    (2, 4),
    (3, 5),
    (4, 1), (4, 2),
    (5, 2),
    (6, 1);

INSERT INTO ref.region_level (region_level_id, code, name_es) VALUES
    (1, 'COUNTRY',    N'País'),
    (2, 'DEPARTMENT', N'Departamento'),
    (3, 'PROVINCE',   N'Provincia'),
    (4, 'DISTRICT',   N'Distrito');

INSERT INTO ref.region (region_level_id, parent_region_id, code, name, geom)
VALUES (1, NULL, 'PE', N'Perú', NULL);
GO
