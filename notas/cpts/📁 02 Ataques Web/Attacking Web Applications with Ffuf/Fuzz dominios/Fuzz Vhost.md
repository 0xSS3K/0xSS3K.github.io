---
tags:
  - webapp
  - fuzzing
---
## Conceptos Clave (TL;DR)

* El fuzzing tradicional de subdominios no funciona para descubrir subdominios que no tienen registros DNS públicos o sitios web que no son públicos.

* Un VHost es fundamentalmente un subdominio alojado en el mismo servidor y con la misma IP, lo que permite que una sola IP sirva a dos o más sitios web diferentes.

* Al aplicar VHost Fuzzing sobre una IP ya conocida, es posible identificar simultáneamente subdominios y VHosts tanto públicos como no públicos.

  

## Herramientas Clave

* **ffuf**: Herramienta utilizada para escanear VHosts automatizando el fuzzing de cabeceras HTTP, específicamente enfocado en la cabecera "Host:".

  

## Metodología Paso a Paso

* **Fase 1: Configuración de la Petición HTTP**

  * Para evitar agregar todo el diccionario manualmente al archivo /etc/hosts, el ataque se realiza manipulando directamente las peticiones del protocolo HTTP.
  * Se inyecta la palabra clave FUZZ dentro de la cabecera Host para que la herramienta pruebe múltiples nombres de subdominio contra la misma dirección.

* **Fase 2: Análisis del Comportamiento del Servidor**

  * Durante el escaneo, es completamente normal que todas las palabras del diccionario devuelvan el estado 200 OK.
  * Esto ocurre porque el servidor subyacente siempre recibe la petición y responde adecuadamente, independientemente de la cabecera modificada.

* **Fase 3: Identificación de VHosts Válidos**

  * La confirmación de un VHost real no se basa en el código de estado, sino en observar un tamaño de respuesta diferente.
  * Una diferencia de tamaño indica que el servidor ha devuelto la página web correspondiente a ese VHost específico, en lugar de la página por defecto.

  
## Cheat Sheet de Comandos

```bash
# -w: Especifica la ruta del diccionario y define la palabra clave FUZZ
# -u: Especifica la URL principal del objetivo
# -H: Modifica la cabecera HTTP inyectando la palabra clave FUZZ en el campo Host

ffuf -w <WORDLIST_PATH>:FUZZ -u http://<TARGET_DOMAIN_OR_IP>:<PORT>/ -H 'Host: FUZZ.<DOMAIN>'
```

  
## "Gotchas" y Troubleshooting

* **Alerta de Falsos Positivos:** Al lanzar el escaneo inicial sin filtros, la salida mostrará todas las palabras como "200 OK". Esto no es un error de la herramienta, sino el comportamiento esperado de la IP principal.

* **Filtrado Crítico:** El factor determinante absoluto para saber si el fuzzing tuvo éxito es el tamaño (Size) de la respuesta HTTP, el cual debe ser diferente al de las peticiones fallidas.

* **Accesibilidad:** Los VHosts a menudo no se publican en registros DNS públicos; si se intenta acceder a ellos directamente desde el navegador sin conocer su IP o sin configurar la resolución local, la conexión fallará.