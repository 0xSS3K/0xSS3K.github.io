---
tags:
  - bruteforce
  - netexec
  - WinRM
  - ssh
  - RDP
  - SMB
  - metasploit
---
## Conceptos Clave (TL;DR)

* Los servicios de red permiten el acceso remoto a un sistema para ejecutar comandos, administrar contenido o acceder a una interfaz gráfica o terminal.

* Servicios comunes en entornos corporativos incluyen WinRM y RDP para sistemas Windows, SSH para Linux, y SMB/NFS para la transferencia y compartición de archivos en redes locales.

* Todos estos servicios implementan mecanismos de autenticación (generalmente mediante usuario y contraseña) y, frecuentemente, se despliegan utilizando configuraciones por defecto, lo que los hace susceptibles a ataques de fuerza bruta o diccionario.

* Una vez obtenidas credenciales válidas, el objetivo es utilizar clientes específicos de cada protocolo para establecer una sesión e interactuar directamente con la máquina objetivo.

  

## Herramientas Clave

* **[NetExec](../../../📂%2008%20Herramientas&Cheatsheets/NetExec.md):** Herramienta de ejecución de red utilizada para enumerar servicios y realizar ataques de fuerza bruta en múltiples protocolos (SMB, WinRM, SSH, RDP, LDAP, etc.).

* **Evil-WinRM:** Utilidad especializada para comunicarse eficientemente con el servicio WinRM de Windows e inicializar sesiones mediante el protocolo de remoting de PowerShell.

* **Hydra:** Herramienta clásica para realizar ataques de fuerza bruta en paralelo contra servicios de autenticación de red.

* **OpenSSH Client:** Cliente nativo en Linux utilizado para autenticarse y acceder a sesiones de terminal remota de forma segura.

* **xFreeRDP:** Cliente para Linux que permite interactuar con servidores de escritorio remoto de Windows (RDP).

* **Metasploit Framework:** Framework de explotación que incluye módulos auxiliares (como `smb_login`) muy útiles cuando otras herramientas de enumeración fallan debido a versiones desactualizadas de protocolos.

* **Smbclient:** Herramienta para conectarse a servidores SMB que permite listar recursos compartidos, así como subir o descargar archivos si los permisos lo permiten.

  

## Metodología Paso a Paso

* **Fase 1: Reconocimiento del Servicio.** El primer paso es identificar qué puertos están abiertos. Puertos típicos incluyen 5985/5986 para WinRM, 22 para SSH, 3389 para RDP y 445 para SMB.

* **Fase 2: Ataques de Diccionario.** Una vez que se identifica el servicio, se emplean herramientas como NetExec o Hydra combinadas con listas de palabras para intentar adivinar usuarios y contraseñas válidos.

* **Fase 3: Verificación de Privilegios.** Si la fuerza bruta tiene éxito, se debe verificar el nivel de acceso obtenido. Herramientas como NetExec mostrarán mensajes como "(Pwn3d!)" si el usuario tiene privilegios suficientes para ejecutar comandos de sistema.

* **Fase 4: Ejecución y Acceso.** Finalmente, se utiliza un cliente compatible con el protocolo vulnerado (Evil-WinRM, SSH, xFreeRDP o smbclient) para obtener una terminal interactiva, entorno gráfico o acceso al sistema de archivos objetivo.

  

## Cheat Sheet de Comandos

  

