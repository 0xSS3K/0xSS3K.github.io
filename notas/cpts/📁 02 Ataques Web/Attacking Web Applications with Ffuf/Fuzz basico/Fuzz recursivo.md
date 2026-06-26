---
tags:
  - fuzzing
  - webapp
---
## Conceptos Clave (TL;DR)

* El fuzzing recursivo automatiza la enumeración al iniciar un nuevo escaneo dentro de cualquier directorio recién identificado hasta cubrir el sitio principal y sus subdirectorios.

* Permite evitar el proceso manual de buscar directorios primero y luego buscar archivos dentro de cada uno de ellos por separado.

* Los árboles de subdirectorios grandes pueden requerir mucho tiempo, por lo que se recomienda encarecidamente limitar la profundidad del escaneo.

  

## Herramientas Clave

* **ffuf**: Utilizada para habilitar el escaneo recursivo, controlar su profundidad y descubrir contenido web.

  

## Metodología Paso a Paso

1. **Configuración de la Recursividad y Profundidad**: Habilitar la recursividad e indicar el nivel de profundidad (ej. nivel 1) para que la herramienta evalúe los directorios principales y sus subdirectorios directos sin perderse en rutas muy profundas.

2. **Especificación de Extensiones**: Definir las extensiones de los archivos que se buscan, ya que estas suelen aplicar a todo el sitio web y permiten descubrir páginas específicas.

3. **Visibilidad de Resultados**: Habilitar el formato detallado para que la salida incluya las URLs completas. Sin esto, puede ser difícil identificar en qué directorio específico se encuentra un archivo descubierto.

4. **Refinamiento Manual**: Una vez escaneados los primeros directorios, seleccionar los más interesantes y ejecutar escaneos adicionales para dirigir mejor el esfuerzo.

## Cheat Sheet de Comandos

```bash
# -w: Ruta del diccionario web y definición de la palabra clave FUZZ.
# -u: URL objetivo con la palabra clave FUZZ.
# -recursion: Habilita el escaneo recursivo.
# -recursion-depth 1: Limita la profundidad a 1 nivel para no fuzzeadas sub-sub-directorios.
# -e .php: Especifica la extensión a buscar.
# -v: Habilita el modo detallado para imprimir la URL completa.


ffuf -w <wordlist>:FUZZ -u URL/FUZZ -recursion -recursion-depth 1 -e .php -v
```

## "Gotchas" y Troubleshooting

* **Tiempos de ejecución extendidos**: Al habilitar la recursividad y extensiones, la lista de palabras efectivamente multiplica su tamaño y el escaneo enviará significativamente más solicitudes, aumentando el tiempo total.

* **Control de profundidad**: Si no se especifica el parámetro de límite de profundidad, se corre el riesgo de caer en árboles de directorios enormes que expandirán masivamente el escaneo.

* **Archivos descontextualizados**: Siempre se debe añadir la bandera de detalle (-v) para ver las URLs completas; de lo contrario, al obtener un acierto, no se sabrá qué archivo pertenece a qué directorio.