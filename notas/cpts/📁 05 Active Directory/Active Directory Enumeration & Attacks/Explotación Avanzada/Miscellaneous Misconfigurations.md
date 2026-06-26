---
tags:
  - privex
  - AD
  - printerbug
  - kerberos
  - ldap
  - dns
  - enum
  - gpp
  - gpo
  - AS-REP
---
# Abuso de Permisos en Exchange y PrivExchange

## Conceptos Clave (TL;DR)

* Una instalación por defecto de Microsoft Exchange dentro de AD otorga privilegios masivos al servicio mediante grupos, usuarios y ACLs.
* El grupo "Exchange Windows Permissions" permite escribir una DACL sobre el objeto del dominio, facilitando la obtención de privilegios DCSync.
* El grupo "Organization Management" equivale a un "Domain Admin" en Exchange y tiene control total sobre "Microsoft Exchange Security Groups".
* PrivExchange aprovecha la función "PushSubscription" para forzar al servicio Exchange (que se ejecuta como SYSTEM) a autenticarse contra un equipo controlado por el atacante vía HTTP.
* Esta autenticación puede retransmitirse (Relay) hacia LDAP para extraer toda la base de datos NTDS o hacia otros hosts del dominio.

  
## Herramientas Clave

* Herramientas de volcado de memoria (para extraer credenciales en texto claro de OWA).
* Scripts de PrivExchange y herramientas de Relay (conceptos implícitos en la técnica).

  
## Metodología Paso a Paso

* **Fase 1: Enumeración de grupos:** Identifica usuarios en grupos de Exchange. Personal de soporte o cuentas de computadora suelen estar dentro de "Exchange Windows Permissions".
* **Fase 2: Volcado de credenciales:** Si logras comprometer un servidor Exchange, extrae credenciales cacheadas de OWA en memoria para recolectar hashes NTLM y texto claro.
* **Fase 3: Explotación de PrivExchange:** Con cualquier usuario de dominio válido con buzón, fuerza al servidor a realizar una conexión HTTP contra tu IP y haz un relay hacia el DC para obtener privilegios DCSync.

  
## "Gotchas" y Troubleshooting

* PrivExchange es altamente efectivo en servidores previos al Cumulative Update de 2019, donde el servicio retiene el privilegio WriteDacl por defecto.
* Comprometer un servidor Exchange habitualmente resulta en el compromiso total del dominio.

---
# Printer Bug (MS-RPRN)

## Conceptos Clave (TL;DR)

* Es una vulnerabilidad en el protocolo MS-RPRN (Print System Remote Protocol) que gestiona la comunicación con servidores de impresión.
* Permite a cualquier usuario de dominio forzar al servicio Spooler (ejecutado como SYSTEM) a autenticarse contra el atacante sobre SMB.
* Esta autenticación puede retransmitirse a LDAP para otorgar privilegios DCSync al atacante o configurar delegación basada en recursos (RBCD).

  
## Herramientas Clave

* `SecurityAssessment.ps1` o herramientas en C/Python similares para verificar vulnerabilidad.

  
## Metodología Paso a Paso

* **Fase 1: Verificación:** Emplea scripts de diagnóstico para confirmar si el objetivo es vulnerable y tiene el servicio Spooler activo.
* **Fase 2: Ejecución:** Invoca los métodos RpcOpenPrinter y RpcRemoteFindFirstPrinterChangeNotificationEx para obligar a la máquina a autenticarse en tu equipo.
* **Fase 3: Explotación Cross-Forest:** Si la confianza permite delegación de TGT, puedes usar este ataque para comprometer controladores de dominio en bosques remotos.

  
## Cheat Sheet de Comandos
```powershell
# Importar el modulo de evaluacion de seguridad
Import-Module .\SecurityAssessment.ps1
 

# Comprobar si el servicio Spooler esta activo y vulnerable en el host objetivo
Get-SpoolStatus -ComputerName <TARGET_FQDN>
```

  
## "Gotchas" y Troubleshooting

* El servicio Spooler viene instalado y activado por defecto en servidores Windows con la experiencia de escritorio (Desktop Experience) instalada.

---
# Falsificación de PAC Kerberos (MS14-068)

## Conceptos Clave (TL;DR)

* Vulnerabilidad en Kerberos que permite a un usuario estándar elevarse a Domain Admin falsificando el Privilege Attribute Certificate (PAC).
* El PAC contiene la membresía de grupos del usuario y es firmado por el KDC.
* La falla permite que el KDC acepte un PAC falso como legítimo.

  
## Herramientas Clave

