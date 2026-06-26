---
tags:
  - windows
  - Poisoning
  - LLMNR
  - NBT-NS
  - AD
---
## Conceptos Clave

* El envenenamiento de LLMNR y NBT-NS es posible desde un host con sistema operativo Windows.
* Esta técnica es útil cuando el entorno de ataque o la máquina comprometida (como administrador local) es un sistema Windows y se busca escalar o pivotar el acceso.
* Inveigh es la principal alternativa a Responder para entornos Windows; opera de manera similar pero está escrita en PowerShell y C#.
* La herramienta es capaz de escuchar e interactuar con múltiples protocolos, incluyendo LLMNR, DNS, mDNS, NBNS, DHCPv6, ICMPv6, HTTP, HTTPS, SMB, LDAP, WebDAV y Proxy Auth.

  
## Herramientas Clave

* **Inveigh (PowerShell)**: Versión original en script (`Inveigh.ps1`) útil para ejecución en memoria, aunque ya no recibe actualizaciones.
* **InveighZero (C#)**: Versión compilada (`Inveigh.exe`) mantenida activamente por el autor, que combina el código de prueba de concepto original y un port de la versión de PowerShell.

  
## Metodología Paso a Paso

### 1. Preparación y Despliegue

Dependiendo de la versión a utilizar, debes cargar el script en tu sesión de PowerShell o tener el binario compilado listo en la máquina atacante Windows. Para la versión en C#, es una buena práctica compilar el ejecutable por tu cuenta utilizando Visual Studio.
### 2. Ejecución y Envenenamiento

Inicia Inveigh con los parámetros deseados para comenzar a escuchar y responder a peticiones de broadcast en la red local. La herramienta te mostrará qué opciones están habilitadas (marcadas con `[+]`) y cuáles están deshabilitadas (marcadas con `[ ]`), así como los eventos de peticiones capturadas y respuestas enviadas.
### 3. Interacción y Extracción de Hashes

Mientras Inveigh se ejecuta, puedes acceder a su consola interactiva sin detener el envenenamiento. A través de esta consola, puedes visualizar credenciales en texto claro, listar usuarios capturados para enumeración adicional o visualizar los hashes NTLMv2 únicos listos para intentar ser crackeados offline con herramientas como Hashcat.
  
## Cheat Sheet de Comandos
```powershell
# Importar el modulo de Inveigh en la sesion actual de PowerShell
Import-Module .\Inveigh.ps1

  
# Listar todos los parametros posibles del modulo de PowerShell
(Get-Command Invoke-Inveigh).Parameters

  
# Iniciar Inveigh en PS habilitando spoofing de NBNS, salida en consola y escritura a un archivo de registro
Invoke-Inveigh Y -NBNS Y -ConsoleOutput Y -FileOutput Y

  
# Ejecutar la version C# de Inveigh con la configuracion por defecto
.\Inveigh.exe
```

```text
# Comandos internos de la consola interactiva de Inveigh (Presionar ESC para entrar/salir)
  

# Mostrar el menu de ayuda con todos los comandos disponibles
HELP
 

# Obtener los hashes NTLMv2 capturados (un hash unico por usuario)
GET NTLMV2UNIQUE
  

# Obtener una lista de nombres de usuario capturados y sus IPs/hostnames de origen
GET NTLMV2USERNAMES


# Detener la ejecucion de Inveigh
STOP
```

```powershell
# Script de mitigacion para deshabilitar NBT-NS localmente (modificando el registro)

$regkey = "HKLM:SYSTEM\CurrentControlSet\services\NetBT\Parameters\Interfaces"

Get-ChildItem $regkey |foreach { Set-ItemProperty -Path "$regkey\$($_.pschildname)" -Name NetbiosOptions -Value 2 -Verbose}
```
## "Gotchas" y Troubleshooting

* **Soporte de Versiones**: La versión original de PowerShell (`Inveigh.ps1`) está descontinuada; se recomienda priorizar el uso de la versión en C# (`Inveigh.exe`).
* **Compilación Requerida**: Antes de poder usar la versión en C#, el ejecutable debe ser compilado.
* **Conflictos de Puertos**: Al iniciar la versión ejecutable, es común ver errores como `Failed to start HTTP listener on port 80` si los puertos requeridos ya están siendo utilizados por otros servicios en el host Windows.
* **Interacción con la Consola**: Presionar la tecla `ESC` es el método designado para entrar y salir de la consola interactiva mientras la herramienta sigue capturando tráfico en segundo plano.
* **Mitigación Deficiente vía GPO**: A diferencia de LLMNR, NBT-NS no puede ser deshabilitado directamente mediante una política de grupo (GPO), sino que requiere configuración local o el despliegue de un script de inicio de PowerShell.
* **Requisitos de Aplicación (Defensa)**: Para que los cambios al deshabilitar NBT-NS surtan efecto, es obligatorio reiniciar el sistema objetivo o reiniciar el adaptador de red.
* **Detección de Actividad**: El tráfico de estos protocolos puede monitorizarse en los puertos UDP 5355 y 137, buscar los Event IDs 4697 y 7045, o revisar la llave de registro `EnableMulticast` (donde un valor de `0` significa que LLMNR está deshabilitado).