---
tags:
  - spraying
  - userlist
  - AD
---
## Conceptos Clave (TL;DR)

* Para ejecutar un ataque de password spraying exitoso, primero se requiere obtener una lista de usuarios válidos del dominio objetivo.
* Es crítico enumerar y conocer la política de contraseñas (longitud mínima, complejidad, umbral de bloqueos y temporizador) antes de interactuar, para evitar bloquear cuentas accidentalmente en la red del cliente.
* Si no se posee acceso a la red interna o a los servicios del dominio, se pueden construir listas iniciales mediante recursos externos como recolección de correos electrónicos o scraping de LinkedIn.

  
## Herramientas Clave

* **enum4linux**: Enumera información del dominio, incluyendo usuarios, mediante sesiones SMB nulas.
* **rpcclient**: Interactúa con endpoints RPC a través de SMB para listar usuarios mediante conexiones anónimas.
* **[NetExec](../../../📂%2008%20Herramientas&Cheatsheets/NetExec.md)**: Extrae listas de usuarios vía SMB (con o sin credenciales previas) y muestra estadísticas cruciales como intentos fallidos (`badpwdcount`) y fecha de último fallo (`baddpwdtime`).
* **ldapsearch / windapsearch**: Permiten consultar el directorio y extraer usuarios utilizando binds anónimos en el servicio LDAP.
* **Kerbrute**: Enumera cuentas de Active Directory validando usuarios a través de la preautenticación de Kerberos de forma rápida y evadiendo ciertos mecanismos de monitoreo.

  
## Metodología Paso a Paso

1. **Evaluar el Entorno y Política de Contraseñas**: Antes de cualquier intento de login masivo, se debe intentar extraer la política de contraseñas vía SMB nulo, LDAP anónimo o con credenciales comprometidas. Esto determina los tiempos de espera y el límite de intentos.

2. **Enumeración No Autenticada (Red Interna)**: Si no se tienen credenciales, el primer paso lógico es buscar Controladores de Dominio que permitan sesiones SMB nulas o binds anónimos de LDAP para extraer la lista completa y exacta de usuarios del AD.

3. **Fuerza Bruta de Nombres de Usuario (Kerberos)**: Si las consultas anónimas a SMB/LDAP fallan, se recurre a Kerbrute utilizando listas de nombres probables (ej. listas de github). Se envían peticiones TGT sin preautenticación; si el KDC solicita preautenticación, el usuario existe.

4. **Enumeración Autenticada**: Al conseguir cualquier credencial válida de dominio (o acceso SYSTEM en un host Windows), se consulta Active Directory de forma directa para volcar la lista íntegra de usuarios.

5. **Mantenimiento de Bitácoras**: Registrar cuentas objetivo, Controlador de Dominio atacado, fecha, hora y contraseñas utilizadas. Esto evita duplicar esfuerzos y permite entregar información al cliente para cruzar con sus logs ante alertas del sistema.

  
## Cheat Sheet de Comandos
```bash
# Extraer lista limpia de usuarios usando sesión SMB nula con enum4linux

enum4linux -U <TARGET_IP> | grep "user:" | cut -f2 -d"[" | cut -f1 -d"]"
```

```bash
# Conexión anónima mediante rpcclient y comando interactivo para listar usuarios
rpcclient -U "" -N <TARGET_IP>

# Una vez en la consola rpcclient, ejecutar:
enumdomusers
```

```bash
# Enumerar usuarios a través de SMB mostrando badpwdcount (intentos fallidos actuales)
crackmapexec smb <TARGET_IP> --users
```

```bash
# Enumerar usuarios con un bind anónimo usando la herramienta nativa ldapsearch
ldapsearch -h <TARGET_IP> -x -b "DC=<DOMAIN_PART_1>,DC=<DOMAIN_PART_2>" -s sub "(&(objectclass=user))" | grep sAMAccountName: | cut -f2 -d" "
```

```bash
# Extraer usuarios vía LDAP anónimo usando el script windapsearch
./windapsearch.py --dc-ip <TARGET_IP> -u "" -U
```

```bash
# Validar nombres de usuario del dominio utilizando Kerbrute y un diccionario
kerbrute userenum -d <DOMAIN> --dc <TARGET_IP> <PATH_TO_WORDLIST>
```

```bash
# Volcar usuarios del dominio vía SMB utilizando credenciales válidas conocidas
crackmapexec smb <TARGET_IP> -u <USER> -p '<PASSWORD>' --users
```

  
## "Gotchas" y Troubleshooting

* **Contadores de bloqueo descentralizados**: En entornos con múltiples Controladores de Dominio, el valor `badpwdcount` se mantiene de forma separada en cada servidor. Para conocer el total exacto de intentos fallidos de una cuenta, se debe consultar cada DC y sumar los valores, o consultar directamente al DC que posea el rol FSMO de PDC Emulator.

* **Ventaja y Riesgo de Kerbrute**: El modo de enumeración de Kerbrute (`userenum`) no genera fallos de inicio de sesión (Evento 4625) y no bloquea cuentas. Sin embargo, genera Eventos 4768 (Solicitud de TGT), los cuales pueden ser detectados por el SIEM de los defensores.

* **Cuidado al transicionar a Spraying con Kerbrute**: Si se cambia la modalidad de Kerbrute de enumerar a realizar *password spraying*, los intentos fallidos de preautenticación Kerberos sí sumarán al contador de bloqueos de la cuenta y pueden desencadenar un bloqueo.

* **Abuso de cuentas de Computadora**: Si posees acceso SYSTEM en una máquina Windows unida al dominio, puedes consultar Active Directory porque una cuenta de computadora es tratada como una cuenta de usuario del dominio (con ligeras diferencias en confianzas de bosque) y permite la suplantación.

* **Filtrado defensivo en CrackMapExec**: Al usar CrackMapExec, revisa siempre la columna `badpwdcount`. Debes eliminar inmediatamente de tu lista de objetivos a cualquier usuario que esté cerca del umbral de bloqueo de la política de contraseñas.