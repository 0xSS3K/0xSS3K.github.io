---
tags:
  - webapp
  - attack
---
## Conceptos Clave (TL;DR)

* Vulnerabilidad que ocurre cuando un framework web permite insertar un conjunto completo de datos ingresados por el usuario directamente en un objeto o base de datos sin un mecanismo de *whitelisting* adecuado. 
* Los atacantes modifican atributos del modelo de datos interceptando peticiones HTTP e inyectando parámetros adicionales no protegidos.
* Este vector permite escalar privilegios, evadir procesos de aprobación, robar información sensible o destruir datos alterando la lógica prevista de la aplicación.  

## Herramientas Clave

* **Burp Suite:** Utilizado para interceptar, analizar y manipular las peticiones HTTP POST antes de que lleguen al servidor, facilitando la inyección de los parámetros ocultos.

## Metodología Paso a Paso

### Fase 1: Reconocimiento y Análisis

* **Lógica:** Necesitamos identificar los puntos de entrada de datos (formularios de registro, actualización de perfiles) y descubrir atributos del modelo que no se estén solicitando por defecto.
* Si se tiene acceso al código fuente o si se puede realizar ingeniería inversa, inspeccionar los modelos de datos y controladores (ej. scripts en Python/Flask o modelos en Ruby on Rails).
* Buscar variables condicionales o atributos críticos que gestionen permisos o estados de la cuenta, tales como `admin` o `confirmed`.

### Fase 2: Intercepción y Manipulación de Peticiones

* **Lógica:** Al no existir controles sobre qué parámetros se procesan, agregamos nuestros propios pares clave-valor a la petición para forzar la modificación del atributo en la base de datos.
* Capturar la petición HTTP de registro o actualización utilizando un proxy como Burp Suite.
* Añadir los parámetros descubiertos a la estructura de datos que se envía al servidor (ya sea en formato JSON o *Form-Data*) y asignarles valores favorables (ej. `true` o `test`).

### Fase 3: Ejecución y Verificación

* **Lógica:** Comprobar si el framework procesó nuestra carga útil y aplicó los cambios sobre el perfil del usuario.
* Enviar la petición alterada al servidor.
* Autenticarse con el usuario recién creado o modificado para verificar si se logró evadir los procesos de aprobación o si se cuenta con privilegios administrativos.

## Cheat Sheet de Comandos

```bash
# Realiza una peticion POST enviando parametros extra en formato JSON para evadir controles de acceso o elevar privilegios

curl -X POST http://<TARGET_IP>/<ENDPOINT> \
-H "Content-Type: application/json" \
-d '{"user": {"username": "<USER>", "email": "<USER>@<DOMAIN>.com", "<VULNERABLE_PARAMETER>": true}}'
```

```bash
# Envia una peticion POST con datos de formulario inyectando parametros de estado descubiertos (ej. confirmed=test)

curl -X POST http://<TARGET_IP>/<REGISTER_ENDPOINT> \
-H "Content-Type: application/x-www-form-urlencoded" \
-d "username=<USER>&password=<PASSWORD>&<VULNERABLE_PARAMETER>=<VALUE>"
```

## "Gotchas" y Troubleshooting

* **Validación de existencia vs validación de contenido:** En ciertas aplicaciones, el servidor solo verifica si el parámetro existe en la petición, no su valor real. Por ejemplo, enviar un valor aleatorio como `test` en lugar de un booleano puede ser suficiente para cumplir condiciones mal programadas (`if request.form['confirmed']:`).

* **Visibilidad de parámetros:** Los parámetros vulnerables casi nunca son visibles en la interfaz de usuario; requieren revisión del código fuente, fuzzing de parámetros o análisis heurístico del comportamiento de la aplicación.

* **Prevención y mitigación:** Si el objetivo utiliza versiones modernas de frameworks con *Strong Parameters* (parámetros fuertes) o *whitelisting* configurado explícitamente, este ataque fallará porque las entradas adicionales serán ignoradas.