* `PyKEK` (Python Kerberos Exploitation Kit).
* `Impacket`.

  
## Metodología Paso a Paso

* **Fase 1: Falsificación:** Crea un PAC malicioso que afirme que tu usuario estándar pertenece a grupos privilegiados (ej. Domain Administrators).
* **Fase 2: Elevación:** Presenta el ticket manipulado para obtener acceso administrativo sobre los recursos.

  
## "Gotchas" y Troubleshooting

* La única mitigación posible contra este ataque es instalar el parche correspondiente.

---
# Interceptación de Credenciales LDAP

## Conceptos Clave (TL;DR)

* Impresoras, consolas web y aplicaciones de terceros suelen almacenar credenciales LDAP, a menudo privilegiadas, para conectarse al AD.
* Dichas consolas pueden usar contraseñas por defecto, exponer datos en texto claro o incluir funciones vulnerables de "Test Connection".

  
## Herramientas Clave

* `netcat` (nc).

  
## Metodología Paso a Paso

* **Fase 1: Acceso a la consola:** Ingresa a la interfaz de administración del dispositivo y ubica la configuración LDAP.
* **Fase 2: Interceptación:** Modifica la IP del servidor LDAP apuntándola hacia tu IP atacante.
* **Fase 3: Captura:** Levanta un listener y presiona el botón "Probar Conexión" para capturar las credenciales en texto claro.

  
## Cheat Sheet de Comandos

```bash
# Levantar un oyente en el puerto estandar LDAP para capturar el trafico
nc -lvnp 389
```


## "Gotchas" y Troubleshooting

* Algunas aplicaciones se negarán a enviar credenciales a un socket básico y requerirán que montes un servidor LDAP completo (Rogue LDAP) para que el ataque funcione.

---
# Enumeración de Registros DNS

## Conceptos Clave (TL;DR)

* Por defecto, cualquier usuario de dominio puede listar los objetos secundarios de una zona DNS integrada en AD.
* Las consultas LDAP convencionales no devuelven todos los registros, por lo que se requieren herramientas especializadas para extraer la zona completa.
* Permite descubrir servidores ocultos, herramientas internas (ej. Jenkins) y clarificar esquemas de nombres no descriptivos.

  
## Herramientas Clave

* `adidnsdump`.

  
## Metodología Paso a Paso

* **Fase 1: Extracción Base:** Utiliza credenciales válidas para solicitar todos los registros DNS vía LDAP. Algunos resultados pueden aparecer vacíos/desconocidos.
* **Fase 2: Resolución:** Ejecuta la herramienta obligando a que se realicen consultas tipo "A" para descubrir las IPs asociadas a los registros ocultos.

  
## Cheat Sheet de Comandos
```bash
# Volcar los registros DNS del AD y guardarlos en un archivo CSV local
adidnsdump -u <DOMAIN>\\<USER> ldap://<TARGET_IP>
  

# Volcar los registros e intentar resolver los registros en blanco/desconocidos
adidnsdump -u <DOMAIN>\\<USER> ldap://<TARGET_IP> -r
```

  
## "Gotchas" y Troubleshooting

* Al revisar el archivo local `records.csv`, los registros que inicialmente marcaban `?` se actualizarán con las IPs descubiertas si se usó el flag `-r`.

---
# Miscelánea de AD: Descripciones, Atributos y SYSVOL

## Conceptos Clave (TL;DR)

* Es común que los administradores guarden contraseñas en los campos de Descripción o Notas de los objetos de AD.
* El flag `PASSWD_NOTREQD` en `userAccountControl` indica que la cuenta no obedece la política de longitud de contraseñas. Podría tener un password corto, nulo o vacío.
* La carpeta SYSVOL (accesible a todo usuario autenticado) aloja scripts `.bat`, `.vbs` y `.ps1` que a menudo contienen credenciales hardcodeadas de administradores locales o sistemas legacy.

  
## Herramientas Clave

* `PowerView`.
* Comandos base de Windows y PowerShell.
* `CrackMapExec`.

  
## Metodología Paso a Paso

