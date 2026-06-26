---
tags:
  - AD
  - password
  - enum
  - windows
---
## Conceptos Clave

* La enumeración con credenciales desde un host Windows permite descubrir errores de configuración, problemas de permisos y relaciones de confianza que facilitan el movimiento lateral y vertical.
* El proceso incluye la inspección profunda de recursos compartidos (file shares) a los que el usuario tiene acceso, ya que frecuentemente contienen datos sensibles o credenciales almacenadas de forma insegura.
* Los datos recopilados durante esta fase también sirven para reportar hallazgos de riesgo medio o mejoras en la postura de seguridad del cliente, y no únicamente para ejecutar ataques directos.

  
## Herramientas Clave

* **ActiveDirectory PowerShell Module:** Colección de cmdlets para administrar AD; útil para enumerar sigilosamente aprovechando binarios integrados (Living Off the Land).

* **PowerView:** Script de PowerShell que automatiza la conciencia situacional en AD, permitiendo enumerar usuarios, grupos, listas de control de acceso (ACLs) y confianzas.

* **SharpView:** Port en .NET de PowerView; ideal para evadir restricciones cuando el uso de PowerShell está monitoreado o bloqueado.

* **Snaffler:** Herramienta automatizada que busca archivos sensibles (contraseñas, llaves SSH) en recursos compartidos a través del dominio.

* **SharpHound / [BloodHound](../../../📂%2008%20Herramientas&Cheatsheets/BloodHound.md):** Recolector (SharpHound) y visualizador gráfico (BloodHound) que analizan las relaciones entre objetos de AD para mapear rutas de ataque y descubrir fallas de arquitectura a largo plazo.

  
## Metodología Paso a Paso

* **Fase 1: Verificación e Importación de Módulos locales:** Al aterrizar en el host Windows, se debe revisar si existen herramientas preinstaladas o scripts administrativos. Si el módulo de AD no está cargado, se debe importar para iniciar la enumeración.

* **Fase 2: Enumeración de Dominio y Usuarios:** Obtener la información base del dominio (SID, nivel funcional) e identificar cuentas con el atributo ServicePrincipalName (SPN) habilitado para preparar posteriores ataques de Kerberoasting.

* **Fase 3: Mapeo de Grupos y Confianzas:** Identificar grupos de alto valor y extraer sus miembros, evaluando la herencia de privilegios mediante búsquedas recursivas. Al mismo tiempo, mapear confianzas intra-bosque e inter-bosque para planificar el movimiento entre dominios.

* **Fase 4: Saqueo de Recursos Compartidos:** Buscar configuraciones sobre-permisivas iterando sobre todos los directorios legibles por el usuario comprometido para extraer datos críticos como archivos `.key`, volcados de bases de datos o contraseñas.

* **Fase 5: Extracción y Análisis Gráfico:** Recolectar de forma masiva los metadatos de AD usando recolectores y exportarlos para analizarlos en GUI, permitiendo encontrar desde cuentas con acceso de administrador local hasta sistemas operativos no soportados o heredados.


## Cheat Sheet de Comandos

### ActiveDirectory PowerShell Module
```powershell
# Lista todos los modulos disponibles, su version y comandos potenciales

Get-Module
```

```powershell
# Importa el modulo de Active Directory para su uso

Import-Module ActiveDirectory
```

```powershell
# Imprime informacion util como el SID del dominio, nivel funcional y dominios hijos

Get-ADDomain
```

```powershell
# Filtra y lista cuentas de usuario que tienen el atributo ServicePrincipalName poblado (susceptibles a Kerberoasting)

Get-ADUser -Filter {ServicePrincipalName -ne "$null"} -Properties ServicePrincipalName
```

```powershell
# Imprime cualquier relacion de confianza que el dominio tenga, direccion y tipo

Get-ADTrust -Filter *
```

```powershell
# Enumera todos los grupos de AD y selecciona unicamente su nombre

Get-ADGroup -Filter * | select name
```

```powershell
# Obtiene informacion detallada sobre un grupo en especifico

Get-ADGroup -Identity "<GROUP_NAME>"
```

```powershell
# Imprime una lista de los miembros pertenecientes a un grupo en especifico

Get-ADGroupMember -Identity "<GROUP_NAME>"
```

### PowerView & SharpView
```powershell
# Obtiene informacion detallada (descripcion, creacion, expiracion, etc.) de un usuario en un dominio especifico

Get-DomainUser -Identity <USER> -Domain <DOMAIN> | Select-Object -Property name,samaccountname,description,memberof,whencreated,pwdlastset,lastlogontimestamp,accountexpires,admincount,userprincipalname,serviceprincipalname,useraccountcontrol
```

```powershell
# El flag -Recurse lista recursivamente a los miembros de grupos anidados dentro del grupo objetivo

Get-DomainGroupMember -Identity "<GROUP_NAME>" -Recurse
```

```powershell
# Enumera todas las relaciones de confianza para el dominio actual y cualquier otro visible

Get-DomainTrustMapping
```

```powershell
# Prueba si el usuario actual tiene acceso de administrador local en una maquina remota especifica

Test-AdminAccess -ComputerName <TARGET_COMPUTER>
```

```powershell
# Busca cuentas de usuario configuradas con SPN para posibles ataques de Kerberoasting

Get-DomainUser -SPN -Properties samaccountname,ServicePrincipalName
```

```powershell
# Usando el port .NET, obtiene argumentos y ayuda sobre un metodo especifico

.\SharpView.exe Get-DomainUser -Help
```

```powershell
# Ejecuta la enumeracion de un usuario especifico utilizando el binario SharpView sin requerir powershell.exe

.\SharpView.exe Get-DomainUser -Identity <USER>
```

### Snaffler
```powershell
# -s: imprime en consola | -d: especifica el dominio | -o: archivo de registro de salida | -v data: nivel de verbosidad optimizado para visualizacion inicial

.\Snaffler.exe -s -d <DOMAIN> -o <OUTPUT_LOG_FILE>.log -v data
```

### SharpHound
```powershell
# -c All: metodo de recoleccion exhaustiva | --zipfilename: especifica el nombre del archivo comprimido de salida

.\SharpHound.exe -c All --zipfilename <OUTPUT_FILENAME>
```

## "Gotchas" y Troubleshooting

* Snaffler requiere ejecutarse obligatoriamente desde un host unido al dominio o estar operando bajo un contexto de usuario de dominio válido.

* Snaffler produce cantidades masivas de datos; la mejor práctica es indicarle que guarde la salida en un archivo y dejarlo correr para procesar los datos después.

* Aunque SharpView replica las funciones de PowerView, su uso es estrictamente estratégico cuando un cliente ha asegurado el entorno contra el uso de PowerShell o se requiere evasión.

* Durante la exploración con BloodHound (o manualmente), es común encontrar registros de computadoras antiguas (ej. Windows 7 o 2008). Muchas veces estos hosts ya no están encendidos pero siguen como registros fantasmas en AD; siempre se debe validar si están activos ("live") antes de atacarlos o reportarlos.

* Documentación obligatoria: Siempre documenta los archivos transferidos desde y hacia los hosts del dominio (incluyendo directorios exactos en disco) para evitar conflictos con el cliente y garantizar la limpieza total del entorno al concluir el assessment.