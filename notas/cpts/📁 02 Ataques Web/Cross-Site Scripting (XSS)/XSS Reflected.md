---
tags:
  - webapp
  - xss
---
## Conceptos Clave (TL;DR)

* Es un tipo de vulnerabilidad No-Persistente donde el input malicioso alcanza el servidor back-end y es devuelto a la víctima en la respuesta sin ser previamente filtrado o sanitizado.

* Su ejecución es completamente temporal; no sobrevive a la recarga de la página y afecta única y exclusivamente al usuario objetivo que activa el enlace.

* Se localiza comúnmente en funciones que reflejan íntegramente el texto introducido por el usuario, tales como mensajes de error o confirmaciones.

  
## Herramientas Clave

* **Firefox Developer Tools (Network Tab):** Fundamental para inspeccionar el tráfico HTTP y determinar si la solicitud enviada al servidor utiliza el método GET, lo cual define cómo se debe empaquetar y entregar el ataque a la víctima.

  
## Metodología Paso a Paso

**1. Descubrimiento y Detección de Reflejo**

Introduce una cadena de texto benigna y controlable (por ejemplo, `test`) en un campo de entrada y verifica si la aplicación la imprime de vuelta en la interfaz, como dentro de un mensaje de error.

  

**2. Inyección y Verificación de Sanitización**

Si el input inicial se refleja, inyecta un payload XSS (como una alerta de JavaScript) para comprobar si el servidor carece de medidas de sanitización. Es vital revisar el código fuente de la página para confirmar que el payload se incrustó directamente en el HTML.

  

**3. Armado y Entrega del Vector**

Abre las herramientas de desarrollador y analiza la petición HTTP. Si el parámetro vulnerable se transmite a través de una solicitud GET, el payload viajará incrustado directamente en la URL. Copia esta URL manipulada y utilízala para apuntar a la víctima.

  
## Cheat Sheet de Comandos

```html
# Payload básico de prueba para confirmar la ejecución de código JavaScript evaluando el origen de la ventana.

<script>alert(window.origin)</script>
```

```text
# Estructura de URL maliciosa para explotar Reflected XSS cuando el parámetro viaja por GET.

http://<TARGET_IP>:<PORT>/index.php?task=<script>alert(window.origin)</script>
```

  
## "Gotchas" y Troubleshooting

* **Falsos negativos visuales:** Al inyectar un payload envuelto en etiquetas `<script>`, es posible que este desaparezca de la interfaz de usuario, mostrando texto vacío (por ejemplo, `Task '' could not be added.`). Esto no significa que el ataque falló; ocurre porque el navegador interpreta y oculta las etiquetas de script. Siempre debes inspeccionar el código fuente (`HTML`) para confirmar el reflejo real.

* **Dependencia del método HTTP:** La técnica de copiar la URL manipulada para enviársela a una víctima solo es efectiva si la vulnerabilidad ocurre sobre una petición GET. Esto se debe a que los parámetros y datos en las peticiones GET se añaden como parte de la URL.

* **Persistencia nula:** Si navegas fuera de la página o la visitas de nuevo sin incluir el payload en la petición, el código dejará de ejecutarse inmediatamente debido a su naturaleza No-Persistente.