---
tags:
  - IDOR
  - webapp
  - attack
---
## Conceptos Clave (TL;DR)

* El primer paso para la explotación es identificar referencias directas a objetos en parámetros de URL, llamadas a APIs o cabeceras HTTP como las cookies.
* Funciones de usuario o administrador no visibles en la interfaz gráfica a menudo pueden descubrirse analizando el código JavaScript (front-end) en busca de llamadas AJAX vulnerables.
* Los identificadores aparentemente seguros pueden ser simples codificaciones (ej. Base64) o hashes generados en el lado del cliente; estos pueden ser decodificados o replicados para acceder a otros recursos.
* La validación de una vulnerabilidad avanzada de control de acceso en el servidor (back-end) requiere el uso de múltiples cuentas de usuario para comparar peticiones y parámetros de la API.
  
## Herramientas Clave

* **Aplicaciones de Fuzzing**: Utilizadas para automatizar la prueba de miles de variaciones en las referencias de objetos e identificar respuestas exitosas que revelen datos ajenos.
* **Decodificadores / Herramientas de identificación de hashes**: Empleadas para analizar referencias a objetos ofuscadas, determinar el algoritmo utilizado e intentar revertir o replicar la ofuscación.

## Metodología Paso a Paso

---
### Fase 1: Intercepción y Mapeo de Parámetros

* Capturar las peticiones HTTP y examinar la recepción de archivos o recursos para detectar referencias a objetos (ej. `?uid=1` o `?filename=file_1.pdf`) en URLs y APIs.
* Revisar exhaustivamente otras cabeceras HTTP, prestando especial atención a las cookies.
---
### Fase 2: Manipulación y Fuzzing de Referencias

* Intentar la manipulación manual incrementando los valores de las referencias a objetos (ej. cambiar `?uid=1` a `?uid=2`).
* Emplear una aplicación de fuzzing para probar automáticamente miles de variaciones y detectar vulnerabilidades IDOR a través de accesos exitosos a archivos ajenos.
---
### Fase 3: Análisis de Código Fuente Front-end

* Inspeccionar el código JavaScript del front-end en busca de parámetros, APIs no utilizadas o llamadas AJAX a endpoints específicos.
* Si se identifican funciones ocultas (como funciones administrativas deshabilitadas en la interfaz de un usuario estándar), probar llamadas directas a esos endpoints insertando referencias directas a objetos.
---
### Fase 4: Reversión de Codificación y Hashing

* Si una referencia emplea valores codificados (reconocibles por su juego de caracteres, como Base64), decodificar el valor para obtener la referencia en texto plano, modificarla por la del objetivo, volver a codificarla y enviarla en la petición.
* Si la referencia está hasheada, analizar el código fuente JavaScript para determinar si la aplicación está realizando el cálculo del hash en el front-end antes de la llamada a la API.
* Si el algoritmo es visible, calcular los hashes para los archivos u objetos objetivo e intentar acceder a ellos; alternativamente, usar identificadores de hashes para adivinar el algoritmo y generar hashes válidos.
---
### Fase 5: Análisis Comparativo entre Roles

* Registrar múltiples cuentas de usuario en la plataforma objetivo.
* Comparar las peticiones HTTP generadas por cada cuenta para comprender la lógica y el cálculo de los parámetros de URL y los identificadores únicos de la API.
* Iniciar sesión con un usuario y repetir las llamadas a la API que contengan la estructura y los parámetros de los datos de otro usuario distinto para validar la falta de control de acceso en el back-end.
---
## Cheat Sheet de Comandos

```javascript
# Análisis de llamadas AJAX ocultas en el front-end para descubrir endpoints administrativos

# Se debe buscar este tipo de estructuras en el código JS y probar interactuar con el endpoint directamente

function changeUserPassword() {
    $.ajax({
        url:"<TARGET_ENDPOINT>.php",
        type: "<HTTP_METHOD>",
        dataType: "json",
        data: {uid: <USER_UID>, password: <USER_PASSWORD>, is_admin: <IS_ADMIN_FLAG>},
        success:function(result){
            //
        }
    });
}
```

```javascript
# Identificación de generación de hashes en el lado del cliente (Front-end Hashing)

# Permite replicar la lógica de hashing (ej. MD5) para generar identificadores válidos para otros archivos u objetos

$.ajax({
    url:"<TARGET_ENDPOINT>.php",
    type: "<HTTP_METHOD>",
    dataType: "json",
    data: {filename: CryptoJS.MD5('<FILENAME>').toString()},
    success:function(result){
        //
    }
});
```

```json
# Estructura típica de objeto JSON en una API vulnerable a escalada de privilegios horizontales

# Replicar esta petición exacta utilizando el token de sesión de un segundo usuario para probar validación en el back-end

{
  "attributes" :
    {
      "type" : "<DATA_TYPE>",
      "url" : "<API_ENDPOINT>/<USER_ID>"
    },
  "Id" : "<USER_ID>",
  "Name" : "<USERNAME>"
}
```

## "Gotchas" y Troubleshooting

* **Falsa seguridad por ofuscación:** No asumir que un identificador es seguro simplemente porque parece un hash complejo o no legible en texto claro. El back-end puede carecer de sistema de control de acceso a pesar del uso de hashes.

* **Ausencia de validación en Back-end:** Una aplicación puede comprobar de manera correcta si existe una sesión válida (el usuario está logueado), pero fallar al no comparar si la sesión del solicitante tiene permisos sobre el dato específico que está intentando consultar.

* **Visibilidad de funciones:** Las funciones administrativas o sensibles pueden estar presentes en el código JavaScript entregado al cliente, incluso si la cuenta en uso no tiene el nivel de privilegios para ver los botones correspondientes en la interfaz de usuario.
```
</USERNAME></USER_ID></USER_ID></API_ENDPOINT></DATA_TYPE></FILENAME></HTTP_METHOD></TARGET_ENDPOINT></IS_ADMIN_FLAG></USER_PASSWORD></USER_UID></HTTP_METHOD></TARGET_ENDPOINT>
```

