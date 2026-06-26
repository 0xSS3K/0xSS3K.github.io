---
tags:
  - webshell
  - php
---
## Conceptos Clave (TL;DR)

* PHP es un lenguaje de scripting del lado del servidor ampliamente utilizado.
* Los servidores que procesan PHP son objetivos primarios para obtener ejecución remota de comandos mediante la carga de web shells basadas en este lenguaje.
* Las restricciones impuestas por las aplicaciones al subir archivos pueden ser evadidas interceptando la petición HTTP y manipulando el tipo de contenido declarado.


## Herramientas Clave

* Burp Suite: Proxy web local utilizado para interceptar, pausar y modificar peticiones HTTP en tránsito antes de que lleguen al servidor.
* [WhiteWinterWolf PHP Web Shell](https://github.com/WhiteWinterWolf/wwwolf-php-webshell): Script pre-fabricado en PHP utilizado como payload para interactuar con el sistema operativo subyacente de forma no interactiva.

  
## Metodología Paso a Paso

1. Fase 1: Configuración del Entorno. Configura las opciones de red del navegador para enrutar todo el tráfico a través del proxy local apuntando a 127.0.0.1 en el puerto 8080.

2. Fase 2: Intercepción de la Petición. Localiza un punto de subida de archivos (ej. logos de proveedor), intenta subir la web shell con formato `.php` y captura la petición POST resultante en el proxy.

3. Fase 3: Evasión de Firmas Estáticas. Inspecciona el código fuente del payload en la petición y elimina comentarios del autor o metadatos; esto evita delatar el ataque frente a controles de seguridad.

4. Fase 4: Evasión de Extensión y Tipo. Dentro de la petición interceptada, modifica el valor de la cabecera Content-Type correspondiente a la shell a un formato de imagen permitido (ej. GIF) y reenvía la petición al servidor.

5. Fase 5: Ejecución y Acceso. Navega a la ruta web exacta donde el servidor almacenó el archivo para acceder a la interfaz de la web shell y comenzar a ejecutar comandos.

  
## Cheat Sheet de Comandos
```http
# Modificación de la cabecera dentro de la petición POST interceptada en Burp Suite para engañar la validación del servidor indicando que el archivo es una imagen.

Content-type: image/gif
```

```bash
# Navegación y ejecución de la web shell mediante una petición GET a la ruta de subida en el servidor.

curl http://<TARGET_IP>/<UPLOAD_PATH>/<PAYLOAD_NAME>.php
```

```bash
# Ejemplo de comandos encadenados (operador &&) que a menudo fallan o son inestables debido a la falta de interactividad real de una web shell pura.

whoami && hostname
```
  

## "Gotchas" y Troubleshooting

* Limitaciones de Interactividad: Operaciones fluidas como la navegación del sistema de archivos, la carga/descarga de archivos adicionales o el encadenamiento de comandos suelen ser altamente inestables a través de una web shell.

* Persistencia Temporal: Muchas aplicaciones web están configuradas para eliminar archivos subidos automáticamente después de un periodo de tiempo definido.

* OpSec y Rastros: Las web shells dejan evidencia clara en el sistema comprometido. Para operaciones evasivas (Black Box), utiliza la web shell únicamente para establecer una reverse shell hacia tu máquina atacante y elimina el archivo PHP del servidor de inmediato.

* Documentación Estricta: Registra de forma precisa todos los métodos probados, los nombres de los payloads utilizados, las ubicaciones de subida y calcula los hashes (MD5 o SHA1) de los archivos para incluirlos en el reporte y garantizar una limpieza adecuada post-compromiso.