---
tags:
  - sqlmap
  - webapp
---
## Conceptos Clave (TL;DR)

* Cada payload inyectado consta de dos partes: el 'vector' (la sentencia SQL útil a ejecutar) y los 'boundaries' (prefijos y sufijos para lograr que el vector se incorpore adecuadamente en la consulta vulnerable).

* De manera predeterminada, SQLMap utiliza un conjunto de boundaries comunes y vectores de alta probabilidad, pero existen escenarios que requieren personalización manual de las solicitudes o el aumento de la intensidad.

* Para estabilizar la detección TRUE/FALSE en aplicaciones web dinámicas con mucha "basura" visual, se puede forzar al escáner a observar únicamente códigos de estado HTTP, títulos HTML, strings específicos o solo el texto sin etiquetas.

  

## Herramientas Clave

* **SQLMap:** Framework automatizado para la detección y explotación de vulnerabilidades de inyección SQL mediante el uso de diferentes vectores y técnicas avanzadas de tuning.

  

## Metodología Paso a Paso

* **Fase 1: Ajuste de Boundaries (Prefijo/Sufijo)**

  Si el objetivo requiere escapar un bloque de código SQL complejo no cubierto por los intentos regulares, se definen estáticamente los cierres de la sintaxis original de la consulta. Esto envuelve todos los vectores de ataque.

* **Fase 2: Incremento de Nivel y Riesgo**

  Para ampliar los diccionarios de ataque internos. El nivel (`--level` 1-5) incrementa los vectores y boundaries probados según su probabilidad de éxito. El riesgo (`--risk` 1-3) incorpora vectores que podrían alterar la base de datos o causar denegaciones de servicio.

* **Fase 3: Verificación Visual**

  Emplear el nivel de verbosidad 3 o superior (`-v 3`) para auditar manualmente qué payloads exactos (con todo y sus prefijos/sufijos) se están enviando al servidor y confirmar que se estén formateando correctamente.

* **Fase 4: Refinamiento de Detección (Falsos Positivos/Negativos)**

  Si el sitio tiene contenido extremadamente dinámico, se instruye a SQLMap a comparar el éxito o fracaso basándose en un código HTTP fijo (`--code`), el contenido de la etiqueta HTML title (`--titles`), una cadena específica (`--string`), o ignorando el código HTML (`--text-only`).

* **Fase 5: Filtrado de Técnicas y Tuning de UNION**

  Si una técnica en particular causa interrupciones, se limita su uso (`--technique`). Para ataques UNION, si fallan los valores dummy (NULL) o la inferencia, se proporcionan de forma manual las columnas exactas, el carácter de relleno o la tabla 'FROM' requerida.


## Cheat Sheet de Comandos

```bash
# Inyectar prefijos y sufijos personalizados alrededor del vector de ataque

sqlmap -u "<TARGET_URL>" --prefix="<PREFIX_STRING>" --suffix="<SUFFIX_STRING>"
```
  
```bash
# Escaneo en profundidad incrementando nivel (boundaries y vectores) y riesgo (vectores peligrosos)

sqlmap -u "<TARGET_URL>" --level=5 --risk=3
```
  
```bash
# Depuración visual de los payloads exactos enviados en tiempo real

sqlmap -u "<TARGET_URL>" -v 3
```
  
```bash
# Fijar la detección de un payload TRUE mediante código HTTP esperado (Ej: 200)

sqlmap -u "<TARGET_URL>" --code=<HTTP_STATUS_CODE>
```
  
```bash
# Basar la detección de respuestas usando únicamente la etiqueta <title> del HTML

sqlmap -u "<TARGET_URL>" --titles
```
  
```bash
# Basar la detección en la aparición de un string estático en las respuestas exitosas

sqlmap -u "<TARGET_URL>" --string="<SUCCESS_STRING>"
```
  
```bash
# Eliminar ruido HTML y basar la comparación solo en el texto visible renderizado

sqlmap -u "<TARGET_URL>" --text-only
```
  
```bash
# Limitar las técnicas de inyección SQL a probar (Ejemplo: B=Boolean, E=Error, U=UNION)

sqlmap -u "<TARGET_URL>" --technique=<LETTERS>
```
  
```bash
# Tuning UNION SQLi: Indicar manualmente la cantidad de columnas conocidas

sqlmap -u "<TARGET_URL>" --union-cols=<COLUMN_COUNT>
```
  
```bash
# Tuning UNION SQLi: Cambiar los valores de relleno (dummy) predeterminados (Ej: 'a' en vez de NULL)

sqlmap -u "<TARGET_URL>" --union-char='<CHARACTER>'
```
  
```bash
# Tuning UNION SQLi: Proveer apéndice FROM genérico si falla detección de DBMS (útil en Oracle)

sqlmap -u "<TARGET_URL>" --union-from=<TABLE_NAME>
```


## "Gotchas" y Troubleshooting

* Aumentar `--level=5` y `--risk=3` eleva el número de payloads de un máximo de 72 por parámetro (default) a más de 7,865, lo que hará el proceso considerablemente más lento y ruidoso.

* Los payloads de la opción `--risk` pueden incluir sentencias lógicas tipo OR, las cuales son inherentemente peligrosas en sentencias activas como DELETE o UPDATE y pueden modificar el contenido de la base de datos real del objetivo. Sin embargo, el aumento de riesgo es obligatorio para bypass de paneles de login.

* En algunas aplicaciones, los payloads ciegos basados en tiempo (time-based blind) causan un efecto de Denegación de Servicio (DoS) o problemas de timeout. Utilizar `--technique` excluyendo la letra 'T' previene esto.

* Cuando las inyecciones basadas en UNION fallan automáticamente, a menudo se debe a que SQLMap es incapaz de detectar el tipo de DBMS antes de construir el payload. Obligar a añadir la cláusula FROM (e.g., `--union-from=users`) resuelve este error común en tecnologías como Oracle.