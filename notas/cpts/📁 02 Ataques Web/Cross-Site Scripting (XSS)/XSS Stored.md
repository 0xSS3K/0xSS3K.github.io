---
tags:
  - webapp
  - nixshells
---
## Conceptos Clave (TL;DR)

* Es el tipo de vulnerabilidad XSS más crítico, también conocido como Persistent XSS.

* El payload inyectado se almacena en la base de datos del backend y se recupera al visitar la página, volviéndose persistente y afectando a cualquier usuario que la visite.

* Su remoción puede ser compleja, requiriendo a menudo la eliminación del payload directamente desde la base de datos del backend.

  

## Herramientas Clave

* **Navegador Web:** Utilizado para interactuar con la aplicación, inyectar datos, verificar la ejecución de JavaScript y revisar el código fuente.

  

## Metodología Paso a Paso

* **Fase 1: Identificación de la entrada:** Interactúa con la aplicación objetivo (como una lista de tareas) ingresando texto de prueba y verificando si la entrada se refleja en la pantalla.

* **Fase 2: Prueba de sanitización:** Si la entrada se refleja en la página web, inyecta payloads básicos de XSS para evaluar si existe una falta de filtrado o sanitización de datos.

* **Fase 3: Verificación del código fuente:** Inspecciona el código fuente de la página mediante el atajo de teclado CTRL+U o haciendo clic derecho y seleccionando "View Page Source" para comprobar si el payload inyectado aparece dentro del HTML.

* **Fase 4: Confirmación de persistencia:** Refresca la página en el navegador. Si el comportamiento inyectado (como una alerta) se repite a través de múltiples recargas, se confirma exitosamente que la vulnerabilidad es un Stored XSS.

  

## Cheat Sheet de Comandos

*Los siguientes payloads se utilizan para comprobar si una aplicación web, como un formulario en la dirección `http://<TARGET_IP>:<PORT>/`, es vulnerable:
```html
# Muestra una caja de alerta revelando la URL exacta de ejecucion, ideal para confirmar el dominio vulnerable.

<script>alert(window.origin)</script>
```

```html
# Detiene la interpretacion del codigo HTML que le sigue y lo muestra en texto plano.

<plaintext>
```

```html
# Despliega el dialogo de impresion del navegador; es poco probable que sea bloqueado por protecciones del navegador.

<script>print()</script>
```


## "Gotchas" y Troubleshooting

* **Aislamiento en IFrames:** Muchas aplicaciones web modernas manejan la entrada de los usuarios a través de IFrames de dominios cruzados. Como resultado, una vulnerabilidad de XSS en el formulario podría no afectar a la aplicación web principal directamente.

* **Por qué no usar un valor estático:** Debido a la posibilidad de que existan IFrames, mostrar un valor estático en una alerta, como un "1", no es óptimo. La función `window.origin` expondrá la URL donde realmente se ejecuta el código, lo que confirma qué formulario específico es el vulnerable.

* **Bypass de bloqueos de navegador:** En ubicaciones específicas, los navegadores modernos pueden bloquear por completo la ejecución de la función JavaScript `alert()`. Si el payload de alerta no tiene éxito, debes recurrir a cargas útiles alternativas como la impresión en pantalla (`<script>print()</script>`) o el renderizado en texto plano (`<plaintext>`) para comprobar de forma efectiva la presencia del XSS.

* **Impacto global:** Ten en cuenta que si el XSS está almacenado en el backend, la ejecución no se limitará a tu sesión; cualquier persona que navegue a la página se convertirá en víctima y disparará el mismo payload.