---
tags:
  - IDOR
  - API
  - webapp
  - attack
---
## Conceptos Clave (TL;DR)

* Las vulnerabilidades IDOR en APIs y llamadas a funciones inseguras permiten a un atacante ejecutar acciones (modificar, crear, eliminar) en nombre de otros usuarios.
* Los privilegios de control de acceso suelen enviarse de forma insegura desde el lado del cliente, ya sea dentro de una Cookie (ej. `role=employee`) o en el cuerpo de una petición JSON, lo que permite su manipulación.
* Es común encadenar dos tipos de IDOR: usar IDOR de Divulgación de Información (vía peticiones GET) para extraer datos sensibles de otros usuarios (como UUIDs o roles), y luego usar esos datos en un IDOR de Llamada a Función Insegura (vía PUT/POST) para evadir validaciones del backend.

## Herramientas Clave

* **Burp Suite:** Indispensable para interceptar el tráfico HTTP, modificar los métodos de la petición (GET, PUT, POST, DELETE), y manipular parámetros ocultos en el cuerpo JSON o en las Cookies.

## Metodología Paso a Paso

---
1. **Identificación de Endpoints y Parámetros Ocultos:**

   * Interactúa con la aplicación web (ej. editar un perfil) e intercepta la petición.

   * Analiza el método HTTP utilizado (PUT para actualizar, POST para crear, DELETE para borrar, GET para leer).

   * Inspecciona el cuerpo de la petición (JSON) y las cabeceras/Cookies en busca de parámetros sensibles o de control de acceso (ej. `uid`, `uuid`, `role`).

---

2. **Manipulación de Identificadores (Horizontal Escalation):**

   * Intenta cambiar tu identificador (`uid`) por el de otro usuario en la carga útil (payload) JSON y en la URL del endpoint de la API.

   * Observa la respuesta del servidor para identificar mecanismos de validación (ej. errores si el `uid` del endpoint no coincide con el del JSON).
  ---

3. **Prueba de Métodos HTTP Alternativos:**

   * Cambia el método de la petición interceptada (ej. de PUT a POST o DELETE) apuntando al identificador de otro usuario para comprobar si existen restricciones en la creación o eliminación de recursos.

---

4. **Escalamiento de Privilegios (Vertical Escalation):**

   * Modifica parámetros que definan niveles de acceso, como el `role` dentro del JSON o en las Cookies, intentando inyectar valores con mayores privilegios (ej. `admin`, `administrator`).
  ---

5. **Encadenamiento (Chaining) con Information Disclosure:**

   * Si las peticiones de modificación fallan debido a validaciones secundarias (ej. se requiere un `uuid` específico del usuario objetivo), cambia el método a GET e intenta leer los perfiles de otros usuarios.

   * Utiliza la información filtrada para construir una petición PUT/POST válida y evadir las protecciones.
  ---
## Cheat Sheet de Comandos

```http
# Interceptar y analizar petición de actualización (PUT). Buscar parámetros ocultos.

PUT /<API_ENDPOINT_PATH>/<USER_ID> HTTP/1.1

Host: <TARGET_IP>:<PORT>

Cookie: role=<CURRENT_ROLE>

{
    "uid": <USER_ID>,
    "uuid": "<CURRENT_UUID>",
    "role": "<CURRENT_ROLE>",
    "full_name": "<NAME>",
    "email": "<EMAIL>",
    "about": "<TEXT>"
}
```

```http
# Intento de IDOR modificando los detalles de otro usuario.

# Se cambia el endpoint y el uid para que coincidan y evitar validaciones básicas.

PUT /<API_ENDPOINT_PATH>/<TARGET_UID> HTTP/1.1

Host: <TARGET_IP>:<PORT>

Cookie: role=<CURRENT_ROLE>

{
    "uid": <TARGET_UID>,
    "uuid": "<CURRENT_UUID>",
    "role": "<CURRENT_ROLE>",
    "full_name": "Hacked",
    "email": "hacked@<DOMAIN>",
    "about": "Hacked"
}
```

```http
# Intento de creación de usuario cambiando el método a POST apuntando a un nuevo UID.

POST /<API_ENDPOINT_PATH>/<NEW_UID> HTTP/1.1

Host: <TARGET_IP>:<PORT>

Cookie: role=<CURRENT_ROLE>

{
    "uid": <NEW_UID>,
    "uuid": "<CURRENT_UUID>",
    "role": "<CURRENT_ROLE>",
    "full_name": "New User",
    "email": "new@<DOMAIN>",
    "about": "New Profile"
}
```

```http
# Testear Divulgación de Información (Information Disclosure) para extraer el UUID del objetivo.

# Si es exitoso, usar el UUID filtrado en el payload del método PUT.

GET /<API_ENDPOINT_PATH>/<TARGET_UID> HTTP/1.1

Host: <TARGET_IP>:<PORT>

Cookie: role=<CURRENT_ROLE>
```

## "Gotchas" y Troubleshooting

* **Error `uid mismatch`:** Ocurre cuando el número del `uid` en el cuerpo JSON de la petición no coincide con el identificador numérico enviado en la URL de la API (el endpoint). Ambos deben sincronizarse al realizar las pruebas.
* **Error `uuid mismatch`:** Protección secundaria del backend que verifica que el token/UUID enviado corresponde legítimamente al usuario que se intenta modificar. No puedes usar tu propio `uuid` para modificar a otro usuario; debes descubrir el `uuid` del objetivo primero (generalmente mediante una petición GET vulnerable).
* **Error `Invalid role`:** Aparece al intentar escalar privilegios inyectando un rol que no existe en la base de datos de la aplicación. Obliga a adivinar, realizar fuerza bruta sobre los nombres de roles, o filtrar un nombre de rol válido de otro usuario.
* **Doble Validación de Autorización:** El servidor podría estar validando los permisos basándose en la Cookie de sesión (ej. `role=employee`) además de los parámetros enviados en el cuerpo JSON. Asegúrate de manipular ambos si buscas un Bypass de Autorización.
