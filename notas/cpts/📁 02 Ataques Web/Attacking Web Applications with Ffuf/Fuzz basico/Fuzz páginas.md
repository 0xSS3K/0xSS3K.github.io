---
tags:
  - fuzzing
  - webapp
---
## Conceptos Clave (TL;DR)

* Cuando se encuentra un directorio al que se tiene acceso pero devuelve una página en blanco, se debe aplicar web fuzzing para descubrir archivos y páginas ocultas en su interior.

* Previo a fuzzeo de archivos, es un requisito indispensable identificar qué tipos de extensiones de páginas procesa el servidor web (por ejemplo, .html, .aspx o .php).

* Aunque se puede intentar adivinar la extensión basándose en el tipo de servidor expuesto en las cabeceras HTTP (ej. Apache suele usar .php, IIS usa .asp o .aspx), este método manual no es práctico, por lo que se recomienda automatizar la búsqueda de extensiones válidas.

  

## Herramientas Clave

* **ffuf**: Herramienta de fuzzing web utilizada para iterar listas de palabras tanto en posiciones de extensión de archivo como en nombres de página.

* **SecLists**: Colección de wordlists recomendada; específicamente `web-extensions.txt` para extensiones y `directory-list-2.3-small.txt` para nombres de archivos.
  

## Metodología Paso a Paso

### Fase 1: Fuzzing de Extensiones

El objetivo inicial es identificar la tecnología subyacente para no desperdiciar peticiones en extensiones inválidas. Como casi todos los sitios web contienen un archivo "index", la lógica consiste en apuntar a ese archivo base e iterar posibles extensiones en la cola de la petición. El resultado exitoso confirmará bajo qué tecnología corre el sitio para la siguiente fase.


### Fase 2: Fuzzing de Páginas

Una vez obtenida la extensión válida (ej. `.php`), se procede a buscar nombres de archivos. La lógica invierte el proceso de la fase anterior: ahora la extensión queda fija y se inyecta el payload de fuzzing en la posición del nombre de archivo utilizando listas de directorios/archivos comunes.

  
## Cheat Sheet de Comandos

```bash
# Fuzzing de extensiones web apuntando a un archivo 'index' genérico.
# Flag -w: Especifica la wordlist y el alias de la palabra clave (FUZZ).
# Flag -u: Define la URL objetivo. El payload se inyecta directamente después de 'index' sin punto.

ffuf -w /<wordlist>:FUZZ -u http://<TARGET_IP>:<PORT>/<DIRECTORY>/indexFUZZ
```

```bash
# Fuzzing de páginas/archivos cuando la extensión ya fue confirmada.
# El payload FUZZ se ubica antes de la extensión conocida (.php en este caso).

ffuf -w <wordlist>:FUZZ -u http://<TARGET_IP>:<PORT>/<DIRECTORY>/FUZZ.php
```


## "Gotchas" y Troubleshooting

* **Puntos en la wordlist:** Al usar la wordlist de SecLists `web-extensions.txt`, es crucial recordar que esta lista ya incluye un punto (`.`) al inicio de cada extensión. Por lo tanto, NO se debe agregar un punto manual en la URL antes de la palabra clave (se usa `indexFUZZ`, no `index.FUZZ`).

* **Fuzzing de múltiples variables:** Es posible fuzzezar nombre de archivo y extensión en un solo comando usando múltiples wordlists con alias distintos (ej. `FUZZ_1.FUZZ_2`), aunque suele ser un enfoque más pesado en peticiones.

* **Análisis de tamaño (Size):** No basta con observar los códigos HTTP 200. Revisa siempre la columna de tamaño (`Size`) y palabras (`Words`) en la salida de `ffuf`. Un archivo `index.php` con tamaño 0 indica una página vacía, mientras que otros archivos con tamaño mayor confirmarán que tienen contenido procesable.