---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)

- Las credenciales encontradas durante la enumeración post-explotación pueden derivar en: escalada de privilegios local, foothold en Active Directory o escalada de privilegios de dominio.
- Las aplicaciones (y sysadmins) a menudo violan buenas prácticas y dejan credenciales en texto plano en: archivos de configuración, diccionarios de aplicaciones, archivos de instalación desatendida (unattend.xml) e historiales de PowerShell.
- Las "PowerShell Credentials" (objetos `PSCredential` exportados con `Export-Clixml`) están cifradas con DPAPI: por defecto solo pueden ser descifradas por el mismo usuario en el mismo equipo donde se crearon.
- Siempre se debe re-enumerar este tipo de archivos tras escalar privilegios, ya que el acceso previo puede no haber permitido leer archivos de otros usuarios (ej. historiales de PowerShell de otras cuentas).

## Herramientas Clave

| Herramienta / Cmdlet | Propósito en este vector |
|---|---|
| `findstr` | Búsqueda de strings (ej. "password") dentro de archivos de configuración en texto plano, de forma recursiva. |
| `Get-ChildItem` (`gc`/`dir`) | Localizar archivos sensibles (web.config, unattend.xml) de forma recursiva en el sistema de archivos. |
| `Get-Content` (`gc`) | Leer contenido de archivos (diccionarios, historiales de PowerShell). |
| `Select-String` | Filtrar líneas que contienen una palabra clave dentro de un archivo (similar a `grep`). |
| `Get-PSReadLineOption` | Confirmar la ruta donde PowerShell guarda el historial de comandos. |
| `Import-Clixml` / `Export-Clixml` | Importar/exportar objetos `PSCredential` cifrados con DPAPI desde/hacia disco (XML). |
| `GetNetworkCredential()` | Método de un objeto `PSCredential` para extraer usuario/contraseña en texto plano una vez descifrado. |

## Metodología Paso a Paso

### Fase 1 – Archivos de Configuración de Aplicaciones
Lógica: las apps suelen guardar credenciales en cleartext en archivos de config (.ini, .cfg, .config, .xml, .txt). Se busca el string "password" en extensiones comunes de forma recursiva e insensible a mayúsculas.

### Fase 2 – Archivos web.config (IIS)
Lógica: IIS puede almacenar cadenas de conexión y credenciales en `web.config`. Puede haber múltiples copias en distintas rutas, por lo que la búsqueda debe ser recursiva sobre todo el disco o sobre `inetpub`.

### Fase 3 – Archivos de Diccionario de Aplicaciones (ej. Chrome)
Lógica: cuando un usuario añade una palabra "no reconocida" (como una contraseña tecleada en un formulario web) al diccionario personalizado del navegador para evitar el subrayado rojo, esa palabra queda almacenada en texto plano en disco.

### Fase 4 – Archivos de Instalación Desatendida (unattend.xml)
Lógica: estos archivos definen logon automático y cuentas creadas durante el despliegue del sistema. Las contraseñas se guardan en texto plano o en Base64. Aunque deberían eliminarse tras la instalación, sysadmins suelen dejar copias en otras carpetas (imágenes, backups, repositorios de despliegue).

### Fase 5 – Historial de PowerShell (PSReadLine)
Lógica: desde PowerShell 5.0 (Windows 10+), el historial de comandos se persiste en disco por usuario. Comandos ejecutados con credenciales en línea (ej. `wevtutil /u: /p:`) quedan expuestos en texto plano.
1. Confirmar la ruta de guardado del historial.
2. Leer el archivo del usuario actual.
3. Si se obtiene admin local, iterar sobre todos los perfiles de usuario para extraer todos los historiales accesibles.

### Fase 6 – Credenciales de PowerShell (DPAPI / PSCredential)
Lógica: scripts de automatización (ej. conexión a vCenter, AD, APIs) suelen guardar credenciales cifradas con `Export-Clixml` para no hardcodear contraseñas en texto plano. Si se obtiene ejecución de comandos como el mismo usuario/equipo que generó el archivo, DPAPI permite descifrarlas de forma transparente con `Import-Clixml`.

## Cheat Sheet de Comandos

```powershell
# Buscar de forma recursiva (/S), insensible a mayusculas (/I) y mostrar solo
# nombre de archivo con coincidencia (/M) el string "password" en extensiones comunes de config.
# NOTA: si se quiere ver la linea completa con el match, quitar la "M" del flag combinado.
findstr /SIM /C:"password" *.txt *.ini *.cfg *.config *.xml
```

