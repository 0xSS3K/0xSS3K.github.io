---
tags:
  - xss
  - webapp
  - mitigation
---
## Conceptos Clave (TL;DR)

* Las vulnerabilidades XSS existen debido a la interaccion entre una fuente (Source, como un campo de entrada) y un sumidero (Sink, donde se muestra la informacion).

* La defensa principal es la sanitizacion y validacion adecuada de la entrada del usuario tanto en el front-end como en el back-end.

* Las protecciones exclusivas de front-end son insuficientes porque pueden ser evadidas enviando peticiones HTTP modificadas (GET/POST) de forma directa al servidor.

* La codificacion de salida (Output HTML Encoding) es vital para transformar caracteres especiales en entidades HTML seguras, neutralizando la ejecucion de scripts maliciosos.

  

## Herramientas Clave

* **DOMPurify:** Libreria de JavaScript (utilizable en front-end y NodeJS) disenada para sanitizar entradas y prevenir vulnerabilidades como DOM XSS escapando caracteres especiales.

* **html-entities:** Libreria de NodeJS utilizada para codificar caracteres especiales en sus equivalentes HTML antes de reflejarlos en la pagina.

* **Web Application Firewall (WAF):** Mecanismo de defensa a nivel de red/aplicacion que detecta y rechaza automaticamente peticiones HTTP que contienen inyecciones.

  

## Metodología Paso a Paso

**Fase 1: Validacion y Sanitizacion Front-end**
Se debe asegurar que la entrada del usuario tenga el formato correcto mediante expresiones regulares (Regex) y escapar cualquier caracter especial antes de procesarlo. Esto previene que se inyecte codigo JavaScript en el navegador del cliente.
  

**Fase 2: Evitar Sinks Peligrosos**
Auditar el codigo para asegurar que la entrada del usuario jamas se inserte directamente dentro de etiquetas `<script>`, `<style>`, atributos HTML o comentarios. Se debe evitar el uso de funciones de JavaScript o jQuery que rendericen texto en crudo.
  

**Fase 3: Validacion y Sanitizacion Back-end**
Implementar validaciones robustas en el servidor para rechazar datos malformados usando funciones nativas del lenguaje. Toda entrada debe ser sanitizada (ej. escapando comillas) antes de ser procesada o almacenada para evitar Stored y Reflected XSS.
  

**Fase 4: Codificacion de Salida (Output Encoding)**
Antes de mostrar cualquier dato ingresado por el usuario en el navegador, este debe ser codificado a entidades HTML. Esto garantiza que el navegador interprete los caracteres como texto y no como codigo ejecutable.
  

**Fase 5: Hardening de Servidor y Cabeceras**
Configurar el servidor web para forzar HTTPS e implementar cabeceras HTTP de seguridad (como Content-Security-Policy y X-Content-Type-Options) y flags de cookies (HttpOnly y Secure) que mitiguen el impacto de un posible XSS.


## Cheat Sheet de Comandos
```javascript
# Validacion de formato de email en Front-end usando Regex

function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test($("#<FORM_ID> input[name=<INPUT_NAME>]").val());
}
```

```javascript
# Sanitizacion de entrada en Front-end usando DOMPurify

<script type="text/javascript" src="dist/purify.min.js"></script>

let clean = DOMPurify.sanitize( <USER_INPUT> );
```

```php
# Validacion de formato de email en Back-end (PHP) usando filter_var

if (filter_var($_GET['<INPUT_NAME>'], FILTER_VALIDATE_EMAIL)) {
    // Input aceptado
} else {
    // Input rechazado
}
```

```php
# Sanitizacion de entrada en Back-end (PHP) escapando caracteres especiales

addslashes($_GET['<INPUT_NAME>'])
```

```javascript
# Sanitizacion de entrada en Back-end (NodeJS) usando DOMPurify

import DOMPurify from 'dompurify';

var clean = DOMPurify.sanitize(<USER_INPUT>);
```

```php
# Codificacion de salida (Output Encoding) en Back-end (PHP)

htmlentities($_GET['<INPUT_NAME>']);
```

```javascript
# Codificacion de salida (Output Encoding) en Back-end (NodeJS) usando html-entities

import encode from 'html-entities';

encode('<USER_INPUT>');
```


## "Gotchas" y Troubleshooting

* **Ilusion de seguridad en el Front-end:** Un error comun es depender unicamente de validaciones en JavaScript del lado del cliente. Estas son trivialmente evadidas capturando la peticion (ej. con Burp Suite) y modificando el payload antes de que llegue al servidor.

* **Funciones DOM Inseguras:** Durante una revision de codigo (Code Review), marca como critico el uso de las siguientes funciones si manejan input de usuario, ya que son vectores directos para DOM XSS: `DOM.innerHTML`, `DOM.outerHTML`, `document.write()`, `document.writeln()`, `document.domain`.

* **Funciones jQuery Inseguras:** De igual manera, las siguientes funciones de jQuery facilitan la inyeccion de raw text: `html()`, `parseHTML()`, `add()`, `append()`, `prepend()`, `after()`, `insertAfter()`, `before()`, `insertBefore()`, `replaceAll()`, `replaceWith()`.

* **Configuracion CSP:** Utilizar la cabecera Content-Security-Policy con la opcion `script-src 'self'` es una medida fuerte, ya que bloquea la ejecucion de scripts externos y solo permite los alojados localmente.

* **Proteccion de Sesiones:** La flag `HttpOnly` en las cookies es critica en la defensa, ya que impide que el codigo JavaScript inyectado (payload XSS) pueda leer o exfiltrar las cookies de sesion.