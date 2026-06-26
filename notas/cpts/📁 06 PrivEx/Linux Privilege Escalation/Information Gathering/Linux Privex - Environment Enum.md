---
tags:
  - linux
  - privex
  - enum
---
## Conceptos Clave (TL;DR)
* La enumeración manual exhaustiva del entorno es la clave principal para descubrir vectores de escalación de privilegios en sistemas Linux.
* Identificar la versión exacta del sistema operativo y del kernel permite determinar la aplicabilidad de exploits públicos, los cuales deben usarse con precaución para evitar caídas del sistema.
* Los servicios mal configurados o vulnerables que se ejecutan como root (como Nagios, Exim o Samba) representan oportunidades directas de compromiso.
* La recolección de información debe incluir variables de entorno, configuraciones de red, usuarios, archivos ocultos y sistemas de archivos montados/desmontados para localizar credenciales o rutas de ataque misceláneas.

## Herramientas Clave
* **LinPEAS:** Script automatizado para la enumeración detallada y búsqueda de vectores de escalación de privilegios en Linux.
* **LinEnum:** Script auxiliar alternativo para asistir en las tareas de enumeración del entorno.

## Metodología Paso a Paso

**Fase 1: Orientación Inicial**
El objetivo es establecer el contexto del usuario actual. Determinar los permisos del usuario, a qué grupos pertenece y si posee capacidades de ejecución sin contraseña mediante sudo, lo cual puede proporcionar una escalación inmediata.

**Fase 2: Identificación del Sistema y Kernel**
Consiste en perfilar el objetivo obteniendo la distribución, la versión del sistema operativo, el kernel y la arquitectura del procesador. Esto dictará el conjunto de herramientas a utilizar y revelará vulnerabilidades públicas conocidas (CVEs).

**Fase 3: Análisis del Entorno de Usuario**
Revisar las variables de entorno locales y la variable PATH. Un PATH mal configurado puede ser abusado para secuestrar la ejecución de binarios legítimos, y las variables de entorno pueden contener credenciales expuestas.

**Fase 4: Enumeración de Red y Enrutamiento**
Analizar las interfaces de red, la tabla de enrutamiento y la caché ARP. Esto permite identificar subredes adicionales, descubrir otros hosts con los que el servidor se comunica y sentar las bases para el movimiento lateral o el pivoting hacia el entorno de Active Directory.

**Fase 5: Auditoría de Cuentas y Grupos**
Revisar minuciosamente los archivos de configuración de usuarios. Buscar usuarios con shells válidos interactivos, revisar la membresía a grupos privilegiados y buscar contraseñas o hashes expuestos atípicamente.

**Fase 6: Almacenamiento, Archivos y Defensas**
Enumerar dispositivos de bloques, sistemas de archivos montados/desmontados y carpetas temporales. Buscar configuraciones, llaves SSH, historiales de comandos (`.bash_history`) y archivos ocultos que puedan contener secretos. Identificar pasivamente protecciones activas (como AppArmor o SELinux) para adaptar la estrategia ofensiva.

## Cheat Sheet de Comandos

### 1. Contexto del usuario actual

Con qué usuario tengo la shell, su UID/GID y a qué grupos pertenezco. Grupos como `sudo`, `docker`, `lxd`, `disk` o `adm` son vectores directos de escalada.
```bash
whoami
id
```

Comandos que puedo ejecutar con `sudo` (con o sin contraseña). Es uno de los primeros vectores a revisar: un solo binario mal configurado puede darme root (revisar contra GTFOBins).
```bash
sudo -l
```

---
### 2. Identidad y propósito de la máquina

El nombre del host, para inferir su rol o nomenclatura (ej. `web01`, `dc01`, `jenkins`) y orientarme dentro de la red.
```bash
hostname
```

---
### 3. Sistema operativo y kernel

Distribución y versión exacta. Una versión vieja puede tener exploits públicos conocidos y me ayuda a elegir las herramientas correctas.
```bash
cat /etc/os-release
```

Versión del kernel y arquitectura. Clave para buscar **kernel exploits** específicos y para compilar/elegir el payload correcto (x86 vs x64).
```bash
uname -a
cat /proc/version
```

Shells de login válidas instaladas. Útil para saber con qué intérpretes cuento y para correlacionar con las shells asignadas a usuarios en `/etc/passwd`.
```bash
cat /etc/shells
```

---
### 4. Entorno y rutas

Las rutas del `PATH`. Si incluye directorios escribibles o relativos (`.`), puede abrir un vector de **PATH hijacking**.
```bash
echo $PATH
```

Todas las variables de entorno de la sesión. Pueden filtrar credenciales, tokens, rutas de configuración o pistas sobre servicios y aplicaciones instaladas.
```bash
env
```

---
### 5. Hardware y discos

Características y arquitectura del CPU (núcleos, virtualización). Útil para perfilar la máquina y confirmar arquitectura.
```bash
lscpu
```

