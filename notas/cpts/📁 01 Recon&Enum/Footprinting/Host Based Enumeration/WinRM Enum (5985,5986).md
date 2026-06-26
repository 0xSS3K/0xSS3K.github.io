---
tags:
  - enum/service
  - WinRM
---
## Conceptos Clave (TL;DR)

* WinRM es un protocolo de administración remota integrado en Windows, basado en línea de comandos y que utiliza SOAP para conectarse a hosts y aplicaciones.
* Permite la ejecución de comandos arbitrarios remotos a través de Windows Remote Shell (WinRS) y es requerido para sesiones remotas de PowerShell.
* Utiliza los puertos TCP 5985 para HTTP y 5986 para HTTPS.
* Viene habilitado por defecto en Windows Server a partir de la versión 2012, pero requiere configuración manual y reglas de firewall en versiones anteriores y en clientes desde Windows 10.

  
## Herramientas Clave

* **[Nmap](../../../📂%2008%20Herramientas&Cheatsheets/Nmap.md):** Utilizado para escanear y confirmar la presencia del servicio WinRM en sus puertos predeterminados.
* **PowerShell (Test-WsMan):** Cmdlet nativo utilizado para verificar si un servidor remoto responde y es accesible mediante WinRM.
* **evil-winrm:** Herramienta de penetración en entornos Linux diseñada específicamente para interactuar con WinRM y obtener una shell interactiva.

  
## Metodología Paso a Paso

1. **Fase de Descubrimiento (Footprinting):** Se realiza un escaneo de puertos sobre los puertos TCP 5985 y 5986 para identificar si el servicio HTTPAPI de Microsoft está expuesto, confirmando la disponibilidad de WinRM en la red.

2. **Fase de Verificación:** Antes de intentar la explotación o el inicio de sesión, se valida la conectividad hacia el servicio WinRM usando herramientas nativas de PowerShell para asegurar que el endpoint remoto responde correctamente.

3. **Fase de Acceso / Ejecución Remota:** Contando con credenciales válidas, se establece una conexión autenticada contra el servicio para obtener una sesión de PowerShell remota (shell) que permita la interacción directa con el sistema operativo.

  
## Cheat Sheet de Comandos

Escaneo de puertos y enumeración de servicio WinRM con Nmap:
```bash
# -sV: Determina la versión del servicio

# -sC: Ejecuta scripts de enumeración por defecto

# -p5985,5986: Especifica los puertos por defecto de WinRM (HTTP y HTTPS)

# --disable-arp-ping: Deshabilita el sondeo de descubrimiento ARP

# -n: Deshabilita la resolución DNS para agilizar el escaneo

nmap -sV -sC <TARGET_IP> -p5985,5986 --disable-arp-ping -n
```

Verificación de disponibilidad de WinRM desde un entorno Windows:
```powershell
# Cmdlet que comprueba si el servicio WinRM en el host remoto está escuchando y responde

Test-WsMan <TARGET_IP>
```

Obtención de shell interactiva desde un entorno Linux:
```bash
# -i: Especifica la dirección IP del objetivo

# -u: Especifica el nombre de usuario válido

# -p: Especifica la contraseña del usuario

evil-winrm -i <TARGET_IP> -u <USER> -p <PASSWORD>
```

## "Gotchas" y Troubleshooting

* A menudo se encontrará que solo el puerto HTTP (TCP 5985) está en uso y expuesto, en lugar de la variante segura HTTPS (TCP 5986).

* En sistemas operativos de cliente (como Windows 10) y servidores anteriores a Windows Server 2012, WinRM no funcionará "out of the box"; debe configurarse explícitamente y se deben crear las excepciones de firewall correspondientes.

* Al utilizar `evil-winrm`, es posible que aparezca una advertencia indicando que el autocompletado de rutas remotas está deshabilitado; esto es un comportamiento normal debido a limitaciones nativas de Ruby en la máquina atacante.

## Configuraciones Inseguras

* **Uso exclusivo de HTTP (TCP 5985):** Configurar y utilizar WinRM únicamente a través del puerto HTTP expone el tráfico a posibles intercepciones, omitiendo la capa de seguridad y cifrado que proporciona el protocolo cuando se implementa sobre el puerto HTTPS (TCP 5986).