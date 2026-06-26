## Conceptos Clave (TL;DR)

* Los filtros basados únicamente en extensiones de archivo no son suficientes para prevenir ataques; los servidores web modernos también prueban el contenido del archivo cargado.

* Existen dos métodos comunes para la validación del contenido del archivo: la cabecera *Content-Type* y el *MIME-Type* basado en el contenido del archivo.

* **Content-Type**: Es asignado automáticamente por el navegador en el lado del cliente, lo que lo hace fácilmente manipulable interceptando la petición.

* **MIME-Type**: Es validado por el servidor inspeccionando los primeros bytes del archivo, conocidos como "Magic Bytes" o "File Signature". Se puede evadir inyectando firmas falsas al inicio del payload.  

## Herramientas Clave

* **Burp Suite (Proxy/Intruder)**: Para interceptar peticiones de subida, modificar cabeceras y hacer fuzzing de Content-Types permitidos.

* **Comando `file`**: Herramienta de Unix utilizada para determinar el tipo de archivo localmente mediante su MIME-Type.

* **SecLists**: Colección de diccionarios que incluye listas exhaustivas de Content-Types para realizar fuzzing.

## Metodología Paso a Paso


### Fase 1: Identificación y Fuzzing de Content-Type

El primer paso es determinar si la aplicación valida la cabecera Content-Type. Si un archivo con extensión válida (ej. `.jpg.php`) es rechazado, es probable que se esté validando el tipo de contenido. Se debe utilizar un diccionario de Content-Types y Burp Intruder para descubrir qué tipos son aceptados por el servidor.

### Fase 2: Bypass de Cabecera Content-Type

Una vez identificado un tipo permitido (ej. `image/jpg`), se sube el archivo malicioso (ej. `shell.php`) interceptando la petición POST. Se reemplaza el valor de la cabecera `Content-Type` correspondiente al archivo por el valor permitido, logrando eludir el filtro cliente-servidor.

### Fase 3: Bypass de MIME-Type (Magic Bytes)

Si modificar la cabecera no es suficiente, el servidor podría estar validando el MIME-Type mediante lectura de bytes (ej. `mime_content_type()` en PHP). Para evadir esto, se debe alterar la estructura del payload añadiendo los "Magic Bytes" de un formato permitido (como `GIF8`) al inicio del archivo. Esto cambia la percepción del tipo de archivo sin destruir la ejecución del código subyacente.

### Fase 4: Combinación y Permutación

Para filtros robustos, se deben combinar técnicas. Esto implica probar archivos con extensiones no permitidas junto con MIME/Content-Types permitidos, o extensiones permitidas con tipos prohibidos para confundir la lógica de seguridad del servidor.
  

## Cheat Sheet de Comandos

```bash
# Descargar el diccionario completo de Content-Types de SecLists
wget https://raw.githubusercontent.com/danielmiessler/SecLists/refs/heads/master/Discovery/Web-Content/web-all-content-types.txt

  
# Filtrar el diccionario para extraer únicamente los Content-Types relacionados con imágenes (útil si el servidor solo admite imágenes)
cat web-all-content-types.txt | grep 'image/' > <OUTPUT_WORDLIST_PATH>

  
# Verificar el tipo MIME de un archivo localmente en base a su contenido (útil para validar el payload antes de subirlo)
file <FILE_NAME>

  
# Inyectar Magic Bytes (GIF8) al inicio de un archivo para alterar su MIME-Type
echo "GIF8" > <PAYLOAD_FILE>
```

```php
# Ejemplo de Payload en PHP con inyección de Magic Bytes en la primera línea
GIF8

<?php system($_GET['cmd']); ?>
```


## "Gotchas" y Troubleshooting

* **Doble Cabecera Content-Type**: Las peticiones HTTP de subida de archivos contienen dos cabeceras Content-Type. Una se encuentra en la parte superior (para toda la petición) y otra en la parte inferior (específica para el archivo adjunto). Usualmente se debe modificar la del archivo, salvo que el contenido se envíe como datos POST puros.

* **Elección de Magic Bytes**: Se recomienda encarecidamente utilizar las firmas de imágenes GIF (`GIF87a` o `GIF89a`). A diferencia de otros formatos cuyas firmas contienen bytes no imprimibles, el formato GIF comienza con caracteres ASCII imprimibles (`GIF8`), lo que facilita su inserción manual en scripts.

* **Output Sucio (Plaintext Residual)**: Al utilizar la técnica de inyección de Magic Bytes en scripts ejecutables (como PHP), la cadena inyectada (ej. `GIF8`) no será interpretada como código y aparecerá en texto plano al inicio del output de los comandos ejecutados en el navegador.