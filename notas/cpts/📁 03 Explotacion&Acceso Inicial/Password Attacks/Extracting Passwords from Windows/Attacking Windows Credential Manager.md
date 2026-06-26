---
tags:
  - AD
  - password
  - WCM
  - windows
---
## Conceptos Clave (TL;DR)

* Credential Manager (introducido en Server 2008 R2 y Windows 7) permite a usuarios y aplicaciones almacenar de forma segura credenciales de otros sistemas y sitios web.
* Las credenciales se almacenan en carpetas encriptadas especiales dentro de los perfiles de usuario y del sistema (ej. Vault y Credentials).
* Cada carpeta contiene un archivo Policy.vpol con claves AES protegidas por DPAPI, las cuales se usan para encriptar las credenciales.
* Credential Guard, en versiones más nuevas de Windows, protege las claves maestras de DPAPI guardándolas en enclaves de memoria asegurados mediante Virtualization-based Security.
* Almacena "Web Credentials" (asociadas a sitios web y usadas por navegadores heredados) y "Windows Credentials" (tokens para servicios, usuarios de dominio y recursos de red local).


## Herramientas Clave

* **cmdkey**: Enumeración desde línea de comandos de las credenciales almacenadas en el perfil del usuario actual.

* **runas**: Ejecución de comandos asumiendo la identidad de otro usuario, abusando de las credenciales almacenadas de tipo interactivo.

* **rundll32**: Acceso directo a la interfaz gráfica de administración y exportación de credenciales guardadas.

* **Mimikatz**: Extracción de credenciales desde la memoria mediante el módulo sekurlsa o desencriptación manual mediante el módulo dpapi.

* **Alternativas**: SharpDPAPI, LaZagne y DonPAPI también pueden usarse para enumerar y extraer credenciales.

  
## Metodología Paso a Paso

### Fase 1: Enumeración

El primer paso consiste en listar las credenciales accesibles desde el contexto del usuario comprometido. El objetivo es identificar objetivos viables buscando credenciales de tipo "Domain Password" que pertenezcan a otros usuarios o administradores, ignorando entradas genéricas o internas del sistema operativo.


### Fase 2: Impersonación (Uso de credenciales interactivas)

Si se encuentra una credencial de dominio marcada para sesiones de inicio de sesión interactivas, se puede spawnear un proceso bajo el contexto de ese usuario. Al usar una bandera específica, el sistema extraerá la contraseña automáticamente del Credential Manager, permitiendo escalar privilegios o realizar movimientos laterales sin conocer la clave en texto plano.


### Fase 3: Extracción desde Memoria (Dumping)

Si se requiere la contraseña en texto plano y se cuenta con los privilegios adecuados, se inyecta en el proceso LSASS para leer los datos de las credenciales directamente desde la memoria, extrayendo las cuentas y claves asociadas a las sesiones activas en el equipo.

## Cheat Sheet de Comandos

```cmd
# Lanza la ventana "Stored User Names and Passwords" para visualizar, agregar, eliminar o exportar bóvedas a archivos .crd.

rundll32 keymgr.dll,KRShowKeyMgr
```

```cmd
# Lista las credenciales actualmente almacenadas en el sistema para el usuario que ejecuta el comando.

cmdkey /list
```

```cmd
# Inicia una consola (cmd) impersonando a <USER> en <DOMAIN>.

# El flag /savecred le indica al sistema que utilice las credenciales almacenadas sin solicitar contraseña.

runas /savecred /user:<DOMAIN>\<USER> cmd
```

```cmd
# Ejecuta el binario de mimikatz en el equipo comprometido.

mimikatz.exe
  

# Otorga privilegios de depuracion necesarios para interactuar con procesos protegidos como LSASS.

privilege::debug

  
# Extrae la informacion del Credential Manager almacenada en la memoria mediante el modulo sekurlsa.

sekurlsa::credman
```

## "Gotchas" y Troubleshooting

* Credenciales marcadas con "``Local machine persistence``" sobreviven a los reinicios del sistema, lo que las hace confiables para establecer persistencia a largo plazo.

* La entrada `virtualapp/didlogical` es un ID interno para cuentas de Microsoft/Windows Live y normalmente debe ser ignorada durante la enumeración.

* El comando `runas` solo funcionará si la credencial almacenada indica específicamente "interactive", lo que significa que está validada para sesiones de inicio de sesión interactivas.

* En sistemas modernos, la presencia de Credential Guard limitará la extracción de las claves maestras DPAPI, ya que estas residen en enclaves virtualizados fuera del alcance estándar.

* Si se logran exportar bóvedas de Windows en formato `.crd`, es necesario tener en cuenta que estos respaldos están encriptados con una contraseña suministrada por el usuario que realizó el backup originalmente.