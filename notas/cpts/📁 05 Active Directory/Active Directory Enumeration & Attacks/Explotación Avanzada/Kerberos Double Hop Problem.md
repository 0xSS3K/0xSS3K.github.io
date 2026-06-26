---
tags:
  - AD
  - kerberos
  - mitigation
---
## Conceptos Clave (TL;DR)

* Ocurre al autenticarse en un host remoto utilizando WinRM o PowerShell: por defecto, el mecanismo solo otorga un ticket (TGS) para acceder a ese recurso específico.
* El ticket TGT (Ticket Granting Ticket) del usuario no se reenvía a la sesión remota, lo que impide demostrar la identidad para saltar a un segundo equipo (movimiento lateral) o consultar recursos del dominio (ej. Active Directory).
* A diferencia de una autenticación con PSExec (SMB/LDAP), donde el hash NTLM o contraseña se almacena en caché en la memoria de la sesión, WinRM no guarda estas credenciales.
* Si el servidor comprometido tiene habilitado "Unconstrained Delegation", este problema no ocurre, ya que el TGT del usuario sí se envía y se almacena en memoria para solicitar nuevos tickets en su nombre.

  
## Herramientas Clave

* **WinRM / Evil-WinRM:** Servicios/herramientas de acceso remoto donde suele presentarse esta limitación de red.

* **Mimikatz:** Utilizado para revisar la memoria (sesión) y confirmar que la contraseña y los hashes NTLM del usuario están vacíos o nulos.

* **klist:** Herramienta nativa de Windows para listar los tickets de Kerberos en caché y confirmar la ausencia de un TGT o tickets delegables.

* **PowerView:** Script de enumeración de Active Directory que típicamente falla con un error de operaciones si se ejecuta sufriendo el problema de Double Hop.

  
## Metodología Paso a Paso


### Fase 1: Identificación del problema

Al ganar acceso a un host intermedio (Host A) vía WinRM y tratar de ejecutar comandos contra el DC u otro host (Host B), la solicitud es denegada o falla. Se verifica la sesión con `klist` notando que solo existe un ticket en caché válido para el servidor actual.

  
### Fase 2: Aplicación del Workaround 1 (Objeto PSCredential)

Si el acceso es limitado (ej. terminal de Evil-WinRM), se empaqueta la contraseña explícitamente en un objeto de PowerShell. Este objeto se pasa como parámetro en cada comando que requiera salto de red para forzar la reautenticación manual.
  

### Fase 3: Aplicación del Workaround 2 (Register-PSSessionConfiguration)

Si se tiene acceso GUI/RDP a un host de ataque Windows o a la máquina comprometida, se crea una nueva configuración de sesión persistente asociada a las credenciales del usuario. Tras reiniciar el servicio WinRM, el equipo local suplantará al remoto interactuando de forma directa con el DC sin perder el contexto de delegación.
  
## Cheat Sheet de Comandos

  
### Verificación del problema (Fase 1)
```powershell
# Extraer contraseñas en memoria con Mimikatz para confirmar que están en "(null)" al usar WinRM
.\mimikatz "privilege::debug" "sekurlsa::logonpasswords" exit

  
# Listar tickets de Kerberos cacheados en la sesión actual
klist
```
  
### Workaround 1: PSCredential (Ideal para Evil-WinRM)
```powershell
# 1. Convertir la contraseña en texto claro a un formato de cadena segura (SecureString)
$SecPassword = ConvertTo-SecureString '<PASSWORD>' -AsPlainText -Force
 

# 2. Crear el objeto PSCredential asociando el dominio/usuario con la contraseña segura
$Cred = New-Object System.Management.Automation.PSCredential('<DOMAIN>\<USER>', $SecPassword)
  

# 3. Ejecutar comandos o herramientas de red pasando explícitamente el flag -credential
get-domainuser -spn -credential $Cred | select samaccountname
```
  
### Workaround 2: Register PSSession (Requiere acceso GUI / Windows Host)
```powershell
# 1. Registrar una nueva configuración de sesión forzando la ejecución bajo las credenciales del objetivo
Register-PSSessionConfiguration -Name <SESSION_NAME> -RunAsCredential <DOMAIN>\<USER>
  

# 2. Reiniciar el servicio WinRM para aplicar la nueva configuración (esto desconectará sesiones activas)
Restart-Service WinRM
  

# 3. Iniciar una nueva sesión interactiva remota indicando el ConfigurationName registrado
Enter-PSSession -ComputerName <TARGET_HOSTNAME> -Credential <DOMAIN>\<USER> -ConfigurationName <SESSION_NAME>
  

# 4. Verificar que ahora los tickets (TGT) están almacenados en caché para uso directo en el dominio
klist
```

## "Gotchas" y Troubleshooting

* **Limitación en Evil-WinRM:** El Workaround 2 (`Register-PSSessionConfiguration`) **no funciona** desde un shell de Evil-WinRM. Se requiere de un prompt para credenciales (GUI) y de una consola de PowerShell debidamente elevada.

* **Incompatibilidad Linux:** El Workaround 2 no es funcional si se ejecuta PowerShell desde un host de ataque Linux (ej. Parrot, Ubuntu) debido a las limitaciones internas sobre cómo PowerShell en Linux maneja Kerberos. Es óptimo usar un "jump host" Windows por RDP.

* **Desconexión esperada:** Al aplicar el Workaround 2, ejecutar `Restart-Service WinRM` expulsará cualquier conexión activa a través de ese protocolo.

* **Alternativas:** Si estos métodos no son viables, se pueden utilizar técnicas como CredSSP, Port Forwarding, o inyección en procesos de sacrificio que corran bajo el contexto del usuario objetivo.