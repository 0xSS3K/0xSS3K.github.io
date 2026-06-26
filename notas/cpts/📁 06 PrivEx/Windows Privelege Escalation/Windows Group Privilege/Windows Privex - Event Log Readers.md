---
tags:
  - privex
  - windows
---
## Conceptos Clave (TL;DR)

- Si la auditoría de creación de procesos está habilitada, Windows registra el Event ID 4688 ("A new process has been created") en el log de Seguridad, capturando la línea de comandos completa.
- Muchos comandos nativos de Windows (ej. `net use`) aceptan contraseñas como parámetro en texto claro. Si el logging de línea de comandos está activo, esas credenciales quedan registradas en el Security log.
- El grupo **Event Log Readers** permite leer logs de eventos sin ser administrador, PERO esto NO es suficiente para consultar el log de Seguridad con `Get-WinEvent` (requiere admin o permisos ajustados en el registro).
- El log **PowerShell Operational** (Script Block Logging / Module Logging) puede contener credenciales en texto claro y es accesible para usuarios SIN privilegios, siendo una fuente alternativa muy valiosa.

## Herramientas Clave

| Herramienta | Propósito |
|---|---|
| `net localgroup` | Enumerar membresía de un grupo local (ej. confirmar pertenencia a Event Log Readers). |
| `wevtutil` | Utilidad CLI nativa para consultar/exportar logs de eventos, soporta credenciales alternativas remotas. |
| `Get-WinEvent` | Cmdlet de PowerShell para filtrar eventos por ID y propiedades específicas (más flexible que wevtutil). |
| `Select-String` / `findstr` | Filtrar la salida de texto buscando patrones (ej. `/user`, `password`). |

## Metodología Paso a Paso

1. **Confirmar permisos de acceso al log**
   Verificar si el usuario actual es miembro de "Event Log Readers" o de un grupo con acceso a logs. Esto determina si se puede leer el log sin privilegios admin.

2. **Consulta local del Security log (vía wevtutil)**
   Exportar eventos del log de Seguridad y filtrar por patrones que delaten credenciales en línea de comandos (ej. `/user`, `password=`, `net use`).

3. **Consulta remota con credenciales alternativas (si aplica)**
   Si no se tiene sesión interactiva en el host objetivo pero se dispone de credenciales válidas, usar `wevtutil` con `/r` (remoto), `/u` y `/p` para consultar el log desde otra máquina.

4. **Consulta avanzada con Get-WinEvent**
   Filtrar específicamente por Event ID 4688 (creación de procesos) y extraer la propiedad que contiene la línea de comandos completa (`Properties[8].Value`). Requiere privilegios de administrador o permisos de registro ajustados; la sola membresía en Event Log Readers no es suficiente.

5. **Pivote a logs alternativos sin privilegios**
   Si no hay acceso al Security log, revisar el log **PowerShell Operational**, que es legible por usuarios sin privilegios y puede contener credenciales si el script block logging está habilitado.

## Cheat Sheet de Comandos

```cmd
:: Confirmar membresía en el grupo Event Log Readers
net localgroup "Event Log Readers"
```

```powershell
# Consultar el log de Seguridad (local), exportar en texto y filtrar
# eventos que contengan "/user" en la linea de comandos
# qe = query-events, /rd:true = orden inverso (mas recientes primero), /f:text = formato texto
wevtutil qe Security /rd:true /f:text | Select-String "/user"
```

```cmd
:: Consultar el log de Seguridad de forma remota usando credenciales alternativas
:: /r:<TARGET_HOST>  -> host remoto a consultar
:: /u:<DOMAIN>\<USER> -> usuario para autenticar la consulta
:: /p:<PASSWORD>      -> contrasena del usuario (cuidado: esto tambien puede quedar logueado)
wevtutil qe Security /rd:true /f:text /r:<TARGET_HOST> /u:<DOMAIN>\<USER> /p:<PASSWORD> | findstr "/user"
```

```powershell
# Filtrar eventos 4688 (creacion de proceso) cuya linea de comandos contenga "/user"
# Properties[8] corresponde al campo "Process Command Line" en el evento 4688
Get-WinEvent -LogName security | where { $_.ID -eq 4688 -and $_.Properties[8].Value -like '*/user*' } | Select-Object @{name='CommandLine';expression={ $_.Properties[8].Value }}
```

```powershell
# Ejecutar la consulta anterior como otro usuario (credenciales alternativas)
# Reemplazar <USER> y construir el objeto de credenciales antes de la llamada
$cred = Get-Credential <DOMAIN>\<USER>
Get-WinEvent -LogName security -Credential $cred | where { $_.ID -eq 4688 -and $_.Properties[8].Value -like '*/user*'}
```

```powershell
# Revisar el log PowerShell Operational (accesible sin privilegios)
# en busca de credenciales expuestas via script block logging
Get-WinEvent -LogName "Microsoft-Windows-PowerShell/Operational" | Select-String "password"
```

## "Gotchas" y Troubleshooting

- **La membresía en "Event Log Readers" NO es suficiente** para usar `Get-WinEvent` contra el log de Seguridad. Se requiere acceso de administrador, o que el registro `HKLM\System\CurrentControlSet\Services\Eventlog\Security` tenga permisos ajustados manualmente.
- `wevtutil` SÍ permite especificar credenciales alternativas (`/u` y `/p`) para consultas remotas, lo cual puede saltarse la limitación anterior dependiendo de los privilegios de esa cuenta.
- OPSEC: pasar la contraseña en texto claro a `/p` en `wevtutil` puede a su vez quedar registrada como un nuevo evento 4688 si la auditoría de línea de comandos está activa en el host desde el que ejecutas el comando — puedes auto-incriminarte o dejar rastro de las credenciales que estás usando.
- El log **PowerShell Operational** es una vía de escalada/recon alternativa de bajo privilegio: no necesitas pertenecer a ningún grupo especial para leerlo, y puede contener contraseñas si el módulo o script block logging está habilitado.
- Muchos comandos nativos de Windows (`net use`, entre otros) aceptan contraseñas como parámetro de línea de comandos; siempre vale la pena buscar el patrón `/user` o `password` en logs de comandos como técnica de credential harvesting durante un engagement.
- Ten en cuenta que tus propios comandos de reconocimiento (`tasklist`, `whoami`, `net view`, `ipconfig`, `systeminfo`, etc.) son exactamente los que las organizaciones con auditoría de línea de comandos habilitada (incluso sin EDR enterprise) suelen monitorear y pueden detectar tu actividad.