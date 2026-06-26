---
tags:
  - webapp
  - xss
---
## Conceptos Clave (TL;DR)

* Es un tipo de XSS no persistente que se procesa completamente en el lado del cliente a través de JavaScript, cambiando el código fuente de la página mediante el Document Object Model (DOM).

* A diferencia del XSS reflejado, los datos de entrada se procesan en el navegador y nunca llegan al servidor backend.

* La vulnerabilidad depende de la interacción entre un "Source" (el objeto de JavaScript que toma la entrada del usuario) y un "Sink" (la función que escribe esa entrada en el DOM sin la sanitización adecuada).

  
## Herramientas Clave

* **Firefox Developer Tools (Pestaña Network)**: Utilizada para confirmar que el procesamiento ocurre localmente al verificar que no se realizan peticiones HTTP hacia el servidor.

* **Web Inspector (CTRL+SHIFT+C)**: Herramienta esencial para visualizar el código fuente renderizado donde se inyecta el payload.

  
## Metodología Paso a Paso 

### Fase 1: Identificación del Vector

Ingresa una cadena de texto de prueba y monitorea el tráfico de red. Si la entrada utiliza un parámetro cliente (como un hashtag `#` en la URL) y no se generan peticiones HTTP en la pestaña Network al procesarse, indica una posible vulnerabilidad DOM XSS.

  
### Fase 2: Análisis de Source y Sink

Inspecciona el código fuente de JavaScript de la aplicación para rastrear el flujo de los datos. Localiza el *Source* (como la variable de URL) y el *Sink*. Evalúa si el *Sink* utiliza funciones de escritura directas y sin sanitización, tales como `document.write()`, `DOM.innerHTML`, `DOM.outerHTML`, o funciones de jQuery como `add()`, `after()`, y `append()`.
  

### Fase 3: Inyección y Explotación

Una vez confirmado que el *Sink* no sanitiza el input, adapta e inyecta el payload directamente en el parámetro vulnerable de la URL. Para comprometer a un objetivo, copia la URL resultante y compártela; el código se ejecutará al momento de la visita.

  
## Cheat Sheet de Comandos
```html
# Crea un objeto de imagen vacío ("") para forzar un error, activando el atributo onerror

# para ejecutar código JavaScript sin requerir el uso de etiquetas <script>.

<img src="" onerror=alert(window.origin)>
```

```bash
# URL de explotación objetivo inyectando el payload directamente en el parámetro cliente controlado por el hashtag (#).

# Al ser visitada por la víctima, se procesará en su navegador de forma local.

http://<TARGET_IP>:<PORT>/#<PARAMETER>=<img src="" onerror=alert(window.origin)>
```

  

## "Gotchas" y Troubleshooting

* **Restricción de innerHTML**: Si el *Sink* identificado es la función `innerHTML`, los payloads básicos que utilizan etiquetas `<script>` no se ejecutarán debido a sus características de seguridad incorporadas. Debes usar payloads alternativos (como eventos `onerror` en etiquetas `<img>` u otros atributos HTML).

* **Visibilidad del código fuente**: El payload inyectado no se encontrará si utilizas el atajo CTRL+U para ver el código fuente base. El JavaScript actualiza el DOM después de que el navegador recupera el código fuente base. Para verificar tu inyección, es obligatorio usar la herramienta Web Inspector en su lugar.