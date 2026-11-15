# 🛰️ ¿En qué se basa BoysFire?

> Guía conceptual del sistema: qué datos usa, qué problema resuelve y por qué se puede confiar en lo que muestra.
> Para la parte técnica (base de datos, comandos, estructura del código) ver [README.md](README.md).

---

## 1. La idea en una frase

**BoysFire convierte 26 años de detecciones de calor hechas por satélites distintos en una sola historia comparable de los incendios en Perú, y la presenta como un calendario y un mapa para ver cuándo y dónde se quema, y cuándo hay que estar alerta.**

---

## 2. Qué es un foco de calor

Los satélites miran la Tierra en infrarrojo. Cuando un punto está mucho más caliente que lo que lo rodea, el satélite registra un **foco de calor**: una latitud, una longitud, una fecha y hora, la temperatura, la potencia del fuego (FRP, en megavatios) y qué tan seguro está de que es fuego (confianza).

Un foco **no es exactamente un incendio**. Puede ser una quema agrícola, un incendio forestal, un volcán o una industria. Por eso el sistema filtra y agrupa antes de mostrar algo.

---

## 3. De dónde salen los datos

Todo el sistema parte de **NASA FIRMS**, el servicio público de la NASA que publica los focos de calor del mundo. Para Perú usamos tres series:

| Serie | Satélite | Desde | Tamaño del píxel |
|---|---|---|---|
| MODIS | Terra y Aqua | nov 2000 / jul 2002 | ~1 km |
| VIIRS S-NPP | Suomi NPP | ene 2012 | ~375 m |
| VIIRS NOAA-20 | NOAA-20 | abr 2018 | ~375 m |

**Hoy el sistema tiene cargados 2 155 045 focos** de Perú, desde noviembre de 2000 hasta noviembre de 2026.

Para lo que viene, el sistema se apoyará además en estas fuentes abiertas:

| Fuente | Para qué |
|---|---|
| NASA GIBS | Mostrar imágenes satelitales reales de cada día en el mapa |
| INEI | Límites de departamentos, provincias y distritos |
| Sentinel-2 / Earth Engine | Medir cuánto se quemó un incendio (cicatriz de fuego) |
| Open-Meteo / NASA POWER | Clima y pronóstico para estimar riesgo |

---

## 4. El problema de fondo: dos sensores, dos "miradas"

MODIS y VIIRS no ven igual:

- **VIIRS detecta mucho más**, porque su píxel es más pequeño y percibe fuegos chicos que MODIS no ve.
- **MODIS guarda la confianza como número (0–100); VIIRS como letra** (`l`, `n`, `h`).
- **Un mismo incendio aparece muchas veces**: varios píxeles, varias pasadas del día, varios satélites.

Si se juntan los datos sin cuidado, ocurre algo engañoso. En nuestros datos reales:

> **Sin armonizar, parece que hubo casi 8 veces más fuego entre 2013 y 2021 que entre 2003 y 2011.**
> Pero ese aumento no es real: es que en 2012 empezó a funcionar un sensor más sensible.

Un calendario construido así mentiría: mostraría una "epidemia de incendios" que nunca existió, y los períodos críticos serían un invento del sensor. **Armonizar es lo que vuelve útil al resto del sistema.**

---

## 5. Cómo lo resolvemos (el método)

El sistema aplica nueve pasos a cada foco. Los cuatro que más importan:

1. **Limpiar.** Se descartan volcanes, industrias, detecciones en el mar y repeticiones exactas. De 2,15 millones de focos quedan 2,10 millones válidos.
2. **Poner todo en una grilla común.** Cada foco cae en una celda de ~1 km. Así el tamaño del píxel deja de importar.
3. **Contar celdas con fuego, no focos.** Un incendio de 1 km² es un píxel para MODIS y unos siete para VIIRS; contados como "celdas con fuego en un día" valen lo mismo para ambos. Esto elimina también los duplicados entre pasadas y satélites.
4. **Calibrar en dos partes.** En los años en que MODIS y VIIRS miraron a la vez (2012 en adelante) se mide cuánto menos ve MODIS, y se aplica a los años anteriores:
   - **Lo que MODIS sí ve:** VIIRS ve más, pero la ventaja se reduce cuanto mayor es el fuego (un incendio grande lo ven todos).
   - **Lo que MODIS no ve (fondo):** más de la mitad de lo que detecta VIIRS ocurre donde MODIS no registra nada. Se estima cuánto fuego pequeño hay normalmente en cada zona y mes, y se ajusta según la actividad de cada día.

   **Todo queda expresado como "lo que habría visto VIIRS".**

