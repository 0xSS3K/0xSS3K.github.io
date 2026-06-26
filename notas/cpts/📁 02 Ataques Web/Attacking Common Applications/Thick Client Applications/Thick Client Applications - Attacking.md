---
tags:
  - webapp
  - thickclient
  - attack
---
## Conceptos Clave (TL;DR)

- Las thick client applications procesan datos localmente (no en servidor), se desarrollan en Java, C++, .NET o Silverlight y se dividen en arquitectura **two-tier** (app comunica directo con DB) o **three-tier** (app -> servidor de aplicacion -> DB via HTTP/HTTPS). La arquitectura three-tier es mas segura porque impide acceso directo a la DB.
- Los vectores de ataque principales son: credenciales hardcodeadas en binarios/codigo fuente, DLL Hijacking, Buffer Overflow, SQL Injection, Insecure Storage y Session Management. XSS, CSRF y Clickjacking NO aplican.
- El flujo de ataque sigue cuatro fases: **Information Gathering** (arquitectura, tecnologias, entry points) -> **Client-Side Attacks** (analisis estatico y dinamico, credenciales en memoria/disco) -> **Network Side Attacks** (captura de trafico) -> **Server-Side Attacks** (OWASP Top Ten).
- Los binarios .NET o Java pueden ocultarse dentro de otros ejecutables como datos base64. La tecnica de **memory dump + strings + deobfuscacion** permite recuperar el ejecutable interno y leer el codigo fuente con dnSpy o JADX.

---

## Herramientas Clave

|Herramienta|Proposito en este vector|
|---|---|
|**CFF Explorer**|Inspeccion de headers PE, imports/exports y metadatos de ejecutables|
|**Detect It Easy (DIE)**|Identificar lenguaje/compilador/packer de un binario|
|**Process Monitor (ProcMon64)**|Monitorizar operaciones de fichero, registro y red en tiempo real|
|**Strings / strings64.exe**|Extraer cadenas ASCII/Unicode de binarios y dumps de memoria|
|**x64dbg**|Depurador dinamico para binarios PE (32/64-bit); permite hacer memory dump|
|**de4dot**|Desofuscador y decompilador de ensamblados .NET|
|**dnSpy**|Decompilador y depurador de .NET; muestra codigo fuente C#/VB desde el binario|
|**Ghidra / IDA / Radare2 / OllyDbg**|Ingenieria inversa estatica y dinamica para binarios no-.NET|
|**JADX / Frida**|Decompilacion y hooking dinamico de aplicaciones Java/Android|
|**Wireshark / tcpdump**|Captura de trafico de red (HTTP, TCP, UDP)|
|**TCPView**|Vista en tiempo real de conexiones TCP/UDP activas en Windows|
|**Burp Suite**|Proxy para interceptar y manipular trafico HTTP/HTTPS de la thick client|

---

## Metodologia Paso a Paso

### Fase 1 - Information Gathering

**Objetivo:** entender la arquitectura (two-tier vs three-tier), el lenguaje/framework del binario y los entry points disponibles antes de tocar nada.

1. Identificar el tipo de ejecutable y tecnologia con **Detect It Easy** o **CFF Explorer**.
2. Ejecutar el binario y monitorizar con **ProcMon64** para ver que ficheros, claves de registro y conexiones crea.
3. Extraer strings iniciales con **strings64.exe** para buscar rutas, URLs, credenciales o identificadores de tecnologia (e.g., `.NETFramework`).

### Fase 2 - Client-Side Attacks (Static + Dynamic Analysis)

**Objetivo:** encontrar credenciales hardcodeadas, logica oculta o binarios embebidos que el ejecutable principal desempaqueta en disco o memoria.

1. **Capturar ficheros temporales:** cambiar permisos de la carpeta `%TEMP%` para impedir la eliminacion automatica de ficheros (desmarcar Delete y Delete subfolders and files en la ACL). Volver a ejecutar el binario y recoger los ficheros `.bat`, `.ps1`, `.txt` generados antes de que se autoeliminan.
2. **Analizar el batch/script:** leer el contenido del `.bat` para identificar si ensambla un ejecutable desde chunks de base64, lo escribe a disco y lo ejecuta. Modificar el script eliminando los comandos `del` para conservar los artefactos intermedios.
3. **Ejecutar el script modificado y recuperar el ejecutable reconstruido:** ejecutar el `.ps1` manualmente para obtener el binario final (`restart-service.exe` en el ejemplo).
4. **Memory dump con x64dbg:**
    - Abrir x64dbg -> Options -> Preferences -> dejar activo solo **Exit Breakpoint** (evita parar en DLLs de carga).
    - File -> Open -> cargar el ejecutable.
    - En la vista CPU -> boton derecho -> **Follow in Memory Map**.
    - Buscar regiones de tipo **MAP** con proteccion **-RW--** y tamano relevante (indicio de fichero mapeado en memoria).
    - Doble clic en la region -> verificar magic bytes `MZ` en la columna ASCII.
    - Boton derecho sobre la entrada en Memory Map -> **Dump Memory to File** -> guardar el `.bin`.
