---
tags:
  - network
  - hunting
---
## Conceptos Clave (TL;DR)

* Los sistemas heredados, servicios mal configurados o aplicaciones de prueba suelen utilizar protocolos no cifrados, exponiendo datos en texto claro.
* Estas brechas de seguridad permiten a los atacantes interceptar el tráfico para cazar credenciales de acceso e información sensible.
* Los protocolos vulnerables más comunes incluyen HTTP, FTP, SNMP, POP3, SMTP y LDAP.

  
## Herramientas Clave

* **Wireshark**: Analizador de paquetes de red preinstalado en distribuciones de pentesting, equipado con un potente motor de filtrado para búsqueda manual.

* **Pcredz**: Herramienta de escaneo rápido para extraer automáticamente credenciales y hashes desde tráfico en vivo o capturas de red.
  

## Metodología Paso a Paso

* **Fase 1: Obtención de la Captura**
  * Asegurar el acceso al archivo de captura de red o establecer la escucha pasiva en una interfaz viva.

* **Fase 2: Extracción Automatizada (Pcredz)**
  * Ejecutar Pcredz sobre la captura para identificar de inmediato tarjetas de crédito, credenciales en texto claro (POP, FTP, HTTP) y hashes (NTLM, Kerberos).

* **Fase 3: Análisis Manual (Wireshark)**
  * Aplicar filtros para aislar tráfico de protocolos no cifrados.
  * Buscar peticiones que contengan envío de datos (como métodos POST) o buscar cadenas específicas dentro de los paquetes.
  * Aislar los flujos TCP específicos para leer el intercambio completo entre el cliente y el servidor.

## Cheat Sheet de Comandos

### Wireshark Filters
```c
# Filtrar paquetes con una IP específica de origen o destino
ip.addr == <TARGET_IP>

  
# Filtrar tráfico entre dos direcciones IP específicas
ip.src == <SOURCE_IP> && ip.dst == <DEST_IP>

  
# Filtrar por un puerto específico (ej. puerto web)
tcp.port == <TARGET_PORT>

  
# Filtrar únicamente tráfico web HTTP
http

  
# Filtrar por peticiones HTTP POST (ideal para capturar envíos de formularios y logins)
http.request.method == "POST"

  
# Buscar paquetes que contengan una palabra clave específica en su contenido
http contains "<SEARCH_STRING>"

  
# Filtrar y seguir un flujo TCP específico para analizar la conversación completa
tcp.stream eq <STREAM_ID>

  
# Filtrar paquetes por dirección MAC
eth.addr == <MAC_ADDRESS>

  
# Detectar paquetes SYN sin ACK, útil para identificar escaneos o intentos de conexión
tcp.flags.syn == 1 && tcp.flags.ack == 0
```

### Pcredz
```bash
# Analizar un archivo pcapng para extraer credenciales en texto claro y hashes.
# -f: especifica el archivo de captura.
# -t: escanea números de tarjetas de crédito.
# -v: modo verbose.

./Pcredz -f <CAPTURE_FILE.PCAPNG> -t -v
```

  
## "Gotchas" y Troubleshooting

* Búsqueda visual en Wireshark: Además de usar filtros de visualización, puedes buscar cadenas manualmente en el contenido del paquete yendo a `Edit > Find Packet`.

* Despliegue de Pcredz: Si prefieres no lidiar con las dependencias al clonar el repositorio, la herramienta dispone de un contenedor Docker para una ejecución más limpia.

* Tráfico cifrado: La búsqueda directa de texto claro no funcionará en las contrapartes seguras de los protocolos mencionados (como HTTPS, FTPS, SMTPS), ya que estos ocultan el contenido del payload.