---
tags:
  - bypass
  - nmap
  - evasion
---
## Conceptos Clave (TL;DR)

* Los firewalls bloquean conexiones no autorizadas al monitorear paquetes; los paquetes pueden ser descartados (drop, sin respuesta) o rechazados (reject, devuelven un flag RST o un código de error ICMP).
* Los sistemas IDS (Detección) e IPS (Prevención) operan en base a firmas y coincidencias de patrones de ataques conocidos para notificar o bloquear el tráfico.
* Los paquetes entrantes con flag SYN suelen ser bloqueados, pero los paquetes con flag ACK frecuentemente logran atravesar el firewall porque este no puede determinar si la conexión original se estableció internamente o desde el exterior.

  
## Herramientas Clave

* [Nmap](../../../📂%2008%20Herramientas&Cheatsheets/Nmap.md): Utilizado para identificar reglas de filtrado mediante la manipulación del tipo de escaneo (banderas TCP), falsificación de la dirección IP de origen, inyección de señuelos (decoys) y modificación del puerto de origen.

* **Netcat (ncat):** Empleado para establecer conexiones directas hacia puertos aparentemente cerrados o filtrados, forzando un puerto de origen confiable para evadir las reglas.
 

## Metodología Paso a Paso

1. **Detección del estado de los puertos y reglas defensivas:** Analizar si los puertos están en estado filtrado evaluando las respuestas (paquetes ignorados o respuestas explícitas RST/ICMP) a los escaneos SYN convencionales.

2. **Evasión mediante manipulación de flags (ACK Scan):** Transmitir paquetes únicamente con el flag ACK para validar si un puerto está filtrado. Si el host devuelve un paquete RST, el puerto no está filtrado (ya sea que esté abierto o cerrado).

3. **Ofuscación de origen (Decoys y Spoofing):** Cuando existen bloqueos geográficos, por subred, o medidas IPS activas, se debe falsificar la IP de origen o insertar IPs señuelo aleatorias (Decoys) en la cabecera IP para enmascarar la procedencia real del ataque.

4. **Abuso de puertos origen confiables:** Alterar el puerto de origen a uno que las reglas de firewall suelan permitir explícitamente (como el puerto TCP 53 para tráfico DNS), logrando que los paquetes sean considerados confiables y se les permita el paso.

  
## Cheat Sheet de Comandos
```bash
# Escaneo SYN silencioso (Descubrimiento base)
# -sS: SYN scan
# -Pn: Deshabilita peticiones ICMP Echo
# -n: Deshabilita resolucion DNS
# --disable-arp-ping: Deshabilita ping ARP
# --packet-trace: Imprime todos los paquetes enviados y recibidos

sudo nmap <TARGET_IP> -p <PORTS> -sS -Pn -n --disable-arp-ping --packet-trace

  

# Escaneo ACK para evadir firewalls e identificar puertos no filtrados
# -sA: Ejecuta escaneo enviando paquetes TCP solo con flag ACK

sudo nmap <TARGET_IP> -p <PORTS> -sA -Pn -n --disable-arp-ping --packet-trace

  

# Escaneo usando Decoys (Señuelos) para ocultar la IP del atacante
# -D RND:<NUM>: Genera la cantidad de IPs aleatorias indicadas como señuelos

sudo nmap <TARGET_IP> -p <PORTS> -sS -Pn -n --disable-arp-ping --packet-trace -D RND:5

  

# Escaneo con IP de origen falsificada (Spoofing)
# -S <SPOOFED_IP>: Especifica manualmente la direccion IP de origen
# -e <INTERFACE>: Envia todas las peticiones a traves de la interfaz especificada (ej. tun0)

sudo nmap <TARGET_IP> -n -Pn -p <PORTS> -O -S <SPOOFED_IP> -e <INTERFACE>

  

# Escaneo forzando un puerto de origen confiable
# --source-port <PORT>: Ejecuta el escaneo suplantando el puerto de origen especificado (ej. 53)

sudo nmap <TARGET_IP> -p <PORTS> -sS -Pn -n --disable-arp-ping --packet-trace --source-port 53

  

# Conexion manual con Netcat suplantando el puerto de origen
# --source-port <PORT>: Fuerza a ncat a salir por un puerto especifico hacia el objetivo

ncat -nv --source-port 53 <TARGET_IP> <TARGET_PORT>
```

  
## "Gotchas" y Troubleshooting

* **Señuelos vivos:** Al usar Decoys, las direcciones IP señuelo utilizadas deben estar operativas (vivas) en la red. Si se emplean IPs inactivas, los mecanismos de seguridad del objetivo podrían causar una condición de SYN-flooding, impidiendo el alcance al servicio.

* **Tráfico saliente (Egress/Ingress Filtering):** A menudo, los ISPs y enrutadores filtran los paquetes falsificados (`-S` o `-D`), incluso dentro del mismo rango de red. Si los paquetes spoofed no llegan, considera manipular el "IP ID" junto con VPS adicionales.

* **Reacciones del IPS por escaneos ruidosos:** Ejecutar un escaneo agresivo contra un solo puerto puede detonar los mecanismos del IPS resultando en el bloqueo total de la IP del atacante. En entornos monitoreados, se requiere un enfoque de escaneo más silencioso y es altamente recomendable utilizar múltiples servidores VPS con distintas IPs en caso de ser bloqueados.

* **Puerto TCP 53:** Aunque tradicionalmente asociado a transferencias de zona, las expansiones de IPv6 y DNSSEC han provocado que un volumen considerable de peticiones DNS utilice el puerto TCP 53. Esto incrementa la probabilidad de que los firewalls e IDS lo tengan configurado como un puerto altamente confiable y poco inspeccionado.