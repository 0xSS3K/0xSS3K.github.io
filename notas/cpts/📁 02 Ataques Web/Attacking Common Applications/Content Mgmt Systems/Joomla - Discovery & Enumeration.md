---
tags:
  - webapp
  - joomla
  - enum
---
## Conceptos Clave (TL;DR)
* Joomla es un CMS de código abierto gratuito utilizado frecuentemente para foros, galerías, e-Commerce y comunidades.
* Su arquitectura base está escrita en PHP y emplea una base de datos MySQL en el backend.
* Presenta una amplia superficie de ataque potencial, ya que puede extenderse con más de 7,000 extensiones y 1,000 plantillas.
* La cuenta de administrador por defecto es `admin`, pero su contraseña se define en la instalación; el acceso no autorizado suele depender de configuraciones débiles descubiertas mediante fuerza bruta.

## Herramientas Clave
* **cURL**: Comando fundamental para interactuar con la web, leer archivos públicos y buscar cadenas de texto que delaten el uso de Joomla.
* **droopescan**: Escáner basado en plugins que funciona para CMS como SilverStripe, WordPress, Drupal, Moodle y Joomla. Ayuda a identificar versiones probables y URLs interesantes.
* **JoomlaScan**: Herramienta escrita en Python (inspirada en OWASP joomscan) para encontrar directorios explorables y componentes/extensiones instaladas.
* **joomla-brute.py**: Script diseñado para ejecutar ataques de fuerza bruta directamente contra el portal de inicio de sesión del administrador.

## Metodología Paso a Paso
**Fase 1: Fingerprinting y Descubrimiento**
La primera tarea frente a un sitio web desconocido es confirmar si está ejecutando Joomla. Esto se logra buscando patrones en el código fuente (como metaetiquetas) o revisando rutas comunes en el archivo `robots.txt` y la presencia del favicon característico.

**Fase 2: Enumeración de Versión**
Una vez confirmado el CMS, el objetivo es descubrir la versión exacta instalada para buscar vulnerabilidades asociadas. Se busca acceder a archivos públicos mal configurados como `README.txt`, archivos JavaScript o manifiestos `.xml` que exponen la rama o número de versión.

**Fase 3: Escaneo Automatizado de Componentes**
Con la versión identificada (o aproximada), se utilizan herramientas automatizadas (`droopescan` o `JoomlaScan`) para mapear la estructura de directorios, encontrar archivos de licencia (`LICENSE.txt`) e identificar componentes (plugins/extensiones) que puedan ser vulnerables.

**Fase 4: Fuerza Bruta Administrativa**
Si se logra ubicar el portal de administrador, se evalúan las validaciones de acceso. Si los mensajes de error de la página son genéricos, se asume el usuario por defecto y se ejecuta un ataque de fuerza bruta con diccionarios conocidos contra el panel de login.

## Cheat Sheet de Comandos

```bash
# Consultar estadísticas globales de versiones vía API de Joomla (Referencia general)
curl -s [https://developer.joomla.org/stats/cms_version](https://developer.joomla.org/stats/cms_version) | python3 -m json.tool

# Fingerprinting Básico: Buscar metaetiquetas de Joomla en la página principal
curl -s <TARGET_URL>/ | grep Joomla

# Enumeración de Versión: Leer el archivo README para confirmar rama (ej. 3.x)
curl -s <TARGET_URL>/README.txt | head -n 5

# Enumeración de Versión: Extraer versión exacta del archivo de manifiesto XML
curl -s <TARGET_URL>/administrator/manifests/files/joomla.xml | xmllint --format -

# Instalación de droopescan vía pip3
sudo pip3 install droopescan

# Escaneo automatizado de Joomla usando droopescan para identificar versiones y URLs
droopescan scan joomla --url <TARGET_URL>

# Preparación de dependencias (Si usas JoomlaScan en un entorno Python 2.7)
python2.7 -m pip install urllib3 certifi bs4

# Escaneo automatizado con JoomlaScan para listar componentes y directorios explorables
python2.7 joomlascan.py -u <TARGET_URL>

# Fuerza bruta contra el panel de administración (/administrator/index.php) asumiendo usuario default
sudo python3 joomla-brute.py -u <TARGET_URL> -w <WORDLIST_PATH> -usr <USER>
```

## "Gotchas" y Troubleshooting
* **Mensajes de Error Genéricos:** Durante la enumeración de usuarios en el portal de login, Joomla devuelve un mensaje genérico ("Username and password do not match..."). Esto dificulta saber si un usuario específico existe sin adivinar también su contraseña.
* **Dependencia Legacy (JoomlaScan):** La herramienta `JoomlaScan` está desactualizada y requiere estrictamente Python 2.7. Si tu entorno no lo tiene, deberás usar manejadores como `pyenv` para instalar y ejecutar esta versión específica.
* **Configuración del `robots.txt` en Subdirectorios:** Si el objetivo tiene Joomla instalado dentro de una carpeta (ej. `www.ejemplo.com/joomla/`), el archivo `robots.txt` seguirá estando en la raíz del sitio, pero todas sus reglas `Disallow` incluirán el prefijo del directorio (ej. `Disallow: /joomla/administrator/`). Presta atención a estas rutas.
* **Alternativas para detectar la versión:** Si el acceso a `README.txt` está bloqueado, intenta buscar la versión directamente en archivos JavaScript bajo `media/system/js/`, en el manifiesto `administrator/manifests/files/joomla.xml`, o en la caché ubicada en `plugins/system/cache/cache.xml`.