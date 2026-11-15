# 🔥 BoysFire — Calendario Unificado de Incendios (MODIS + VIIRS)

> **NASA Space Apps Challenge · San Vicente de Cañete · Reto 09**
> *"Conecta los datos. Comprende el fuego."* — Harmonization of MODIS and VIIRS Hot Spot

Aplicación web que **unifica los registros de focos de calor de MODIS y VIIRS** en una sola serie histórica armonizada (2000 → hoy), la presenta como **calendario de actividad de incendios** sobre un **mapa satelital interactivo**, y la usa para **analizar lo ocurrido, alertar en tiempo casi real y anticipar períodos críticos**.

---

## 1. El problema (análisis del reto)

| | **MODIS** (Terra / Aqua) | **VIIRS** (S-NPP / NOAA-20 / NOAA-21) |
|---|---|---|
| Disponible desde | Nov 2000 (Terra), Jul 2002 (Aqua) | 2012 (S-NPP), 2018 (NOAA-20), 2023 (NOAA-21) |
| Resolución del píxel | ~1 km | ~375 m |
| Confianza | Numérica 0–100 | Categórica: `low` / `nominal` / `high` |
| Sensibilidad | Pierde fuegos pequeños | Detecta 3–10× más focos |
| Futuro | Satélites al final de su vida útil | Sensor que lo reemplaza |

**Por qué hay que "armonizar":** si se juntan los datos sin más, la gráfica muestra un "aumento" falso de incendios a partir de 2012 que en realidad se debe a que entró un sensor más sensible. Además, un mismo incendio aparece varias veces (varios satélites, varias pasadas). El reto es construir **una sola serie comparable en el tiempo**, para que los patrones históricos y los períodos críticos sean reales y no artefactos del sensor.

---

## 2. Qué hace el sistema (módulos)

### 2.1 🗺️ Mapa satelital interactivo
- Mapa base satelital con **zoom continuo** desde todo el país hasta el nivel de parcela.
- Capas de **NASA GIBS** (imagen MODIS/VIIRS real del día seleccionado) + Sentinel-2 / Esri World Imagery.
- Visualización adaptativa según zoom:
  - Zoom bajo → **mapa de calor / hexágonos H3** (densidad).
  - Zoom medio → **clusters** de focos.
  - Zoom alto → **puntos individuales** con su huella real (1 km MODIS vs 375 m VIIRS) y **polígono del evento**.
- Clic en un evento → panel con: fecha de inicio/fin, área estimada, FRP (intensidad), sensores que lo vieron, imagen antes/después.
- Búsqueda por región (departamento / provincia / distrito de Perú) o dibujando un área.

### 2.2 📅 Calendario de actividad de incendios (núcleo del reto)
- **Heatmap tipo calendario** (estilo GitHub contributions): cada celda = un día, color = actividad armonizada.
- Vista **multianual** (filas = años, columnas = días del año) para ver la temporada de fuego repitiéndose y detectar años anómalos.
- Filtros: región, sensor (MODIS / VIIRS / armonizado), confianza mínima, tipo de cobertura (bosque, pastizal, cultivo).
- Marcado automático de **períodos críticos** (días por encima del percentil 90 histórico de esa región/fecha).
- Clic en un día → el mapa salta a esa fecha.

### 2.3 ⏱️ Línea de tiempo y comparación temporal
- **Slider de tiempo animado** (play/pause) para ver la evolución de un incendio día a día o de una temporada mes a mes.
- **Comparación temporal lado a lado / swipe**: dos fechas en el mismo mapa (antes vs después).
- Comparación **año vs año** y **año vs promedio histórico** (anomalía %).
- Gráficas de series: focos/día, FRP acumulado, área quemada mensual.

### 2.4 🔍 Detección de cambios / deformaciones en el terreno (cicatrices de fuego)
- Cálculo de **dNBR** (*differenced Normalized Burn Ratio*) con Sentinel-2 / Landsat antes y después del evento → mapa de **severidad de quemado** (baja, moderada, alta).
- Validación cruzada con el producto oficial de área quemada **MCD64A1**.
- Detección de **cambio de cobertura** (pérdida de vegetación vía NDVI) para ver recuperación post-incendio en meses/años siguientes.
- *(Opcional / avanzado)* deformación real del suelo con radar Sentinel-1 (InSAR) para zonas con riesgo de deslizamiento tras el fuego.

