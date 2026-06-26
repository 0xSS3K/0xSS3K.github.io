---
tags:
  - ftp
  - enum
---
## Conceptos Clave (TL;DR)

* El protocolo FTP opera en texto claro utilizando el puerto TCP 21 para el canal de control y el TCP 20 para el canal de datos. Soporta modo Activo y modo Pasivo, siendo el Pasivo diseñado para evadir firewalls del lado del cliente.
* El acceso anónimo (usuario "anonymous" sin contraseña) es una configuración predeterminada frecuente y un vector crítico de acceso inicial para enumerar o modificar archivos.
* TFTP (Trivial File Transfer Protocol) es una alternativa basada en UDP, poco confiable, que carece de autenticación y características de seguridad, limitándose a operar mediante permisos globales del sistema operativo.
* Identificar permisos de escritura (subida de archivos) en un servidor FTP que está conectado a un servidor web aumenta dramáticamente la probabilidad de lograr un RCE (Remote Command Execution) o explotar un LFI.

### Herramientas Clave

* [Nmap](../../../%F0%9F%93%81%2001_Reconocimiento_y_Enumeracion/Footprinting/Host%20Based%20Enumeration/brain-not-braining/%F0%9F%93%82%2008_Herramientas_y_Cheatsheets/Nmap.md): Detección de servicios, versiones y ejecución de scripts automatizados (NSE) para identificar accesos anónimos.
* [ftp/tftp](../../../%F0%9F%93%81%2001_Reconocimiento_y_Enumeracion/Footprinting/Host%20Based%20Enumeration/ServiceEnum/): Clientes de consola nativos para establecer conexión e interactuar con los comandos del servidor.
* **wget**: Útil para la descarga recursiva y masiva de todo el contenido de un servidor FTP.
* **nc / telnet**: Herramientas para la interacción manual de red y recolección rápida del banner del servicio.
* **openssl**: Cliente necesario para interactuar con servicios FTP protegidos por TLS/SSL y extraer información de sus certificados.

### Metodología Paso a Paso

1. **Reconocimiento (Footprinting)**    Se inicia escaneando el objetivo en busca del puerto 21 para identificar el servicio y su versión. Se ejecutan scripts NSE por defecto para descubrir vulnerabilidades rápidas, como el inicio de sesión anónimo habilitado.
2. **Interacción y Recolección de Metadatos**    Si el servicio usa texto claro, se utiliza Netcat, Telnet o el cliente FTP estándar para capturar el banner y detectar el tipo de sistema. Si requiere TLS/SSL, se utiliza OpenSSL para inspeccionar la cadena del certificado, lo que puede revelar dominios internos, direcciones de correo y ubicaciones físicas.
3. **Autenticación Anónima y Enumeración Interna**    Se intenta ingresar mediante el usuario `anonymous`. Una vez dentro, se utilizan comandos del cliente FTP para listar la estructura de archivos recursivamente y habilitar modos de depuración para observar las respuestas del servidor.
4. **Transferencia de Archivos (Prueba de Lectura/Escritura)**    Se descargan archivos de interés encontrados durante la enumeración para buscar credenciales o información sensible. Se ejecuta una prueba de subida de archivos (comando `put`) para validar si existen permisos de escritura, lo cual es el primer paso para buscar un RCE.

### Cheat Sheet de Comandos

```bash
# Actualizar la base de datos de scripts NSE de Nmap
sudo nmap --script-updatedb

# Escaneo agresivo, detección de versión y ejecución de scripts por defecto en el puerto FTP
sudo nmap -sV -p21 -sC -A <TARGET_IP>


# Escaneo FTP con trazado de red para inspeccionar qué comandos envía Nmap y qué respuestas recibe
sudo nmap -sV -p21 -sC -A <TARGET_IP> --script-trace


# Conexión estándar mediante el cliente FTP nativo
ftp <TARGET_IP>
 

# Conexión directa al banner mediante Netcat o Telnet
nc -nv <TARGET_IP> 21
telnet <TARGET_IP> 21


# Conexión a un servidor FTP cifrado con TLS/SSL usando OpenSSL para volcar el certificado
openssl s_client -connect <TARGET_IP>:21 -starttls ftp
 

# Descarga recursiva de todo el contenido accesible del FTP (usa modo activo y autenticación anónima)
wget -m --no-passive ftp://anonymous:anonymous@<TARGET_IP>
```

```bash
# COMANDOS INTERNOS DEL CLIENTE FTP (una vez conectado)

# Habilitar el estado y las variables de configuración de la conexión actual
status


# Activar modo de depuración y trazado de paquetes
debug
trace


# Listar de forma recursiva todos los directorios y archivos visibles
ls -R
  

# Descargar un archivo desde el servidor hacia la máquina local
get <FILE_NAME>


# Subir un archivo desde la máquina local hacia el servidor remoto
put <FILE_NAME>
```

```bash
# COMANDOS INTERNOS DEL CLIENTE TFTP

# Establecer la conexión hacia el servidor remoto
connect <TARGET_IP>
  

# Mostrar el estado actual de tftp
status  


# Activar modo verboso para mostrar información adicional durante la transferencia
verbose  


# Descargar o subir archivos (Nota: TFTP no tiene comando de listado)
get <FILE_NAME>
put <FILE_NAME>
```

### "Gotchas" y Troubleshooting

* **Ocultación de IDs:** Si el servidor vsFTPd tiene la directiva `hide_ids=YES`, todos los propietarios en el listado de directorios se mostrarán como "ftp", ocultando los usuarios locales reales y mitigando ataques de fuerza bruta.
* **Modo Pasivo (PASV):** Es vital tenerlo en cuenta al ejecutar comandos de listado o transferencia si el cliente está detrás de un firewall restrictivo.
* **Limitaciones de TFTP:** TFTP no posee la funcionalidad de listado de directorios (no hay comando `ls`); debes conocer de antemano el nombre y ruta exacta del archivo que deseas extraer.
* **Alarma de Descarga:** Extraer todo un servidor mediante `wget -m` generará mucho ruido de red y fácilmente puede disparar alarmas en un Blue Team.
* **Sniffing:** Al ser FTP un protocolo de texto claro, si te encuentras en una posición de red favorable (Ej. envenenamiento ARP en la subred local), puedes interceptar credenciales en tránsito usando un sniffer.
* **Log Poisoning:** Los registros (logs) del FTP pueden ser un vector para inyectar payloads, lo que podría derivar en RCE.
