---
tags:
  - tomcat
  - enum
  - webapp
---
## Conceptos Clave (TL;DR)
* Servidor web open-source utilizado para alojar aplicaciones Java, como Java Servlets y scripts JSP.
* Es un objetivo de alto valor frecuentemente encontrado en pruebas de penetracion internas, muchas veces configurado con credenciales debiles o por defecto.
* Archivos criticos incluyen `WEB-INF/web.xml` (descriptor de despliegue, excelente objetivo para LFI) y `conf/tomcat-users.xml` (almacena credenciales y roles de usuario).
* El vector principal de compromiso post-autenticacion en paneles de administracion es la subida de un archivo WAR (Web Application ARchive) que contenga una web shell JSP para obtener RCE.

## Herramientas Clave
* **EyeWitness:** Herramienta de reconocimiento visual que suele clasificar las instancias de Tomcat como "High Value Targets".
* **cURL:** Utilizado para interactuar rapidamente con el servidor web, extraer banners del encabezado y leer el codigo fuente de paginas por defecto para identificar versiones.
* **Gobuster:** Empleado para la enumeracion de directorios web con el fin de localizar los paneles de administracion ocultos o no enlazados.

## Metodologia Paso a Paso

1. **Fingerprinting e Identificacion de Version:**
   El primer paso es confirmar la presencia de Tomcat y su version. Esto se logra leyendo el encabezado `Server` en la respuesta HTTP o forzando paginas de error. Identificar la version exacta permite buscar vulnerabilidades publicas especificas.

2. **Enumeracion de Paginas por Defecto y Paneles:**
   Si las paginas de error estan personalizadas y no filtran informacion, se deben buscar directorios por defecto (como `/docs`) que los administradores olvidan remover. Posteriormente, se debe realizar fuzzing activo para localizar los paneles de administracion vitales: `/manager` y `/host-manager`.

3. **Acceso Inicial (Fuerza Bruta / Credenciales por Defecto):**
   Una vez localizados los paneles, el objetivo es autenticarse probando combinaciones comunes (ej. `tomcat:tomcat`, `admin:admin`) o ejecutando un ataque de fuerza bruta.

4. **Ejecucion de Codigo (RCE):**
   Tras un inicio de sesion exitoso en el panel manager, la aplicacion permite la carga de archivos. Subir un payload empaquetado en formato `.war` garantiza la ejecucion de comandos en el servidor.

## Cheat Sheet de Comandos

```bash
# Realiza una peticion GET a una ruta inexistente para forzar un error 404. 
# Si el servidor esta detras de un proxy inverso, esto puede revelar la version de Tomcat.
curl -s http://<TARGET_IP>:<PORT>/invalid
```

```bash
# Realiza una peticion silenciosa (-s) a la pagina de documentacion por defecto y filtra la salida buscando "Tomcat".
# Util para confirmar la version exacta si las paginas de error fueron personalizadas.
curl -s http://<TARGET_IP>:<PORT>/docs/ | grep Tomcat
```

```bash
# Ejecuta un ataque de enumeracion de directorios (dir) sobre la URL objetivo utilizando una wordlist especifica.
# Busca descubrir rutas criticas como /manager o /host-manager.
gobuster dir -u http://<TARGET_IP>:<PORT>/ -w <WORDLIST_PATH>
```

## "Gotchas" y Troubleshooting
* **Puertos Comunes:** A diferencia del puerto 80 estandar, Tomcat suele operar por defecto en el puerto 8080 o el puerto 8180.
* **Roles Requeridos:** Para que unas credenciales capturadas funcionen en la interfaz grafica (`/manager/html`), el usuario debe tener especificamente asignado el rol `manager-gui` dentro del archivo `tomcat-users.xml`. Otros roles como `manager-script` solo dan acceso a la API HTTP.
* **LFI:** Si descubres una vulnerabilidad de inclusion de archivos locales (LFI), el archivo `WEB-INF/web.xml` debe ser tu objetivo principal, ya que revela la estructura de las clases compiladas que podrian contener logica de negocio sensible.
* **Archivos Personalizados:** La ausencia de un banner de version en una pagina 404 no significa que no sea Tomcat; los administradores pueden configurar paginas de error personalizadas. Recurre siempre a enumerar el directorio `/docs` como plan de respaldo.