### 2.5 🚨 Sistema de alertas (tiempo casi real)
- Ingesta automática de **FIRMS NRT** cada 1–3 h (los datos llegan <3 h después de la pasada del satélite).
- El usuario define **zonas de interés** (polígono, distrito, área protegida, radio alrededor de su chacra/comunidad).
- Reglas de alerta:
  - Nuevo foco con confianza `nominal`/`high` dentro de la zona.
  - Crecimiento de un evento activo (más focos o FRP mayor que la pasada anterior).
  - Foco cerca de infraestructura crítica / áreas naturales protegidas.
- Canales: notificación en la web (WebSocket), **correo**, **Telegram / WhatsApp**.
- Nivel de alerta: 🟢 informativa · 🟡 vigilancia · 🟠 alerta · 🔴 emergencia.

### 2.6 🛡️ Prevención y riesgo
- **Índice de riesgo por zona** combinando:
  - Climatología histórica de fuego armonizada (¿esta zona suele quemar en esta semana del año?).
  - Meteorología actual y pronóstico (temperatura, humedad, viento, días sin lluvia) — Open-Meteo / NASA POWER.
  - Índice **FWI** (Fire Weather Index, NASA GFWED).
  - Estado de la vegetación (NDVI / sequedad).
- **Pronóstico de 7 días** de riesgo en el mapa.
- Recomendaciones preventivas por nivel (p. ej. no realizar quemas agrícolas, avisar a bomberos/municipio).
- Reporte ciudadano: el usuario puede reportar humo o fuego con foto + ubicación (validación cruzada con satélite).

### 2.7 📊 Histórico / "lo que ya ocurrió"
- Catálogo de **eventos de incendio** reconstruidos (no solo puntos): duración, área, intensidad, sensores.
- Ranking de distritos más afectados, tendencias por década, estacionalidad.
- Exportación CSV / GeoJSON / PDF de reportes por región.

---

## 3. Ideas propuestas (valor diferencial)
1. **Serie armonizada 2000–hoy** con factor de calibración MODIS↔VIIRS por celda y mes (lo central del reto, bien explicado en la app).
2. **"Huella del sensor"**: dibujar el píxel real (1 km vs 375 m) para que el usuario entienda por qué VIIRS ve más.
3. **Eventos en vez de puntos**: agrupar focos en incendios con identidad propia y ciclo de vida.
4. **Calendario de riesgo**: el mismo calendario pero hacia el futuro (pronóstico de 7 días + climatología).
5. **Modo comunidad**: alertas sencillas por Telegram en español para agricultores y municipios de Cañete y la sierra de Lima.
6. **Asistente de consulta en lenguaje natural** *(opcional)*: "¿Cuántos incendios hubo en Yauyos en septiembre de 2023?" → consulta + mapa.

---

## 4. Cómo se armoniza MODIS + VIIRS (pipeline implementado)

Código en `processing/src/boysfire/harmonize/`. Cada paso es un módulo.

```
 Archivos .zip de FIRMS (MODIS C6.1, VIIRS S-NPP, VIIRS NOAA-20)
            │
            ▼
 0. INGESTA ─────── ingest.raw_hotspot, tal como llega. Cada CSV se carga una sola
            │       vez (se identifica por su hash).
            ▼
 1. NORMALIZACIÓN ─ satélite, fecha y hora (UTC y hora de Perú) y confianza común:
            │         MODIS: <30 baja · 30–79 nominal · ≥80 alta
            │         VIIRS: l / n / h
            ▼
 2. GRILLA COMÚN ── cada foco cae en una celda H3 de ~1 km (resolución 8).
            ▼
 3. LIMPIEZA ────── fuera volcanes, industrias y mar (type ≠ 0), las fuentes fijas
            │       en datos NRT (que no traen tipo) y las detecciones repetidas.
            ▼
 4. COBERTURA ───── qué días observaba cada satélite. Un hueco no es un día sin fuego.
            ▼
 5. DEDUPLICACIÓN ─ se cuentan "celdas activas" (celda de ~1 km con fuego en un día),
            │       no focos. Un incendio de 1 km² es 1 píxel MODIS y ~7 VIIRS:
            │       contado así vale lo mismo para ambos.
            ▼
 6. CALIBRACIÓN ─── en los años comunes con VIIRS S-NPP se ajustan dos partes:
            │       · Respuesta: donde el grupo ve fuego, VIIRS ve más, pero la ventaja
            │         baja cuanto mayor es el fuego. Para una celda de ~1 770 km²
            │         (resolución 4) y un día con n celdas activas:
            │             equivalentes = coeficiente × n ^ exponente × ajuste local
            │       · Fondo: más de la mitad de lo que ve VIIRS ocurre donde el grupo
            │         no ve nada. Se estima una tasa diaria por zona y mes, modulada
            │         por la actividad de cada día.
            ▼
 7. SERIE ───────── índice armonizado = detectado + fondo, en "equivalente VIIRS
            │       S-NPP". Cada día usa el mejor grupo disponible:
            │       S-NPP → NOAA-20 → MODIS (Terra+Aqua) → Aqua → Terra.
            ▼
 8. REGIONES ────── cada celda de ~1 km se ubica en su distrito, provincia y
            │       departamento; todo se agrega en los cuatro niveles.
            ▼
 9. CLIMATOLOGÍA ── lo normal para cada día del año (±7 días) y umbral de día crítico
            │       (percentil 90, con un piso para la época de lluvias), por región.
            ▼
10. VALIDACIÓN ──── se compara la estimación desde MODIS con VIIRS real.
```

