---
tags:
  - windows
  - privex
  - enum
---
## Conceptos Clave (TL;DR)
* Los privilegios en Windows permiten realizar operaciones en el sistema local, como gestionar servicios, cargar drivers o depurar aplicaciones, y se otorgan a través de un token de acceso al iniciar sesión.
* Los privilegios son distintos a los derechos de acceso, los cuales controlan el acceso a objetos asegurables comparando el token del usuario con las Entradas de Control de Acceso (ACEs).
* Un privilegio en estado "Disabled" significa que la cuenta lo tiene asignado, pero no puede ser utilizado hasta que sea habilitado de forma activa en el proceso.
* Los privilegios y derechos varían drásticamente dependiendo de si se ejecuta desde una consola estándar o una elevada, debido al Control de Cuentas de Usuario (UAC).

## Herramientas Clave
* **cmd.exe / PowerShell:** Consolas de línea de comandos para enumerar privilegios actuales y ejecutar acciones abusando de los derechos asignados.
* **Scripts de PowerShell personalizados:** Requeridos para habilitar privilegios en estado "Disabled" o ajustar los privilegios del token, ya que Windows no proporciona un comando nativo para habilitarlos.

## Metodología Paso a Paso

### Fase 1: Enumeración de Privilegios Locales
El objetivo inicial es descubrir qué puede hacer el usuario actual en el sistema comprometido. 
* Se debe consultar la lista de privilegios del token de acceso.
* Analizar el estado de los privilegios devueltos para determinar cuáles están activos (Enabled) y cuáles requieren ser activados (Disabled).

### Fase 2: Identificación de Grupos Sensibles
Revisar si el usuario comprometido pertenece a grupos con derechos críticos por defecto, tanto a nivel local como en Active Directory.
* Identificar grupos de alto valor como Server Operators, Backup Operators, Print Operators, Account Operators, DNS Admins o Hyper-V Administrators.
* Determinar el vector de ataque específico de cada grupo (ej. los Backup Operators pueden copiar la base de datos NTDS/SAM y leer el registro remotamente).

### Fase 3: Explotación y Escalada de Privilegios
Utilizar la información enumerada para ejecutar técnicas que permitan obtener acceso de Administrador, SYSTEM o Domain Admin.
* Si se cuenta con `SeImpersonatePrivilege`, intentar suplantar a un usuario u otra cuenta.
* Si se cuenta con `SeTakeOwnershipPrivilege`, modificar la propiedad de archivos, servicios o procesos críticos del sistema.
* Si el usuario es parte de DNS Admins, preparar la inyección de una DLL maliciosa o modificar un registro WPAD para obtener persistencia o ejecución.

## Cheat Sheet de Comandos

```powershell
# Muestra el nombre del usuario actual y el dominio/hostname al que pertenece.
whoami
```

```powershell
# Enumera todos los privilegios asignados al usuario actual y su estado (Enabled/Disabled).
whoami /priv
```

*(Nota: El texto base no proporciona comandos adicionales con sintaxis específica, pero durante el examen se emplearán scripts y ejecutables externos para habilitar privilegios en base a la enumeración obtenida con estos comandos)*.

## "Gotchas" y Troubleshooting
* **Falso Positivo de Falta de Privilegios:** Que un privilegio aparezca como "Disabled" al ejecutar `whoami /priv` NO significa que carezcas de él; simplemente debes habilitarlo mediante scripts antes de invocar la acción.
* **Restricciones de UAC:** Algunos derechos solo están disponibles y son visibles si la consola (cmd o PowerShell) se ejecuta con privilegios elevados.
* **Inestabilidad con DNS Admins:** Al abusar del grupo DNS Admins cargando una DLL maliciosa, es muy probable que el servicio DNS falle (crash); crear un registro WPAD es un método mucho más confiable.
* **Impacto del SeShutdownPrivilege:** Usuarios en grupos como Backup Operators pueden tener habilitado el privilegio para apagar el sistema; si se ejecuta en un Domain Controller, puede causar una interrupción masiva del servicio.
* **Riesgo de Detección (OPSEC):** La asignación y uso de privilegios especiales en una sesión genera el Evento 4672 en los logs de Windows, lo cual es altamente monitoreado por los equipos de defensa.