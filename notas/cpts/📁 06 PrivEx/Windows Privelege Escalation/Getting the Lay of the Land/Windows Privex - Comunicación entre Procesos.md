---
tags:
  - windows
  - privex
  - enum
---
## Conceptos Clave (TL;DR)

- Los procesos en ejecución (aunque no sean Admin) pueden filtrar privilegios mas altos. Caso clásico: servidor web (IIS/XAMPP) corriendo con un usuario de bajo privilegio que tiene el token `SeImpersonate` habilitado, explotable con Potato exploits (Rogue/Juicy/Lonely Potato) para escalar a SYSTEM.
- Los Access Tokens describen el contexto de seguridad (identidad + privilegios) de un proceso/hilo. Cada interaccion de un usuario con un proceso presenta una copia de este token para validar el nivel de privilegio.
- Buscar servicios en `127.0.0.1` / `::1` que NO escuchan en la IP de red o en `0.0.0.0`. Estos sockets en loopback suelen estar mal asegurados porque se asume que "no son accesibles desde la red".
- Named Pipes son archivos en memoria usados para IPC (Inter-Process Communication), tipo cliente-servidor. Si un pipe tiene permisos laxos (Everyone con FILE_ALL_ACCESS / RW), un usuario de bajo privilegio puede interactuar con un proceso privilegiado (ej. un servicio corriendo como SYSTEM) y escalar privilegios.

## Herramientas Clave

- **netstat**: Enumera conexiones de red activas (TCP/UDP) y los puertos en escucha, local y externamente.
- **PipeList (Sysinternals)**: Lista named pipes abiertos en el sistema.
- **gci (Get-ChildItem) en PowerShell**: Alternativa nativa para listar named pipes sin subir binarios.
- **AccessChk (Sysinternals)**: Enumera permisos (DACL) sobre un recurso securizable (named pipe, proceso, archivo, etc.) — clave para encontrar pipes con permisos mal configurados.

## Metodologia Paso a Paso

### Fase 1: Enumeracion de Servicios de Red
La idea es identificar procesos accesibles via socket de red (DNS, HTTP, SMB, etc.) que puedan estar mal configurados o ser vulnerables, especialmente los que solo escuchan en loopback.

1. Ejecutar `netstat -ano` para ver todas las conexiones TCP/UDP activas junto al PID del proceso.
2. Filtrar resultados buscando puertos en `127.0.0.1` o `::1` que NO aparezcan tambien en la IP de la interfaz de red o en `0.0.0.0`.
3. Identificar el proceso (PID) asociado a ese puerto y mapearlo a un servicio conocido (ej. puerto 14147 = interfaz administrativa de FileZilla Server).
4. Si el puerto pertenece a un servicio conocido vulnerable (FileZilla admin interface, Splunk Universal Forwarder, Erlang/RabbitMQ cookie en 25672), investigar el exploit publico correspondiente.

### Fase 2: Enumeracion de Named Pipes
La logica es encontrar pipes que permitan lectura/escritura al grupo "Everyone" (todos los usuarios autenticados), lo que permitiria interactuar con un proceso privilegiado que escucha en ese pipe.

