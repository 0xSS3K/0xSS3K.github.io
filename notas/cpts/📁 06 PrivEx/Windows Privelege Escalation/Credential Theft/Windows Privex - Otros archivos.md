---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)

- Los archivos locales y los recursos de red compartidos son una fuente habitual de credenciales: documentos Excel/Word, libros OneNote, archivos `passwords.txt`, archivos de configuración (`web.config`), y bases de datos de apps como StickyNotes.
- En entornos AD, las carpetas de usuario mapeadas en file servers (ej. `\\<SERVER>\<SHARE>\<USER>`) suelen tener permisos laxos (Domain Users con lectura sobre todas las carpetas), permitiendo leer datos de otros usuarios.
- StickyNotes guarda sus notas en una base de datos SQLite (`plum.sqlite`) en texto plano; la mayoría de usuarios no sabe que es un archivo de BD y no que es legible.
- Las herramientas automáticas de enumeración (winPEAS, Snaffler, etc.) no cubren el 100% de las extensiones/ubicaciones; siempre hay que saber buscar manualmente y, si es necesario, ampliar los scripts.

## Herramientas Clave

- **Snaffler** – Rastrea recursos compartidos de red en busca de extensiones de interés (`.kdbx`, `.vmdk`, `.vhdx`, `.ppk`, etc.).
- **findstr** (cmd) – Búsqueda de cadenas (ej. "password") dentro del contenido de archivos.
- **where /R** (cmd) – Búsqueda recursiva de archivos por nombre/extensión en el sistema de archivos.
- **Get-ChildItem** (PowerShell) – Búsqueda recursiva por extensión, más flexible que `where`.
- **Select-String** (PowerShell) – Equivalente PowerShell de `findstr`, busca patrones dentro del contenido de archivos.
- **DB Browser for SQLite** – GUI para abrir y consultar archivos `.sqlite` (ej. `plum.sqlite`) extraídos del objetivo.
- **PSSQLite** (módulo PowerShell) – Permite consultar una base SQLite directamente desde PowerShell, incluso de forma remota vía WinRM.
- **strings** – Extrae cadenas imprimibles de archivos binarios/BD (`plum.sqlite-wal`) cuando no se dispone de un visor SQLite.

## Metodología Paso a Paso

### Fase 1 – Reconocimiento de recursos compartidos
Identificar shares de archivos con carpetas de usuario individuales (ej. `\\FILE01\users\<USER>`) y comprobar permisos laxos que permitan leer carpetas de otros usuarios. Usar Snaffler para automatizar la búsqueda de extensiones sensibles en estos shares.

### Fase 2 – Búsqueda manual por contenido
Buscar la cadena "password" (u otras palabras clave: cred, secret, pwd, etc.) dentro de archivos de texto/config/xml usando `findstr` o `Select-String`. Esto detecta credenciales incrustadas en archivos de configuración de aplicaciones (ej. `web.config`).

### Fase 3 – Búsqueda manual por extensión/nombre de archivo
Buscar archivos por nombre o extensión característica (`*pass*`, `*cred*`, `*vnc*`, `*.config`, `*.rdp`) usando `dir /S /B`, `where /R` o `Get-ChildItem -Recurse -Include`. Esto detecta archivos de configuración de clientes RDP/VNC que pueden contener contraseñas guardadas/cifradas.

### Fase 4 – Extracción y análisis de la base de datos de StickyNotes
1. Localizar el archivo `plum.sqlite` (y sus archivos asociados `-shm` y `-wal`) en el perfil del usuario.
2. Copiar los **tres archivos** (`plum.sqlite`, `plum.sqlite-shm`, `plum.sqlite-wal`) a la máquina de ataque (o trabajar en remoto vía WinRM).
3. Abrir con DB Browser for SQLite y consultar la tabla `Note`, o usar el módulo PowerShell `PSSQLite` para hacerlo in-memory sin GUI.
4. Si no se dispone de herramientas SQLite, usar `strings` sobre el archivo `-wal` para extraer texto plano (menos eficiente en BDs grandes).

### Fase 5 – Revisión de otros archivos de interés conocidos
Comprobar ubicaciones clásicas de Windows donde pueden quedar credenciales residuales (copias de seguridad de hives SAM/SECURITY, logs de IIS, `ntuser.dat`, `pagefile.sys`, etc.) que los scripts automáticos de enumeración pueden no cubrir.

## Cheat Sheet de Comandos

```cmd
:: Buscar la cadena "password" en archivos .xml .ini .txt dentro del directorio actual
:: /S = subdirectorios, /I = case-insensitive, /M = solo mostrar nombre de archivo con coincidencia
cd C:\Users\<USER>\Documents
findstr /SI /M "password" *.xml *.ini *.txt

:: Igual que arriba pero incluyendo .config y mostrando la línea completa de coincidencia
findstr /si password *.xml *.ini *.txt *.config

:: /s = subdirectorios, /p = ignora archivos no imprimibles/binarios,
:: /i = case-insensitive, /n = muestra el número de línea de la coincidencia
findstr /spin "password" *.*
```

