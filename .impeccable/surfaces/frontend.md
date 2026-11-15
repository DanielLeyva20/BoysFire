---
version: 1
slug: "frontend"
primary_target: "frontend"
related_targets: []
---

# Frontend BoysFire (Angular)

Modo: Operate. Aplicación de exploración: mapa, calendario, línea de tiempo y estadísticas sobre la API REST existente.

Audiencia y tarea: jurado y equipo en una demo proyectada con luz de día; después, personal de gestión de riesgo. Tarea: ver dónde y cuándo se quema, si un período es peor de lo normal, y bajar de país a región, a día y a foco exacto (lugar, fecha y hora).

Contenido real: índice armonizado diario (detectado + fondo estimado), umbral crítico y climatología por región; focos individuales; celdas H3; contornos de departamentos, provincias y distritos. Restricción: no mostrar eventos, alertas ni riesgo, que aún no existen.

Momento memorable: elegir un día en el planificador anual y ver el mapa saltar a ese día, con los focos de ese día y su hora exacta.

Pendiente de decidir: ninguna decisión abierta bloquea la construcción.

## Direction contract

THESIS: el producto es un almanaque de temporada de quemas, no un tablero de control. El calendario es el objeto que gobierna la pantalla y el mapa es su lámina. Se rechaza el panel oscuro con puntos rojos brillantes y tarjetas de indicadores.

OWN-WORLD: papel blanco frío y tinta azul marino casi negra; reglas finas azul grisáceo como las de un planificador de pared; una sola tinta de acento, azul ultramar, para selección y acciones. Tres tintas de dato reservadas a la intensidad: verde, anaranjado y rojo. Lo estimado (fondo) se imprime rayado, nunca sólido. Una sola familia tipográfica, Archivo, de ancho variable: estrecha y tabular en celdas y cifras, ancha y pesada en los encabezados de mes y de sección. Celdas de día cuadradas con numeral, tablas regladas en lugar de tarjetas.

STORY: el visitante entiende que hay 26 años comparables, ve la temporada repetirse cada año, identifica los días críticos y llega al foco exacto.

FIRST VIEWPORT: a la izquierda, ocupando dos tercios, el mapa de Perú con sus departamentos y la actividad del día elegido; arriba del mapa, el selector de mapa base. A la derecha, la columna del almanaque: nombre de la región, el año en numerales grandes, los doce meses como cuadrículas de días coloreadas por nivel y, debajo, la ficha del día seleccionado. Al pie, a todo el ancho, la tira de 26 años con el año activo marcado. La acción principal es elegir un día.

FORM: almanaque y planificador anual de pared; candidato 6 de 7 de la lista propia; clave de sorteo 05e063c7. Mejoras tomadas de las formas descartadas: de la señalética de aeropuerto, la cadena de decisiones (país, departamento, provincia, distrito) con la selección resaltada en todos los paneles; de la notación Laban, los períodos críticos como bloques cuyo largo es su duración; del catálogo Factory, un único gráfico de años apilados que ocupa todo su panel; de la carátula de casete, las cifras alineadas a la derecha en numerales tabulares; del catálogo de personajes, el ranking de regiones como lista ordenada con datos fijos por fila.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