Dispositivos de bloque (discos, particiones, USB, loop). Sirve para detectar volúmenes adicionales o montajes interesantes.
```bash
lsblk
```

Uso del espacio en disco y sistemas de archivos montados actualmente. Me da una vista rápida de qué está montado y dónde.
```bash
df -h
```

Sistema de archivos persistente y puntos de montaje definidos. Puede revelar **credenciales en texto plano** (montajes NFS/SMB con usuario y contraseña) o shares de red interesantes.
```bash
cat /etc/fstab
```

Lo mismo que el anterior, pero filtrando comentarios y tabulado para leerlo limpio (incluye montajes definidos aunque no estén activos).
```bash
cat /etc/fstab | grep -v "#" | column -t
```

Estado y cola de las impresoras conectadas. Aporta contexto del entorno y, ocasionalmente, servicios/usuarios asociados.
```bash
lpstat
```

---
### 6. Red

Interfaces de red, IPs asignadas y subredes. Define en qué segmento estoy y prepara el terreno para **pivoting / movimiento lateral**.
```bash
ifconfig
ip a
```

Tabla de enrutamiento del kernel. Revela **otras subredes alcanzables** a través de esta máquina (clave para pivotear).
```bash
route
netstat -rn
```

Configuración de resolución DNS. Identifica **dominios internos** y servidores DNS, lo que insinúa la existencia de un Active Directory u otros servicios internos.
```bash
cat /etc/resolv.conf
```

Caché ARP. Lista **otros hosts vivos** en la misma red local con los que esta máquina ya se ha comunicado.
```bash
arp -a
```

---
### 7. Usuarios y grupos

Todos los usuarios y cuentas de servicio del sistema. Me da nombres para apuntar y revela qué servicios corren bajo cuentas dedicadas.
```bash
cat /etc/passwd
```

Solo los nombres de usuario, en una lista limpia (útil para alimentar ataques de password spraying o brute force).
```bash
cat /etc/passwd | cut -f1 -d:
```

Usuarios con una shell interactiva (que termina en `sh`). Filtra cuentas reales con las que se puede iniciar sesión, descartando cuentas de servicio sin shell.
```bash
grep "sh$" /etc/passwd
```

Todos los grupos del sistema y sus miembros. Sirve para mapear pertenencias que sean vector de escalada.
```bash
cat /etc/group
```

Los miembros de un grupo concreto (ej. `sudo`, `docker`, `lxd`). Confirma quién pertenece a grupos privilegiados.
```bash
getent group <GROUP_NAME>
```

Los directorios home existentes. Punto de partida para buscar archivos sensibles (claves SSH, `.bash_history`, configuraciones, credenciales).
```bash
ls /home
```

---
### 8. Archivos y directorios sensibles

Archivos ocultos en todo el sistema que pertenezcan a un usuario concreto. Suelen esconder configuraciones, historiales, claves o credenciales. (`2>/dev/null` silencia los errores de permisos.)
```bash
find / -type f -name ".*" -exec ls -l {} \; 2>/dev/null | grep <USERNAME>
```

Directorios ocultos en todo el sistema. Pueden contener `.ssh`, `.gnupg`, carpetas de configuración de apps, backups, etc.
```bash
find / -type d -name ".*" -ls 2>/dev/null
```

Contenido de los directorios temporales donde cualquier usuario puede escribir. Útiles para **soltar payloads/tools**, y a veces contienen archivos dejados por otros procesos o usuarios.
```bash
ls -l /tmp /var/tmp /dev/shm
```

---
## "Gotchas" y Troubleshooting
* **Riesgo de Exploits de Kernel:** La ejecución de exploits de kernel en entornos de producción puede causar inestabilidad severa o la caída completa del sistema. Es imperativo comprender las ramificaciones del código antes de compilar y ejecutar.
* **Contraseñas Expuestas en texto claro:** Aunque es una práctica obsoleta, en sistemas embebidos o enrutadores aún es posible encontrar los hashes de contraseñas (o contraseñas en texto claro) directamente en el archivo `/etc/passwd`, el cual es legible por todos los usuarios.
* **Persistencia en Directorios Temporales:** Existen diferencias críticas entre directorios temporales. Los archivos en `/tmp` se eliminan al reiniciar el sistema o a los 10 días, mientras que `/var/tmp` está diseñado para preservar archivos temporalmente entre reinicios y retiene datos hasta por 30 días.
* **Enumeración de Defensas Limitada:** Generalmente, un usuario de bajos privilegios no tiene permisos suficientes para leer la configuración interna de soluciones defensivas como AppArmor, SELinux, o Fail2ban. No obstante, identificar que estos procesos están en ejecución ayuda a evitar vectores de ataque inútiles.
* **Sistemas de Archivos Desmontados:** Un administrador puede desmontar un sistema de archivos para ocultar scripts o datos a usuarios estándar. Solo al escalar a root se pueden volver a montar e inspeccionar dichos volúmenes de forma arbitraria.