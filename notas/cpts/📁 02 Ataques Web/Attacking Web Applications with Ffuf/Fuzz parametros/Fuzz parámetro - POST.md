---
tags:
  - webapp
  - fuzzing
---
## Conceptos Clave (TL;DR)

* A diferencia de las peticiones GET, los parámetros de las peticiones POST no se pasan en la URL ni se adjuntan después del símbolo de interrogación.

* Los datos enviados por POST residen internamente en el campo de datos (data field) de la solicitud HTTP.

* Para descubrir parámetros POST ocultos de forma automatizada, es necesario forzar el envío del verbo HTTP correcto y manipular el encabezado de tipo de contenido.

  

## Herramientas Clave

* **ffuf**: Fuzzer web principal utilizado para iterar palabras clave dentro del campo de datos de una petición HTTP.

* **curl**: Utilizado para realizar pruebas manuales rápidas y confirmar la existencia y comportamiento de los parámetros descubiertos.

  

## Metodología Paso a Paso
  
### Fase 1: Descubrimiento Automatizado

El objetivo es encontrar nombres de variables no documentadas inyectando diccionarios en el cuerpo de la petición. Se utiliza el parámetro de datos para declarar que el nombre de la variable será reemplazado por la palabra clave de fuzzing (ej. `FUZZ=valor_arbitrario`). Se deben filtrar los tamaños de respuesta por defecto para identificar las anomalías.

### Fase 2: Validación Manual

Una vez que el fuzzer devuelve un "hit" (un cambio en el código de estado o tamaño de respuesta que indica un parámetro válido, como por ejemplo un parámetro `id`), se procede a interactuar de forma manual con el objetivo. Esto permite observar los mensajes de error (ej. "Invalid id!") o la lógica de negocio subyacente para preparar la siguiente fase de explotación.

  
## Cheat Sheet de Comandos

```bash
# ==========================================
# Fuzzing de parámetros POST con ffuf
# ==========================================

# -w: Ruta del diccionario y definicion de la palabra clave FUZZ.
# -u: URL del objetivo.
# -X POST: Obliga a ffuf a enviar la solicitud mediante el método POST.
# -d: Especifica la cadena de datos POST; inyecta el payload en la clave.
# -H: Define el encabezado Content-Type.
# -fs: Filtra por el tamaño de respuesta base para ocultar resultados irrelevantes.

  
ffuf -w <WORDLIST_PATH>:FUZZ -u http://<TARGET_IP>:<TARGET_PORT><TARGET_ENDPOINT> -X POST -d 'FUZZ=<TEST_VALUE>' -H 'Content-Type: application/x-www-form-urlencoded' -fs <DEFAULT_RESPONSE_SIZE>
```

```bash
# ==========================================
# Validación manual de parámetros POST con curl
# ==========================================

# -X POST: Utiliza explícitamente el método POST.
# -d: Pasa los datos del formulario (parámetro descubierto y su valor de prueba).
# -H: Requisito de cabecera necesario para que la aplicación procese los datos.

  
curl http://<TARGET_IP>:<TARGET_PORT><TARGET_ENDPOINT> -X POST -d '<VALID_PARAMETER>=<TEST_VALUE>' -H 'Content-Type: application/x-www-form-urlencoded'
```
  

## "Gotchas" y Troubleshooting

* **Restricción de Content-Type en PHP**: Como regla general para entornos PHP, el procesamiento de datos "POST" requiere de forma estricta que la cabecera "content-type" esté configurada como `application/x-www-form-urlencoded`. Si olvidas pasar la bandera `-H 'Content-Type: application/x-www-form-urlencoded'` tanto en `ffuf` como en `curl`, el servidor no parseará tus datos y obtendrás falsos negativos durante el examen.