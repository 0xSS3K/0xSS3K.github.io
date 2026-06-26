---
tags:
  - drupal
  - enum
  - webapp
---
## Conceptos Clave (TL;DR)
* CMS de código abierto escrito en PHP que soporta bases de datos como MySQL, PostgreSQL o SQLite.
* Indexa su contenido utilizando nodos, donde los URI suelen tener el formato `/node/<nodeid>`, lo cual facilita la identificación de la tecnología cuando se emplean temas personalizados.
* Cuenta con tres tipos de usuarios predeterminados: Administrador (control absoluto), Usuario Autenticado (puede añadir o editar contenido basado en permisos) y Anónimo (visitantes con permisos de solo lectura).

## Herramientas Clave
* **cURL & utilidades de texto (grep, sed, head):** Utilizados para extraer información de cabeceras HTTP, código fuente y archivos de texto estáticos.
* **droopescan:** Herramienta automatizada especializada en Drupal que posee gran funcionalidad para perfilar la versión exacta, plugins (módulos) instalados, temas y URLs de administración.

## Metodología Paso a Paso

**Fase 1: Descubrimiento y Footprinting**
El objetivo es confirmar que el CMS objetivo es Drupal. Esto se puede lograr revisando metadatos en el código fuente, mensajes en el pie de página ("Powered by Drupal"), el logo estándar, o buscando indicios en el archivo `robots.txt` como referencias a rutas `/node`. 

**Fase 2: Identificación mediante Nodos**
Si la página de inicio de sesión no es visible o se usa un tema muy personalizado, navegar manualmente a rutas de nodos (por ejemplo, `/node/1`) es un método confiable para confirmar la presencia del CMS.

**Fase 3: Enumeración Manual de Archivos**
Buscar archivos como `CHANGELOG.txt` o `README.txt`. En versiones no recientes, estos archivos suelen estar expuestos y contienen la versión exacta del core de Drupal.

**Fase 4: Enumeración Automatizada**
Cuando las técnicas manuales no revelan suficiente información, se debe utilizar `droopescan` para automatizar la búsqueda de la versión del núcleo, enumerar la lista de módulos instalados (ubicados en `/modules/`) y descubrir puntos de acceso administrativos ocultos.

## Cheat Sheet de Comandos

```bash
# Realiza una peticion silenciosa (-s) a la raiz del sitio y busca la palabra "Drupal" en el codigo fuente para identificar el CMS.
curl -s http://<TARGET_URL> | grep Drupal

# Navega manualmente a un nodo para validar si la estructura corresponde a Drupal.
curl -s http://<TARGET_URL>/node/<NODE_ID>

# Solicita el archivo CHANGELOG.txt e imprime solo las coincidencias relevantes (ej. la segunda coincidencia vacia que suele preceder a la version) para extraer la version de Drupal.
curl -s http://<TARGET_URL>/CHANGELOG.txt | grep -m2 ""

# Ejecuta un escaneo automatizado especifico para Drupal para encontrar plugins, temas, versiones probables y URLs interesantes.
droopescan scan drupal -u http://<TARGET_URL>
```

## "Gotchas" y Troubleshooting
* **Visibilidad del panel de login:** No todas las instalaciones de Drupal permiten a los usuarios acceder a la página de inicio de sesión desde internet, ni todas tienen el mismo aspecto visual.
* **Archivos bloqueados en versiones recientes:** Las instalaciones más nuevas de Drupal bloquean por defecto el acceso a los archivos `CHANGELOG.txt` y `README.txt`, por lo que intentar acceder a ellos devolverá una respuesta HTTP 404 Not Found.
* **Siguientes pasos post-enumeración:** Si la versión del core identificada no presenta vulnerabilidades evidentes, el enfoque de la prueba de penetración debe cambiar hacia la enumeración de plugins instalados o la búsqueda de abusos en las funcionalidades nativas del CMS.