* **Fase 1: Extracción de Campos:** Extrae las descripciones de todos los usuarios y audita visualmente en busca de secretos.
* **Fase 2: Cuentas sin restricción:** Filtra cuentas con el flag `PASSWD_NOTREQD` y verifica si permiten acceso sin contraseña.
* **Fase 3: Búsqueda en Scripts:** Navega el SYSVOL, lee los scripts alojados y extrae contraseñas expuestas. Valídalas contra la red mediante Password Spraying local.

  
## Cheat Sheet de Comandos
```powershell
# Extraer usuarios que tengan informacion en su campo de descripcion
Get-DomainUser * | Select-Object samaccountname,description | Where-Object {$_.Description -ne $null}
  

# Listar usuarios con el atributo de contraseña no requerida
Get-DomainUser -UACFilter PASSWD_NOTREQD | Select-Object samaccountname,useraccountcontrol

  
# Explorar la carpeta de scripts dentro de SYSVOL
ls \\<DOMAIN_CONTROLLER>\SYSVOL\<DOMAIN>\scripts

  
# Leer el contenido de un script especifico en SYSVOL
cat \\<DOMAIN_CONTROLLER>\SYSVOL\<DOMAIN>\scripts\<SCRIPT_NAME>
```

  
## "Gotchas" y Troubleshooting

* Que una cuenta tenga `PASSWD_NOTREQD` no significa que esté en blanco garantizado, sino que puede haber sido un accidente, falta de requerimiento temporal, o un residuo de la instalación de un software de terceros.

---
# Group Policy Preferences (GPP) y Autologon

## Conceptos Clave (TL;DR)

* Cuando se configuran preferencias vía GPO (mapeo de discos, impresoras, admins locales, etc.), se generan archivos XML en el SYSVOL (`Groups.xml`, `drives.xml`, `scheduledtasks.xml`, etc.).
* Contienen el atributo `cpassword` cifrado en AES-256, pero Microsoft hizo pública la llave privada, permitiendo su fácil descifrado.
* Vulnerabilidad parchada en 2014 (MS14-025), pero el parche NO borra los archivos XML preexistentes en la red.
* Configurar "Autologon" en un equipo vía GPO almacena credenciales en `Registry.xml` en texto claro dentro del SYSVOL.

## Herramientas Clave

* `gpp-decrypt`.
* `CrackMapExec` (`gpp_password`, `gpp_autologin`).
* `Get-GPPPassword.ps1` y `Get-GPPAutologon.ps1`.

  
## Metodología Paso a Paso

* **Fase 1: Búsqueda:** Explora el SYSVOL o usa módulos de CME para extraer archivos XML relacionados a GPP y registros de autologin.
* **Fase 2: Descifrado:** En el caso de GPP, toma el string en base64 de `cpassword` y descífralo con la clave AES estática.
* **Fase 3: Password Spray:** Las credenciales descubiertas en GPP muchas veces son antiguas o recicladas. Ejecuta un spray en la red para validar su utilidad.


## Cheat Sheet de Comandos

```bash
# Descifrar manualmente una cpassword obtenida de un XML
gpp-decrypt <ENCRYPTED_CPASSWORD>
  

# Extraer informacion de GPP passwords automaticamente del controlador de dominio
crackmapexec smb <TARGET_IP> -u <USER> -p <PASSWORD> -M gpp_password

  
# Buscar archivos Registry.xml para extraer credenciales en texto claro de Autologon
crackmapexec smb <TARGET_IP> -u <USER> -p <PASSWORD> -M gpp_autologin
```

  
## "Gotchas" y Troubleshooting

* Si un administrador "elimina" la política en lugar de desenlazarla (unlink), la copia vulnerable podría persistir de forma local en los equipos.
* Las credenciales de Autologin suelen pertenecer a kioskos compartidos, guardias de seguridad o máquinas de planta.

---
# ASREP Roasting

## Conceptos Clave (TL;DR)

* Permite obtener el Ticket Granting Ticket (TGT) cifrado de cuentas que tengan la opción "Do not require Kerberos pre-authentication" activada (DONT_REQ_PREAUTH).
* Sin pre-autenticación, el KDC no exige validar la clave con un timestamp. Cualquier usuario puede solicitar los datos de autenticación (AS-REP).
* El AS-REP se cifra utilizando un derivado de la contraseña del usuario objetivo, permitiendo forzar la clave de forma offline.

## Herramientas Clave

* `PowerView`.
* `Rubeus`.
* `Hashcat` / `John the Ripper`.
* `Kerbrute` e `Impacket` (`GetNPUsers.py`).

  
## Metodología Paso a Paso

