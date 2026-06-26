---
tags:
  - linux
  - hunting
---
## Conceptos Clave (TL;DR)

* Búsqueda de credenciales (passwords, hashes, keys) como método rápido para escalar privilegios locales tras obtener acceso inicial.

* Se fundamenta en el principio básico de Linux: "todo es un archivo".

* La búsqueda se divide en 4 grandes categorías: Archivos (configuraciones, bases de datos, notas, scripts), Historial (comandos y logs), Memoria (caché) y Keyrings (credenciales en navegadores).
  

## Herramientas Clave

* **find / grep**: Utilidades base de Linux para buscar archivos específicos y filtrar texto en busca de credenciales hardcodeadas.
* **mimipenguin**: Herramienta para extraer credenciales en texto plano desde la memoria.
* **LaZagne**: Script multi-propósito para extraer credenciales de navegadores, bases de datos, wifi, shadow, etc.
* **jq**: Procesador de JSON en línea de comandos, útil para leer archivos de configuración de navegadores.
* **firefox_decrypt**: Script en Python para desencriptar contraseñas almacenadas localmente en perfiles de Firefox.
  

## Metodología Paso a Paso

1. **Fase 1: Enumeración de Archivos y Scripts**:

   Revisar el sistema de archivos buscando configuraciones, bases de datos, notas y scripts. Estos archivos suelen contener credenciales en texto plano necesarias para la interacción entre servicios automatizados o apuntes de administradores.

2. **Fase 2: Revisión de Historiales y Cronjobs**:

   Analizar tareas programadas y los historiales de shell. Los usuarios y administradores a menudo introducen contraseñas directamente en la línea de comandos o configuran scripts vulnerables en el cron.

3. **Fase 3: Análisis de Logs**:

   Buscar en los registros del sistema, servicios y eventos. Los errores de autenticación o procesos mal configurados pueden volcar información sensible en estos archivos.

4. **Fase 4: Extracción de Memoria y Keyrings**:

   Utilizar herramientas especializadas para buscar en la memoria volátil de procesos activos o extraer y desencriptar bases de datos locales de gestores de contraseñas de navegadores web.

  
## Cheat Sheet de Comandos
```bash
# Busca archivos de configuracion comunes y omite directorios ruidosos

for l in $(echo ".conf .config .cnf");do echo -e "\nFile extension: " $l; find / -name *$l 2>/dev/null | grep -v "lib\|fonts\|share\|core" ;done
```
  
```bash
# Busca las palabras "user", "password" o "pass" dentro de archivos .cnf ignorando comentarios

for i in $(find / -name *.cnf 2>/dev/null | grep -v "doc\|lib");do echo -e "\nFile: " $i; grep "user\|password\|pass" $i 2>/dev/null | grep -v "\#";done
```
  
```bash
# Busca posibles archivos de bases de datos por su extension

for l in $(echo ".sql .db .*db .db*");do echo -e "\nDB File extension: " $l; find / -name *$l 2>/dev/null | grep -v "doc\|lib\|headers\|share\|man";done
```
  
```bash
# Busca archivos de texto (.txt) o archivos sin extension en los directorios home de los usuarios

find /home/* -type f -name "*.txt" -o ! -name "*.*"
```
  
```bash
# Busca scripts comunes (.py, .sh, .pl, etc.) en todo el sistema

for l in $(echo ".py .pyc .pl .go .jar .c .sh");do echo -e "\nFile extension: " $l; find / -name *$l 2>/dev/null | grep -v "doc\|lib\|headers\|share";done
```
  
```bash
# Lee el archivo crontab principal del sistema

cat /etc/crontab
```
  
```bash
# Enumera todos los directorios de cron para revisar scripts programados

ls -la /etc/cron.*/
```
  
```bash
# Muestra las ultimas lineas del historial de bash y perfiles de todos los usuarios en /home

tail -n5 /home/*/.bash*
```
  
```bash
# Filtra palabras clave relacionadas con autenticacion y eventos relevantes en todos los logs de /var/log

for i in $(ls /var/log/* 2>/dev/null);do GREP=$(grep "accepted\|session opened\|session closed\|failure\|failed\|ssh\|password changed\|new user\|delete user\|sudo\|COMMAND\=\|logs" $i 2>/dev/null); if [[ $GREP ]];then echo -e "\n#### Log file: " $i; grep "accepted\|session opened\|session closed\|failure\|failed\|ssh\|password changed\|new user\|delete user\|sudo\|COMMAND\=\|logs" $i 2>/dev/null;fi;done
```
  
```bash
# Ejecuta mimipenguin para buscar credenciales en memoria

sudo python3 mimipenguin.py
```
  
```bash
# Extrae contraseñas utilizando el modulo 'all' de LaZagne (idealmente ejecutado como root para mayor alcance)

sudo python2.7 laZagne.py all
```
  
```bash
# Busca unicamente credenciales en navegadores usando LaZagne

python3 laZagne.py browsers
```
  
```bash
# Enumera directorios de perfiles de Firefox

ls -l /home/<USER>/.mozilla/firefox/ | grep default
```
  
```bash
# Formatea la salida del archivo de contraseñas encriptadas de Firefox para visualizacion rapida

cat /home/<USER>/.mozilla/firefox/<PROFILE_NAME>.default-release/logins.json | jq .
```
  
```bash
# Desencripta perfiles de Firefox usando firefox_decrypt de forma interactiva

python3.9 firefox_decrypt.py
```

  

## "Gotchas" y Troubleshooting

* **Nombres no estándar:** Los archivos de configuración no están obligados a utilizar extensiones como `.conf` o `.cnf`; podrían haber sido renombrados o alterados durante la compilación del servicio.

* **Notas sin formato:** Las notas de los administradores no siempre tienen la extensión `.txt`; se debe incluir la búsqueda de archivos sin extensión en carpetas de usuarios.

* **Dependencia de Root:** La herramienta `mimipenguin` requiere estrictamente permisos de administrador/root para poder inspeccionar la memoria.

* **Dependencias de Python:** `firefox_decrypt` requiere Python 3.9 para su versión más reciente. Si el target solo tiene Python 2, se debe utilizar la versión 0.7.0 del script.

* **Logs por Distribución:** Los registros de autenticación se encuentran en `/var/log/auth.log` en distribuciones Debian, mientras que en sistemas RedHat/CentOS se ubican en `/var/log/secure`.

* **Lógica del Entorno:** Si te encuentras en un servidor de bases de datos aislado, es probable que no existan usuarios regulares del sistema corporativo, ya que el acceso se restringe a unos pocos administradores.