---
tags:
  - enum/service
  - MySQL
---
## Conceptos Clave (TL;DR)

* MySQL es un sistema de gestión de bases de datos relacionales basado en SQL que opera bajo el principio cliente-servidor y generalmente escucha en el puerto TCP 3306.
* Es un componente central en stacks de aplicaciones web como LAMP o LEMP, utilizado para almacenar datos de plataformas como WordPress.
* Las inyecciones SQL y los mensajes de error detallados pueden revelar la estructura de la base de datos o ser manipulados para ejecutar comandos a nivel de sistema operativo.

  
## Herramientas Clave

* [Nmap](../../../📂%2008%20Herramientas&Cheatsheets/Nmap.md): Utilizado para la detección inicial del servicio, extracción de versiones y ejecución de scripts agresivos de enumeración (fuerza bruta, usuarios, bases de datos).
* **Cliente MySQL (`mysql`)**: Herramienta nativa de línea de comandos para autenticarse e interactuar de forma estructurada con el motor de base de datos.

  
## Metodología Paso a Paso

1. **Descubrimiento y Escaneo**: Iniciar escaneos sobre el puerto 3306 utilizando scripts automatizados para identificar configuraciones erróneas comunes, como cuentas por defecto o contraseñas en blanco.

2. **Validación Manual de Accesos**: Dado que las herramientas automatizadas pueden arrojar falsos positivos (como reportar contraseñas vacías incorrectamente), se debe intentar el inicio de sesión manual para confirmar el acceso.

3. **Enumeración Interna (Post-Autenticación)**: Una vez conectado, listar las bases de datos disponibles. Se debe prestar especial atención a bases de datos de información (`information_schema`, `sys`) y esquemas propios de las aplicaciones alojadas para extraer tablas y registros.

  
## Configuraciones Inseguras

* **Credenciales en texto claro**: Las opciones `user`, `password` y `admin_address` suelen configurarse en texto claro dentro de archivos como `/etc/mysql/mysql.conf.d/mysqld.cnf`. Si los permisos del archivo son débiles, cualquier lectura local compromete la base de datos.

* **Verbosidad excesiva (`debug`, `sql_warnings`)**: Estas opciones devuelven errores detallados a la aplicación que, si no se filtran, entregan a un atacante la información necesaria para explotar vulnerabilidades de inyección.

* **Exposición pública**: Un servidor MySQL accesible desde internet suele ser producto de configuraciones temporales olvidadas o soluciones alternativas ("workarounds") de administradores, representando una grave falla arquitectónica.

* **Importación/Exportación sin restricciones (`secure_file_priv`)**: Controla las capacidades de lectura y escritura de archivos desde el motor SQL hacia el sistema operativo subyacente. Si está mal configurado, permite el compromiso del sistema de archivos.

  
## Cheat Sheet de Comandos
```bash
# Escaneo de versión, scripts por defecto y scripts específicos de MySQL en el puerto 3306
sudo nmap <TARGET_IP> -sV -sC -p3306 --script mysql*
 

# Conectarse al servidor MySQL remoto con un usuario sin contraseña
mysql -u <USER> -h <TARGET_IP>

  
# Conectarse al servidor MySQL remoto especificando una contraseña
# IMPORTANTE: NO dejar espacio entre -p y la contraseña (ej. -pP4ssw0rd)
mysql -u <USER> -p<PASSWORD> -h <TARGET_IP>

  
# Extraer el archivo de configuración por defecto de MySQL en sistemas Linux (requiere acceso a lectura local)
cat /etc/mysql/mysql.conf.d/mysqld.cnf
```

  

### Comandos Internos de MySQL (Consola SQL)
```sql
-- Mostrar todas las bases de datos disponibles en el servidor
show databases;


-- Obtener la versión exacta del servidor de base de datos
select version();

  
-- Seleccionar una base de datos específica para operar en ella
use <DATABASE_NAME>;

  
-- Listar todas las tablas dentro de la base de datos actualmente seleccionada
show tables;

  
-- Mostrar la estructura y columnas de una tabla específica
show columns from <TABLE_NAME>;

  
-- Extraer absolutamente todos los registros de una tabla específica
select * from <TABLE_NAME>;

  
-- Buscar un valor exacto dentro de una columna específica de una tabla
select * from <TABLE_NAME> where <COLUMN_NAME> = "<STRING_TO_SEARCH>";
```

  

## "Gotchas" y Troubleshooting

* **Falsos positivos de Nmap**: Los scripts `mysql-empty-password` y `mysql-enum` suelen indicar credenciales válidas sin contraseña que en realidad no existen. Verifica siempre de forma manual utilizando el cliente `mysql`.

* **Sintaxis estricta**: En el comando de conexión `mysql -u <USER> -p<PASSWORD>`, cualquier espacio introducido entre `-p` y la contraseña resultará en un fallo de conexión.

* **Perspectiva de archivos locales**: Si comprometes el servidor web subyacente y tienes capacidad de leer archivos (LFI o shell), prioriza leer el archivo de configuración `mysqld.cnf` para obtener las credenciales maestras antes de lanzar ataques ruidosos.

* **Información del Sistema**: Las bases de datos `information_schema` y `sys` son universales. La base de datos `sys` (estándar de ANSI/ISO introducido por Microsoft) condensa la información y metadatos de configuración críticos de `information_schema` de manera más accesible y estructurada.