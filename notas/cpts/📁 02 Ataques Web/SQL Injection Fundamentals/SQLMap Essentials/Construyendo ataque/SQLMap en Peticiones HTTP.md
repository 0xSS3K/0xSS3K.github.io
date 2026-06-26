---
tags:
  - sqlmap
  - webapp
---
## Conceptos Clave (TL;DR)

* La configuración exacta de la petición HTTP (cookies, datos POST formateados) es crítica; los errores de sintaxis previenen la detección de vulnerabilidades.

* Las peticiones complejas se manejan mejor exportándolas desde el navegador o un proxy hacia un archivo de texto.

* SQLMap permite apuntar la inyección a parámetros específicos, cabeceras HTTP o formatos estructurados como JSON y XML.

* Se puede forzar el punto de inyección exacto agregando un asterisco ``(*)`` en cualquier parte de la petición.
  

## Herramientas Clave

* **SQLMap**: Automatización de detección y explotación de inyecciones SQL.

* **Navegador (DevTools)**: Utilizado para capturar peticiones nativas mediante la función "Copy as cURL" o copiando las cabeceras.

* **Burp Suite**: Proxy HTTP para interceptar peticiones complejas y exportarlas rápidamente a un archivo.
  

## Metodología Paso a Paso

**Fase 1: Captura de la Petición**

Extraer la petición legítima asegura que los tokens, cookies y cabeceras de sesión sean válidos. Se puede copiar como cURL desde el navegador , o guardar la petición completa en un archivo de texto desde Burp Suite ("Copy to file").

 

**Fase 2: Adaptación del Comando**

Para peticiones sencillas GET/POST, se utilizan banderas directas por consola. Si se pegó un comando cURL, simplemente se reemplaza la palabra `curl` por `sqlmap` al inicio. Para peticiones complejas o con cuerpos JSON/XML extensos, se carga el archivo de texto capturado en la Fase 1.

  

**Fase 3: Aislamiento del Vector**

Para optimizar el tiempo de escaneo, se debe limitar SQLMap al parámetro presuntamente vulnerable. Si la sintaxis es inusual o se ataca una cabecera, se marca el punto de inyección de forma manual.

  

**Fase 4: Evasión de Filtros Básicos**

Ajustar las cabeceras HTTP, especialmente el User-Agent, para evitar que soluciones de seguridad bloqueen el tráfico por identificar la firma por defecto de la herramienta.

  

## Cheat Sheet de Comando

```bash
# Ejecutar SQLMap a partir de un comando cURL copiado del navegador
# Solo cambiar "curl" por "sqlmap". Mantiene todas las cabeceras originales.

sqlmap '<TARGET_URL>' -H 'User-Agent: <USER_AGENT_STRING>' -H 'Accept: <ACCEPT_VAL>' --compressed -H 'Connection: keep-alive'

  
# Escanear parámetros GET básicos
sqlmap -u '<TARGET_URL>'

  
# Escanear peticiones POST con datos form-urlencoded
sqlmap -u '<TARGET_URL>' --data '<PARAM1>=<VALUE1>&<PARAM2>=<VALUE2>'

  
# Escanear petición POST enfocándose EXCLUSIVAMENTE en un parámetro específico
sqlmap -u '<TARGET_URL>' --data '<PARAM1>=<VALUE1>&<PARAM2>=<VALUE2>' -p <PARAM1>

  
# Marcar punto de inyección manual en el cuerpo POST usando el asterisco (*)
sqlmap -u '<TARGET_URL>' --data '<PARAM1>=<VALUE1>*&<PARAM2>=<VALUE2>'

  
# Cargar y escanear una petición HTTP completa desde un archivo (JSON, XML, o múltiples cabeceras)
sqlmap -r <REQUEST_FILE>.txt

  
# Especificar manualmente una Cookie de sesión
sqlmap -u '<TARGET_URL>' --cookie='<COOKIE_NAME>=<COOKIE_VALUE>'

  
# Especificar manualmente una cabecera HTTP personalizada
sqlmap -u '<TARGET_URL>' -H='<HEADER_NAME>:<HEADER_VALUE>'

  
# Marcar un punto de inyección manual dentro de una cabecera HTTP
sqlmap -u '<TARGET_URL>' --cookie="<COOKIE_NAME>=<COOKIE_VALUE>*"

  
# Especificar un método HTTP alternativo (ej. PUT)
sqlmap -u '<TARGET_URL>' --data='<DATA>' --method <METHOD>

  
# Evasión WAF: Utilizar un User-Agent legítimo aleatorio de la base de datos de SQLMap
sqlmap -u '<TARGET_URL>' --random-agent

  
# Evasión/Lógica condicional: Imitar el User-Agent de un dispositivo móvil
sqlmap -u '<TARGET_URL>' --mobile
```

## "Gotchas" y Troubleshooting

* **Bloqueos Inmediatos (WAF/IPS)**: Soluciones de protección descartan el tráfico si detectan el User-Agent por defecto de SQLMap (ej. `sqlmap/1.4.9...`). SIEMPRE usar `--random-agent` en entornos protegidos.

* **Archivos vs Terminal**: Si el cuerpo POST es muy largo, tiene caracteres especiales o usa formatos como JSON/XML, evita usar `--data` en la terminal. Guarda la intercepción en un `.txt` y usa `-r` para evitar errores de parseo del shell.

* **Inyección en Cabeceras**: Por defecto, SQLMap solo prueba parámetros (GET/POST). Si necesitas probar cabeceras (como User-Agent, Referer o Cookies), debes especificar el marcador `*` explícitamente en el valor.

* **Marcador de Inyección en Archivos**: Al igual que en la terminal, puedes abrir el archivo `.txt` de tu petición guardada e insertar un `*` (ej. `/?id=1*`) para guiar a SQLMap directamente al vector vulnerable.

* **Formatos Relajados**: SQLMap no es estricto con el formato interno del JSON/XML que envíes; procesará el payload inyectando en los valores detectados automáticamente, pero preguntará en la terminal si deseas que procese el cuerpo estructurado detectado.