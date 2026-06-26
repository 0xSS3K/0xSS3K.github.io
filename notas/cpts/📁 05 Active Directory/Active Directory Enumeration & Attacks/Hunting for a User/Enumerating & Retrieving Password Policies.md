---
tags:
  - AD
  - enum
  - password
  - poli
---
## Conceptos Clave (TL;DR)

* Obtener la política de contraseñas del dominio es un paso crítico antes de ejecutar un ataque de password spraying.
* Conocer la política permite identificar la longitud mínima de la contraseña, los requisitos de complejidad, el umbral de bloqueo de cuenta y la duración de dicho bloqueo.
* Esta enumeración se puede lograr tanto si se poseen credenciales válidas del dominio, como si no se poseen, utilizando configuraciones heredadas inseguras como SMB NULL sessions o LDAP Anonymous Binds.
* El objetivo principal de conocer estos límites es evitar el bloqueo de cuentas, lo cual puede interrumpir operaciones legítimas y alertar a los administradores.

### Herramientas Clave

* **[NetExec](../../../📂%2008%20Herramientas&Cheatsheets/NetExec.md)** Herramienta versátil para enumerar políticas vía SMB, tanto con credenciales como mediante sesiones nulas.
* **rpcclient:** Utilidad para interactuar con endpoints RPC de Windows, útil para verificar acceso de sesión nula y extraer políticas.
* **enum4linux / enum4linux-ng:** Herramientas integrales basadas en Samba para la enumeración de hosts y dominios Windows. La versión "ng" permite exportar resultados a formatos YAML o JSON.
* **ldapsearch:** Herramienta de línea de comandos para consultar directorios LDAP, útil cuando se permite el "anonymous bind".
* **net.exe:** Binario nativo de Windows para recuperar la política localmente si se tiene acceso a un host del dominio.
* **PowerView:** Módulo de PowerShell utilizado para la enumeración avanzada de dominios de Active Directory.

### Metodología Paso a Paso

1. **Fase 1: Enumeración con Credenciales (Si están disponibles)**    Si ya posees un usuario y contraseña válidos, puedes consultar directamente el controlador de dominio para extraer la política de contraseñas utilizando herramientas desde Linux (como CrackMapExec) o desde un equipo Windows.
2. **Fase 2: Enumeración sin Credenciales (SMB NULL Session / LDAP Anonymous Bind)**    Si no posees credenciales, debes probar vectores no autenticados. Primero, intenta establecer una sesión nula vía SMB, lo cual es común en controladores de dominio antiguos o actualizados sobre versiones vulnerables. Si esto falla, intenta un LDAP anonymous bind, una configuración legacy que a veces se mantiene por compatibilidad de aplicaciones.
3. **Fase 3: Análisis de la Política para Password Spraying**    Una vez obtenida la información, analiza el umbral de bloqueo (ej. 5 intentos) y el tiempo de expiración (ej. 30 minutos). Esto dictará tu cadencia de ataque; por ejemplo, si el umbral es 5, puedes realizar 2 o 3 intentos seguros cada 31 minutos.

### Cheat Sheet de Comandos

#### Desde Linux - Con Credenciales

```bash
# Obtener la política de contraseñas usando credenciales válidas

crackmapexec smb <TARGET_IP> -u <USER> -p <PASSWORD> --pass-pol
```

#### Desde Linux - SMB NULL Sessions (Sin Credenciales)

```bash
# Conexión interactiva usando rpcclient con sesión nula (usuario vacío, sin contraseña)

rpcclient -U "" -N <TARGET_IP>
```

```bash
# Comandos internos de rpcclient para obtener info del dominio y contraseñas

rpcclient $> querydominfo

rpcclient $> getdompwinfo
```

```bash
# Extracción de políticas usando enum4linux

enum4linux -P <TARGET_IP>
```

```bash
# Extracción usando enum4linux-ng y guardando el output en formato JSON/YAML

enum4linux-ng -P <TARGET_IP> -oA <OUTPUT_NAME>
```

#### Desde Linux - LDAP Anonymous Bind (Sin Credenciales)

```bash
# Consultar la política de contraseñas a través de LDAP sin autenticación

# Nota: Adaptar DC=DOMAIN,DC=TLD a los valores reales del dominio.

# Nota: En versiones nuevas de ldapsearch se usa -H en lugar de -h

ldapsearch -h <TARGET_IP> -x -b "DC=<DOMAIN>,DC=<TLD>" -s sub "*" | grep -m 1 -B 10 pwdHistoryLength
```

#### Desde Windows - Con o Sin Credenciales

```cmd
# Intentar establecer una sesión nula desde Windows

net use \\<TARGET_IP>\ipc$ "" /u:""
  

# Obtener la política de contraseñas localmente (requiere acceso al host)

net accounts
```

```powershell
# Obtener la política de contraseñas usando PowerView

import-module .\PowerView.ps1

Get-DomainPolicy
```

### "Gotchas" y Troubleshooting

* **Origen de Vulnerabilidades SMB/LDAP:** Las configuraciones de SMB NULL session a menudo existen por actualizaciones in-place de controladores de dominio legados. Por otro lado, LDAP anonymous bind es legacy (previo a Windows Server 2003) pero puede estar habilitado a propósito por administradores para ciertas aplicaciones.
* **Parámetro Deprecado:** En versiones recientes de `ldapsearch`, el parámetro `-h` está deprecado; se debe utilizar `-H` (ej. `-H ldap://<TARGET_IP>`).
* **Errores de Autenticación en Windows (net use):**   \* **System error 1331:** La cuenta de usuario está deshabilitada.   \* **System error 1326:** El nombre de usuario o la contraseña son incorrectos.   \* **System error 1909:** La cuenta referenciada está actualmente bloqueada.
* **Política Desconocida:** Si no logras obtener la política por ningún medio y el cliente no la provee, extrema las precauciones. Realiza máximo 1 o 2 intentos de password spraying y espera más de una hora entre cada intento para evitar bloqueos.
* **Bloqueos Manuales:** Aunque lo común es que las cuentas se desbloqueen automáticamente tras la ventana de tiempo (ej. 30 minutos), algunas organizaciones configuran el dominio para requerir intervención manual de un administrador para el desbloqueo. Debes evitar a toda costa causar esta situación.
