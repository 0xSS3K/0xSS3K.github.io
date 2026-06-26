---
tags:
  - ACL
  - AD
  - attack
---
## Conceptos Clave

* Las Listas de Control de Acceso (ACL) definen que identidades (Security Principals) tienen acceso a un recurso y el nivel de privilegios que poseen.
* Las ACL contienen Entradas de Control de Acceso (ACE), divididas principalmente en DACL (conceden o deniegan acceso explícito) y SACL (generan registros de auditoría).
* La evaluación de permisos se realiza de arriba hacia abajo hasta encontrar una denegación explícita (Access denied). Si un objeto no tiene DACL, todos los usuarios tienen control total; si la DACL existe pero está vacía, se deniega el acceso a todos.
* El abuso de ACEs mal configuradas permite establecer persistencia, escalar privilegios y moverse lateralmente. Estos fallos rara vez son detectados por escáneres de vulnerabilidades tradicionales.

### Herramientas Clave

* **[BloodHound](../../../📂%2008%20Herramientas&Cheatsheets/BloodHound.md)**: Utilizado para enumerar y visualizar gráficamente los permisos y rutas de ataque en Active Directory.
* **PowerView**: Framework principal en PowerShell utilizado para explotar y abusar de los permisos descubiertos en los objetos del dominio.
* **GMSAPasswordReader**: Herramienta específica utilizada para obtener la contraseña de una cuenta de servicio administrada si se posee el permiso adecuado.

### Metodología Paso a Paso

1. **Fase de Enumeración y Visualización**

La lógica de esta fase es mapear el dominio para encontrar qué usuarios o grupos comprometidos (ej. cuentas de Help Desk) tienen permisos excesivos sobre otros objetos. Se recolectan los datos y se visualizan las relaciones de las ACEs.

2. **Fase de Identificación de Permisos Abusables**

Consiste en identificar las ACEs específicas que representan una vía de ataque directa. Se busca obtener permisos como `GenericAll` (control total), `GenericWrite` (escritura de atributos), `AddSelf` o `ForceChangePassword`.

3. **Fase de Explotación**

Según el permiso encontrado, se ejecuta el ataque correspondiente. Por ejemplo, abusar de `GenericWrite` sobre un usuario para asignarle un SPN y ejecutar Kerberoasting, o leer la contraseña de LAPS si se tiene `GenericAll` sobre un equipo.

4. **Fase de Documentación y Limpieza**

Dado que modificar objetos puede interrumpir operaciones, es imperativo registrar cada cambio realizado (como un restablecimiento de contraseña o modificación de grupo) para poder revertirlo y dejar el entorno en su estado original.

### Cheat Sheet de Comandos

A continuación, se presentan los `cmdlets` de PowerView asociados a los ataques de ACL descritos.

```powershell
# Abuso de ForceChangePassword: Restablece la contraseña de un usuario sin conocer la actual.
Set-DomainUserPassword -Identity <TARGET_USER> -AccountPassword (ConvertTo-SecureString "<NEW_PASSWORD>" -AsPlainText -Force)


# Abuso de Add Members, AddSelf, GenericAll o AllExtendedRights (Grupos): Añade un usuario a un grupo objetivo.
Add-DomainGroupMember -Identity "<TARGET_GROUP>" -Members "<ATTACKER_USER>"

  
# Abuso de GenericWrite o WriteOwner: Modifica los atributos de un objeto o cambia su propietario.
Set-DomainObject -Identity <TARGET_OBJECT> -Set @{<ATTRIBUTE>="<VALUE>"}
Set-DomainObjectOwner -Identity <TARGET_OBJECT> -OwnerIdentity "<ATTACKER_USER>"

  
# Abuso de WriteDACL: Añade una nueva regla a la lista de control de acceso de un objeto.
Add-DomainObjectACL -TargetIdentity <TARGET_OBJECT> -PrincipalIdentity <ATTACKER_USER> -Rights ResetPassword
```

### "Gotchas" y Troubleshooting

* **Impacto Destructivo**: Permisos como `ForceChangePassword` son destructivos porque bloquean el acceso del usuario legítimo al cambiar su contraseña. Se recomienda consultar con el cliente antes de ejecutar este ataque para evitar problemas operativos.
* **Dependencias de Entorno (LAPS)**: El abuso del permiso `GenericAll` sobre un objeto de tipo computadora para obtener credenciales de administrador local asume que el Local Administrator Password Solution (LAPS) está implementado en el entorno.
* **Software de Terceros**: Instalaciones de software complejo, como Microsoft Exchange, suelen inyectar cambios masivos en las ACL del entorno durante su instalación, lo que frecuentemente deja derechos excesivos y vulnerabilidades heredadas.
* **Kerberoasting de Oportunidad**: Si posees `GenericWrite` sobre un usuario, pero no tienes control total para resetear credenciales, modificar el atributo SPN te permitirá pivotar hacia un ataque de Kerberoasting, asumiendo que la cuenta objetivo posee una contraseña débil.
