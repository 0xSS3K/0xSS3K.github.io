---
tags:
  - ACL
  - AD
  - attack
  - enum
---
## Conceptos Clave (TL;DR)

* Las ACLs (Access Control Lists) y sus ACEs (Access Control Entries) definen los privilegios que un objeto tiene sobre otro en la red interna.
* La enumeración masiva de ACLs genera cantidades inmanejables de datos; la metodología eficiente requiere realizar búsquedas dirigidas partiendo exclusivamente de un usuario sobre el que ya se tiene control.
* Los derechos de acceso se heredan mediante la anidación de grupos; si se obtiene control sobre un grupo base, se adquieren los derechos de todos los grupos superiores en los que este esté anidado.
* El encadenamiento estratégico de privilegios (ej. `User-Force-Change-Password` -> `GenericWrite` -> `GenericAll`) permite escalar progresivamente en el dominio hasta alcanzar objetivos críticos, como permisos para ataques DCSync (`DS-Replication-Get-Changes`).

  
## Herramientas Clave

* **PowerView**: Herramienta de PowerShell para enumeración dirigida de objetos y resolución automática de GUIDs de permisos.

* **[BloodHound](../../../📂%2008%20Herramientas&Cheatsheets/BloodHound.md)**: Solución gráfica para mapear visualmente rutas de ataque complejas ("Outbound Control Rights" y "Transitive Object Control") utilizando los datos de SharpHound.

* **Cmdlets Nativos (Get-ADUser, Get-Acl, Get-ADObject)**: Alternativas de PowerShell integradas en el sistema operativo, cruciales cuando se opera en sistemas de clientes con restricciones de uso de herramientas de terceros.

  
## Metodología Paso a Paso

### Fase 1: Enumeración Dirigida desde un Compromiso Inicial

En lugar de extraer todos los ACLs del dominio, comenzamos obteniendo el identificador de seguridad (SID) del usuario que hemos comprometido. Luego, buscamos qué objetos en el dominio reconocen ese SID con algún privilegio concedido.

### Fase 2: Resolución e Interpretación de Derechos (GUIDs)

Los permisos de AD a menudo se representan como GUIDs ilegibles (ej. `00299570-246d-11d0-a768-00aa006e0529`). Es necesario mapear estos identificadores a nombres legibles por humanos (ej. `User-Force-Change-Password`) para entender qué vector de abuso es posible.

### Fase 3: Análisis de Herencia y Anidación

Si descubrimos que podemos modificar o escribir en un grupo de seguridad (`GenericWrite`), debemos enumerar a qué otros grupos pertenece ("MemberOf"). Al añadirnos al grupo inicial, heredamos automáticamente todos los privilegios del grupo matriz.

### Fase 4: Mapeo Visual y Confirmación de Rutas (BloodHound)

Para evaluaciones complejas, cargamos los datos recolectados en BloodHound para visualizar las relaciones transitivas. Evaluamos los nodos bajo "First Degree Object Control" (control directo) y "Transitive Object Control" (rutas multi-salto) para planificar la cadena de ataque y consultar la ayuda integrada sobre la ejecución.


## Cheat Sheet de Comandos

### Enumeración con PowerView
```powershell
# Cargar el módulo en memoria

Import-Module .\PowerView.ps1
```
  
```powershell
# Obtener el SID de un usuario comprometido

$sid = Convert-NameToSid <USER>
```
  
```powershell
# Búsqueda dirigida de objetos sobre los que el usuario tiene permisos (Resuelve los GUIDs a formato legible)

Get-DomainObjectACL -ResolveGUIDs -Identity * | ? {$_.SecurityIdentifier -eq $sid}
```
  
```powershell
# Búsqueda general de todos los ACLs del dominio (Demasiado ruido, uso no recomendado)

Find-InterestingDomainAcl
```
  
```powershell
# Verificación de la anidación de un grupo comprometido

Get-DomainGroup -Identity "<GROUP_NAME>" | select memberof
```

### Enumeración y Mapeo Manual con Binarios Nativos
```powershell
# Búsqueda nativa de derechos (Get-Acl) iterando sobre todos los usuarios del dominio

Get-ADUser -Filter * | Select-Object -ExpandProperty SamAccountName > ad_users.txt

foreach($line in [System.IO.File]::ReadLines("C:\<PATH>\ad_users.txt")) {get-acl  "AD:\$(Get-ADUser $line)" | Select-Object Path -ExpandProperty Access | Where-Object {$_.IdentityReference -match '<DOMAIN>\\<USER>'}}
```
  
```powershell
# Mapeo manual inverso de un GUID a su nombre de derecho extendido nativo

$guid= "<GUID>"

Get-ADObject -SearchBase "CN=Extended-Rights,$((Get-ADRootDSE).ConfigurationNamingContext)" -Filter {ObjectClass -like 'ControlAccessRight'} -Properties * |Select Name,DisplayName,DistinguishedName,rightsGuid | ?{$_.rightsGuid -eq $guid} | fl
```


## "Gotchas" y Troubleshooting

* **Omisión del flag ResolveGUIDs**: Si usas `Get-DomainObjectACL` sin el flag `-ResolveGUIDs`, la propiedad `ObjectAceType` devolverá un valor GUID no legible.

* **Conflictos de PowerShell Session**: Si intentas mapear un GUID manualmente usando `Get-ADObject` pero ya importaste `PowerView.ps1` en la misma sesión, el cmdlet resultará en un error. Debes ejecutar el comando nativo desde una nueva sesión limpia.

* **Lentitud de Comandos**: Tanto la enumeración dirigida de PowerView como los bucles `foreach` con cmdlets nativos pueden tardar bastante tiempo (minutos o más) en finalizar dependiendo del tamaño del entorno. Los cmdlets nativos son significativamente más lentos que PowerView.