5. **Analizar el dump:**
    - Correr `strings64.exe` sobre el `.bin` para confirmar si contiene un ejecutable .NET u otro formato.
    - Si es .NET, pasar el `.bin` por **de4dot** (arrastrar el fichero al ejecutable de de4dot) para limpiar la ofuscacion y generar un `-cleaned.bin`.
    - Abrir el `-cleaned.bin` en **dnSpy** para leer el codigo fuente C# y localizar credenciales hardcodeadas, logica de autenticacion o llamadas a servicios.

### Fase 3 - Network Side Attacks

**Objetivo:** capturar credenciales o tokens transmitidos entre la thick client y el servidor.

1. Configurar **Burp Suite** como proxy si la aplicacion usa HTTP/HTTPS.
2. Usar **Wireshark** o **tcpdump** para protocoles no-HTTP (TCP/UDP raw).
3. Usar **TCPView** para identificar a que endpoints se conecta la aplicacion en tiempo real.

### Fase 4 - Server-Side Attacks

**Objetivo:** probar los endpoints del servidor con las mismas tecnicas de web app (OWASP Top Ten): SQL Injection, IDOR, Command Injection, etc., una vez identificados en las fases anteriores.

---

## Cheat Sheet de Comandos

### Informacion inicial del binario (Windows)

```powershell
# Listar ficheros en un share SMB descubierto previamente
dir \\<TARGET_IP>\NETLOGON

# Ejecutar el binario sospechoso para observar comportamiento inicial
C:\Apps> .\<TARGET_BINARY>.exe
```

### Captura de artefactos temporales - modificar ACL de %TEMP%

```powershell
# Ver permisos actuales de la carpeta Temp del usuario objetivo
icacls "C:\Users\<USER>\AppData\Local\Temp"

# Listar contenido de la subcarpeta Temp\2 tras re-ejecutar el binario
dir "C:\Users\<USER>\AppData\Local\Temp\2"
```

> El paso critico de ACL se hace por GUI: Propiedades de la carpeta Temp -> Seguridad -> Avanzado -> <USER> -> Deshabilitar herencia -> Convertir en permisos explicitos -> Editar -> Mostrar permisos avanzados -> DESMARCAR "Eliminar subcarpetas y archivos" y "Eliminar" -> OK -> Aplicar.

### Leer y modificar el batch script para retener artefactos

```batch
REM Ver el contenido del batch generado
type "C:\Users\<USER>\AppData\Local\Temp\2\<RANDOM>.bat"

REM Abrir el batch en notepad para editar (eliminar las lineas "del")
notepad "C:\Users\<USER>\AppData\Local\Temp\2\<RANDOM>.bat"
```

### Ejecutar el script PowerShell de reconstruccion manualmente

```powershell
# El script lee oracle.txt (base64), concatena las lineas, decodifica y escribe el EXE resultante
$salida = $null
$fichero = (Get-Content C:\ProgramData\oracle.txt)
foreach ($linea in $fichero) { $salida += $linea }
$salida = $salida.Replace(" ","")
[System.IO.File]::WriteAllBytes("C:\ProgramData\<OUTPUT_BINARY>.exe", [System.Convert]::FromBase64String($salida))

# Verificar que el ejecutable reconstruido existe en disco
ls C:\ProgramData\
```

### Strings sobre binarios y dumps

```powershell
# Extraer strings del ejecutable original (buscar rutas, URLs, credenciales, identificadores de tecnologia)
C:\TOOLS\Strings\strings64.exe .\<TARGET_BINARY>.exe

# Extraer strings del dump de memoria exportado desde x64dbg
# Confirma si contiene .NETFramework u otro indicador de tecnologia
C:\TOOLS\Strings\strings64.exe .\<MEMORY_DUMP>.bin
```

### Desofuscacion .NET con de4dot

```cmd
REM Arrastrar el .bin al ejecutable de de4dot, o ejecutarlo por CLI
REM Genera un fichero -cleaned.bin con simbolos renombrados y ofuscacion eliminada
de4dot.exe .\<MEMORY_DUMP>.bin

REM El output sera: <MEMORY_DUMP>-cleaned.bin
```

### Abrir el binario limpio en dnSpy (GUI)

