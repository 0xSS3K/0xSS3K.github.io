---
tags:
  - nmap
  - enum/service
  - enum/port
---
## Conceptos Clave (TL;DR)

* Identificar la aplicación y su versión exacta es crítico para analizar código fuente y buscar exploits precisos adaptados al objetivo.
* Los servidores suelen enviar un "banner" de identificación al cliente inmediatamente después de completar el 3-way handshake TCP.
* A nivel de red, la transmisión del banner se realiza mediante un paquete con el flag PSH en la cabecera TCP.
* Las herramientas automatizadas pueden omitir información valiosa si no están programadas para procesar o interpretar el formato específico del banner devuelto.

  
## Herramientas Clave

* **[Nmap](../../../📂%2008%20Herramientas&Cheatsheets/Nmap.md)**: Utilizado para descubrimiento de puertos, detección de versiones mediante lectura de banners y coincidencia de firmas.
* **Netcat (nc)**: Utilizado para establecer conexiones manuales a los puertos y realizar "banner grabbing" directo.
* **Tcpdump**: Empleado para interceptar y analizar el tráfico de red en crudo, revelando detalles que otras herramientas de capa superior pueden ocultar.

  
## Metodología Paso a Paso

1. **Escaneo Rápido Inicial**: Ejecutar un escaneo inicial para obtener un panorama de los puertos disponibles. Esto genera menos tráfico y reduce el riesgo de ser bloqueado por mecanismos de seguridad.
2. **Escaneo Completo y de Versiones**: Ejecutar un escaneo en segundo plano abarcando todos los puertos y activando la detección de versiones para perfilar los servicios subyacentes.
3. **Análisis a Nivel de Paquetes (Troubleshooting)**: Si el escaneo automatizado resulta ambiguo, ejecutar un escaneo con trazado de paquetes para observar las respuestas crudas del servicio.
4. **Banner Grabbing Manual**: Conectarse manualmente al servicio mientras se intercepta el tráfico. Esto permite capturar la respuesta exacta del servidor (incluyendo detalles de OS u otros datos) que herramientas como Nmap podrían haber filtrado u omitido.


## Cheat Sheet de Comandos
```bash
# Escanea todos los puertos y detecta versiones de servicios en un objetivo.

# -p- : Escanea todos los 65535 puertos.

# -sV : Ejecuta detección de versión de servicios.

sudo nmap <TARGET_IP> -p- -sV
```  

```bash
# Escaneo de puertos y versiones reportando el progreso cada 5 segundos.
# --stats-every=5s : Define el intervalo de tiempo para mostrar el estado.

sudo nmap <TARGET_IP> -p- -sV --stats-every=5s
``` 

```bash
# Escaneo de puertos y versiones con alta verbosidad.
# -v : Incrementa la verbosidad, mostrando los puertos abiertos en tiempo real tan pronto son detectados.

sudo nmap <TARGET_IP> -p- -sV -v
```

```bash
# Escaneo sigiloso y de versiones con trazado de red y resoluciones deshabilitadas.
# -Pn : Deshabilita solicitudes ICMP Echo (asume que el host está activo).
# -n : Deshabilita resolución DNS.
# --disable-arp-ping : Deshabilita el ping ARP.
# --packet-trace : Muestra todos los paquetes enviados y recibidos a nivel de red.

sudo nmap <TARGET_IP> -p- -sV -Pn -n --disable-arp-ping --packet-trace
```

```bash
# Intercepta tráfico de red entre el atacante y el objetivo en una interfaz específica.

# -i <INTERFACE> : Especifica la interfaz de red a escuchar (ej. eth0, tun0).

# host <IP> and <IP> : Filtra el tráfico estrictamente entre las dos IPs especificadas.

sudo tcpdump -i <ATTACKER_INTERFACE> host <ATTACKER_IP> and <TARGET_IP>
```

```bash
# Conexión manual a un puerto para extraer el banner (Banner Grabbing).
# -n : Sin resolución DNS.
# -v : Modo verboso.

nc -nv <TARGET_IP> <PORT>
```


## "Gotchas" y Troubleshooting

* **Tiempo de escaneo**: Si Nmap no puede identificar la versión mediante el banner, recurrirá a un sistema de coincidencia de firmas, lo cual incrementa drásticamente la duración del escaneo.

* **Revisión de Estado**: Durante cualquier escaneo de Nmap, puedes presionar la tecla `[Barra Espaciadora]` para visualizar el estado de progreso actual en la terminal.

* **Pérdida de datos en automatización**: Nmap a veces recorta u omite información valiosa (como la distribución específica de Linux, ej. Ubuntu) simplemente porque su parser no está configurado para mostrar esa porción del banner.

* **Banners ausentes o modificados**: No todos los servicios envían su banner inmediatamente tras la conexión. Además, los banners pueden ser eliminados o manipulados por los administradores de sistemas como medida de ofuscación.