```powershell
# Buscar el patrón "password" dentro de archivos .txt en una ruta específica
Select-String -Path C:\Users\<USER>\Documents\*.txt -Pattern password
```

```cmd
:: Buscar recursivamente (/S) archivos cuyo nombre contenga pass/cred/vnc/config, listado solo de rutas (/B)
dir /S /B *pass*.txt == *pass*.xml == *pass*.ini == *cred* == *vnc* == *.config*

:: Buscar recursivamente (/R) todos los archivos .config a partir de C:\
where /R C:\ *.config
```

```powershell
# Buscar recursivamente extensiones específicas relacionadas con credenciales/conexiones guardadas
# -ErrorAction Ignore evita que se detenga por errores de permisos (Access Denied)
Get-ChildItem C:\ -Recurse -Include *.rdp, *.config, *.vnc, *.cred -ErrorAction Ignore
```

```powershell
# --- Extracción de base de datos de StickyNotes (plum.sqlite) ---

# Ruta fija del archivo de base de datos de StickyNotes
# C:\Users\<USER>\AppData\Local\Packages\Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe\LocalState\plum.sqlite

# Permitir ejecución temporal de scripts/módulos en la sesión actual (necesario para importar PSSQLite)
Set-ExecutionPolicy Bypass -Scope Process

# Entrar al directorio del módulo PSSQLite (debe estar previamente descargado/subido al objetivo)
cd .\PSSQLite\

# Importar el módulo PSSQLite para poder consultar archivos SQLite desde PowerShell
Import-Module .\PSSQLite.psd1

# Definir la ruta a la base de datos de StickyNotes como variable
$db = 'C:\Users\<USER>\AppData\Local\Packages\Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe\LocalState\plum.sqlite'

# Consultar la tabla Note y mostrar el resultado en formato tabla con wrap (sin truncar texto largo)
Invoke-SqliteQuery -Database $db -Query "SELECT Text FROM Note" | ft -wrap
```

```sql
-- Consulta equivalente desde DB Browser for SQLite (tras abrir plum.sqlite manualmente)
select Text from Note;
```

```bash
# Extraer cadenas de texto legibles del archivo WAL de la base SQLite de StickyNotes
# (alternativa cuando no se dispone de un visor/driver SQLite)
strings plum.sqlite-wal
```

## "Gotchas" y Troubleshooting

- **Copiar los tres archivos juntos**: al extraer `plum.sqlite`, siempre copiar también `plum.sqlite-shm` y `plum.sqlite-wal`; los datos más recientes pueden estar solo en el WAL (Write-Ahead Log) y no aún confirmados en el archivo principal.
- **StickyNotes es una BD, no un archivo plano**: muchos usuarios desconocen que sus notas (a menudo con credenciales) quedan almacenadas en SQLite, por lo que vale la pena revisarlo siempre aunque no parezca "interesante" a simple vista.
- **`strings` es menos eficiente**: usarlo solo como alternativa cuando no se puede usar DB Browser/PSSQLite, ya que en bases de datos grandes generará mucho ruido.
- **Acceso remoto sin copiar archivos**: la consulta vía PSSQLite puede ejecutarse directamente sobre el objetivo a través de WinRM, sin necesidad de exfiltrar el archivo `.sqlite` primero.
- **Permisos laxos en shares**: revisar siempre si Domain Users (o grupos amplios) tienen acceso de lectura a TODAS las carpetas de usuario en un file server, no solo a la propia.
- **No depender solo de scripts automáticos**: herramientas de enumeración de privesc no cubren necesariamente todas las extensiones/ubicaciones; conviene conocer la lista de archivos "clásicos" con posibles credenciales y, si falta alguno relevante, añadirlo manualmente a los scripts.
- **Otras ubicaciones clásicas a revisar manualmente** (pueden contener credenciales o hashes residuales):
  - `%SYSTEMDRIVE%\pagefile.sys`
  - `%WINDIR%\debug\NetSetup.log`
  - `%WINDIR%\repair\sam`, `%WINDIR%\repair\system`, `%WINDIR%\repair\software`, `%WINDIR%\repair\security`
  - `%WINDIR%\iis6.log`
  - `%WINDIR%\system32\config\AppEvent.Evt`, `SecEvent.Evt`
  - `%WINDIR%\system32\config\default.sav`, `security.sav`, `software.sav`, `system.sav`
  - `%WINDIR%\system32\CCM\logs\*.log`
  - `%USERPROFILE%\ntuser.dat`
  - `%USERPROFILE%\LocalS~1\Tempor~1\Content.IE5\index.dat`
  - `%WINDIR%\System32\drivers\etc\hosts`
  - `C:\ProgramData\Configs\*`
  - `C:\Program Files\Windows PowerShell\*`