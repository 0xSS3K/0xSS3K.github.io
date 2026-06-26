SMB es utilizado comúnmente en redes Windows para compartir archivos y carpetas. A continuación, las formas legítimas de interactuar con el servicio.

## Interacción desde Windows

* **GUI (Explorador / Ejecutar):** Presiona `[WINKEY] + [R]` para abrir el cuadro de diálogo Ejecutar y escribe la ubicación del recurso, ej: 
```ejecutar
\\192.168.220.129\Finance\
```
* **CMD - Listar contenido de un directorio:** 
```cmd
dir \\192.168.220.129\Finance\
```
* **CMD - Montar/Mapear un recurso compartido:** 
```cmd
net use n: \\192.168.220.129\Finance
```
* **CMD - Montar proporcionando credenciales:** 
```cmd
net use n: \\192.168.220.129\Finance /user:plaintext Password123
```
* **CMD - Buscar archivos por nombre en el recurso montado:** 
```cmd
dir n:\*cred* /s /b
```
* **CMD - Buscar cadenas de texto dentro de archivos:** 
```cmd
findstr /s /i cred n:\*.*
```
* **PowerShell - Listar contenido:** 
```powershell
Get-ChildItem \\192.168.220.129\Finance\
```
* **PowerShell - Montar recurso compartido (PSDrive):** 
```powershell
New-PSDrive -Name "N" -Root "\\192.168.220.129\Finance" -PSProvider "FileSystem"
```
* **PowerShell - Montar recurso con credenciales:** Requiere la creación previa de un objeto `PSCredential`.
```powershell
$username = 'plaintext'
$password = 'Password123'
$secpassword = ConvertTo-SecureString $password -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential $username, $secpassword
New-PSDrive -Name "N" -Root "\\192.168.220.129\Finance" -PSProvider "FileSystem" -Credential $cred
```
* **PowerShell - Buscar archivos por nombre:** 
```powershell
Get-ChildItem -Recurse -Path N:\ -Include *cred* -File
```
* **PowerShell - Buscar cadenas de texto dentro de archivos:** 
```powershell
Get-ChildItem -Recurse -Path N:\ | Select-String "cred" -List
```

## Interacción desde Linux

* **Instalar utilidades necesarias:** 
```sh
sudo apt install cifs-utils
```
* **Montar recurso compartido:** 
```sh
sudo mount -t cifs -o username=plaintext,password=Password123,domain=. //192.168.220.129/Finance /mnt/Finance
```
* **Montar usando un archivo de credenciales:** 
```sh
mount -t cifs //192.168.220.129/Finance /mnt/Finance -o credentials=/path/credentialfile
```
*Estructura del archivo:* `username=plaintext`, `password=Password123`, `domain=.`
* **Linux - Buscar archivos por nombre en el montaje:** 
```sh
find /mnt/Finance/ -name *cred*
```
* **Linux - Buscar cadenas de texto en los archivos:** 
```
grep -rn /mnt/Finance/ -ie cred
```

## Clientes de Consola Alternativos
* **Listar recursos con sesión nula (smbclient):** 
```sh
smbclient -N -L //10.129.14.128
```
* **Listar recursos (smbmap):** 
```sh
smbmap -H 10.129.14.128
```
* **Listar recursos de forma recursiva (smbmap):** 
```sh
smbmap -H 10.129.14.128 -r notes
```
* **Descargar archivos (smbmap):** 
```sh
smbmap -H 10.129.14.128 --download "notes\note.txt"
```
* **Subir archivos (smbmap):** 
```sh
smbmap -H 10.129.14.128 --upload test.txt "notes\test.txt"
```



