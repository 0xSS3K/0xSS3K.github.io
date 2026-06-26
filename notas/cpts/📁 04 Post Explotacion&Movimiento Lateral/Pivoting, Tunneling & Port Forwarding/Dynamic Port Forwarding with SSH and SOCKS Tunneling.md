---
tags:
  - pivoting
  - ssh
  - socks
  - tunneling
---
## Conceptos Clave (TL;DR)

- El port forwarding redirige una conexión de un puerto a otro, usando TCP como capa de transporte, encapsulado vía SSH (u otros protocolos como SOCKS) para evadir firewalls y pivotar hacia otras redes desde un host comprometido.
- **Local Port Forwarding (`-L`)**: mapea un puerto local específico a un puerto/servicio remoto concreto en el host pivot. Se usa cuando ya sabes exactamente qué servicio/puerto quieres alcanzar (ej. una base de datos interna).
- **Dynamic Port Forwarding (`-D`)**: convierte el cliente SSH en un proxy SOCKS, permitiendo enrutar el tráfico de cualquier herramienta (vía proxychains) hacia toda una subred desconocida. Se usa cuando NO sabes qué servicios existen del otro lado de la red.
- SOCKS (Socket Secure): SOCKS4 (sin autenticación, sin soporte UDP) vs SOCKS5 (con autenticación y soporte UDP). Proxychains fuerza el tráfico TCP de cualquier herramienta a pasar por el proxy SOCKS/HTTP establecido, e incluso permite encadenar varios proxies.
- Limitación crítica: proxychains solo soporta **full TCP connect scans**, ya que no puede interpretar paquetes parciales (half-open/SYN scans dan resultados incorrectos). Además, el firewall de Windows Defender bloquea ICMP por defecto, por lo que los pings tradicionales fallarán contra hosts Windows.

## Herramientas Clave

- **ssh**: cliente usado tanto para local port forwarding (`-L`) como para dynamic port forwarding (`-D`); crea el túnel encapsulado.
- **nmap**: para enumerar el host pivot directamente, verificar el forwarding local, y escanear la red interna a través de proxychains.
- **netstat**: confirma que el puerto local forwardeado está en estado LISTEN.
- **proxychains**: enruta el tráfico TCP de cualquier herramienta a través del proxy SOCKS creado por `ssh -D`. Requiere editar `/etc/proxychains.conf`.
- **msfconsole (Metasploit)**: se ejecuta a través de proxychains para usar módulos auxiliares de escaneo (ej. `rdp_scanner`) contra hosts de la red interna.
- **xfreerdp**: cliente RDP usado para pivotar y conectarse a hosts Windows internos a través del túnel SOCKS.

## Metodología Paso a Paso

### Fase 1: Reconocimiento del Pivot
Antes de forwardear nada, hay que entender qué puertos/servicios tiene el host comprometido y si tiene acceso a otra red.
1. Escanear el host comprometido para confirmar puertos abiertos relevantes (ej. SSH abierto, servicio interno como MySQL cerrado/filtrado desde fuera).
2. Revisar las interfaces de red del pivot (`ifconfig`) para detectar múltiples NICs. Una segunda interfaz (ej. `ens224`) indica que el host está conectado a una red interna a la que el host de ataque no tiene ruta directa — ahí está la oportunidad de pivotar.

### Fase 2: Local Port Forwarding (cuando ya sabes qué servicio quieres)
1. Levantar el túnel con `ssh -L` mapeando un puerto local a `localhost:<puerto_servicio>` en el pivot.
2. Verificar el túnel localmente con `netstat` o `nmap` contra `localhost`.
3. Atacar/usar el servicio como si fuera local (ej. lanzar un exploit contra MySQL en `127.0.0.1:<puerto_local>`), algo que no podrías hacer directamente porque el servicio solo escucha en localhost del pivot.

### Fase 3: Dynamic Port Forwarding (cuando NO sabes qué hay en la red interna)
1. Levantar un listener SOCKS dinámico con `ssh -D` en el host pivot. Esto convierte tu máquina en un proxy SOCKS local.
2. Editar `/etc/proxychains.conf` añadiendo (o verificando) la línea `socks4 127.0.0.1 <puerto>` para que proxychains sepa enrutar a través de ese túnel.
3. Escanear la red interna completa o rangos conocidos a través de `proxychains nmap`, usando siempre **full connect scan** (`-sT`) y desactivando el ping ICMP (`-Pn`).
4. Identificar hosts vivos y puertos abiertos en la red interna (ej. SMB 445, RDP 3389, RPC 135, NetBIOS 139, etc.).

### Fase 4: Explotación/Acceso a través del túnel SOCKS
1. Ejecutar Metasploit a través de proxychains (`proxychains msfconsole`) para usar módulos auxiliares de escaneo (ej. `rdp_scanner`) y confirmar servicios/versión de OS en hosts internos.
2. Con credenciales válidas obtenidas durante el assessment, conectarse directamente al servicio interno (ej. RDP) usando `proxychains` + la herramienta cliente correspondiente (ej. `xfreerdp`).

