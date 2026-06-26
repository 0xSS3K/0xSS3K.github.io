---
tags:
  - enum
  - portscanning
---
## Conceptos Clave (TL;DR)

* Nmap clasifica los puertos en 6 estados posibles: `open`, `closed`, `filtered`, `unfiltered`, `open|filtered` y `closed|filtered`.
* En TCP, un puerto cerrado responde con un paquete que contiene el flag `RST`.
* El escaneo TCP Connect (`-sT`) completa el "three-way handshake", lo que lo hace altamente preciso pero genera logs en los sistemas destino, siendo poco sigiloso.
* El escaneo SYN (`-sS`) es por defecto cuando se ejecuta como root (requiere permisos para raw sockets) y es más sigiloso al no completar la conexión.
* El escaneo UDP (`-sU`) es considerablemente más lento debido a que UDP es un protocolo sin estado (stateless); al no recibir ACKs, depende de tiempos de espera largos para confirmar el estado del puerto.

### Herramientas Clave

* [Nmap](../../../%F0%9F%93%81%2001_Reconocimiento_y_Enumeracion/Network%20Enumeration%20with%20Nmap/Host%20Enumeration/brain-not-braining/%F0%9F%93%82%2008_Herramientas_y_Cheatsheets/Nmap.md): Herramienta principal para el descubrimiento de puertos abiertos, protocolos, estados de firewall, servicios e identificación de versiones de sistemas objetivo.

### Metodología Paso a Paso

**Fase 1: Descubrimiento de Puertos TCP**

El objetivo es identificar rápidamente qué puertos TCP están expuestos. Se utiliza el escaneo SYN por defecto por ser rápido y sigiloso. Si se requiere interactuar limpiamente con los servicios sin causar errores por conexiones a medias, se opta por Connect Scan (`-sT`).

**Fase 2: Análisis de Puertos Filtrados y Evasión**

Cuando los puertos aparecen como "`filtered`", indica presencia de firewalls que hacen "`drop`" (descartan sin respuesta) o "`reject`" (rechazan con respuesta de error) a los paquetes. Para analizar esto, se deshabilitan resoluciones innecesarias (DNS, ARP, ping) y se trazan los paquetes para observar exactamente qué flags devuelve el firewall.

**Fase 3: Descubrimiento de Puertos UDP**

Dado que los administradores suelen olvidar filtrar UDP, es vital escanearlos. Se recomienda escanear solo los puertos más comunes (`-F`) debido a la lentitud del escaneo UDP.

**Fase 4: Enumeración de Servicios y Versiones**

Una vez identificados los puertos abiertos, se procede a extraer los banners, nombres de servicios y versiones exactas (`-sV`) para buscar vulnerabilidades específicas asociadas a dichas versiones.

### Cheat Sheet de Comandos

```bash
# Escaneo rápido de los 10 puertos TCP más comunes

sudo nmap <TARGET_IP> --top-ports=10
```

```bash
# Escaneo rápido (Top 100 puertos) en protocolo UDP

sudo nmap <TARGET_IP> -F -sU
```

```bash
# Escaneo TCP Connect (-sT) en un puerto específico con trazado de paquetes y razones

# Banderas: -Pn (sin ping), -n (sin DNS), --disable-arp-ping (sin ARP), --reason (muestra por qué el puerto tiene ese estado)

sudo nmap <TARGET_IP> -p <PORT> --packet-trace --disable-arp-ping -Pn -n --reason -sT
```

```bash
# Depuración profunda de respuestas de Firewall (ideal para puertos 'filtered')

# Deshabilita ruido (ping, dns, arp) y muestra los paquetes crudos enviados/recibidos

sudo nmap <TARGET_IP> -p <PORT> --packet-trace -n --disable-arp-ping -Pn
```

```bash
# Escaneo UDP detallado de un puerto específico para ver la respuesta del protocolo

sudo nmap <TARGET_IP> -sU -Pn -n --disable-arp-ping --packet-trace -p <PORT> --reason
```

```bash
# Escaneo de Versión y Servicios en un puerto detectado como abierto

# -sV interactúa con el servicio para extraer su banner y versión exacta

sudo nmap <TARGET_IP> -Pn -n --disable-arp-ping --packet-trace -p <PORT> --reason -sV
```

### "Gotchas" y Troubleshooting

* **Privilegios necesarios:** El escaneo SYN (`-sS`) sólo funciona por defecto si Nmap se ejecuta como root (`sudo`); de lo contrario, Nmap retrocede automáticamente a un Connect Scan (`-sT`).
* **Lentitud por Firewalls:** Cuando un firewall descarta (`drops`) los paquetes, Nmap no recibe respuesta y, por defecto, reintentará enviar la petición 10 veces (`--max-retries`), lo que ralentiza masivamente los escaneos.
* **Estados ambiguos:** \* `unfiltered`: Sólo ocurre en escaneos TCP-ACK, indica que el puerto es accesible pero Nmap no sabe si está abierto o cerrado.

&#x20;   \* `open|filtered`: Ocurre comúnmente en UDP si no hay ninguna respuesta del puerto; Nmap no puede saber si el puerto está abierto y el servicio no responde, o si un firewall descartó silenciosamente el paquete.

* **Confirmación de UDP cerrado:** En escaneos UDP, si recibes un paquete ICMP con Tipo 3 y Código 3 (`Port unreachable`), es la confirmación definitiva de que el puerto está cerrado.
* **Detección de IDS/IPS:** Connect Scan (`-sT`) genera logs en casi todos los sistemas, pero los IDS/IPS modernos también están calibrados para detectar los escaneos SYN ("`half-open`").
