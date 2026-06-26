---
tags:
  - webapp
  - fuzzing
---
## Conceptos Clave (TL;DR)

* Un subdominio es un sitio web que se encuentra subyacente a otro dominio principal.

* El proceso de descubrimiento consiste en iterar diferentes nombres para ver si existen, comprobando si cuentan con un registro DNS publico que redirija a la IP de un servidor funcional.

* Para poder iniciar el escaneo se requieren estrictamente dos elementos: un diccionario (wordlist) y un objetivo (target).

  

## Herramientas Clave

* **ffuf**: Herramienta utilizada para el fuzzing web que permite identificar subdominios inyectando payloads en posiciones especificas de una URL.

* **SecLists**: Repositorio de diccionarios que incluye una seccion especifica de descubrimiento DNS con las palabras mas comunes utilizadas en la creacion de subdominios.

  

## Metodologia Paso a Paso

* **Fase 1: Preparacion del Diccionario**: Seleccionar una lista de palabras adecuada para descubrimiento DNS. Por defecto se puede usar `subdomains-top1million-5000.txt` para escaneos rapidos. Si se desea ampliar el alcance del escaneo, se debe seleccionar una lista de mayor longitud.

* **Fase 2: Lanzamiento del Ataque**: Ejecutar la herramienta `ffuf` posicionando la palabra clave `FUZZ` exactamente en el lugar del subdominio dentro de la estructura de la URL objetivo.

* **Fase 3: Validacion de Resultados**: Analizar la salida del escaneo buscando codigos de estado HTTP exitosos o redirecciones (ej. 200 o 301) que confirmen la resolucion del subdominio.
  

## Cheat Sheet de Comandos

```bash
# -w: Especifica la ruta absoluta del diccionario a utilizar y delimita la palabra clave a inyectar (:FUZZ)

# -u: Define la URL objetivo indicando a la herramienta que inyecte los payloads en el subdominio (FUZZ.<DOMAIN>)

ffuf -w /opt/useful/seclists/Discovery/DNS/subdomains-top1million-5000.txt:FUZZ -u https://FUZZ.<DOMAIN>/
```
  

## "Gotchas" y Troubleshooting

* Que un escaneo no devuelva resultados no implica la inexistencia total de subdominios bajo un objetivo.

* Esto suele indicar que no existen subdominios publicos configurados con un registro DNS publico.

* Al realizar pruebas en entornos controlados, agregar el dominio principal al archivo `/etc/hosts` no permite descubrir subdominios mediante este metodo. Al no estar mapeados los subdominios explicitamente en `/etc/hosts`, `ffuf` realiza la consulta al DNS publico, el cual no podra resolver las direcciones locales.