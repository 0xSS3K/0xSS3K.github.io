---
tags:
  - linux
  - enum
  - privex
---
## Conceptos Clave (TL;DR)
* Las credenciales suelen encontrarse en archivos de configuracion (.conf, .config, .xml), scripts de consola, historial de bash, archivos de respaldo (.bak), bases de datos y archivos de texto.
* Estas credenciales son utiles para escalar privilegios hacia otros usuarios o root, asi como para acceder a bases de datos y otros sistemas dentro del entorno.
* El directorio /var tipicamente contiene la raiz web, la cual puede almacenar credenciales de bases de datos que permiten mayor acceso.
* Las llaves privadas SSH de otros usuarios con mayores privilegios pueden ser utilizadas para acceder al mismo sistema u otros hosts en el entorno.
* El archivo known_hosts contiene una lista de llaves publicas de los hosts a los que el usuario se ha conectado, siendo vital para el movimiento lateral.

## Herramientas Clave

* **grep**: Utilizado para buscar patrones o variables especificas de configuracion dentro de archivos individuales.
* **find**: Utilizado para localizar archivos especificos (como archivos de configuracion) de forma recursiva a traves del sistema de archivos.
* **ls**: Utilizado para listar el contenido de directorios ocultos clave, en este caso para descubrir archivos relacionados con SSH.

## Metodologia Paso a Paso
### Fase 1: Búsqueda de Archivos de Configuración y Credenciales
El objetivo es localizar archivos que comunmente almacenan informacion sensible. Se debe buscar en la raiz web (usualmente en /var) configuraciones como las de WordPress, asi como en directorios de correo o spool si estan accesibles.
### Fase 2: Extracción de Credenciales en Texto Claro
Una vez identificados los archivos de configuracion, se procede a leer su contenido buscando patrones especificos como cadenas de conexion a bases de datos (ej. credenciales de MySQL).
### Fase 3: Enumeracion de Llaves SSH para Movimiento Lateral
Consiste en buscar por todo el sistema llaves privadas SSH accesibles pertenecientes a otros usuarios. Al encontrar una llave, es imperativo revisar el archivo known_hosts para identificar a que sistemas remotos se puede acceder utilizando dicha llave para ejecutar movimiento lateral o escalar privilegios.

## Cheat Sheet de Comandos

```bash
# Busca las variables comunes de base de datos dentro de un archivo de configuracion especifico.
grep 'DB_USER\|DB_PASSWORD' <CONFIG_FILE_PATH>

# Busca archivos cuyo nombre contenga la palabra "config" desde la raiz (/).
# Excluye el directorio /proc (! -path "*/proc/*") para evitar ruido.
# Filtra solo por archivos (-type f) y redirige los errores de permisos a nulo (2>/dev/null).
find / ! -path "*/proc/*" -iname "*config*" -type f 2>/dev/null 

# grep recursivo en el directorio actual
grep -r "DB_USER\|DB_PASSWORD" . 2>/dev/null

# Lista el contenido del directorio .ssh para identificar llaves privadas (ej. id_rsa), llaves publicas y hosts conocidos.
ls ~/.ssh
```

## "Gotchas" y Troubleshooting

* Al utilizar el comando `find` desde la raiz del sistema de archivos, siempre excluye la ruta `/proc` para evitar inundar la salida con errores y resultados irrelevantes.
* Encontrar una llave SSH es solo la mitad del trabajo; siempre debes revisar el archivo `known_hosts` asociado para descubrir los objetivos exactos donde esa llave podria ser valida.
* No subestimes los directorios de spool o de correo; si tienes permisos de lectura sobre ellos, pueden contener informacion valiosa o credenciales directamente expuestas.
* Es comun encontrar credenciales de bases de datos directamente dentro de archivos alojados en la raiz web.