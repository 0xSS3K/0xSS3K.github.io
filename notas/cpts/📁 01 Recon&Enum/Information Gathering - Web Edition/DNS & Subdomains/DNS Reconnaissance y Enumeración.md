---
tags:
  - webapp
  - webrecon
  - dns
---
## Conceptos Clave (TL;DR)

* La enumeración de DNS es esencial para extraer información de servidores y mapear la infraestructura web objetivo
* La respuesta estándar de una consulta consta de: Header (estado de consulta/flags), Question (qué se busca), Answer (el registro resuelto y su TTL) y Footer (tiempo y servidor responsable).
* Una pseudo-sección "opt" puede aparecer en la salida debido a EDNS (Extension Mechanisms for DNS), soportando mensajes de mayor tamaño y DNSSEC.


## Herramientas Clave

* **dig (Domain Information Groper):** Herramienta principal y versátil para consultas manuales de todo tipo de registros, troubleshooting y transferencias de zona.
* **nslookup / host:** Herramientas más simples para verificaciones rápidas de resolución y registros A/AAAA/MX.
* **dnsenum / fierce / dnsrecon:** Automatización de reconocimiento. Ejecutan fuerza bruta, ataques de diccionario, detección de comodines (wildcards) y transferencias de zona.
* **theHarvester:** OSINT multipropósito para recopilar correos electrónicos y datos de empleados asociados a un dominio a partir de fuentes públicas.
* **Servicios de búsqueda DNS Online:** Alternativa útil cuando el uso de la terminal está restringido.

  
## Metodología Paso a Paso

1. **Identificación de Infraestructura Base:** Consultar registros A/AAAA para obtener direcciones IPv4/IPv6 y mapear las IP principales asociadas al dominio.

2. **Descubrimiento de Servidores y Servicios:** Consultar registros MX para ubicar servidores de correo y NS para descubrir los servidores de nombres autoritativos que controlan la zona.

3. **Extracción de Configuraciones Adicionales:** Solicitar registros TXT (usualmente contienen SPF, verificaciones de dominio, etc.) y SOA (Start of Authority) para entender la topología del dominio.

4. **Análisis de Rutas y Relaciones:** Realizar búsquedas inversas (reverse lookups) sobre IPs descubiertas para encontrar otros hostnames ocultos y trazar la resolución completa para detectar intermediarios.

## Cheat Sheet de Comandos
```bash
# Realiza una consulta por defecto del registro A para el dominio
dig <DOMAIN>


# Extrae especificamente la direccion IPv4 (registro A)
dig <DOMAIN> A
  

# Extrae especificamente la direccion IPv6 (registro AAAA)
dig <DOMAIN> AAAA

  
# Identifica los servidores de correo (registro MX)
dig <DOMAIN> MX

  
# Identifica los servidores de nombres autoritativos (registro NS)
dig <DOMAIN> NS

  
# Extrae cualquier registro de texto (TXT) asociado al dominio
dig <DOMAIN> TXT

  
# Descubre el nombre canonico o alias (registro CNAME)
dig <DOMAIN> CNAME


# Extrae el registro Start of Authority (SOA)
dig <DOMAIN> SOA

  
# Dirige la consulta forzosamente hacia un servidor DNS especifico en lugar del local
dig @<TARGET_NS_IP> <DOMAIN>

  
# Muestra la ruta completa de resolucion DNS (tracing)
dig +trace <DOMAIN>

  
# Realiza una busqueda inversa (Reverse Lookup) sobre una IP para encontrar su hostname
dig -x <TARGET_IP>

  
# Formatea la salida para mostrar unicamente el resultado final de forma concisa
dig +short <DOMAIN>

  
# Formatea la salida ocultando cabeceras y mostrando unicamente la seccion Answer completa
dig +noall +answer <DOMAIN>

  
# Intenta solicitar todos los registros DNS disponibles
dig <DOMAIN> ANY
```

  

## "Gotchas" y Troubleshooting

* **Queries ANY ignorados:** Muchos servidores modernos ignoran las consultas tipo `ANY` para prevenir abusos y reducir carga de procesamiento, en cumplimiento con el RFC 8482.

* **Rate Limiting y Bloqueos:** Servidores configurados de forma estricta pueden detectar y bloquear un volumen excesivo de peticiones DNS. Es necesario respetar los limites de tasa y tener autorizacion.

* **Dependencia de NS en búsquedas inversas:** Al realizar un reverse lookup (`-x`), puede que el comando falle a menos que se especifique directamente un servidor de nombres (`@<TARGET_NS_IP>`) capaz de resolver la zona PTR.

* **Avisos de Recursión:** La salida puede mostrar `WARNING: recursion requested but not available`, lo que indica que el servidor interrogado no realiza consultas iterativas en nombre del cliente para buscar la respuesta completa.