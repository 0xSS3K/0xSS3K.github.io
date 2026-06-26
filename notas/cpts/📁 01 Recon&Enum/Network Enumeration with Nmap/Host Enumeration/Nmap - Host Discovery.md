---
tags:
  - nmap
  - enum/host
---
## Conceptos Clave (TL;DR)

* El primer paso en una prueba de penetración interna es obtener una visión general de los sistemas que están en línea para saber con cuáles se puede trabajar.
* Existen múltiples opciones para determinar si un objetivo está vivo, siendo las solicitudes ICMP echo el método más efectivo.
* Es una buena práctica almacenar cada escaneo realizado para su posterior comparación, documentación y reporte.
* Guardar los resultados ayuda a distinguir las variaciones en los hallazgos cuando se utilizan diferentes herramientas.

  
## Herramientas Clave

* **Nmap**: Utilizado para el descubrimiento activo de hosts en la red mediante diversas técnicas de escaneo.
* **grep** y **cut**: Utilizados en conjunto con Nmap para filtrar la salida en la terminal y extraer únicamente las direcciones IP limpias.

  
## Metodología Paso a Paso

1. **Definición del Objetivo**: Determinar si se evaluará un rango de red completo, una lista de IPs predefinida (común en pentests internos), múltiples IPs aisladas o un host individual.
2. **Escaneo de Descubrimiento (Ping Scan)**: Ejecutar [Nmap](../../../📂%2008%20Herramientas&Cheatsheets/Nmap.md) deshabilitando el escaneo de puertos para acelerar la identificación de hosts vivos en la red.
3. **Análisis de la Conectividad**: Utilizar banderas de Nmap para entender exactamente qué tipo de paquetes se están enviando y recibiendo, lo cual es útil para confirmar si un host responde por ARP o por ICMP.
4. **Modificación del Comportamiento Predeterminado**: Desactivar los pings ARP si es necesario forzar a Nmap a utilizar solicitudes ICMP echo, permitiendo observar las respuestas directas del protocolo de red.

  
## Cheat Sheet de Comandos
```bash
# Escanear un rango de red completo deshabilitando el escaneo de puertos y guardando en todos los formatos
# -sn: Deshabilita escaneo de puertos
# -oA: Guarda los resultados en los 3 formatos (XML, Nmap, Grepable) con el prefijo indicado

sudo nmap <TARGET_NETWORK>/<CIDR> -sn -oA <OUTPUT_PREFIX> | grep for | cut -d" " -f5
```
  
```bash
# Escanear a partir de una lista de IPs proporcionada
# -iL: Lee los objetivos desde el archivo especificado

sudo nmap -sn -oA <OUTPUT_PREFIX> -iL <LIST_FILE.lst> | grep for | cut -d" " -f5
```
  
```bash
# Escanear múltiples IPs específicas (separadas por espacio)

sudo nmap -sn -oA <OUTPUT_PREFIX> <TARGET_IP_1> <TARGET_IP_2> <TARGET_IP_3> | grep for | cut -d" " -f5
```
  
```bash
# Escanear un rango de IPs consecutivas en el último octeto

sudo nmap -sn -oA <OUTPUT_PREFIX> <TARGET_IP_START>-<TARGET_IP_END> | grep for | cut -d" " -f5
```
  
```bash
# Escaneo de un host individual confirmando envío de solicitudes ICMP Echo y trazando paquetes
# -PE: Realiza ping scan usando solicitudes ICMP Echo
# --packet-trace: Muestra todos los paquetes enviados y recibidos

sudo nmap <TARGET_IP> -sn -oA <OUTPUT_PREFIX> -PE --packet-trace
```
  
```bash
# Escaneo mostrando la razón específica por la cual Nmap marca al host en un estado particular
# --reason: Muestra el motivo del resultado (ej. arp-response)

sudo nmap <TARGET_IP> -sn -oA <OUTPUT_PREFIX> -PE --reason
```
  
```bash
# Escaneo forzando el uso de ICMP al deshabilitar las solicitudes ARP previas
# --disable-arp-ping: Deshabilita los pings ARP

sudo nmap <TARGET_IP> -sn -oA <OUTPUT_PREFIX> -PE --packet-trace --disable-arp-ping
```


## "Gotchas" y Troubleshooting

* **Falsos Negativos por Firewall**: El método de descubrimiento básico solo funciona si los firewalls de los hosts lo permiten; las configuraciones de firewall a menudo ignoran las solicitudes ICMP echo por defecto, provocando que Nmap marque a los hosts activos como inactivos.
* **Comportamiento por defecto de Nmap (ARP vs ICMP)**: Aunque al usar `-sn` Nmap automáticamente hace un ping scan con ICMP Echo Requests (`-PE`), si el objetivo está en la misma subred, Nmap enviará un ARP ping primero.
* **Falsos Positivos de ICMP**: Nmap detectará si un host está vivo basándose únicamente en la solicitud y respuesta ARP, incluso si el host no responde a ICMP.
* **Utilidad del ICMP**: Analizar los detalles de la solicitud ICMP echo no solo ayuda a determinar si el objetivo está vivo, sino que también puede ayudar a identificar el sistema subyacente.