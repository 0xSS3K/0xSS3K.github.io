---
tags:
  - mitigation
  - fileupload
---
## Conceptos Clave (TL;DR)

- La validacion de extension por si sola es insuficiente; siempre debe combinarse con validacion de contenido (MIME type + file signature).
- El enfoque mas robusto combina blacklist + whitelist: la blacklist cubre bypasses de la whitelist (ej. `shell.php.jpg`) y la whitelist restringe al conjunto permitido.
- Exponer el directorio de uploads directamente es un riesgo critico; los archivos deben servirse unicamente a traves de un script controlado (`download.php`) con headers de seguridad apropiados.
- Si un atacante logra RCE, el dano debe contenerse: desactivar funciones peligrosas en el interprete (ej. `disable_functions` en PHP) y aislar el servidor de uploads limita el radio de explosion.

---

## Herramientas Clave

| Herramienta / Mecanismo | Proposito en este contexto |
|---|---|
| `preg_match` (PHP) | Validacion de extension via regex (blacklist y whitelist) |
| `mime_content_type()` (PHP) | Lectura del MIME type real del archivo desde el servidor |
| `$_FILES['uploadFile']['type']` | Lectura del Content-Type enviado por el cliente (no confiable por si solo) |
| `php.ini` / `disable_functions` | Deshabilitar funciones de ejecucion de comandos del sistema en PHP |
| `open_basedir` (PHP) | Restringir el acceso del interprete PHP a directorios especificos |
| WAF (Web Application Firewall) | Capa secundaria de proteccion ante bypasses de validacion |

---

## Metodologia Paso a Paso

### Fase 1: Validacion de Extension (Back-end)

Implementar doble validacion: primero blacklist, luego whitelist. La blacklist busca la extension en cualquier parte del nombre del archivo. La whitelist verifica que el nombre TERMINE con la extension permitida. Ambas deben aplicarse en el back-end; la validacion front-end es complementaria y reduce ruido, pero es trivialmente bypasseable.

**Logica:** Un atacante puede nombrar su shell `shell.php.jpg`. La whitelist que solo verifica el final del nombre dejaria pasar `.jpg`. La blacklist detectaria `.php` en cualquier posicion del nombre y bloquearia el archivo antes de que la whitelist lo apruebe.

### Fase 2: Validacion de Contenido (MIME + File Signature)

No confiar en la extension ni en el `Content-Type` del cliente. Leer el MIME type real del archivo desde el servidor con `mime_content_type()` y validar que coincida con lo esperado. Verificar ambos: el header HTTP del cliente y la firma real del archivo.

**Logica:** Un atacante puede cambiar el `Content-Type` de la peticion a `image/png` y renombrar su webshell a `.png`. La firma del archivo (magic bytes) revelara que el contenido no es una imagen PNG real.

### Fase 3: Controlar la Exposicion del Directorio de Uploads

- El directorio de uploads no debe ser accesible directamente; cualquier peticion directa debe retornar `403 Forbidden`.
- Implementar un script `download.php` como unico punto de acceso a los archivos subidos.
- El script debe aplicar: verificacion de autorizacion (previene IDOR), validacion estricta de rutas (previene LFI/path traversal), y una allowlist de archivos/directorios accesibles.

**Logica:** Incluso si un atacante logra subir una webshell, si no puede acceder a la URL donde esta almacenada, no puede ejecutarla.

### Fase 4: Anonimizacion y Aislamiento de Archivos

- Guardar los archivos con nombres aleatorios (UUID, hash) en el servidor.
- Almacenar el nombre original "saneado" en base de datos.
- El script `download.php` resuelve el nombre original desde la BD al momento de la descarga.

**Logica:** Previene que el atacante conozca la ruta exacta de su archivo subido y mitiga vulnerabilidades de inyeccion en nombres de archivo (ej. command injection via filename).

### Fase 5: Endurecimiento del Servidor / Interprete

- Deshabilitar funciones peligrosas de ejecucion de sistema en el interprete.
- Configurar `open_basedir` para confinar al interprete a su directorio.
- Aislar el servidor de uploads en un contenedor o servidor separado.
- Suprimir mensajes de error del sistema; manejar errores a nivel de aplicacion con mensajes genericos.

**Logica:** Si todas las capas anteriores fallan, estas medidas limitan lo que un atacante puede hacer tras lograr ejecucion de codigo (defense-in-depth).

### Fase 6: Medidas Adicionales (Checklist Final)

- Limitar el tamano maximo de archivo permitido.
- Mantener librerias de procesamiento de archivos actualizadas.
- Escanear archivos subidos con antivirus/herramientas de deteccion de malware.
- Desplegar un WAF como ultima linea de defensa.

---

## Cheat Sheet de Comandos

### Validacion de Extension en PHP (Blacklist + Whitelist)

```php
<?php
$fileName = basename($_FILES["uploadFile"]["name"]);

# BLACKLIST: Bloquea si el nombre del archivo contiene extensiones PHP peligrosas
# en cualquier posicion. Cubre bypasses como shell.php.jpg
if (preg_match('/^.*\.ph(p|ps|ar|tml)/', $fileName)) {
    echo "Only images are allowed";
    die();
}

# WHITELIST: Permite el archivo solo si TERMINA con una extension de imagen valida
# El $ al final del regex ancla la comparacion al fin del string
if (!preg_match('/^.*\.(jpg|jpeg|png|gif)$/', $fileName)) {
    echo "Only images are allowed";
    die();
}
?>
```

