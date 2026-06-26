---
tags:
  - linux
  - privex
  - enum
---
## Conceptos Clave (TL;DR)
* El acceso a la cuenta root proporciona control administrativo total sobre el sistema operativo Linux.
* Comprometer totalmente el host permite capturar trafico, acceder a archivos sensibles y pivotar hacia otros sistemas, incluyendo Active Directory si la maquina esta unida al dominio.
* La enumeracion manual detallada es la clave del exito, buscando servicios vulnerables, configuraciones erroneas, scripts desactualizados y credenciales expuestas.

## Herramientas Clave
* LinEnum: Script automatizado de asistencia para la enumeracion de vectores de escalada de privilegios.
* Binarios nativos del sistema: Herramientas integradas como ps, ls, history, sudo, cat, find y lsblk utilizadas para la recoleccion manual de informacion.

## Metodología Paso a Paso

Fase 1: Informacion del Sistema y Kernel
Identificar la distribucion del sistema operativo y la version del kernel. Esto ayuda a determinar el conjunto de herramientas disponibles y a buscar exploits publicos que aprovechen vulnerabilidades especificas.

Fase 2: Servicios, Procesos y Paquetes
Revisar los servicios y procesos en ejecucion, prestando especial atencion a aquellos que se ejecutan como root. Se deben buscar servicios mal configurados o paquetes desactualizados (ej. Nagios Core, Screen 4.05.00) que posean Pruebas de Concepto (PoC) publicas.

Fase 3: Usuarios, Entorno y Directorios
Analizar que usuarios estan logueados y que procesos tienen atados a sus terminales para entender posibles rutas de movimiento lateral. Explorar los directorios de los usuarios en busca de configuraciones, historial de bash y llaves SSH que permitan acceso a otros sistemas o persistencia.

Fase 4: Privilegios, Configuraciones y Credenciales
Verificar si el usuario actual posee permisos para ejecutar comandos como otro usuario o root utilizando sudo. Buscar archivos terminados en .conf o .config, y revisar si archivos criticos como /etc/shadow o /etc/passwd exponen hashes de contrasenas para realizar ataques de fuerza bruta offline.

Fase 5: Trabajos Programados y Archivos Modificables
Listar directorios como /etc/cron.daily/ para identificar tareas programadas. Buscar sistemas de archivos no montados, binarios con permisos SETUID/SETGID, y localizar directorios o archivos modificables globalmente (world-writable) para inyectar comandos o herramientas.

## Cheat Sheet de Comandos

```bash
# Listar procesos en ejecucion y filtrar por un usuario especifico
ps aux | grep <USER>

# Listar procesos actuales atados a una terminal interactiva
ps au

# Listar el contenido del directorio home de un usuario incluyendo archivos ocultos
ls -la /home/<USER>/

# Listar el contenido del directorio SSH del usuario actual para buscar llaves privadas/publicas
ls -l ~/.ssh

# Revisar el historial de comandos de bash del usuario actual
history

# Listar los privilegios y comandos que el usuario actual puede ejecutar mediante sudo
sudo -l

# Obtener una shell de root inmediatamente si se tienen privilegios totales de sudo
sudo su

# Leer el archivo passwd en busca de usuarios del sistema o hashes expuestos
cat /etc/passwd

# Listar tareas programadas diarias del sistema
ls -la /etc/cron.daily/

# Listar dispositivos de bloques y sistemas de archivos montados/no montados
lsblk

# Buscar directorios que tienen permisos de escritura global (world-writable), excluyendo /proc y ocultando errores
find / -path /proc -prune -o -type d -perm -o+w 2>/dev/null

# Buscar archivos que tienen permisos de escritura global (world-writable), excluyendo /proc y ocultando errores
find / -path /proc -prune -o -type f -perm -o+w 2>/dev/null
```

## "Gotchas" y Troubleshooting
* Inestabilidad por Exploits de Kernel: La ejecucion de exploits de kernel puede causar inestabilidad en el sistema o una caida completa (crash); se debe tener extrema precaucion en sistemas de produccion.
* Sudo NOPASSWD: Las entradas en sudoers a menudo incluyen NOPASSWD, lo que significa que el comando especificado se puede ejecutar sin que el sistema solicite una contrasena.
* Limitaciones de Sudo: No todos los comandos que se pueden ejecutar como root a traves de sudo garantizan una ruta directa hacia la escalada de privilegios.
* Hashes en /etc/passwd: Aunque no es comun en servidores modernos, en dispositivos embebidos y enrutadores es posible encontrar hashes de contrasenas directamente en el archivo /etc/passwd en lugar de /etc/shadow.
* Riesgo al alterar configuraciones: Modificar archivos de configuracion puede ser extremadamente destructivo para el sistema, aunque a veces modificaciones menores pueden abrir accesos adicionales.
* Hashes recuperados: Si se logran leer hashes de contrasenas, estos no garantizan acceso inmediato y deben ser sometidos a ataques de fuerza bruta offline para recuperar la contrasena en texto claro.
* Llaves SSH: Una llave SSH encontrada solo es util para acceso directo si el servicio SSH esta expuesto externamente, de lo contrario sirve para movimiento lateral comprobando la cache ARP.