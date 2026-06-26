---
tags:
  - IDOR
  - mitigation
  - webapp
---
## Conceptos Clave (TL;DR)

* Las vulnerabilidades IDOR se originan principalmente por controles de acceso inadecuados o faltantes en los servidores backend.
* La prevención requiere dos capas: implementación de control de acceso a nivel de objeto (ej. RBAC) y uso de referencias de objetos seguras.
* Los roles y privilegios deben mapearse de forma centralizada en el backend utilizando el token de sesión autenticado, nunca confiando en parámetros controlados por el usuario.
* Las referencias a los objetos no deben usar patrones secuenciales o texto claro (ej. uid=1), sino valores aleatorios y fuertes como UUID V4 o hashes con sal.

## Herramientas Clave

* El texto base no especifica herramientas de explotación en línea de comandos, enfocándose netamente en arquitectura defensiva y revisión de código (White-box/Code Review) para identificar debilidades estructurales.

## Metodología Paso a Paso

* **Fase 1: Revisión de Control de Acceso (RBAC)**
  La lógica de este paso es garantizar que el backend verifique activamente si el usuario autenticado tiene permisos sobre el objeto específico solicitado. Se debe evitar la lectura de roles desde cookies o perfiles manipulables.

* **Fase 2: Revisión de Referencias de Objetos (Obfuscación)**
  La lógica es comprobar que la aplicación no expone identificadores directos previsibles. Se busca la implementación de UUIDs (ej. 89c9b29b-d19f-4515-b2dd-abb6e693eb20) mapeados en la base de datos.
* **Fase 3: Evaluación de Generación de Hashes**
  La lógica es auditar dónde se genera la referencia segura. Los hashes o UUIDs deben generarse exclusivamente en el backend al crear el objeto, nunca calculados desde el frontend.

## Cheat Sheet de Comandos

*Nota: El texto original se centra en prevención y revisión de código fuente. A continuación se extraen los fragmentos técnicos de código proporcionados que ilustran la implementación segura y vulnerable, adaptados para revisión.*
```javascript
# Implementación segura de validación de RBAC en el backend (ejemplo de reglas de API)

# Evalúa el token de sesión autenticado en lugar de parámetros HTTP controlados por el usuario.

match /api/profile/{<USER_ID>} {

    allow read, write: if user.isAuth == true
    && (user.uid == <USER_ID> || user.roles == 'admin');
}
```

```php
# Ejemplo de consulta a base de datos utilizando referencias directas.

# Para asegurar esto, <UID> debe ser un valor aleatorio (UUIDv4) y no un entero predecible.

$uid = intval($_REQUEST['<UID_PARAMETER>']);
$query = "SELECT url FROM documents where uid=" . $uid;
$result = mysqli_query($conn, $query);
$row = mysqli_fetch_array($result);
echo "<a href='" . $row['url'] . "' target='_blank'></a>";
```

## "Gotchas" y Troubleshooting

* **Falsa sensación de seguridad con UUIDs:** Usar referencias complejas (como UUIDs) dificulta la detección del IDOR, pero no soluciona la vulnerabilidad si el control de acceso a nivel de objeto es inexistente o defectuoso.

* **Explotación de IDOR ofuscado:** Si solo se usan UUIDs sin RBAC, la vulnerabilidad aún puede ser explotada repitiendo la solicitud de un usuario utilizando la sesión de otro atacante.

* **Hashes en el Frontend:** Es un error crítico de diseño calcular los hashes de los objetos en la parte del cliente (frontend).

* **Manipulación de Roles:** Guardar el rol del usuario dentro de los detalles del usuario o en una cookie permite la escalada de privilegios y anula cualquier defensa contra IDOR.