---
tags:
  - webapp
  - LFI
---
## Conceptos Clave (TL;DR)

* LFI permite explotar vulnerabilidades en aplicaciones web para leer el contenido de archivos locales en el servidor backend.

* El vector más común se presenta cuando la aplicación carga partes de la página utilizando motores de plantillas (template engines) que incluyen archivos locales basados en parámetros.

* Los archivos objetivo principales para comprobar la vulnerabilidad son `/etc/passwd` en sistemas Linux y `C:\Windows\boot.ini` en sistemas Windows.

* Ataques de Segundo Orden (Second-Order LFI): Consisten en envenenar una entrada de la base de datos (por ejemplo, un nombre de usuario) con un payload LFI.  Esta entrada maliciosa es posteriormente utilizada por otra funcionalidad de la aplicación que extrae archivos, ejecutando el ataque de forma indirecta.

  

## Herramientas Clave

* **Navegador Web / cURL:** Para interactuar directamente con los parámetros de la URL e inspeccionar las respuestas del servidor web intentando visualizar el contenido del archivo arbitrario.

  

## Metodología Paso a Paso

### Fase 1: Identificación de Vectores

Buscar parámetros en la URL (ej. `?language=`) que alteren el contenido de la página o carguen diferentes versiones o módulos de la aplicación.

  

### Fase 2: LFI Básico (Ruta Absoluta)

Sustituir el valor del parámetro sospechoso por la ruta absoluta de un archivo local conocido.  Este método es efectivo si el input del usuario se pasa íntegramente a la función de inclusión (ej. `include()`) sin modificaciones adicionales.

  

### Fase 3: Path Traversal (Ruta Relativa)

Si la aplicación antepone un directorio al input (ej. `include("./languages/" . $_GET['language']);`), la ruta absoluta fallará.  Para eludir esto, utilizar secuencias `../` (que hacen referencia al directorio padre) para retroceder recursivamente hasta el directorio raíz (`/`), y luego anexar la ruta del archivo deseado.

  

### Fase 4: Bypass de Prefijos de Archivo

Si el input se concatena inmediatamente después de un prefijo de cadena de texto (ej. `include("lang_" . $_GET['language']);`), el Path Traversal estándar generará una ruta inválida.  Para eludir la restricción, anteponer una barra `/` al payload para forzar que el sistema interprete el prefijo como un directorio, permitiendo que la secuencia de salto funcione.

  
## Cheat Sheet de Comandos 

```bash
# LFI Básico: Intento de lectura directa usando ruta absoluta.
curl -s "http://<TARGET_IP>:<PORT>/index.php?language=/etc/passwd"
  

# Path Traversal: Retroceso de directorios (4 niveles) para escapar del directorio actual y llegar a la raíz.
curl -s "http://<TARGET_IP>:<PORT>/index.php?language=../../../../etc/passwd"
 

# Bypass de Prefijo: Uso de "/" inicial para tratar el prefijo inyectado como un directorio (ej. "lang_/") y permitir el salto de directorios.
curl -s "http://<TARGET_IP>:<PORT>/index.php?language=/../../../etc/passwd"
```
  

## "Gotchas" y Troubleshooting

* **Errores de PHP Ocultos:** Las aplicaciones web en producción no deben mostrar errores detallados.  Todos los ataques LFI deben ejecutarse asumiendo un entorno ciego, ya que no dependen de la lectura de errores para funcionar.

* **Límites de Salto de Directorio:** Si se retrocede hasta el directorio raíz (`/`), añadir secuencias `../` adicionales no romperá la ruta; el puntero simplemente se mantendrá en la raíz.  En caso de duda sobre la profundidad, se puede inyectar `../` un centenar de veces de forma segura.

* **Eficiencia en Reportes:** Para optimizar exploits y reportes, es una buena práctica calcular exactamente a cuántos directorios se encuentra el punto de inyección de la raíz y usar el número mínimo necesario de `../` (ej. `/var/www/html/` requiere 3 saltos).

* **Fallo de Bypass por Prefijo:** La técnica de anteponer `/` al payload puede fallar si el prefijo evaluado como directorio (ej. `lang_/`) no existe realmente en el sistema de archivos, haciendo que la ruta relativa sea incorrecta.  Además, los prefijos pueden neutralizar otras técnicas como el uso de wrappers/filtros de PHP o Remote File Inclusion (RFI).

* **Extensiones Concatenadas (Appended Extensions):** Si el servidor fuerza una extensión al final del input (ej. `.php`), buscar `/etc/passwd` resolverá a `/etc/passwd.php`, lo cual devolverá un error por archivo inexistente.  Existen técnicas de bypass específicas para este escenario.

* **Agnóstico al Lenguaje:** Todas las técnicas de Path Traversal y LFI documentadas son aplicables a cualquier vulnerabilidad de este tipo, independientemente del lenguaje de desarrollo o framework del backend.