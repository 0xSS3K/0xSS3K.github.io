---
tags:
  - webapp
  - LFI
---
## Conceptos Clave (TL;DR)

* Los ataques LFI ocurren cuando una aplicación web utiliza entradas del usuario (parámetros HTTP) no sanitizadas para cargar o especificar la ruta de un archivo local en el servidor back-end.

* Son extremadamente comunes en motores de plantillas (templating engines) donde una página principal (ej. `index.php`) carga contenido estático y utiliza parámetros (ej. `?page=<ARCHIVO>`) para incrustar contenido dinámico de forma modular.

* El impacto de un LFI abarca desde la exposición de código fuente y datos sensibles (credenciales, claves de bases de datos), hasta la Ejecución Remota de Código (RCE) y el compromiso total del servidor si se cumplen ciertas condiciones.

* Es crítico distinguir si la función vulnerable en el código back-end solo tiene permisos de *lectura* o si también puede *ejecutar* el archivo invocado.

  
## Herramientas Clave

* *Nota del pentester:* *El texto no menciona herramientas automatizadas ofensivas, sino que se enfoca en la identificación de funciones vulnerables directamente en el código fuente de lenguajes como PHP, NodeJS, Java y .NET.*

  
## Metodología Paso a Paso

* **Fase 1: Identificación de Vectores de Entrada**
  Analizar la aplicación en busca de parámetros HTTP (GET/POST) o rutas de URL (URL paths) que parezcan controlar el contenido cargado o el idioma de la página (ej. `?language=es` o `/about/en`).

* **Fase 2: Manipulación del Parámetro (Path Traversal)**
  Interceptar la petición y modificar el valor del parámetro identificado para apuntar a un archivo local conocido dentro del sistema de archivos del servidor en lugar del recurso web esperado.

* **Fase 3: Evaluación de Impacto y Escalada**
  Verificar si el archivo inyectado se refleja en la respuesta HTTP. En caso afirmativo, determinar si se trata de un LFI de solo lectura (útil para extraer configuración y código fuente en busca de más vulnerabilidades) o si hay capacidad de ejecución (vía hacia RCE).

  

## Cheat Sheet de Comandos (Identificación de Código Vulnerable)

*A continuación, se detallan los patrones de código vulnerables extraídos por lenguaje. Durante auditorías de caja blanca. La idea es buscar estas estructuras donde el `<PARAMETER>` sea controlable por el usuario.*
```php
# PHP: Carga directa de un archivo a través de un parámetro GET sin sanitizar.
# Permite lectura, ejecución y (dependiendo de la configuración) URLs remotas.

if (isset($_GET['<PARAMETER>'])) {
   include($_GET['<PARAMETER>']);
}
```

```javascript
# NodeJS (Express): Lectura de archivos usando fs.readFile.
# El input del usuario se usa directamente. Permite lectura, pero NO ejecución.

if(req.query.<PARAMETER>) {
    fs.readFile(path.join(__dirname, req.query.<PARAMETER>), function (err, data) {
        res.write(data);
    });
}

  
# NodeJS (Express): Renderizado de plantillas usando un parámetro de la URL (URL path).
# Permite lectura y ejecución.

app.get("/about/:<PARAMETER>", function(req, res) {
    res.render(`/${req.params.<PARAMETER>}/about.html`);
});
```

```jsp
# Java (JSP): Uso de la etiqueta jsp:include recibiendo el parámetro de la solicitud.
# Permite lectura, NO ejecución.

<c:if test="${not empty param.<PARAMETER>}">
    <jsp:include file="<%= request.getParameter('<PARAMETER>') %>" />
</c:if>

  
# Java (JSP): Uso de la función import.
# Peligroso: Permite lectura, ejecución y URLs remotas.

<c:import url= "<%= request.getParameter('<PARAMETER>') %>"/>
```

```csharp
# .NET: Escritura directa del archivo en la respuesta basado en el Query String.
# Permite lectura, NO ejecución.

@if (!string.IsNullOrEmpty(HttpContext.Request.Query['<PARAMETER>'])) {
    <% Response.WriteFile("<% HttpContext.Request.Query['<PARAMETER>'] %>"); %>
}

  
# .NET: Renderizado de la ruta como parte del front-end template.
# Permite lectura, NO ejecución.

@Html.Partial(HttpContext.Request.Query['<PARAMETER>'])

  
# .NET: Server-Side Include (SSI).
# Peligroso: Permite lectura, ejecución y URLs remotas.
```

|**Function**|**Read Content**|**Execute**|**Remote URL**|
|---|:-:|:-:|:-:|
|**PHP**||||
|`include()`/`include_once()`|✅|✅|✅|
|`require()`/`require_once()`|✅|✅|❌|
|`file_get_contents()`|✅|❌|✅|
|`fopen()`/`file()`|✅|❌|❌|
|**NodeJS**||||
|`fs.readFile()`|✅|❌|❌|
|`fs.sendFile()`|✅|❌|❌|
|`res.render()`|✅|✅|❌|
|**Java**||||
|`include`|✅|❌|❌|
|`import`|✅|✅|✅|
|**.NET**||||
|`@Html.Partial()`|✅|❌|❌|
|`@Html.RemotePartial()`|✅|❌|✅|
|`Response.WriteFile()`|✅|❌|❌|
|`include`|✅|✅|✅|
## "Gotchas" y Troubleshooting

* **Routing Parameters vs Query Strings:** Cuidado al mapear aplicaciones modernas (como Express.js). Los parámetros vulnerables pueden no estar acompañados del clásico `?` en la URL. Pueden ser parámetros de ruta explícitos (ej. `/about/en` donde `en` es la variable a manipular).

* **Matriz de Capacidades (Lectura vs Ejecución vs Remoto):** Dependiendo de la función explotada, tus capacidades de post-explotación varían:
  * **PHP:** `include()` y `require()` permiten ejecución. `file_get_contents()` y `fopen()` solo permiten lectura.
  * **NodeJS:** `res.render()` permite ejecución. `fs.readFile()` solo lectura.
  * **Java:** `import` permite ejecución y URLs remotas (RFI). `include` solo lectura.
  * **.NET:** La directiva `include` permite ejecución y remoto. `Response.WriteFile()` y `@Html.Partial()` solo lectura.

* **Escalada sin Ejecución:** Si determinas que la función solo permite leer archivos y no ejecutarlos, no asumas que es un callejón sin salida. Extrae código fuente para revelar credenciales de administrador, claves de bases de datos o descubrir debilidades adicionales ocultas en la lógica del back-end.