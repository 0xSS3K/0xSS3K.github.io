---
tags:
  - webapp
  - fuzzing
---
## Conceptos Clave (TL;DR)

* Una vez identificado un parámetro funcional, es necesario realizar fuzzing para encontrar el valor exacto que retorne el contenido deseado o gatille la vulnerabilidad.

* La técnica es casi idéntica al fuzzing de parámetros, pero el reto principal radica en la obtención o generación del wordlist adecuado.

* Dependiendo del parámetro (ej. identificadores numéricos, nombres de usuario), se debe decidir entre usar listas prefabricadas o construir diccionarios personalizados acordes a la aplicación objetivo.

* Para parámetros como IDs, los valores pueden ser secuencias numéricas (ej. 1 al 1000) o seguir formatos personalizados, lo cual requiere scripting básico para generar los payloads.

  

## Herramientas Clave

* **Bash / Python:** Herramientas nativas y de scripting fundamentales para automatizar y generar rápidamente diccionarios secuenciales o personalizados.

* **SecLists:** Repositorio estándar de la industria útil para encontrar wordlists prefabricados (como listas de nombres de usuario) cuando el parámetro espera valores comunes.

* **ffuf:** Fuzzer web principal utilizado para iterar el wordlist generado contra el parámetro objetivo a través de peticiones HTTP.

* **curl:** Herramienta de línea de comandos utilizada para enviar la solicitud manual final una vez que se ha identificado el valor correcto.

  

## Metodología Paso a Paso

1. **Análisis del Parámetro:** Inferir el tipo de dato que espera el parámetro descubierto (ej. texto, número, formato específico) basándose en su nombre (ej. `id` usualmente espera números).

2. **Preparación del Wordlist:** Buscar una lista existente en directorios como SecLists o crear un archivo personalizado mediante comandos de terminal si los valores esperados son predecibles o secuenciales.

3. **Ejecución del Fuzzing:** Configurar `ffuf` para que envíe los valores del wordlist directamente en la carga útil (payload) del parámetro, manteniendo el resto de la petición (URL, cabeceras) intacta.

4. **Validación:** Analizar los resultados de `ffuf` e inyectar manualmente el valor válido encontrado usando `curl` o un proxy de intercepción para recolectar el objetivo (flag, acceso, etc.).

  
## Cheat Sheet de Comandos
 
```bash
# Genera una lista secuencial de números (ej. 1 al 1000) e inserta cada uno en un archivo de texto.

# Reemplazar <MIN_NUM> y <MAX_NUM> por el rango deseado, y <WORDLIST> por el nombre del archivo.

for i in $(seq <MIN_NUM> <MAX_NUM>); do echo $i >> <WORDLIST>.txt; done

  

# Muestra el contenido del wordlist generado para verificar su integridad.
cat <WORDLIST>.txt

  

# Ejecuta ffuf enviando peticiones POST para encontrar valores válidos en un parámetro específico.

# -w: Especifica el diccionario y el keyword FUZZ.
# -u: URL objetivo.
# -X POST: Define el método HTTP.
# -d: Especifica los datos de la petición, inyectando la palabra clave FUZZ en el valor del parámetro.
# -H: Define el Content-Type necesario para procesar formularios POST.
# -fs: Filtra por el tamaño de la respuesta por defecto para ocultar falsos positivos.

ffuf -w <WORDLIST>.txt:FUZZ -u <TARGET_URL> -X POST -d '<PARAMETER_NAME>=FUZZ' -H 'Content-Type: application/x-www-form-urlencoded' -fs <DEFAULT_RESPONSE_SIZE>
```
  

## "Gotchas" y Troubleshooting

* **Falsos Positivos:** Es mandatorio identificar el tamaño base de una respuesta fallida y filtrarlo usando la bandera `-fs xxx` en `ffuf` para evitar que la terminal se inunde de resultados que no sirven.

* **Formatos de ID:** No asumas que todos los IDs son números simples secuenciales (1, 2, 3...); el objetivo puede utilizar formatos estructurados o secuencias más largas (ej. hasta 1000000), lo que requerirá adaptar el bucle `for`.

* **Wordlists Incompatibles:** Si el fuzzer no arroja resultados, el problema probablemente radique en el wordlist; no siempre hay listas prefabricadas que sirvan para cada parámetro particular.