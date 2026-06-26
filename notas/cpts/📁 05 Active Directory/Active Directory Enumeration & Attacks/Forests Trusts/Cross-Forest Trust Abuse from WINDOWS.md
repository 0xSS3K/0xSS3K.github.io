---
tags:
  - AD
  - attack
  - windows
  - forest
---

## Conceptos Clave (TL;DR)

* Los ataques de Kerberos, como Kerberoasting y ASREPRoasting, se pueden ejecutar a través de relaciones de confianza (trusts) entrantes o bidireccionales.
* Si no puedes escalar privilegios localmente, puedes intentar comprometer una cuenta en otro dominio que posea privilegios administrativos cruzados mediante la enumeración de SPNs y posterior crackeo offline.
* Es común encontrar reutilización de contraseñas entre administradores del mismo grupo corporativo o descubrir que usuarios del dominio base pertenecen a grupos locales (como Administradores) en el dominio objetivo.
* El historial de SIDs (SID History) puede abusarse para conservar privilegios de un dominio anterior si el filtrado de SIDs no esta activado durante la migracion de bosques.

  
## Herramientas Clave

* **PowerView:** Enumeracion de usuarios con SPNs y descubrimiento de miembros de grupos extranjeros (Foreign Group Membership).
* **Rubeus:** Ejecucion de ataques Kerberoasting a traves del limite del bosque utilizando la bandera de dominio.
* **[Hashcat](../../../📂%2008%20Herramientas&Cheatsheets/Hashcat.md):** Crackeo offline del hash de Kerberos obtenido.
* **Enter-PSSession (PowerShell):** Autenticacion cruzada y movimiento lateral hacia el controlador de dominio objetivo via WinRM.

  
## Metodologia Paso a Paso

1. **Enumeracion de SPNs y Privilegios:** Se buscan usuarios que tengan un Service Principal Name (SPN) asociado dentro del dominio objetivo mediante la confianza. Luego, se comprueba a que grupos pertenecen para asegurar que su compromiso otorgue altos privilegios.
2. **Ataque Kerberoasting Cruzado:** Se solicita el ticket de servicio (TGS) de la cuenta vulnerable desde el dominio actual especificando el dominio objetivo. El hash extraido se intenta crackear offline.
3. **Enumeracion de Grupos Extranjeros:** Si Kerberoasting falla, se listan los grupos en el dominio objetivo para ver si nuestra cuenta comprometida actual, u otra en nuestro dominio, es miembro directo (ej. en el grupo Built-in Administrators).
4. **Acceso y Movimiento Lateral:** Si se confirma acceso administrativo directo (por pertenencia a grupos o reuso de credenciales), se establece una sesion remota con el DC objetivo.

## Cheat Sheet de Comandos
```powershell
# Enumerable usuarios con SPNs en el dominio objetivo a traves de la relacion de confianza
Get-DomainUser -SPN -Domain <TARGET_DOMAIN> | select SamAccountName

  
# Validar los grupos a los que pertenece el usuario vulnerable en el dominio objetivo
Get-DomainUser -Domain <TARGET_DOMAIN> -Identity <TARGET_USER> | select samaccountname,memberof
```

```cmd
# Solicitar TGS para realizar Kerberoasting en el dominio objetivo.
# /domain: especifica el bosque/dominio de destino. /nowrap: evita saltos de linea en el hash para facilitar copiar a Hashcat

.\Rubeus.exe kerberoast /domain:<TARGET_DOMAIN> /user:<TARGET_USER> /nowrap
```

```powershell
# Enumerar grupos del dominio objetivo que contienen miembros de dominios externos (ej. nuestro dominio comprometido)
Get-DomainForeignGroupMember -Domain <TARGET_DOMAIN>
  

# Convertir el SID obtenido del comando anterior a un nombre de cuenta legible para identificar al usuario
Convert-SidToName <TARGET_SID>
```

```powershell
# Establecer una sesion de administracion remota via WinRM utilizando las credenciales cruzadas

Enter-PSSession -ComputerName <TARGET_DC_FQDN> -Credential <COMPROMISED_DOMAIN>\<COMPROMISED_USER>
```

## "Gotchas" y Troubleshooting

* **Kerberoasting con AES:** Rubeus informara si las cuentas tienen AES habilitado y devolvera hashes AES. Si necesitas el formato tradicional (RC4_HMAC), debes usar las banderas `/ticket:X` o `/tgtdeleg` de Rubeus para forzar un downgrade a RC4.

* **Pertenencia a Grupos Extranjeros:** Solo los Grupos Locales de Dominio (Domain Local Groups) permiten entidades de seguridad provenientes de un bosque externo.

* **Requisito de Filtrado SID:** Para abusar de privilegios migrados via SID History, el entorno objetivo no debe tener el SID Filtering habilitado.