```bash
# ==========================================
# NETEXEC (ENUMERACIÓN Y FUERZA BRUTA)
# ==========================================
  

# Instalación rápida de NetExec mediante apt.
sudo apt-get -y install netexec

  
# Visualizar la ayuda general y los protocolos soportados.
netexec -h

  
# Visualizar la ayuda específica para un protocolo en particular (ej. smb, winrm, ssh).
netexec <PROTOCOLO> -h

  
# Ejecutar fuerza bruta básica contra un servicio.
# Reemplaza <PROTOCOLO> por winrm, smb, ssh, etc..
netexec <PROTOCOLO> <TARGET_IP> -u <USER_LIST> -p <PASSWORD_LIST>

  
# Enumerar recursos compartidos en SMB con credenciales válidas conocidas.
# La bandera --shares lista los directorios y permisos disponibles.
netexec smb <TARGET_IP> -u "<USER>" -p "<PASSWORD>" --shares

  
# ==========================================
# WINRM (WINDOWS REMOTE MANAGEMENT)
# ==========================================

  
# Instalar Evil-WinRM usando RubyGems.
sudo gem install evil-winrm
  

# Conectarse a un servidor remoto utilizando Evil-WinRM.
# Proporciona una sesión de PowerShell al establecer la conexión.
evil-winrm -i <TARGET_IP> -u <USER> -p <PASSWORD>
  

# ==========================================
# SSH (SECURE SHELL)
# ==========================================
  

# Conexión básica a un servidor mediante el cliente de OpenSSH.
ssh <USER>@<TARGET_IP>

  

# ==========================================
# HYDRA (FUERZA BRUTA MULTI-PROTOCOLO)
# ==========================================
  

# Fuerza bruta contra SSH.
hydra -L <USER_LIST> -P <PASSWORD_LIST> ssh://<TARGET_IP>

  
# Fuerza bruta contra RDP.
# -t 4 reduce los hilos a 4 para no saturar el servicio RDP.
hydra -t 4 -L <USER_LIST> -P <PASSWORD_LIST> rdp://<TARGET_IP>

  
# Fuerza bruta contra SMB.
# -t 1 reduce los hilos a 1, ya que SMB a menudo no soporta conexiones paralelas estables en este contexto.
hydra -t 1 -L <USER_LIST> -P <PASSWORD_LIST> smb://<TARGET_IP>

  

# ==========================================
# RDP (REMOTE DESKTOP PROTOCOL)
# ==========================================

  
# Conexión gráfica a un servidor RDP desde Linux usando xfreerdp.
# /v: especifica el objetivo, /u: el usuario, /p: la contraseña.
xfreerdp /v:<TARGET_IP> /u:<USER> /p:<PASSWORD>

  
# ==========================================
# SMB (SERVER MESSAGE BLOCK)
# ==========================================

  
# Conectarse a un recurso compartido de red específico mediante smbclient.
# -U especifica el usuario, requiere escapar las barras invertidas en Linux.
smbclient -U <USER> \\\\<TARGET_IP>\\<SHARE_NAME>
  

# ==========================================
# METASPLOIT (ALTERNATIVA SMB LOGIN)
# ==========================================

  
# Iniciar Metasploit de forma silenciosa e interactuar con el escáner de login SMB.

msfconsole -q
use auxiliary/scanner/smb/smb_login
set user_file <USER_LIST>
set pass_file <PASSWORD_LIST>
set rhosts <TARGET_IP>
run
```

  
## "Gotchas" y Troubleshooting

* **WinRM Desactivado por Defecto:** En Windows 10/11, el servicio WinRM debe activarse y configurarse manualmente, por lo que su presencia depende en gran medida de las políticas de seguridad del entorno o dominio.

* **Puertos de WinRM:** WinRM utiliza los puertos TCP 5985 (sobre HTTP) y 5986 (sobre HTTPS) de manera predeterminada.

* **Saturación de Conexiones RDP y SMB en Hydra:** Los servidores RDP y SMB a menudo no manejan bien una gran cantidad de conexiones paralelas. Si realizas fuerza bruta, reduce las tareas usando la bandera `-t 1` o `-t 4` en Hydra, y considera usar los parámetros `-W 1` o `-W 3` para agregar demoras y permitir que el servidor se recupere.

* **Errores de SMBv3 con Hydra:** Si durante un ataque de SMB con Hydra obtienes un error del tipo "invalid reply from target", suele deberse a que posees una versión antigua que no maneja correctamente las respuestas de SMBv3. Como alternativa a la recompilación de la herramienta, se aconseja utilizar el módulo `auxiliary/scanner/smb/smb_login` de Metasploit.

* **Confusión de Conceptos SMB:** Es común referirse erróneamente a SMB como un "sistema de archivos", cuando en realidad es el protocolo responsable de implementar la transferencia, compartición de carpetas y servicios de impresión en redes de área local, comparable a NFS en Unix/Linux.