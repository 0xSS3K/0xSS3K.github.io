---
tags:
  - fuzzing
  - webapp
---
## Conceptos Clave (TL;DR)

* El "Directory Fuzzing" consiste en utilizar herramientas automatizadas y diccionarios (wordlists) para descubrir directorios en sitios web.

* Es posible probar miles de URLs en segundos para identificar endpoints válidos basándose en la respuesta del servidor.

* Encontrar una página en blanco sin recibir un código HTTP 404 (Not Found) o 403 (Access Denied) indica que el directorio existe y es accesible.

  

## Herramientas Clave

* **ffuf:** Herramienta utilizada para el descubrimiento de directorios y contenido web.

  

## Metodología Paso a Paso

* **Fase 1: Preparación**

  Selecciona tu diccionario (wordlist) y asígnale una palabra clave para referenciarlo en el comando. Por ejemplo, se le puede asignar la palabra clave "FUZZ" añadiendo ":FUZZ" después de la ruta del archivo.

* **Fase 2: Ejecución**

  Coloca la palabra clave "FUZZ" en la posición exacta de la URL donde el directorio estaría ubicado para que la herramienta inyecte las palabras del diccionario.

* **Fase 3: Verificación Manual**

  Una vez que la herramienta arroje resultados (hits), visita las URLs descubiertas en un navegador para verificar que el endpoint realmente existe.

* **Fase 4: Enumeración Profunda**

  Si encuentras directorios vacíos pero accesibles, el siguiente paso es buscar archivos o páginas dentro de este directorio.

  

## Cheat Sheet de Comandos

  

```bash

# Ver las opciones de ayuda de la herramienta para consultar parámetros y flags

ffuf -h

```

  

```bash

# Fuzzing básico de directorios web asignando la palabra clave FUZZ al wordlist

# -w: Ruta del diccionario y asignación de la palabra clave

# -u: URL objetivo con la palabra clave en la ruta

ffuf -w <WORDLIST_PATH>:FUZZ -u http://<TARGET_IP>:<PORT>/FUZZ

```

  

```bash

# Fuzzing avanzado con filtros, matchers y output detallado

# -w: Ruta del diccionario

# -u: URL objetivo con la palabra clave

# -mc all: Coincidir con todos los códigos de estado HTTP en la respuesta

# -fs 42: Filtrar y omitir respuestas con tamaño exacto de 42 bytes

# -c: Output con colores

# -v: Modo verboso

ffuf -w <WORDLIST_PATH> -u https://<DOMAIN>/FUZZ -mc all -fs 42 -c -v

```

  

## "Gotchas" y Troubleshooting

* **Riesgo de DoS:** Puedes aumentar la velocidad de la herramienta incrementando el número de hilos (ej. agregando `-t 200`), pero esto no es recomendable en sitios remotos porque puede interrumpir el servicio, causar una Denegación de Servicio (DoS) o tumbar tu conexión a internet.

* **Escaneo Recursivo:** Si decides utilizar el escaneo recursivo (`-recursion`), la herramienta solo soporta la palabra clave "FUZZ" y la URL especificada con `-u` debe terminar obligatoriamente con dicha palabra clave.

* **Velocidad Variable:** La rapidez con la que se envían las peticiones variará dependiendo de la velocidad de tu internet y el ping si estás ejecutando la herramienta desde tu propia máquina.

* **Páginas en Blanco:** Un hit que devuelve una página en blanco significa que el directorio no tiene una página dedicada, pero confirma tu acceso si no obtienes errores 404 o 403.