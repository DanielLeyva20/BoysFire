# Product

BoysFire: calendario unificado de incendios de Perú a partir de los focos de calor de MODIS y VIIRS (NASA FIRMS).

> Escrito a partir del encargo del usuario y del código existente, sin entrevista: el usuario pidió elegir el diseño y avanzar. Lo marcado como (supuesto) no fue confirmado.

## Platform

web

## Stack

Angular (frontend), Spring Boot (API REST de solo lectura), SQL Server 2022, pipeline de armonización en Python. Mapa con MapLibre GL JS; gráficas con Apache ECharts.

## Users

- Jurado del NASA Space Apps Challenge (San Vicente de Cañete), que ve una demo proyectada en un aula iluminada.
- Equipo BoysFire, que presenta y navega la aplicación en vivo.
- (supuesto) Personal de municipios, bomberos y gestión de riesgo, y agricultores, que consultan qué pasó y cuándo conviene estar alerta.

## Product Purpose

Responder con datos comparables a tres preguntas: dónde se quema, cuándo se quema y si este período es peor de lo normal. El éxito es que alguien entienda en segundos el patrón de 26 años y pueda bajar hasta el foco exacto (lugar, fecha y hora).

## Positioning

FIRMS muestra puntos rojos de las últimas 24 horas. BoysFire muestra la historia: une dos sensores que no se pueden sumar (MODIS de ~1 km y VIIRS de ~375 m) en un solo índice comparable desde 2000, y lo valida contra datos reales.

## Operating Context

Pantalla de escritorio y proyector, de día, con luz ambiente alta. Uso exploratorio: filtrar por región y fechas, leer el calendario, hacer zoom en el mapa, abrir un foco. También debe funcionar en un celular.

## Capabilities and Constraints

- Datos reales: 2 099 572 focos limpios de Perú (2000-10-31 a 2026-11-13), país + 25 departamentos + 195 provincias + 1 826 distritos.
- El índice armonizado tiene dos partes: detectado y fondo estimado. Antes de 2012 la mayor parte es fondo; la interfaz debe distinguirlas.
- Un foco de calor no es necesariamente un incendio. No se predicen incendios con certeza.
- Los focos individuales se consultan por área y hasta 31 días; las celdas del mapa, hasta 366 días.
- Aún no existen eventos, alertas ni índice de riesgo: no se muestran como si existieran.

## Brand Commitments

- Nombre: BoysFire. Idioma: español de Perú.
- Niveles de intensidad en verde, anaranjado y rojo (pedido del usuario).
- No debe parecerse a FIRMS: nada de puntos rojos saturados sobre un mapa oscuro como única lectura.

## Evidence on Hand

- Salto falso entre eras sin armonizar: 7,9 veces; armonizado: 0,95.
- MODIS calibrado frente a VIIRS real en años no vistos (2022–2026): correlación mensual 0,995, diaria 0,82; percentil 99 diario +1 %.
- Fuente de datos: NASA FIRMS. Límites administrativos: INEI (versión simplificada, nombres sin tildes).

## Product Principles

- El dato manda: cada cifra visible sale de la API, con su unidad.
- Honestidad sobre la incertidumbre: lo estimado se ve distinto de lo detectado.
- De lo general a lo exacto: país → región → día → foco.

## Accessibility & Inclusion

Contraste AA. La intensidad nunca depende solo del color (también valor, etiqueta o forma). Navegable con teclado. Respeta `prefers-reduced-motion`.