## Cheat Sheet de Comandos

```bash
# Escanear puertos específicos del host pivot comprometido (SSH y servicio interno objetivo)
nmap -sT -p22,3306 <TARGET_IP>
```

```bash
# Local Port Forwarding: reenvía <LOCAL_PORT> de tu máquina al puerto <REMOTE_PORT> 
# en localhost del host pivot, encapsulado vía SSH
ssh -L <LOCAL_PORT>:localhost:<REMOTE_PORT> <USER>@<TARGET_IP>
```

```bash
# Verificar que el puerto local forwardeado está escuchando (estado LISTEN)
netstat -antp | grep <LOCAL_PORT>
```

```bash
# Confirmar el servicio forwardeado con Nmap contra localhost (-sV para detectar versión)
nmap -v -sV -p<LOCAL_PORT> localhost
```

```bash
# Forwarding de múltiples puertos en un solo comando SSH (encadenando -L)
ssh -L <LOCAL_PORT_1>:localhost:<REMOTE_PORT_1> -L <LOCAL_PORT_2>:localhost:<REMOTE_PORT_2> <USER>@<TARGET_IP>
```

```bash
# (Ejecutado EN el host pivot) Listar interfaces de red para identificar NICs adicionales
# que conecten a una red interna no enrutable desde el host de ataque
ifconfig
```

```bash
# Dynamic Port Forwarding: convierte el cliente SSH en un proxy SOCKS local en <SOCKS_PORT>
ssh -D <SOCKS_PORT> <USER>@<TARGET_IP>
```

```bash
# Verificar/inspeccionar la configuración actual de proxychains
tail -4 /etc/proxychains.conf
```

```bash
# Línea que debe existir en /etc/proxychains.conf (añadir si no está, normalmente al final)
# para indicar a proxychains que use el SOCKS listener creado por ssh -D
socks4  127.0.0.1 <SOCKS_PORT>
```

```bash
# Escaneo de descubrimiento de hosts (ping scan) en la red interna a través del túnel SOCKS
# -sn = solo descubrimiento de hosts, sin escaneo de puertos
proxychains nmap -v -sn <INTERNAL_NETWORK_RANGE>
```

```bash
# Escaneo completo de puertos contra un host interno específico a través de proxychains
# -Pn = no hacer ping (Windows Defender suele bloquear ICMP)
# -sT = full TCP connect scan (OBLIGATORIO con proxychains, no usar -sS)
proxychains nmap -v -Pn -sT <INTERNAL_TARGET_IP>
```

```bash
# Levantar Metasploit a través de proxychains para enrutar todo su tráfico por el túnel SOCKS
proxychains msfconsole
```

```text
# Dentro de msfconsole: buscar, configurar y ejecutar el módulo de escaneo RDP
search rdp_scanner
use auxiliary/scanner/rdp/rdp_scanner
set rhosts <INTERNAL_TARGET_IP>
run
```

```bash
# Conectarse vía RDP a un host interno a través del túnel SOCKS, usando credenciales obtenidas
proxychains xfreerdp /v:<INTERNAL_TARGET_IP> /u:<USER> /p:<PASSWORD>
```

## Gotchas y Troubleshooting

- **Solo full connect scans con proxychains**: nunca usar `-sS` (SYN/half-open) a través de proxychains; no entiende paquetes parciales y devolverá resultados incorrectos. Usar siempre `-sT`.
- **ICMP bloqueado en Windows**: Windows Defender Firewall bloquea pings por defecto. Si escaneas hosts Windows internos, usa siempre `-Pn` o obtendrás falsos negativos de "host down".
- **Configuración de proxychains obligatoria**: si la línea `socks4 127.0.0.1 <SOCKS_PORT>` no está en `/etc/proxychains.conf` (o apunta al puerto incorrecto), el túnel simplemente no funcionará aunque el `ssh -D` esté activo.
- **Rendimiento**: un full TCP connect scan sin `-Pn` sobre un rango de red completo (ej. `/23`) puede tardar muchísimo. Prioriza escanear hosts individuales o rangos pequeños ya identificados como activos.
- **Elegir el tipo de forwarding correcto**: usa `-L` solo si ya sabes el puerto/servicio exacto que quieres alcanzar; si desconoces qué hay en la red interna, necesitas `-D` (dynamic) + escaneo vía proxychains.
- **xfreerdp y certificados**: al conectar pedirá aceptar un certificado RDP antes de poder establecer la sesión; hay que aceptarlo manualmente.
- **Tiempos de laboratorio (HTB)**: tras desplegar el target, esperar 3-5 minutos para que toda la configuración del lab esté lista antes de intentar la conexión, o el pivot puede fallar sin motivo aparente.
- **Identificación de oportunidades de pivot**: la presencia de múltiples NICs (`ifconfig`) en el host comprometido (una hacia tu red de ataque, otra hacia una red interna) es la señal clave de que existe una red adicional para pivotar.