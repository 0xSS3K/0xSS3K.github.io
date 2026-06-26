---
tags:
  - AD
  - enum
---
## Conceptos Clave (TL;DR)

* La enumeración de Active Directory debe abordarse en etapas progresivas y planificadas para evitar perder información vital.

* Las evaluaciones suelen comenzar desde una perspectiva no autenticada para simular vectores de entrada realistas, como ataques de phishing, acceso físico o empleados malintencionados.

* El objetivo principal de esta fase inicial es establecer un punto de apoyo en la red obteniendo credenciales en texto claro, un hash NTLM, una shell en el contexto de un usuario del dominio o acceso nivel SYSTEM en un host unido al dominio.

* Un nivel de acceso SYSTEM en una máquina unida al dominio permite suplantar la cuenta del equipo y enumerar el entorno de AD como si se tuviera un usuario de dominio estándar.

  

## Herramientas Clave

* **Wireshark / tcpdump**: Permiten la captura y análisis de tráfico de capa 2 y protocolos de red (como ARP y MDNS) para identificar hosts de manera completamente pasiva.

* **Responder**: Utilizado en su modo de análisis para escuchar peticiones de red (LLMNR, NBT-NS y MDNS) y descubrir hosts únicos sin enviar paquetes envenenados.

* **fping**: Herramienta de barrido ICMP útil para validar de forma rápida y silenciosa la disponibilidad de múltiples hosts en bloque (round-robin) en lugar de esperar la respuesta de un solo objetivo a la vez.

* **[Nmap](../../../📂%2008%20Herramientas&Cheatsheets/Nmap.md)**: Escáner de puertos utilizado para perfilar los hosts activos, identificar servicios críticos (DNS, SMB, LDAP, Kerberos, RDP) y detectar posibles vulnerabilidades iniciales.

* **Kerbrute**: Herramienta para la enumeración sigilosa de nombres de usuario mediante solicitudes de preautenticación de Kerberos al Controlador de Dominio.

  
## Metodología Paso a Paso

1. **Identificación Pasiva**: Iniciar la evaluación escuchando el tráfico de la red sin interactuar directamente con los hosts. Esto permite descubrir equipos y convenciones de nombres mediante el tráfico broadcast de la red local.

2. **Identificación Activa (ICMP Sweep)**: Validar el estado de las direcciones IP descubiertas y barrer el rango de red asignado para identificar otros hosts "vivos" que puedan responder a solicitudes ICMP.

3. **Enumeración de Puertos y Servicios**: Escanear la lista consolidada de hosts activos para determinar qué servicios operan en cada uno. El enfoque debe orientarse a puertos comúnmente asociados con servicios de Active Directory.

4. **Enumeración de Usuarios**: Compilar una lista de cuentas de dominio válidas interrogando al Controlador de Dominio. Estos usuarios válidos servirán como objetivo posterior para ataques de password spraying.


## Cheat Sheet de Comandos

```bash
# Captura de tráfico de red en interfaz gráfica (ejecutado con privilegios para capturar)

sudo -E wireshark
```
  
```bash
# Captura de tráfico en CLI sobre una interfaz específica

sudo tcpdump -i <INTERFACE>
```
  
```bash
# Análisis pasivo de la red con Responder (el flag -A evita realizar poisoning)

sudo responder -I <INTERFACE> -A
```
  
```bash
# Barrido ICMP silencioso sobre todo un segmento de red

# -a: muestra solo hosts vivos, -s: imprime estadísticas, -g: genera lista desde CIDR, -q: output silencioso

fping -asgq <SUBNET_CIDR>
```
  
```bash
# Escaneo agresivo de Nmap sobre una lista de objetivos descubiertos

# -v: verbose, -A: escaneo agresivo (OS, servicios, scripts), -iL: input desde archivo, -oN (o -oA): output

sudo nmap -v -A -iL <HOSTS_FILE> -oA <OUTPUT_PREFIX>
```
  
```bash
# Clonación y compilación de Kerbrute para múltiples plataformas/arquitecturas

sudo git clone https://github.com/ropnop/kerbrute.git

cd kerbrute

sudo make all
```
  
```bash
# Enumeración rápida de usuarios válidos vía Kerberos

# -d: dominio objetivo, --dc: IP del Domain Controller, lista de usuarios, -o: archivo de salida

kerbrute userenum -d <DOMAIN> --dc <DC_IP> <WORDLIST> -o <OUTPUT_FILE>
```


## "Gotchas" y Troubleshooting

* **Bloqueos de cuentas con Kerbrute**: Aunque la enumeración de usuarios es generalmente segura, los fallos de preautenticación en Kerberos cuentan como un inicio de sesión fallido en el AD y **pueden bloquear las cuentas** de los usuarios.

* **Inestabilidad por Escaneos**: El uso de escaneos agresivos o con scripts (como `nmap -A`) puede causar inestabilidad en la red e interrumpir operaciones si se escanean dispositivos sensibles, como controladores lógicos o equipos industriales.

* **Sistemas Legacy (End-of-Life)**: Es común encontrar sistemas antiguos (Windows 7, 8 o Server 2008) en entornos corporativos de producción. Estos sistemas son vectores excelentes para obtener shells nivel SYSTEM mediante exploits antiguos como MS08-067 o EternalBlue.

* **Regla de Oro con Exploits**: Antes de ejecutar cualquier exploit sobre sistemas legacy, se debe contar obligatoriamente con la aprobación por escrito del cliente para evitar responsabilidades ante una posible caída del servicio.

* **Evitar ruido excesivo**: En pruebas de tipo "Red Team" o evasivas, realizar escaneos amplios con Nmap alertará rápidamente al Blue Team o al SOC del cliente.