Un factor único por zona y mes iguala los totales, pero carga todo el "fondo" sobre los
días con detecciones y exagera los picos diarios. Por eso el modelo tiene dos partes.

**Resultado con los datos de Perú (2000-11 → 2026-11, 2,15 millones de focos):**

| Medida | Sin armonizar | Armonizado |
|---|---|---|
| Promedio anual 2013–2021 frente a 2003–2011 | **7,9 veces más** (salto falso) | **0,95** (sin salto) |
| Correlación mensual MODIS estimado vs VIIRS real, 2012–2021 | — | 0,98 |
| Igual, en 2022–2026 (años que la calibración no vio) | — | 0,995, sesgo +0,2 % |
| Correlación diaria MODIS estimado vs VIIRS real, 2022–2026 | — | 0,82 |
| Días extremos (percentil 99 diario) frente a VIIRS real, 2022–2026 | — | +1 % |
| Días críticos por año, 2003–2011 frente a 2013–2021 | — | 35 frente a 30 |

---

## 5. Fuentes de datos (todas abiertas)

| Fuente | Uso | Acceso |
|---|---|---|
| **NASA FIRMS** | Focos MODIS y VIIRS (NRT y archivo histórico) | API con `MAP_KEY` gratuito: `firms.modaps.eosdis.nasa.gov/api/area/csv/{KEY}/{SOURCE}/{BBOX}/{DIAS}/{FECHA}` + descarga de archivo histórico |
| **NASA GIBS** | Imágenes satelitales diarias como capas del mapa (WMTS con dimensión tiempo) | `gibs.earthdata.nasa.gov` |
| **MCD64A1** | Área quemada mensual oficial (validación) | NASA LP DAAC / Earthdata |
| **Sentinel-2 / Landsat** | dNBR, NDVI, antes/después | Copernicus Data Space / Microsoft Planetary Computer (STAC) |
| **NASA GFWED** | Fire Weather Index | NASA GISS |
| **Open-Meteo / NASA POWER** | Clima actual, pronóstico, histórico | API libre |
| **INEI / GeoGPS Perú** | Límites departamento/provincia/distrito | Shapefiles públicos |
| **SERNANP** | Áreas naturales protegidas | Geoservicios públicos |
| **ESA WorldCover** | Cobertura de suelo | Libre |

> Bounding box de Perú aprox.: `-81.4,-18.4,-68.6,-0.0`

---

## 6. Stack tecnológico

### Recomendación

| Capa | Propuesta del equipo | Recomendación | Motivo |
|---|---|---|---|
| Frontend | Angular | ✅ **Angular 18+** | Bien para dashboards grandes y tipados |
| Mapa | — | **MapLibre GL JS** (o Leaflet si el equipo ya lo conoce) | WebGL, maneja miles de puntos, capas de tiempo, 3D de relieve |
| Gráficas / calendario | — | **Apache ECharts** (`ngx-echarts`) | Trae gráfico tipo *calendar heatmap* nativo |
| Backend | Spring Boot | ✅ **Spring Boot 3 (Java 21)** | API REST, seguridad, schedulers, WebSocket |
| Procesamiento geo / satelital | — | **Microservicio Python (FastAPI)** | geopandas, rasterio, scikit-learn (DBSCAN), xarray: el ecosistema satelital está en Python |
| Base de datos | SQL Server | ✅ **SQL Server 2022 en Docker** (decisión final) | El equipo lo domina; H3 y el agrupamiento se calculan en Python |
| Tiles vectoriales | — | **Martin** o **pg_tileserv** (solo con PostGIS) | Sirve millones de puntos al mapa de forma eficiente |
| Cache / colas | — | Redis | Cache de agregados y cola de alertas |
| Notificaciones | — | Telegram Bot API + SMTP | Gratis y rápido de integrar |
| Despliegue | — | Docker Compose | Levantar todo con un comando |