Además, el sistema sabe **qué días cada satélite estuvo realmente observando**. Un día sin datos no se cuenta como "día sin fuego": se marca como hueco.

---

## 6. Cómo sabemos que funciona

Se comprobó con los datos reales, no solo en teoría:

| Prueba | Resultado |
|---|---|
| El salto falso de 2012 | Pasó de **7,9 veces** a **0,95**: desapareció |
| ¿MODIS calibrado reproduce lo que midió VIIRS? (2012–2021) | Correlación mensual de **0,98** |
| ¿Funciona con años que la calibración nunca vio? (2022–2026) | Correlación mensual de **0,995** y diaria de **0,82**, sin sesgo en el total |
| ¿Los días extremos quedan del mismo tamaño? (2022–2026) | El percentil 99 diario difiere en **+1 %** |
| ¿Hay tantos días críticos antes y después de 2012? | **35** por año en 2003–2011 frente a **30** en 2013–2021 |

Es decir: si tomamos solo MODIS, lo calibramos y lo comparamos contra lo que VIIRS midió de verdad, coinciden.

---

## 7. Lo que el sistema muestra (y en qué se apoya cada parte)

| Módulo | Qué ve el usuario | En qué se basa |
|---|---|---|
| 📅 **Calendario** | Una celda por día; el color indica cuánta actividad hubo. Años en filas para ver la temporada de fuego repetirse | La serie armonizada diaria |
| 🔴 **Períodos críticos** | Días marcados cuando la actividad supera lo normal para esa época | El percentil 90 histórico de cada día del año (±7 días), con un mínimo para que en época de lluvias un solo foco no dispare la marca |
| 🗺️ **Mapa de Perú** | Zonas con más fuego, desde todo el país hasta la parcela | Agregados por celda de ~250 km² y focos individuales con su huella real |
| ⏱️ **Línea de tiempo** | Reproducir la evolución de una temporada día a día | La serie diaria por celda |
| 🔥 **Eventos** | Incendios con inicio, fin, área e intensidad, en lugar de puntos sueltos | Agrupamiento de focos cercanos en espacio y tiempo |
| 🚨 **Alertas** | Aviso a celulares (Telegram y notificaciones) cuando aparece fuego en una zona vigilada | Datos FIRMS de tiempo casi real, que llegan pocas horas después de la pasada |
| 🛡️ **Riesgo** | Cuándo y dónde es probable que se queme | Historia armonizada + clima y pronóstico |
| 🔍 **Cicatrices** | Mapa de cuánto se quemó un incendio | Imágenes Sentinel-2 antes y después |

---

## 8. Estado actual

| | |
|---|---|
| ✅ Hecho | Carga de los datos de FIRMS, limpieza, grilla común, calibración, serie armonizada diaria, climatología y días críticos, validación. Todo disponible para Perú, sus 25 departamentos, 195 provincias y 1 826 distritos, guardado en SQL Server |
| 🔜 Siguiente | API (Spring Boot), calendario y mapa (Angular) |
| 🔜 Después | Eventos, alertas en tiempo casi real, comparación temporal |
| ⭐ Si alcanza el tiempo | Riesgo y pronóstico, cicatrices de fuego, reporte ciudadano |

---

## 9. Lo que el sistema NO afirma

- **Un foco no es siempre un incendio.** Se reduce el error con filtros, pero no se elimina.
- **El satélite no ve todo.** Pasa pocas veces al día y las nubes o el humo pueden tapar un fuego.
- **La calibración es estadística.** Iguala los totales de MODIS y VIIRS, pero no puede recuperar fuegos pequeños que MODIS nunca vio.
- **Antes de 2012, la mayor parte del índice es una estimación.** Cerca de tres cuartos del total anual corresponde a fuego pequeño que MODIS no ve y que el sistema estima por zona, mes y actividad del día. Sirve para comparar épocas, no para ubicar incendios concretos.
- **De noviembre de 2000 a julio de 2002 solo existe un satélite (Terra)**, que ve muy poco: esos meses son los menos fiables.
- **El sistema no predice incendios con certeza.** Los períodos críticos y el índice de riesgo señalan épocas y zonas con mayor probabilidad, según la historia y el clima.

---

**Equipo BoysFire** · NASA Space Apps Challenge 2026 · San Vicente de Cañete, Perú