1. Listar todos los named pipes activos con `pipelist.exe` o `gci \\.\pipe\` (PowerShell, no requiere subir binario).
2. Revisar permisos (DACL) de un pipe especifico con `accesschk.exe` para ver quien tiene acceso de lectura/escritura/control total.
3. Buscar masivamente pipes con permisos de escritura abiertos usando el flag `-w` de accesschk sobre todos los pipes (`\pipe\*`).
4. Si se encuentra un pipe con `Everyone: FILE_ALL_ACCESS` (o RW), investigar el servicio dueño del pipe (ej. WindscribeService) en busca de exploits publicos de privesc conocidos para ese software.

## Cheat Sheet de Comandos

```cmd
:: Muestra todas las conexiones TCP/UDP activas con su PID
:: -a = todas las conexiones, -n = no resolver nombres (mas rapido), -o = mostrar PID del proceso
netstat -ano
```

```cmd
:: Lista los named pipes abiertos en el sistema usando Sysinternals PipeList
:: /accepteula = acepta el EULA automaticamente sin prompt grafico
pipelist.exe /accepteula
```

```powershell
# Lista named pipes activos de forma nativa sin subir binarios externos
# gci = alias de Get-ChildItem
gci \\.\pipe\
```

```cmd
:: Revisa los permisos (DACL) de un named pipe especifico, en este caso lsass
:: /accepteula = acepta el EULA, -v = verbose (muestra detalle de permisos por grupo)
accesschk.exe /accepteula \\.\Pipe\lsass -v
```

```cmd
:: Revisa los permisos DACL de TODOS los named pipes del sistema de una sola vez
:: /accepteula = acepta el EULA
accesschk.exe /accepteula \pipe\.
```

```cmd
:: Busca especificamente pipes que permitan acceso de ESCRITURA (write) a cualquier usuario
:: -w = filtra solo por permisos de escritura, \pipe\* = todos los pipes, -v = verbose
accesschk.exe -w \pipe\* -v
```

```cmd
:: Revisa permisos de un pipe especifico identificado como vulnerable (ej. <PIPE_NAME>)
:: -accepteula = acepta EULA, -w = filtra por permisos de escritura, -v = verbose
accesschk.exe -accepteula -w \pipe\<PIPE_NAME> -v
```

## Gotchas y Troubleshooting

- Al revisar `netstat -ano`, enfocarse SIEMPRE en lo que escucha en `127.0.0.1` / `::1` y que NO aparece tambien escuchando en la IP real de la maquina (`<TARGET_IP>`) o en `0.0.0.0` / `[::]`. Esa es la senal de un servicio "olvidado" porque se asumio que loopback era seguro.
- El puerto **14147** en loopback es la interfaz administrativa de **FileZilla Server**: conectandose se pueden extraer credenciales FTP y crear un FTP Share en `c:\` corriendo como el usuario de FileZilla Server (potencialmente Administrator).
- **Splunk Universal Forwarder**: por defecto NO requiere autenticacion y permite desplegar apps -> ejecucion de codigo. Corre como `SYSTEM` por defecto. Buscar herramientas tipo "SplunkWhisperer2".
- **Erlang Port (25672)**: usado por apps tipo SolarWinds, RabbitMQ, CouchDB. El "cookie" que autentica el join al cluster Erlang suele ser debil (RabbitMQ usa `rabbit` por defecto) o estar en un archivo de configuracion con permisos pobres.
- Cobalt Strike usa named pipes con nombres por defecto como `\.\pipe\msagent_12`; operadores de Red Team suelen camuflar el nombre (ej. usar `mojo` simulando trafico de Chrome). Si se encuentra un pipe tipo `mojo` en una maquina SIN Chrome instalado, puede ser indicio de actividad de Red Team interno (no confundir con un atacante real).
- Los named pipes pueden ser half-duplex (cliente solo escribe) o duplex (bidireccional); cada nueva conexion a un pipe server crea una nueva instancia con el mismo nombre pero buffer de datos distinto — esto es relevante al interpretar el campo "Instances" en PipeList.
- El proceso LSASS, por diseno correcto, solo otorga `FILE_ALL_ACCESS` a `BUILTIN\Administrators`; si se encuentra un pipe critico (no LSASS) con permisos similares otorgados a `Everyone`, es una bandera roja de privesc explotable (caso de ejemplo real: WindscribeService Named Pipe Privilege Escalation).
- Requisito previo para usar AccessChk/PipeList: ambas son herramientas de Sysinternals, no nativas de Windows -> hay que subirlas al objetivo (salvo la alternativa nativa `gci \\.\pipe\` en PowerShell para listar, que no requiere binario externo, aunque no reemplaza la funcionalidad de revision de permisos DACL de accesschk).