**Sobre la base de datos:**
- **SQL Server** sí soporta datos espaciales (`geography`, índices espaciales, `STDistance`, `STIntersects`) y funciona con Spring Boot + Hibernate Spatial. Si el equipo lo domina, **es válido**.
- **PostgreSQL + PostGIS** es el estándar en GIS: más funciones (clustering `ST_ClusterDBSCAN`, `ST_ConcaveHull`, H3), servidores de tiles directos, integración nativa con geopandas/QGIS, y es gratuito para desplegar en la nube. **TimescaleDB** acelera las consultas por tiempo (calendario).
- 👉 **Decisión:** SQL Server 2022. La grilla H3, la calibración y el agrupamiento se hacen en el microservicio Python; el mapa recibe agregados por celda desde la API.

### Arquitectura

```
┌───────────────────────── Angular (SPA) ─────────────────────────┐
│ Mapa MapLibre │ Calendario ECharts │ Timeline │ Alertas │ Riesgo │
└───────┬───────────────────┬──────────────────────┬──────────────┘
        │ REST / WebSocket  │ Vector tiles          │ WMTS (GIBS)
        ▼                   ▼                       ▼
┌────────────────┐   ┌──────────────┐        NASA GIBS / Sentinel
│  Spring Boot   │   │ Martin tiles │
│ API · Auth JWT │   └──────┬───────┘
│ Alertas · Jobs │          │
└──┬─────────┬───┘          │
   │         │ REST         │
   │         ▼              │
   │  ┌──────────────────┐  │
   │  │ Python FastAPI   │  │  ← ingesta FIRMS, armonización,
   │  │ (procesamiento)  │  │    ST-DBSCAN, dNBR, modelo de riesgo
   │  └────────┬─────────┘  │
   ▼           ▼            ▼
┌─────────────────────────────────┐   ┌───────┐
│ PostgreSQL + PostGIS + Timescale│   │ Redis │
└─────────────────────────────────┘   └───────┘
```

---

## 7. Modelo de datos (implementado)

SQL Server 2022. Migraciones en `db/migrations/` (Flyway). Tres esquemas:

```
ref     catálogos
        sensor · satellite · confidence_level · detection_type
        source_group · source_group_satellite · region_level · region

ingest  datos tal como llegan y bitácora
        ingest_batch · raw_hotspot · pipeline_run · pipeline_run_metric

fire    modelo armonizado (se reconstruye desde ingest)
        grid_cell                celdas H3: locus r8 → mapa r5 → calibración r4
        hotspot                  foco limpio, 1 a 1 con su registro crudo
        observation_day          qué grupo de satélites alimenta cada día
        calibration_response     respuesta a la intensidad por grupo (coeficiente y exponente)
        calibration_factor       ajuste local de la respuesta por grupo, celda r4 y mes
        daily_background_scale   peso del fondo por día y grupo
        background_cell_rate     tasa diaria de fondo por grupo, celda r5 y mes
        background_region_rate   tasa diaria de fondo por grupo, región y mes
        daily_cell_activity      focos observados por día, celda r5 y satélite
        daily_cell_harmonized    parte detectada del índice por día, celda r5 y grupo
        daily_region_activity    focos observados por día, región y satélite
        daily_region_harmonized  parte detectada del índice por día, región y grupo
        region_climatology       lo normal y el umbral crítico por día del año

vistas  fire.v_hotspot · fire.v_daily_region_index · fire.v_calendar_day · fire.v_daily_cell_index
        (las tres últimas entregan detected_index + background_index = harmonized_index)
```

`ref.region` tiene Perú, 25 departamentos, 195 provincias y 1 826 distritos con su geometría.
Cada celda de ~1 km guarda su distrito en `fire.grid_cell.region_id`.

Pendiente (se añadirá con nuevas migraciones): `fire_event`, `alert_zone`, `alert`,
`risk_forecast` y `citizen_report`.

---

## 8. API (implementada)