### Validacion de Contenido en PHP (Extension + MIME type del cliente + MIME type del servidor)

```php
<?php
$fileName    = basename($_FILES["uploadFile"]["name"]);
$contentType = $_FILES['uploadFile']['type'];          // MIME del cliente (no confiable)
$MIMEtype    = mime_content_type($_FILES['uploadFile']['tmp_name']); // MIME real del servidor

# WHITELIST de extension: solo acepta archivos .png
if (!preg_match('/^.*\.png$/', $fileName)) {
    echo "Only PNG images are allowed";
    die();
}

# Valida tanto el Content-Type enviado por el cliente como el MIME real del archivo
# Si cualquiera de los dos no es 'image/png', rechaza el upload
foreach (array($contentType, $MIMEtype) as $type) {
    if (!in_array($type, array('image/png'))) {
        echo "Only PNG images are allowed";
        die();
    }
}
?>
```

### Deshabilitar Funciones Peligrosas en php.ini

```ini
# En el archivo php.ini del servidor, agregar o modificar la directiva disable_functions
# Esto deshabilita globalmente las funciones de ejecucion de comandos del sistema
# Evita que un atacante con acceso a codigo PHP pueda ejecutar comandos del SO
disable_functions = exec,shell_exec,system,passthru,popen,proc_open,pcntl_exec
```

### Restringir el Directorio de Trabajo del Interprete PHP en php.ini

```ini
# open_basedir limita los archivos que el interprete PHP puede abrir
# El interprete no podra acceder a rutas fuera de /var/www/html/
# Mitiga LFI y path traversal a nivel de configuracion del servidor
open_basedir = /var/www/html/
```

### Configuracion de Apache para Bloquear Acceso Directo al Directorio de Uploads

```apache
# En .htaccess dentro del directorio de uploads, o en la config del VirtualHost
# Retorna 403 Forbidden para cualquier peticion directa al directorio
# El acceso debe realizarse exclusivamente a traves de download.php
<Directory /var/www/html/uploads/>
    Order Allow,Deny
    Deny from all
</Directory>
```

### Headers HTTP de Seguridad para el Script download.php

```php
<?php
# Forzar descarga del archivo en lugar de renderizarlo en el navegador (inline)
header('Content-Disposition: attachment; filename="' . $sanitizedOriginalName . '"');

# Declarar el tipo MIME correcto para que el navegador sepa como manejar el archivo
header('Content-Type: image/png');

# Previene MIME-type sniffing: el navegador debe respetar estrictamente el Content-Type
# Mitiga ataques donde el navegador "adivina" el tipo de contenido e interpreta el archivo
header('X-Content-Type-Options: nosniff');
?>
```

---

## "Gotchas" y Troubleshooting

- **Blacklist insuficiente sola:** Una blacklist puede bypassearse con extensiones no listadas (`.phtml`, `.php7`, `.phar`). Siempre combinar blacklist + whitelist.

- **Whitelist bypasseable sin blacklist:** Un archivo `shell.php.jpg` pasa la whitelist si solo se verifica que el nombre termine en `.jpg`, pero el servidor podria ejecutarlo como PHP segun su configuracion. La blacklist detectaria `.php` en el nombre antes de llegar a la whitelist.

- **Content-Type del cliente no es confiable:** El header `Content-Type` de la peticion HTTP puede ser manipulado trivialmente con Burp Suite. Nunca usar `$_FILES['uploadFile']['type']` como unica validacion; siempre combinar con `mime_content_type()` que lee el archivo real en el servidor.

- **Front-end validation es bypasseable:** La validacion JavaScript en el cliente es evasion trivial (interceptar con Burp, deshabilitar JS). Su unico valor es UX y reducir falsos positivos en logs, no seguridad.

- **Inyeccion en nombres de archivo:** Nombres como `; rm -rf /`, `../../../etc/passwd`, o `$(id).png` pueden causar command injection o path traversal si se usan directamente. La aleatorizacion del nombre en storage y el uso del nombre saneado desde BD previene esto.

- **IDOR en download.php:** Si el script acepta un parametro como `?file=1` para buscar en BD sin verificar que el archivo pertenece al usuario autenticado, un atacante puede enumerar y descargar archivos de otros usuarios. Siempre verificar autorizacion.

- **LFI en download.php:** Si el script construye la ruta del archivo concatenando input del usuario sin sanitizar (ej. `?file=../../../etc/passwd`), es vulnerable a LFI. Usar una allowlist estricta de rutas y nunca pasar input de usuario directamente a funciones de filesystem.

- **Error disclosure:** Errores PHP en produccion pueden revelar rutas absolutas del servidor, nombre del directorio de uploads, o detalles de la BD. Configurar `display_errors = Off` y `log_errors = On` en `php.ini`.

- **open_basedir bypass:** En versiones antiguas de PHP o con configuraciones incorrectas, `open_basedir` puede bypassearse. No confiar en el como unica medida de contencion; combinar con aislamiento en contenedor/VM.

- **WAF como ultima capa, no primera:** Un WAF puede ser bypasseado y no debe ser la unica defensa. Usarlo como red de seguridad adicional, no como sustituto de validacion a nivel de aplicacion.

- **Checklist de reporte para pentest:** Al reportar, verificar ausencia de: validacion de extension back-end, validacion de MIME real, bloqueo de acceso directo a uploads, anonimizacion de nombres, `disable_functions` configurado, supreson de errores de sistema, y WAF activo.