```powershell
# Busqueda recursiva de archivos web.config de IIS en todo el disco (pueden existir
# multiples copias en distintas rutas, no solo en la ruta por defecto de IIS)
Get-ChildItem -Path C:\ -Filter web.config -Recurse -ErrorAction SilentlyContinue

# Ruta por defecto del sitio web predeterminado de IIS
C:\inetpub\wwwroot\web.config
```

```powershell
# Busqueda recursiva de archivos unattend.xml (instalacion desatendida) en todo el disco
Get-ChildItem -Path C:\ -Filter unattend.xml -Recurse -ErrorAction SilentlyContinue
```

```powershell
# Leer el diccionario personalizado de Chrome del usuario <USER> y filtrar
# lineas que contengan la palabra "password"
gc 'C:\Users\<USER>\AppData\Local\Google\Chrome\User Data\Default\Custom Dictionary.txt' | Select-String password
```

```powershell
# Confirmar la ruta donde PowerShell guarda el historial de comandos (PSReadLine)
(Get-PSReadLineOption).HistorySavePath

# Ruta por defecto:
# C:\Users\<USER>\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt
```

```powershell
# Leer el contenido del historial de PowerShell del usuario actual
gc (Get-PSReadLineOption).HistorySavePath
```

```powershell
# Post-explotacion / con privilegios elevados: leer el historial de PowerShell
# de TODOS los usuarios del sistema (ruta por defecto de guardado)
foreach($user in ((ls C:\users).fullname)){cat "$user\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadline\ConsoleHost_history.txt" -ErrorAction SilentlyContinue}
```

```powershell
# Crear (en el lado del usuario legitimo) un objeto de credencial cifrado con DPAPI
# y exportarlo a disco como XML
Get-Credential | Export-Clixml -Path 'C:\scripts\<FILENAME>.xml'
```

```powershell
# Importar y descifrar un objeto PSCredential (DPAPI) si tenemos ejecucion de
# comandos como el MISMO usuario y en el MISMO equipo donde se creo el archivo
$credential = Import-Clixml -Path 'C:\scripts\<FILENAME>.xml'

# Extraer el nombre de usuario en texto plano
$credential.GetNetworkCredential().username

# Extraer la contrasena en texto plano
$credential.GetNetworkCredential().password
```

```powershell
# Ejemplo de comando con credenciales expuestas en linea (tal como pueden
# aparecer en el historial de PowerShell): conexion remota a Event Viewer
wevtutil qe Application "/q:*[Application [(EventID=<EVENT_ID>)]]" /f:text /rd:true /u:<DOMAIN>\<USER> /p:<PASSWORD> /r:<TARGET_HOSTNAME>
```

## "Gotchas" y Troubleshooting

- `findstr /SIM`: el flag `/M` solo imprime el NOMBRE del archivo con coincidencia, no la línea completa. Si necesitas ver el contexto/línea, quita la `M` del combo de flags.
- `web.config` puede existir en múltiples ubicaciones además de la ruta por defecto de IIS (`C:\inetpub\wwwroot\web.config`); la enumeración debe ser recursiva sobre todo el disco, no solo sobre la carpeta default.
- Los archivos `unattend.xml` deberían autoeliminarse tras la instalación, pero sysadmins frecuentemente dejan copias en otras carpetas durante el desarrollo de imágenes o procesos de despliegue (golden images, repositorios de SCCM/MDT, etc.) — buscar también fuera de las rutas estándar.
- Las contraseñas en `unattend.xml` pueden estar en texto plano O codificadas en Base64 — revisar ambos casos.
- El historial de PowerShell vía PSReadLine solo aplica a partir de PowerShell 5.0 en Windows 10 (versiones anteriores pueden no tener este archivo o usar otra ruta).
- Si el acceso inicial es como un usuario sin privilegios, es posible que NO se puedan leer los archivos `ConsoleHost_history.txt` de otros usuarios. Repetir esta enumeración después de obtener privilegios de administrador local (usar el foreach sobre `C:\Users`).
- Las "PowerShell Credentials" (`Export-Clixml`/`Import-Clixml`) están protegidas por DPAPI: por defecto solo el mismo usuario en el mismo equipo donde se generó el archivo puede descifrarlas con `Import-Clixml`. Si se intenta importar desde otro usuario/equipo sin abusar de DPAPI (master keys), la descifrado fallará o devolverá datos inválidos.
- Verificar siempre la ruta real de guardado del historial con `(Get-PSReadLineOption).HistorySavePath` antes de asumir la ruta por defecto, ya que puede haber sido personalizada.