---
tags:
  - enum
  - windows
  - security
  - AD
---
## Conceptos Clave (TL;DR)

* Comprender los controles de seguridad implementados en una organización es fundamental porque afecta directamente las herramientas que se pueden usar para la enumeración, explotación y post-explotación de Active Directory.

* Entender las defensas permite planificar el curso de acción, ya sea evitando ciertas herramientas o modificándolas.

* Los controles de seguridad no siempre se aplican de manera uniforme en toda la organización; ciertas políticas pueden dificultar la enumeración en algunas máquinas y no existir en otras.

  
## Herramientas Clave

* **PowerShell (cmdlets integrados):** Se utiliza de forma nativa para consultar el estado de Windows Defender, extraer políticas de AppLocker y verificar el modo de lenguaje actual de la sesión.

* **LAPSToolkit:** Un conjunto de herramientas para analizar las configuraciones de Microsoft LAPS, facilitando la búsqueda de grupos delegados, permisos extendidos y contraseñas en texto claro.

  

## Metodología Paso a Paso

  

**Fase 1: Verificación del Estado de Windows Defender**

El primer paso es evaluar si la protección en tiempo real está habilitada, ya que esto bloqueará por defecto el uso de herramientas ofensivas comunes como PowerView. Se debe comprobar el valor de la propiedad `RealTimeProtectionEnabled` para confirmar si la protección está activa en el sistema.

  

**Fase 2: Análisis de Políticas de AppLocker**

Las listas blancas de aplicaciones (AppLocker) controlan qué ejecutables, scripts o instaladores pueden ejecutarse. La enumeración de las reglas efectivas permite identificar si el acceso a herramientas como `cmd.exe` o `powershell.exe` está bloqueado para los usuarios del dominio y revelar posibles rutas de evasión.

  

**Fase 3: Evaluación de Restricciones de PowerShell**

Es necesario comprobar rápidamente si la sesión actual opera en "Constrained Language Mode". Este modo restringe severamente el uso de PowerShell, bloqueando objetos COM, limitando tipos .NET permitidos y clases, lo cual afecta la ejecución de payloads avanzados.

  

**Fase 4: Enumeración de Delegaciones de LAPS**

El objetivo es encontrar usuarios de Active Directory que tengan permisos para leer las contraseñas aleatorias de los administradores locales gestionadas por LAPS. Esto se logra identificando grupos delegados específicamente para esta tarea y usuarios que posean "All Extended Rights" sobre las computadoras del dominio.

  

## Cheat Sheet de Comandos

  

```powershell

# Obtiene el estado actual de Windows Defender en el sistema local.

# Busca específicamente la propiedad "RealTimeProtectionEnabled" para ver si es "True".

Get-MpComputerStatus

```

  
  

```powershell

# Extrae las reglas efectivas de AppLocker aplicadas al sistema.

# El flag "-Effective" muestra las reglas aplicadas, y "select -ExpandProperty RuleCollections" desglosa las condiciones y acciones (Allow/Deny).

Get-AppLockerPolicy -Effective | select -ExpandProperty RuleCollections

```

  
  

```powershell

# Devuelve el modo de lenguaje actual de la sesión de PowerShell.

# Si el resultado es "ConstrainedLanguage", las capacidades ofensivas de PowerShell estarán muy limitadas.

$ExecutionContext.SessionState.LanguageMode

```

  
  

```powershell

# Función de LAPSToolkit para listar las Unidades Organizativas (OUs) y los grupos de AD delegados para leer contraseñas de LAPS.

Find-LAPSDelegatedGroups

```

  
  

```powershell

# Función de LAPSToolkit para comprobar los derechos en cada equipo con LAPS habilitado.

# Revela grupos con acceso de lectura y usuarios con permisos de "All Extended Rights".

Find-AdmPwdExtendedRights

```

  
  

```powershell

# Función de LAPSToolkit para buscar computadoras que tienen LAPS habilitado.

# Muestra el nombre del equipo, la fecha de expiración y, si el usuario actual tiene los permisos necesarios, la contraseña en texto claro.

Get-LAPSComputers

```

  
  

## "Gotchas" y Troubleshooting

* **Bypass Básico de AppLocker:** Las organizaciones a menudo se enfocan en bloquear la ruta principal de PowerShell, pero frecuentemente olvidan bloquear ubicaciones alternativas del ejecutable. Si la regla bloquea `%SystemRoot%\system32\WindowsPowerShell\v1.0\powershell.exe`, se puede intentar invocar PowerShell desde `%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe` o usar `PowerShell_ISE.exe`.

* **Permisos Ocultos en LAPS:** No busques únicamente grupos llamados "LAPS Admins". Un usuario o cuenta que ha unido una computadora al dominio (<DOMAIN>) recibe "All Extended Rights" sobre ese host en particular, otorgándole la capacidad de leer contraseñas de LAPS sin pertenecer a un grupo explícito de delegación. Estos usuarios suelen estar menos protegidos que los miembros de grupos delegados oficiales.