Spring Boot 4 · Java 25 · solo lectura. Documentación interactiva en `http://localhost:8080/swagger-ui.html`.

| Endpoint | Descripción |
|---|---|
| `GET /api/meta` | Rango de fechas disponible, volumen de datos y métricas de validación |
| `GET /api/regions?parentId=&level=` | Regiones hijas de una región, o todas las de un nivel. Sin parámetros, el país |
| `GET /api/regions/search?q=` | Búsqueda por nombre, sin distinguir mayúsculas ni tildes |
| `GET /api/regions/locate?latitude=&longitude=` | Distrito, provincia y departamento que contienen un punto |
| `GET /api/regions/{id}` | Una región con sus ancestros |
| `GET /api/regions/{id}/geometry` | Contorno de la región (GeoJSON) |
| `GET /api/regions/{id}/children/geometry` | Contorno de cada región hija (GeoJSON) |
| `GET /api/calendar/days?regionId=&from=&to=` | Serie diaria armonizada: índice, detectado, fondo, lo normal, umbral y si es crítico |
| `GET /api/calendar/years?regionId=` | Resumen por año: serie armonizada junto a los focos crudos de MODIS y VIIRS |
| `GET /api/calendar/sensor-days?regionId=&from=&to=` | Focos observados por día y sensor, sin armonizar |
| `GET /api/calendar/climatology?regionId=` | Lo normal para cada día del año y el umbral crítico |
| `GET /api/calendar/children?parentId=&from=&to=` | Actividad de cada región hija, de mayor a menor, con su día pico |
| `GET /api/calendar/critical-periods?regionId=&from=&to=&minCriticalDays=&maxGapDays=` | Rachas de días críticos |
| `GET /api/hotspots?bbox=&from=&to=&sensor=&minConfidence=&limit=` | Focos individuales en un área (máximo 31 días) |
| `GET /api/map/cells?from=&to=&bbox=&includeBackground=` | Índice acumulado por celda hexagonal H3 (máximo 366 días) |

- Sin `regionId` se responde para el país; sin `from` o `to` se usa el inicio o el fin de la serie.
- `bbox` es `minLon,minLat,maxLon,maxLat`. Las fechas son `AAAA-MM-DD`, en hora de Perú.
- Los errores llegan como `application/problem+json` con un mensaje en `detail`.

Pendiente: eventos, alertas (REST y WebSocket), riesgo y reporte ciudadano.

---

## 9. Estructura del repositorio

```
Hackaton/
├── docker-compose.yml       # SQL Server + creación de la base + migraciones
├── .env.example             # variables (copiar a .env)
├── db/
│   ├── init/                # crea la base y el usuario de la aplicación
│   └── migrations/          # V1…V6: esquemas, tablas, catálogos y vistas (Flyway)
├── processing/              # Python: ingesta y armonización
│   ├── pyproject.toml
│   ├── src/boysfire/
│   │   ├── cli.py           # python -m boysfire regions | ingest | harmonize | run
│   │   ├── config.py        # conexión y parámetros de armonización
│   │   ├── domain/          # catálogos (satélites, confianza, grupos)
│   │   ├── db/              # conexión, carga masiva y repositorios por esquema
│   │   ├── ingest/          # lectura de los .zip de FIRMS y carga cruda
│   │   ├── regions/         # límites administrativos y ubicación de puntos
│   │   ├── harmonize/       # un módulo por paso del pipeline (sección 4)
│   │   └── pipeline/        # orquestación y bitácora
│   └── tests/               # pruebas unitarias (pytest)
├── data/raw/                # .zip descargados de FIRMS (no se versionan)
├── data/boundaries/         # límites administrativos (se descargan solos)
├── backend/                 # API REST (Spring Boot)
│   ├── pom.xml
│   └── src/main/java/pe/boysfire/api/
│       ├── common/          # configuración, errores, dominio, GeoJSON y valores de consulta
│       ├── region/          # un paquete por módulo: controlador, servicio, repositorio y modelos
│       ├── calendar/
│       ├── hotspot/
│       ├── mapcell/
│       └── meta/
└── frontend/                # Aplicación web (Angular + Tailwind CSS)
    └── src/
        ├── styles/          # tema (colores, tipografía), base y componentes comunes
        └── app/
            ├── core/        # acceso a la API, estado compartido y reglas (niveles, fechas, formato)
            ├── shared/      # piezas reutilizables: selector de región, leyenda, ranking, gráficos, iconos
            └── features/    # una carpeta por página: map, calendar, timeline, stats
```

