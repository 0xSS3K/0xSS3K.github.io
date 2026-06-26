---
tags:
  - IDOR
  - webapp
  - attack
  - enum
---
## Conceptos Clave (TL;DR)

* Una vulnerabilidad IDOR ocurre cuando una aplicación expone referencias directas a objetos como un identificador de usuario en texto claro, careciendo de un sistema de control de acceso adecuado en el backend.
* El IDOR de archivo estático se basa en patrones de nombres de archivo predecibles que incorporan el identificador del usuario y fechas, lo que permite intentar el descubrimiento mediante fuzzing.
* La enumeración masiva automatiza la explotación iterando sobre el parámetro vulnerable para extraer grandes cantidades de datos u obtener escalamiento de privilegios.

## Herramientas Clave

* **Firefox Element Inspector (CTRL+SHIFT+C):** Permite revisar el código fuente HTML para identificar enlaces a archivos o datos expuestos que no son evidentes en la interfaz gráfica.
* **Burp Intruder / ZAP Fuzzer:** Utilizados para automatizar la manipulación de parámetros y recuperar archivos o respuestas de múltiples usuarios.
* **Bash (curl, grep, wget):** Usados en conjunto para crear scripts rápidos que soliciten las páginas, extraigan las rutas de los archivos mediante expresiones regulares y descarguen los documentos masivamente.

## Metodología Paso a Paso

1. **Identificación de parámetros de referencia directa:** Ubica parámetros en la URL o cuerpo de la solicitud que controlen los registros mostrados, como parámetros GET de identificadores de usuario o filtros de visualización.
2. **Prueba de manipulación:** Modifica el valor del parámetro identificado por el de otro usuario para comprobar si la aplicación deniega el acceso o permite la lectura de registros ajenos.
3. **Inspección de la respuesta:** Analiza detalladamente el código fuente HTML y el tamaño de la página, ya que la estructura visual puede parecer idéntica incluso cuando los enlaces de los documentos subyacentes han cambiado.
4. **Automatización y extracción:** Selecciona un patrón único en el código fuente HTML que envuelva los enlaces objetivo y utiliza herramientas de línea de comandos o proxies para iterar sobre los identificadores y descargar todos los archivos accesibles.

## Cheat Sheet de Comandos

```bash
# Realiza una petición web silenciosa (-s) y filtra la salida buscando una cadena específica del HTML para confirmar la fuga de enlaces

curl -s "http://<TARGET_IP>:<PORT>/<PATH>?<PARAMETER>=<ID>" | grep "<HTML_TAG_OR_CLASS>"
```

```bash
# Realiza una petición web silenciosa (-s) y utiliza expresiones regulares de Perl (-P) para extraer solo la coincidencia exacta (-o) de la ruta del archivo

curl -s "http://<TARGET_IP>:<PORT>/<PATH>?<PARAMETER>=<ID>" | grep -oP "\/<TARGET_DIRECTORY>.*?\.<EXTENSION>"
```

```bash
# Script para enumerar y descargar archivos masivamente iterando sobre IDs de usuario

# wget -q realiza la descarga de los archivos extraídos de forma silenciosa

#!/bin/bash
url="http://<TARGET_IP>:<PORT>"

for i in {1..10}; do
        for link in $(curl -s "$url/<PATH>?<PARAMETER>=$i" | grep -oP "\/<TARGET_DIRECTORY>.*?\.<EXTENSION>"); do
                wget -q $url/$link
        done
done
```

## "Gotchas" y Troubleshooting

* **Falsos negativos visuales:** Al cambiar el parámetro identificador, la página web podría no mostrar diferencias evidentes en su interfaz de usuario, pero los enlaces a los documentos en el código fuente apuntarán a los archivos de la víctima.

* **Revisión obligatoria:** Durante cualquier prueba de penetración web, siempre se debe mantener atención al código fuente y a las variaciones en el tamaño de la página al modificar parámetros.

* **Parámetros de filtro:** En ocasiones, el IDOR no se encuentra en el identificador principal, sino en parámetros de filtro; estos pueden manipularse para ver documentos de otros usuarios o eliminarse por completo para que la aplicación muestre todos los registros a la vez.

* **Limitaciones del fuzzing estático:** Depender únicamente de la predicción de nombres de archivos estáticos asumiendo prefijos comunes puede dejar archivos sin descubrir, por lo que es más efectivo explotar el parámetro que genera dichos enlaces.

````</EXTENSION></TARGET_DIRECTORY></PARAMETER></PATH></PORT></TARGET_IP></EXTENSION></TARGET_DIRECTORY></ID></PARAMETER></PATH></PORT></TARGET_IP></HTML_TAG_OR_CLASS></ID></PARAMETER></PATH></PORT></TARGET_IP>