* **Fase 1: Descubrimiento:** Extrae del dominio los usuarios vulnerables al requerimiento de pre-autenticación.
* **Fase 2: Extracción:** Solicita el ticket AS-REP al DC. Extrae la respuesta formateada de forma segura para cracking.
* **Fase 3: Cracking Offline:** Ejecuta diccionarios y reglas locales contra el material criptográfico para revelar la contraseña en texto claro.

  
## Cheat Sheet de Comandos
```powershell
# Encontrar cuentas con DONT_REQ_PREAUTH usando PowerView
Get-DomainUser -PreauthNotRequired | select samaccountname,userprincipalname,useraccountcontrol | fl

  

# Solicitar el ticket AS-REP y devolverlo en el formato exacto que necesita Hashcat
.\Rubeus.exe asreproast /user:<USER> /nowrap /format:hashcat
```

```bash
# Crackear el hash offline usando Hashcat y una wordlist (Modo 18200)
hashcat -m 18200 <HASH_FILE> <WORDLIST_PATH>

  
# Enumerar usuarios y solicitar automaticamente tickets AS-REP vulnerables
kerbrute userenum -d <DOMAIN> --dc <TARGET_IP> <USER_LIST_PATH>

  
# Buscar desde Linux cuentas sin pre-autenticacion y volcar sus hashes
GetNPUsers.py <DOMAIN>/ -dc-ip <TARGET_IP> -no-pass -usersfile <USER_LIST_PATH>
```


## "Gotchas" y Troubleshooting

* A diferencia del Kerberoasting, NO requieres una cuenta unida al dominio ni un SPN. Solo necesitas conectividad al DC y el nombre de la cuenta.

* Asegúrate de incluir el flag `/nowrap` en Rubeus para evitar que la terminal corte el formato del hash en la salida, lo que arruinaría el ataque en Hashcat.

* Si controlas GenericWrite o GenericAll sobre un usuario temporalmente, puedes ACTIVAR el atributo, extraer el hash y DESACTIVARLO para robar su contraseña discretamente.

---
# Abuso de Objetos de Políticas de Grupo (GPO)

## Conceptos Clave (TL;DR)

* Fallas en las ACLs asignadas a una GPO permiten que atacantes tomen el control de las políticas de dominio aplicadas sobre equipos u OUs enteras.
* Modificar una GPO comprometida sirve para escalar privilegios locales, agregar usuarios, forzar tareas programadas o realizar movimiento lateral a gran escala.

  
## Herramientas Clave

* `PowerView`.
* Cmdlets nativos de AD (`GroupPolicy`).
* `BloodHound`.
* `SharpGPOAbuse`.

  
## Metodología Paso a Paso

* **Fase 1: Enumeración de GPOs:** Lista todas las políticas existentes y comprende su propósito general (ej. políticas restrictivas o creación de usuarios locales).
* **Fase 2: Identificación de ACLs Válidas:** Revisa qué grupos controlados por ti (ej. Domain Users) disponen de permisos como WriteProperty, WriteDacl o WriteOwner sobre una GPO específica.
* **Fase 3: Mapeo de Impacto:** Evalúa en BloodHound los "Affected Objects" para saber a cuántas máquinas u OUs aplica esta GPO antes de hacer cambios.
* **Fase 4: Explotación:** Utiliza una herramienta de inyección de políticas para desplegar tu carga útil (ej. tarea programada con reverse shell, o añadir cuenta de administrador) sobre todas las máquinas en alcance.


## Cheat Sheet de Comandos

```powershell
# Extraer un listado basico de todas las GPOs mediante PowerView
Get-DomainGPO | select displayname

  
# Extraer el mismo listado usando el modulo nativo de Administracion de GPO de Windows
Get-GPO -All | Select DisplayName

  
# Verificar si el grupo "Domain Users" cuenta con algun permiso peligroso sobre alguna GPO
$sid=Convert-NameToSid "Domain Users"

Get-DomainGPO | Get-ObjectAcl | ?{$_.SecurityIdentifier -eq $sid}

  
# Obtener los detalles de la GPO empleando su ID (GUID)
Get-GPO -Guid <GPO_GUID>
```

  
## "Gotchas" y Troubleshooting

* ¡Cuidado con el alcance (Scope)! Si abusas de una GPO vinculada al nivel raíz de la empresa, afectarás a miles de computadoras de golpe, haciendo un ruido brutal e incurriendo en riesgo operativo. Apunta sólo a hosts específicos si tu herramienta lo permite.