---

## 10. Plan de trabajo para la hackathon (≈48 h)

**Fase 1 — MVP obligatorio (lo que pide el reto)**
- [x] Obtener `MAP_KEY` de FIRMS y descargar histórico de Perú (MODIS 2000–hoy, VIIRS S-NPP 2012–hoy).
- [x] Pipeline: limpieza + normalización de confianza + deduplicación + grilla H3.
- [x] Cálculo de factor de calibración y serie armonizada.
- [x] Tablas de actividad diaria y climatología.
- [x] Departamentos, provincias y distritos: todo agregado en los cuatro niveles.
- [x] API REST: calendario, regiones, focos y celdas del mapa (Spring Boot).
- [x] Angular: mapa satelital + calendario enlazados (clic en día → mapa), con seis mapas base.
- [x] Línea de tiempo, calendario de todos los años y página de estadísticas.
- [x] Reproducción día a día de un año en el mapa.

**Fase 2 — Diferenciadores**
- [ ] Eventos (ST-DBSCAN) con polígonos y panel de detalle.
- [ ] Ingesta NRT programada + alertas por zona (web + Telegram).
- [ ] Comparación temporal (swipe antes/después con capas GIBS).
- [ ] Períodos críticos (percentil 90).

**Fase 3 — Si sobra tiempo**
- [ ] dNBR / severidad de quemado de un evento destacado.
- [ ] Índice de riesgo con clima + FWI y pronóstico 7 días.
- [ ] Reporte ciudadano.

**Para el pitch:** mostrar un caso real de Perú (p. ej. temporada de incendios de septiembre 2024 en la sierra/Amazonía) recorriendo calendario → mapa → evento → antes/después → alerta.

---

## 11. Puesta en marcha

Requisitos: Docker Desktop, Python 3.11 o superior y el *ODBC Driver 18 for SQL Server*.

```bash
# 1. Variables: copia .env.example como .env y completa las contraseñas

# 2. Base de datos: levanta SQL Server, crea la base y aplica las migraciones
docker compose up -d

# 3. Entorno de Python (una sola vez)
cd processing
python -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"

# 4. Carga los límites de departamentos, provincias y distritos (una sola vez)
.venv\Scripts\python -m boysfire regions

# 5. Coloca los .zip de FIRMS en data/raw/ y ejecuta el pipeline (≈7 min)
.venv\Scripts\python -m boysfire run

# Pruebas
.venv\Scripts\python -m pytest

# 6. API (requiere Java 25 y Maven)
cd ..\backend
mvn spring-boot:run          # o: mvn package  y  java -jar target\boysfire-api-0.1.0.jar

# 7. Aplicación web (requiere Node 22), en otra terminal
cd ..\frontend
npm install
npm start                    # abre http://localhost:4200
```

SQL Server queda en `127.0.0.1:14330` (base `boysfire`), la API en `http://localhost:8080` y la aplicación en
`http://localhost:4200` (que reenvía `/api` a la API).
La API lee las credenciales del mismo `.env` de la raíz.

---

## 12. Limitaciones a declarar
- Un foco de calor **no es** necesariamente un incendio (quemas agrícolas, superficies calientes); se mitiga con filtros de confianza, tipo y fuentes estáticas.
- Nubes y humo pueden ocultar fuegos; las pasadas son 2–4 veces al día, no continuas.
- La calibración MODIS↔VIIRS es estadística: mejora la comparabilidad, pero no reconstruye fuegos pequeños que MODIS nunca vio.
- Antes de 2012, alrededor de tres cuartos del índice anual es **fondo estimado** (fuego pequeño que MODIS no ve), no detecciones. El fondo sigue la estacionalidad y la actividad del día, pero no ubica incendios concretos.
- En la era MODIS los días tranquilos salen algo altos (mediana diaria ≈ +17 a +27 % frente a VIIRS real); los días fuertes y extremos quedan sin sesgo apreciable.
- Los límites administrativos son una versión simplificada del INEI: faltan 8 distritos sin geometría y 1 provincia, los nombres vienen sin tildes y no incluye los distritos creados en los últimos años.
- De 2000-11 a 2002-07 solo existe Terra, que ve muy poco: en esos meses el índice es casi todo fondo y son los menos fiables.
- Los datos NRT pueden corregirse luego en la versión estándar (SP).

---

**Equipo BoysFire** · NASA Space Apps Challenge 2026 · San Vicente de Cañete, Perú
