---
tags:
  - enum
  - linux
  - privex
---
## Conceptos Clave (TL;DR)
* Llevar la enumeración más allá de los permisos básicos de archivos permite descubrir configuraciones internas defectuosas, aplicaciones instaladas, sockets en uso y políticas de contraseñas.
* El sistema de archivos `/proc` (procfs) es virtual y generado dinámicamente; resulta vital para extraer parámetros del kernel y argumentos de línea de comandos (donde a menudo se filtran credenciales).
* Los archivos de configuración y scripts internos suelen contener contraseñas hardcodeadas o poseer privilegios excesivos por descuido administrativo.
* Incluso si no tienes permisos sobre una carpeta, si un archivo de configuración dentro de ella tiene permisos de lectura global, podrás leerlo.

## Herramientas Clave
* **ip / ifconfig / net-tools:** Para descubrir interfaces de red y posibles vías de pivoting.
* **lastlog / w / finger:** Para rastrear actividad de usuarios y sesiones activas.
* **find:** Esencial para localizar archivos `.conf`, `.config`, `.sh` y archivos de historial ocultos.
* **apt:** Para listar paquetes instalados y cruzar datos en busca de vulnerabilidades.
* **curl / jq:** Para automatizar consultas cruzadas contra la API de GTFObins.
* **strace:** Analizador de llamadas al sistema útil para rastrear el flujo de un programa e identificar vectores de ataque o tokens filtrados.

## Metodología Paso a Paso

1. **Enumeración de Red:** Revisar interfaces locales para identificar redes secundarias que permitan realizar pivoting hacia subredes previamente inalcanzables. Analizar la resolución de nombres local.
2. **Auditoría de Usuarios y Sesiones:** Identificar quién está en el sistema y revisar sus horas de login. Sistemas muy utilizados suelen contener más "basura" o historiales descuidados.
3. **Revisión de Historiales:** Inspeccionar historiales de bash y archivos de historial específicos de aplicaciones, ya que los usuarios suelen pasar contraseñas por línea de comandos o configurar tareas cron inseguras.
4. **Análisis de Tareas Programadas y Procesos (Cron & Procfs):** Buscar tareas programadas con rutas relativas o permisos débiles para secuestrar la ejecución. Revisar el procfs en busca de argumentos de línea de comandos en texto plano.
5. **Auditoría de Software y Binarios:** Listar software instalado y binarios disponibles directamente en el sistema. Revisar versiones críticas como sudo y automatizar la búsqueda de binarios explotables mediante GTFObins.
6. **Rastreo de Llamadas del Sistema:**
   Utilizar strace en binarios sospechosos para monitorear el acceso a recursos y peticiones remotas que podrían revelar información sensible.
7. **Búsqueda de Configuraciones y Scripts:** Escanear todo el sistema en busca de archivos `.conf` y `.sh`. Leer estos archivos ayuda a entender el flujo interno de los servicios y descubrir credenciales de acceso.

## Cheat Sheet de Comandos

```bash
# Mostrar interfaces de red para identificar posibles subredes para pivoting
ip a
# Alternativa si el paquete net-tools no está instalado y falla el comando anterior
ifconfig

# Revisar el archivo hosts en busca de resoluciones internas interesantes
cat /etc/hosts

# Ver el último inicio de sesión de todos los usuarios
lastlog

# Listar usuarios actualmente logueados en el sistema junto con el atacante
w
# Alternativa para ver usuarios logueados en ciertos sistemas Linux
finger

# Ver el historial de comandos del usuario actual
history

# Buscar archivos de historial creados por scripts o programas en todo el sistema (ignorando errores)
find / -type f \( -name *_hist -o -name *_history \) -exec ls -l {} \; 2>/dev/null

# Listar los scripts que se ejecutan como cron jobs diarios
ls -la /etc/cron.daily/

# Extraer argumentos de línea de comandos de todos los procesos en ejecución a través de procfs
find /proc -name cmdline -exec cat {} \; 2>/dev/null | tr " " "\n"

# Crear una lista limpia de paquetes instalados para posterior análisis de vulnerabilidades
apt list --installed | tr "/" " " | cut -d" " -f1,3 | sed 's/[0-9]://g' | tee -a installed_pkgs.list

# Revisar la versión exacta de Sudo para buscar exploits conocidos (ej. CVE-2021-3156)
sudo -V

# Listar binarios ejecutables directamente por el sistema que no requieren instalación
ls -l /bin /usr/bin/ /usr/sbin/

# Automatizar la validación de binarios instalados contra la base de datos de GTFObins
for i in $(curl -s [https://gtfobins.org/api.json](https://gtfobins.org/api.json) | jq -r '.executables | keys[]'); do if grep -q "$i" installed_pkgs.list; then echo "Check for GTFO: $i";fi; done

# Rastrear las llamadas al sistema y procesamiento de señales de un binario específico
strace <BINARY> -c1 <TARGET_IP>

# Buscar todos los archivos de configuración en el sistema omitiendo los errores de permisos
find / -type f \( -name *.conf -o -name *.config \) -exec ls -l {} \; 2>/dev/null

# Buscar todos los scripts de shell en el sistema filtrando directorios comunes ruidosos
find / -type f -name "*.sh" 2>/dev/null | grep -v "src\|snap\|share"

# Listar los procesos en ejecución y filtrar para ver cuáles están siendo ejecutados por un usuario específico
ps aux | grep <USER>
```

## "Gotchas" y Troubleshooting
* **Comandos de red faltantes:** El comando `ifconfig` puede fallar si el paquete `net-tools` no está instalado. Utiliza siempre `ip a` como primera opción.
* **Permisos de directorio vs archivos:** No asumas que no puedes leer un archivo solo porque no tienes acceso de lectura a su directorio padre. Si el administrador dejó permisos de lectura global en el archivo (`chmod o+r`), la lectura directa funcionará.
* **Ejecución del oneliner de GTFObins:** El bucle que extrae ejecutables de GTFObins requiere que la máquina donde se ejecuta tenga `curl`, `jq` y acceso a Internet. Si el objetivo está aislado (offline), descarga el archivo `installed_pkgs.list` a tu máquina de ataque y corre el comando de forma local.
* **Archivos ocultos en Procfs:** Recuerda que `/proc` no existe en el disco, se genera dinámicamente por el kernel. Debes actuar rápido para capturar la línea de comandos (`cmdline`) de procesos efímeros o tareas cron que se ejecutan de forma temporal.