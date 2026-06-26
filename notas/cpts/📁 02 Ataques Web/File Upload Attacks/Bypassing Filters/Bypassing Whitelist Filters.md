---
tags:
  - webapp
  - fileupload
  - bypass
---
## Conceptos Clave (TL;DR)

* Las listas blancas (whitelists) son generalmente más seguras que las listas negras, ya que el servidor web solo permite extensiones explícitamente especificadas y la lista no necesita ser exhaustiva para cubrir extensiones poco comunes.

* Las vulnerabilidades surgen frecuentemente por el uso de expresiones regulares (regex) débiles implementadas por desarrolladores que solo comprueban si el nombre del archivo contiene la extensión, en lugar de verificar si realmente termina con ella.

* Estas validaciones deficientes se pueden evadir utilizando técnicas como la doble extensión, la doble extensión inversa o la inyección de caracteres.

* Las configuraciones inseguras del servidor web pueden permitir la ejecución de código PHP incluso si el archivo finaliza con una extensión de imagen, siempre y cuando el nombre contenga una extensión PHP válida.

  
## Herramientas Clave

* **Burp Suite (Intruder):** Utilizado para realizar ataques de fuzzing en formularios de subida de archivos, probando diccionarios de extensiones o permutaciones de nombres de archivo para identificar filtros permitidos.

* **Bash (Scripting):** Útil para automatizar la generación de diccionarios (wordlists) personalizados que combinan extensiones y caracteres de inyección.

  
## Metodología Paso a Paso

### Fase 1: Reconocimiento y Fuzzing

* Interceptar una petición de subida de archivo normal usando un proxy.
* Fuzzear la extensión del archivo utilizando un diccionario de extensiones (ej. variaciones de PHP) para determinar si las peticiones son bloqueadas o si el servidor acepta extensiones maliciosas inesperadas.

  
### Fase 2: Bypass por Doble Extensión (Regex Débil)

* Esta técnica es útil cuando el código fuente valida que el nombre del archivo contenga una extensión permitida, pero omite validar de forma estricta el final de la cadena.
* Renombrar el payload web shell agregando la extensión permitida seguida de la extensión ejecutable (ej. `shell.jpg.php`).
* Subir el archivo y navegar a la ruta del mismo probando la ejecución de un comando en el sistema para confirmar que se procesa como un script.

  
### Fase 3: Bypass por Doble Extensión Inversa (Misconfiguración de Servidor)

* Si la aplicación web utiliza un regex estricto que solo considera la extensión final del archivo (usando el ancla de finalización `$`), la técnica de doble extensión tradicional no funcionará.
* Sin embargo, si el servidor Apache posee configuraciones inseguras (ej. la directiva `<FilesMatch>`) que determinan la ejecución de código para cualquier archivo que simplemente contenga `.php` en su nombre sin terminar con él, se puede aplicar esta variante.
* Nombrar el archivo anteponiendo la extensión maliciosa y terminando de forma estricta con la extensión de imagen permitida (ej. `shell.php.jpg`).
* Subir el archivo y comprobar la ejecución de comandos para confirmar la explotación de la mala configuración.

  
### Fase 4: Bypass por Inyección de Caracteres

* Implica inyectar caracteres especiales antes o después de la extensión final para engañar a la aplicación web, forzándola a malinterpretar el nombre de archivo y ejecutar el código.
* Generar un diccionario personalizado con permutaciones de nombres, inyectando caracteres como `%20`, `%0a`, `%00`, `%0d0a`, `/`, `.\`, `.`, y `:`.
* Ejecutar un ataque de fuzzing con este diccionario utilizando Intruder para identificar qué variante de inyección logra evadir la validación y ejecutarse en el backend.


## Cheat Sheet de Comandos

```bash
# Generador de Wordlist para Inyección de Caracteres

# Crea combinaciones de inyección antes y después de la extensión permitida y la ejecutable.

for char in '%20' '%0a' '%00' '%0d0a' '/' '.\\' '.' '…' ':'; do
    for ext in '.php' '.phps'; do
        echo "shell$char$ext.jpg" >> wordlist.txt
        echo "shell$ext$char.jpg" >> wordlist.txt
        echo "shell.jpg$char$ext" >> wordlist.txt
        echo "shell.jpg$ext$char" >> wordlist.txt
    done
done
```

```bash
# Validación de ejecución de Web Shell vía cURL

# Se añade el parámetro definido en la webshell para ejecutar comandos (ej. id) tras un bypass exitoso

curl http://<TARGET_IP>:<PORT>/<UPLOAD_DIRECTORY>/shell.jpg.php?cmd=id
curl http://<TARGET_IP>:<PORT>/<UPLOAD_DIRECTORY>/shell.php.jpg?cmd=id
```

  
## "Gotchas" y Troubleshooting

* **Falsos Positivos en Errores:** Los mensajes de error de una aplicación web no siempre reflejan de forma precisa qué tipo de validación exacta (lista blanca vs lista negra) se está utilizando internamente.

* **Limitaciones del Null Byte:** La técnica de inyección del carácter de byte nulo `%00` (ej. `shell.php%00.jpg`) se limita operativamente a servidores web PHP con versión 5.X o anteriores.

* **Entornos Windows:** Al interactuar con aplicaciones alojadas en servidores Windows, inyectar el carácter de dos puntos (`:`) justo antes de la extensión permitida (ej. `shell.aspx:.jpg`) puede lograr que el sistema ignore la extensión de imagen y escriba el archivo como ejecutable.

* **Dependencia de Configuraciones Externas:** Las vulnerabilidades explotables mediante doble extensión inversa a menudo no residen en una falla de la función de subida, sino en configuraciones globales inseguras del servidor web (como en `/etc/apache2/mods-enabled/php7.4.conf`).