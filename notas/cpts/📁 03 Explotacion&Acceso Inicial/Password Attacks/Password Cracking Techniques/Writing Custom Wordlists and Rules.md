---
tags:
  - cracking
---
## Conceptos Clave (TL;DR)

* Los usuarios tienden a crear contraseñas predecibles basadas en su entorno (empresa, mascotas, fechas, intereses), incluso cuando existen políticas de contraseñas estrictas.

* Para cumplir con los requisitos del sistema, los usuarios suelen aplicar modificaciones simples a palabras base comunes, como capitalizar la primera letra, añadir el año actual o agregar un carácter especial al final.

* La creación de wordlists efectivas requiere combinar palabras clave recolectadas mediante inteligencia de fuentes abiertas (OSINT) con reglas de mutación que simulan los patrones humanos de creación de contraseñas.

  
## Herramientas Clave

* [Hashcat](../../../📂%2008%20Herramientas&Cheatsheets/Hashcat.md): Se utiliza tanto para aplicar listas de reglas a palabras base como para la ejecución del ataque de fuerza bruta/diccionario.

* **John the Ripper (JtR):** Alternativa para el cracking que también incluye listas de reglas preconstruidas.

* **CeWL:** Herramienta de scraping (spidering) web diseñada para extraer palabras de un sitio corporativo y compilar una lista base personalizada.

  

## Metodología Paso a Paso

1. **Recolección de Inteligencia (OSINT):** Recopilar información personal del objetivo (fechas de nacimiento, nombres de familiares/mascotas, hobbies) o corporativa (nombre de la empresa, servicios) para conformar el diccionario base.

2. **Generación de Diccionario Base Automatizado:** Extraer palabras clave directamente de la infraestructura web pública de la organización para capturar terminología interna.

3. **Definición de Reglas de Mutación:** Escribir un archivo de reglas basándose en la política de contraseñas conocida (ej. mínimo de caracteres, inclusión de símbolos/números) y las sustituciones lógicas habituales.

4. **Mutación de la Wordlist:** Procesar el diccionario base a través del motor de reglas para generar de forma determinista todas las permutaciones posibles antes o durante el ataque.

  
## Cheat Sheet de Comandos

### Scraping de Palabras Clave con CeWL
```bash
# -d: Profundidad del spidering (cuántos enlaces seguir)
# -m: Longitud mínima de la palabra a capturar
# --lowercase: Convierte todos los resultados a minúsculas para normalizar la lista
# -w: Archivo de salida

cewl https://<TARGET_URL> -d <DEPTH> -m <MIN_LENGTH> --lowercase -w <OUTPUT_WORDLIST>.txt
```
### Sintaxis Fundamental de Reglas de Hashcat
```text
# Crear un archivo custom.rule y añadir las transformaciones por línea:
:     # No hacer nada (deja la palabra intacta)
l     # Convertir todas las letras a minúsculas
u     # Convertir todas las letras a mayúsculas
c     # Capitalizar la primera letra y poner el resto en minúsculas

s<X><Y> # Reemplazar todas las instancias de la letra X por la letra/número Y

$<CHAR> # Añadir un carácter específico al final de la palabra (ej. $! para añadir !)
```
### Generación de Wordlist Mutada (Testeo en Texto Plano)
```bash
# --force: Ignorar advertencias
# -r: Especificar el archivo de reglas a aplicar
# --stdout: Imprimir las combinaciones en pantalla en lugar de intentar crackear un hash
# | sort -u: Ordenar alfabéticamente y eliminar duplicados
# > : Redirigir el output limpio al wordlist final

hashcat --force <BASE_WORDLIST>.txt -r <RULES_FILE>.rule --stdout | sort -u > <MUTATED_WORDLIST>.txt
```

## "Gotchas" y Troubleshooting

* **Reglas Preconstruidas:** Antes de crear reglas complejas desde cero, prueba usar `best64.rule` (incluida en Hashcat/JtR). Es un estándar en la industria que aplica las transformaciones que estadísticamente resultan en más aciertos.

* **Políticas vs Realidad:** La mayoría de las contraseñas tienen 10 caracteres o menos, incluso con políticas en vigor. Si conoces la política del objetivo (ej. "mínimo 12 caracteres"), ajusta las palabras base de OSINT (usualmente >5 caracteres) y añade el año y caracteres especiales para alcanzar el mínimo requerido.

* **Mentalidad de Cracking:** Generar diccionarios es un juego de adivinanzas basado en probabilidades. Utiliza el contexto (región geográfica, industria, departamento del usuario) para filtrar y enfocar la wordlist base, evitando diccionarios genéricos masivos que ralentizarán el proceso en un entorno de examen.