---
tags:
  - webapp
  - wordpress
  - enum
---
## Conceptos Clave (TL;DR)

* WordPress es un Sistema de Gestión de Contenidos (CMS) de código abierto escrito en PHP que generalmente se ejecuta sobre un servidor web Apache con MySQL como base de datos.
* Aunque es sumamente personalizable, esta extensibilidad lo hace muy propenso a presentar vulnerabilidades a través de temas y plugins desarrollados por terceros.
* Presenta cinco niveles o roles de usuario predeterminados (Administrador, Editor, Autor, Colaborador, Suscriptor); comprometer y obtener acceso a un usuario Administrador es habitualmente suficiente para lograr ejecución de código (RCE) en el servidor subyacente.
* Usuarios con roles intermedios, como Editores y Autores, pueden poseer permisos de acceso a plugins vulnerables específicos que los usuarios estándar (suscriptores o no autenticados) no pueden alcanzar.

## Herramientas Clave

* **cURL**: Se utiliza para inspeccionar rápidamente el código fuente de la página de forma manual en la terminal, lo cual ayuda a confirmar el uso de WordPress y hacer "fingerprinting" de versiones o plugins activos.
* **WPScan**: Una herramienta de enumeración y escaneo de seguridad automatizada específica para WordPress; su propósito es determinar si los componentes (núcleo, temas, plugins) están desactualizados, enumerar usuarios y detectar vulnerabilidades.
* **WPVulnDB (API)**: Base de datos de vulnerabilidades externa desde la cual WPScan obtiene reportes y pruebas de concepto (PoC); se integra mediante la creación de una cuenta y el uso de un token.

## Metodología Paso a Paso

* **Fase 1: Reconocimiento (Footprinting)**: Navegar al archivo de exclusión `/robots.txt`; la presencia de entradas deshabilitadas para directorios clave como `/wp-admin` y `/wp-content` indica directamente una instalación de WordPress. Asimismo, revisar la etiqueta `<meta name="generator">` en el código fuente HTML, ya que a menudo revela la versión exacta del núcleo instalada por defecto.
* **Fase 2: Enumeración Manual (Plugins y Temas)**: Navegar por la aplicación web y utilizar comandos de consola para filtrar el código fuente HTML en busca de directorios `wp-content/themes` y `wp-content/plugins`. Intentar acceder directamente a estas rutas para verificar si el listado de directorios está habilitado e intentar leer los archivos `readme.txt` de cada extensión para obtener números de versión precisos de forma manual.
* **Fase 3: Enumeración Manual (Usuarios)**: Localizar y acceder al panel de administración base en `/wp-login.php`. Utilizar nombres de usuario arbitrarios y analizar los mensajes de error retornados; WordPress indica explícitamente "The username X is not registered" si no existe, o "The password for username X is incorrect" si el usuario es válido, lo que permite fuerza bruta de enumeración de nombres.
* **Fase 4: Enumeración Automatizada**: Ejecutar escáneres especializados, combinándolos con un token de API para correlacionar los hallazgos directamente con exploits. Esta fase no reemplaza a la anterior, ya que automatizar permite cubrir mucha superficie rápidamente, pero se deben validar los hallazgos manualmente.

## Cheat Sheet de Comandos

```bash
# Solicita el código fuente de la página principal y busca la etiqueta meta 'generator' para revelar la versión de WordPress
curl -s http://<TARGET_IP_OR_DOMAIN> | grep WordPress

# Filtra el código fuente de la respuesta para extraer rutas que contengan los nombres y versiones de los temas en uso
curl -s http://<TARGET_IP_OR_DOMAIN>/ | grep themes

# Inspecciona el código HTML en búsqueda de archivos CSS y JS cargados, lo que expone los directorios y nombres de plugins activos
curl -s http://<TARGET_IP_OR_DOMAIN>/ | grep plugins

# Ejemplo manual para extraer el archivo de lectura que suele contener detalles críticos como el changelog y la versión de un plugin
curl -s http://<TARGET_IP_OR_DOMAIN>/wp-content/plugins/<PLUGIN_NAME>/readme.txt

# Comando para instalar WPScan manualmente a través del gestor de paquetes de Ruby si no se encuentra en el entorno de ataque
sudo gem install wpscan

# Ejecuta un escaneo automatizado contra el objetivo enumerando temas, usuarios y plugins vulnerables; inyecta un token para obtener datos de CVEs y PoCs
sudo wpscan --url http://<TARGET_IP_OR_DOMAIN> --enumerate --api-token <API_TOKEN>

# Restringe la enumeración de WPScan de forma agresiva para buscar absolutamente todos los plugins ("ap" = all plugins) disponibles en la aplicación
wpscan --url http://<TARGET_IP_OR_DOMAIN> --enumerate ap

# Sobrescribe el número de hilos de ejecución simultáneos usados por el escáner (el valor por defecto es 5)
wpscan --url http://<TARGET_IP_OR_DOMAIN> -t <NUMBER_OF_THREADS>
```

## "Gotchas" y Troubleshooting
* **Falsos Negativos en WPScan**: La enumeración automatizada a menudo falla y es insuficiente por sí sola; escáneres como WPScan pueden pasar por alto plugins o no inferir correctamente la jerarquía de los temas, por lo que es imperativo combinar la ejecución del escáner con la enumeración humana curiosa y minuciosa.
* **Directory Listing Habilitado**: Si los directorios de carga o de complementos (como `wp-content/plugins/` o `wp-content/uploads/`) no restringen el listado, se puede navegar libremente para extraer archivos sensibles que de otro modo estarían ocultos.
* **Abuso de XML-RPC**: Frecuentemente, las instalaciones mantienen el archivo `xmlrpc.php` habilitado, este vector es abusado ampliamente para realizar ataques de fuerza bruta a contraseñas utilizando herramientas como el mismo WPScan o módulos de Metasploit.
* **Restricciones de WPVulnDB**: La cuenta gratuita del servicio de base de datos impone un límite estricto de hasta 25 solicitudes de API por día, lo que debe considerarse al escanear múltiples objetivos en un entorno de examen.
* **Control de Impulsos**: En auditorías contra este CMS, es crítico no precipitarse ni comenzar a explotar la primera vulnerabilidad detectada, ya que la extensa superficie de ataque podría contener fallas de configuración y vectores de ataque mucho más directos o estables que no deben pasarse por alto.