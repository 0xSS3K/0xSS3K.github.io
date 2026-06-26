---
tags:
  - windows
  - privex
  - enum
---
## Conceptos Clave (TL;DR)
- La enumeración de red y protecciones es el primer paso crítico antes de escalar privilegios para operar proactivamente y no reactivamente.
- Identificar hosts dual-homed, tablas de enrutamiento y caché ARP revela vectores de movimiento lateral y objetivos adyacentes no accesibles directamente.
- Enumerar AV/EDR y AppLocker determina si las herramientas públicas serán bloqueadas y si se requieren payloads personalizados o bypasses.

## Herramientas Clave
- ipconfig: Enumera interfaces de red, IPs, gateways y DNS.
- arp: Visualiza la caché ARP para descubrir hosts cercanos.
- route: Inspecciona la tabla de enrutamiento para detectar redes adicionales.
- Get-MpComputerStatus: Verifica el estado y configuración de Windows Defender.
- Get-AppLockerPolicy: Enumera las reglas de restricción de aplicaciones (AppLocker).
- Test-AppLockerPolicy: Prueba si un archivo específico es bloqueado por las políticas de AppLocker.

## Metodología Paso a Paso
1. Recopilación de Información de Red
   - Lógica: Identificar interfaces y direcciones IP para detectar si el host pertenece a múltiples redes (dual-homed). Revisar la caché ARP para encontrar hosts con los que el objetivo se ha comunicado, identificando posibles servidores de administración. Inspeccionar la tabla de enrutamiento para descubrir redes adyacentes y gateways que permitan el movimiento lateral.
2. Enumeración de Protecciones
   - Lógica: Verificar el estado del antivirus/EDR para confirmar si la protección en tiempo real está activa. Enumerar las políticas de AppLocker para identificar binarios, scripts o tipos de archivos restringidos. Probar la política contra binarios comunes para confirmar bloqueos y planificar bypasses si es necesario.

## Cheat Sheet de Comandos

```powershell
# /all: Muestra información detallada de todas las interfaces de red, incluyendo direcciones MAC, servidores DNS y configuración DHCP.
ipconfig /all
```

```powershell
# -a: Muestra la tabla ARP actual, revelando direcciones IP y MACs de hosts con los que el sistema se ha comunicado recientemente.
arp -a
```

```powershell
# Imprime la tabla de enrutamiento completa (IPv4 e IPv6), mostrando interfaces, métricas y gateways para identificar redes adicionales.
route print
```

```powershell
# Obtiene el estado actual de Windows Defender. Revisar flags como RealTimeProtectionEnabled, AntivirusEnabled y AMServiceEnabled.
Get-MpComputerStatus
```

```powershell
# -Effective: Obtiene la política de AppLocker que se está aplicando actualmente (combinación de local y dominio).
# select -ExpandProperty RuleCollections: Extrae y despliega las colecciones de reglas para ver qué está permitido o denegado.
Get-AppLockerPolicy -Effective | select -ExpandProperty RuleCollections
```

```powershell
# -Local: Usa la política de AppLocker configurada localmente en el host.
# -path: Especifica la ruta absoluta del binario o script a evaluar.
# -User: Define el usuario o grupo contra el cual se probará la política.
Get-AppLockerPolicy -Local | Test-AppLockerPolicy -path C:\Windows\System32\cmd.exe -User <USER_OR_GROUP>
```

## "Gotchas" y Troubleshooting
- Los EDR y soluciones de whitelisting pueden bloquear binarios comunes (net.exe, tasklist, cmd.exe). Siempre enumerar estas protecciones primero.
- Si AppLocker bloquea cmd.exe o powershell.exe, se debe ejecutar un bypass de AppLocker antes de intentar técnicas de escalada de privilegios.
- Las políticas de AppLocker pueden ser locales, de dominio o efectivas. Usar el flag -Effective muestra la política real aplicada en el sistema.
- El comando Test-AppLockerPolicy requiere la ruta absoluta del archivo y el usuario/grupo bajo el cual se evaluará la restricción.
- Si Windows Defender tiene RealTimeProtectionEnabled en False, verificar AntivirusEnabled y AMServiceEnabled para confirmar si el servicio está realmente deshabilitado o solo en modo de auditoría.