```powershell
# Lanzar dnSpy y abrir el fichero limpio para leer el codigo fuente C#
# No hay CLI para esto; se hace desde la interfaz grafica:
# File -> Open -> seleccionar <MEMORY_DUMP>-cleaned.bin
# Navegar por el arbol de namespaces/clases hasta localizar credenciales hardcodeadas
.\dnSpy.exe
```

### Workflow completo de extraccion de credenciales desde SMB

```powershell
# 1. Descargar el ejecutable desde el share SMB
copy \\<TARGET_IP>\NETLOGON\<TARGET_BINARY>.exe C:\Apps\

# 2. Ejecutar y monitorizar con ProcMon64 (GUI) para identificar ficheros temporales

# 3. Cambiar ACL del directorio Temp para retener ficheros (ver paso GUI arriba)

# 4. Re-ejecutar el binario y capturar el batch generado
.\<TARGET_BINARY>.exe
dir "C:\Users\<USER>\AppData\Local\Temp\2"

# 5. Leer el batch, eliminar los comandos "del" y ejecutarlo
type "C:\Users\<USER>\AppData\Local\Temp\2\<RANDOM>.bat"
# Editar: quitar las lineas: del c:\programdata\monta.ps1 / del c:\programdata\oracle.txt / del c:\programdata\restart-service.exe
"C:\Users\<USER>\AppData\Local\Temp\2\<RANDOM_MODIFIED>.bat"

# 6. Verificar que los artefactos existen en C:\ProgramData\
ls C:\ProgramData\
# Esperado: oracle.txt (base64), monta.ps1, <RECONSTRUCTED_BINARY>.exe

# 7. Extraer strings del ejecutable reconstruido
C:\TOOLS\Strings\strings64.exe C:\ProgramData\<RECONSTRUCTED_BINARY>.exe

# 8. Si es .NET -> memory dump con x64dbg (ver metodologia Fase 2, paso 4)
# 9. Strings sobre el dump para confirmar .NET
C:\TOOLS\Strings\strings64.exe .\<MEMORY_DUMP>.bin

# 10. Desofuscar con de4dot
de4dot.exe .\<MEMORY_DUMP>.bin
# Output: <MEMORY_DUMP>-cleaned.bin

# 11. Abrir -cleaned.bin en dnSpy -> leer credenciales hardcodeadas en codigo fuente
```

---

## "Gotchas" y Troubleshooting

- **Los nombres de ficheros temporales son aleatorios en cada ejecucion.** El batch (e.g., `6F39.bat`) y el `.tmp` asociado reciben nombres distintos cada vez. No hardcodees el nombre; busca por extension o fecha de modificacion reciente con `dir /OD`.
- **Sin modificar la ACL, los artefactos se autoeliminan antes de poder leerlos.** La ACL debe estar en lugar ANTES de ejecutar el binario. El batch borra `monta.ps1`, `oracle.txt` y el ejecutable reconstruido al terminar.
- **La validacion de usuario esta hardcodeada en el batch.** El script original comprueba `%username%` contra una lista blanca (`matt`, `frankytech`, `ev4si0n`). Si tu usuario no esta en la lista, el batch salta al bloque `:error` y no genera los artefactos. Solucion: ejecutar el batch modificado directamente (ya que has eliminado esa comprobacion junto con los `del`) o renombrar temporalmente la sesion.
- **En x64dbg, dejar activos System Breakpoint o Entry Breakpoint hace que el depurador pare en DLLs de carga del sistema**, lo que dificulta llegar al punto de interes. Dejar solo **Exit Breakpoint** acelera el proceso.
- **La region de memoria a buscar en x64dbg es tipo MAP con proteccion -RW--.** Las regiones de tipo MEM o con proteccion diferente (-RX--, etc.) suelen corresponder al propio ejecutable o a DLLs del sistema, no a ficheros mapeados en memoria por la aplicacion.
- **Los magic bytes `MZ` en la columna ASCII del Memory Dump view** son el indicador de que la region contiene un ejecutable PE embebido. Sin ese indicador, la region probablemente no es de interes.
- **de4dot puede no reconocer el obfuscador** (imprime "Detected Unknown Obfuscator") pero aun asi limpia y renombra simbolos. El binario resultante `-cleaned.bin` es igualmente util para dnSpy.
- **dnSpy solo funciona con ensamblados .NET.** Si `strings64.exe` no muestra `.NETFramework` en el dump, usar Ghidra, IDA o Radare2 para la ingenieria inversa.
- **El escenario asume acceso previo a SMB.** El punto de entrada es el share `NETLOGON` expuesto. Sin ese acceso inicial, este vector no aplica directamente.
- **Arquitectura three-tier:** si la thick client se comunica con un servidor intermedio via HTTP/HTTPS, proxear el trafico con Burp Suite antes del analisis estatico/dinamico para mapear todos los endpoints del servidor antes de atacar el lado cliente.