---
tags:
  - mitigation
  - webapp
  - verbtamp
---
## Conceptos Clave (TL;DR)

- Las vulnerabilidades de Verb Tampering nacen de dos causas: configuración insegura del servidor (restringir auth solo a un verbo concreto) y código inseguro (inconsistencia entre el verbo usado para filtrar y el usado para ejecutar).
- Limitar autorización a `GET` en la config del servidor deja todas las demás peticiones (POST, HEAD, OPTIONS, PUT...) sin protección de autenticación.
- En código, mezclar `$_POST` para validar y `$_REQUEST` para ejecutar es un bypass trivial: el filtro comprueba POST, el atacante inyecta por GET, y `$_REQUEST` lo recoge igualmente.
- La mitigación correcta es aplicar controles a TODOS los verbos/métodos HTTP, sin excepción, tanto en la configuración del servidor como en las funciones de seguridad del código.

## Herramientas Clave

| Herramienta / Concepto | Propósito en este vector |
|---|---|
| Burp Suite / curl | Manipular el verbo HTTP de la petición para explotar la config vulnerable |
| Revisión de `000-default.conf` / `.htaccess` | Auditar configuración de Apache para detectar `<Limit>` mal aplicado |
| Revisión de `web.xml` | Auditar configuración de Tomcat para detectar `<http-method>` restrictivo |
| Revisión de `web.config` | Auditar configuración de ASP.NET para detectar `allow/deny` limitado a un verbo |
| Grep / revisión de código fuente | Detectar inconsistencias entre `$_POST` vs `$_REQUEST` (o equivalentes) en el código |

## Metodología Paso a Paso

### Fase 1 - Identificar el punto de restricción de autorización

Localizar los archivos de configuración del servidor web y buscar bloques de autorización que limiten el control a un único verbo. El problema es que proteger solo un método deja el resto expuesto sin autenticación.

- **Apache**: `000-default.conf` o `.htaccess` — buscar la directiva `<Limit>`.
- **Tomcat**: `web.xml` — buscar la etiqueta `<http-method>` dentro de `<security-constraint>`.
- **ASP.NET**: `web.config` — buscar atributos `verbs="GET"` en bloques `<allow>` o `<deny>`.

### Fase 2 - Verificar explotabilidad cambiando el verbo

Enviar la petición a la ruta protegida usando un verbo alternativo (POST si solo hay restricción en GET, o HEAD/OPTIONS como comodín). Si el servidor responde con contenido en lugar de un 401/403, la config es vulnerable.

### Fase 3 - Auditar el código fuente en busca de inconsistencias de método

Buscar funciones de validación/sanitización que operen sobre `$_POST` (o equivalente) mientras la función de ejecución opera sobre `$_REQUEST`. Cualquier split entre "filtro" y "acción" usando distintos superglobales es candidato a bypass.

### Fase 4 - Aplicar parches

**Configuración del servidor**: reemplazar directivas restrictivas por sus equivalentes seguros que cubran todos los verbos menos el especificado.

**Código**: unificar el superglobal usado en filtros y en ejecución, usando siempre `$_REQUEST` / `request.getParameter()` / `Request[]` en ambas partes, o aplicar el filtro antes de llegar a cualquier superglobal ambiguo.

## Cheat Sheet de Comandos

```bash
# Probar acceso con POST a una ruta que solo restringe GET (bypass de auth)
curl -s -X POST http://<TARGET_IP>/admin/

# Probar con HEAD para detectar si queda expuesto (responde sin body pero sin 401)
curl -s -I http://<TARGET_IP>/admin/

# Probar con OPTIONS para enumerar métodos permitidos por el servidor
curl -s -X OPTIONS http://<TARGET_IP>/admin/ -v

# Enviar parámetro por GET a un endpoint que filtra solo $_POST (bypass de filtro de código)
# El filtro preg_match comprueba $_POST['filename'] (vacío), pero system() usa $_REQUEST['filename']
curl -s "http://<TARGET_IP>/admin/filemanager.php?filename=<PAYLOAD>"
```

```xml
<!-- VULNERABLE - Apache: solo protege GET, deja POST y el resto sin auth -->
<Directory "/var/www/html/admin">
    AuthType Basic
    AuthName "Admin Panel"
    AuthUserFile /etc/apache2/.htpasswd
    <Limit GET>
        Require valid-user
    </Limit>
</Directory>

<!-- SEGURO - Apache: usar LimitExcept cubre TODOS los verbos excepto GET -->
<Directory "/var/www/html/admin">
    AuthType Basic
    AuthName "Admin Panel"
    AuthUserFile /etc/apache2/.htpasswd
    <LimitExcept GET>
        Require valid-user
    </LimitExcept>
</Directory>
```

```xml
<!-- VULNERABLE - Tomcat web.xml: auth solo aplica a GET -->
<security-constraint>
    <web-resource-collection>
        <url-pattern>/admin/*</url-pattern>
        <http-method>GET</http-method>
    </web-resource-collection>
    <auth-constraint>
        <role-name>admin</role-name>
    </auth-constraint>
</security-constraint>

<!-- SEGURO - Tomcat: usar http-method-omission cubre todos los verbos excepto el especificado -->
<security-constraint>
    <web-resource-collection>
        <url-pattern>/admin/*</url-pattern>
        <http-method-omission>GET</http-method-omission>
    </web-resource-collection>
    <auth-constraint>
        <role-name>admin</role-name>
    </auth-constraint>
</security-constraint>
```

```xml
<!-- VULNERABLE - ASP.NET web.config: allow/deny scoped solo a GET -->
<system.web>
    <authorization>
        <allow verbs="GET" roles="admin">
            <deny verbs="GET" users="*">
            </deny>
        </allow>
    </authorization>
</system.web>

<!-- SEGURO - ASP.NET: usar add/remove para cubrir todos los verbos -->
<system.web>
    <authorization>
        <allow roles="admin" />
        <deny users="*" />
    </authorization>
</system.web>
```

```php
<?php
// VULNERABLE: filtro usa $_POST, ejecucion usa $_REQUEST
// Un atacante pasa el payload por GET -> $_POST esta vacio -> preg_match no lo ve -> system() lo ejecuta
if (isset($_REQUEST['filename'])) {
    if (!preg_match('/[^A-Za-z0-9. _-]/', $_POST['filename'])) {
        system("touch " . $_REQUEST['filename']);
    } else {
        echo "Malicious Request Denied!";
    }
}

// SEGURO: usar el mismo superglobal en filtro y en ejecucion
if (isset($_REQUEST['filename'])) {
    if (!preg_match('/[^A-Za-z0-9. _-]/', $_REQUEST['filename'])) {
        system("touch " . $_REQUEST['filename']);
    } else {
        echo "Malicious Request Denied!";
    }
}
?>
```

```
# Tabla de superglobales seguros para funciones de seguridad (cubren GET + POST + COOKIE)
PHP   -> $_REQUEST['param']
Java  -> request.getParameter('param')
C#    -> Request['param']
```

## "Gotchas" y Troubleshooting

- **`<Limit>` vs `<LimitExcept>` en Apache**: el error mas frecuente es usar `<Limit GET>` creyendo que "protege GET". En realidad solo aplica la directiva interna a GET; todo lo demas queda sin la directiva. `<LimitExcept GET>` hace lo opuesto: aplica la directiva a todos los verbos EXCEPTO GET. Para auth, `LimitExcept` es casi siempre la opcion correcta.

- **HEAD siempre debe deshabilitarse si no es necesario**: HEAD es funcionalmente identico a GET para el servidor (misma ruta de codigo), pero muchos configs de `<Limit GET>` no incluyen HEAD. Esto permite un bypass limpio y sin body de respuesta que puede pasar desapercibido en logs menos verbosos.

- **El bypass de codigo no requiere herramienta especial**: el vector mas peligroso (inconsistencia `$_POST` vs `$_REQUEST`) se explota con un simple GET en la URL. No hace falta Burp ni modificacion de cabeceras.

- **En aplicaciones reales el split filtro/ejecucion estara en funciones separadas**: el modulo advierte que en produccion el `preg_match` y el `system()` no estaran en lineas consecutivas. Hay que trazar el flujo completo de datos: donde entra el parametro, que superglobal usa el validador y que superglobal usa el ejecutor.

- **`$_REQUEST` en PHP incluye `$_GET`, `$_POST` y `$_COOKIE`**: si el filtro solo mira `$_POST` y el atacante inyecta por cookie, el bypass tambien funciona. El mismo principio aplica.

- **Tomcat `http-method` sin `http-method-omission`**: si no se especifica ningun `<http-method>`, Tomcat aplica el constraint a TODOS los metodos (comportamiento seguro por defecto). El problema ocurre exactamente cuando el desarrollador intenta ser explicito y lista solo GET.

- **ASP.NET `verbs` attribute**: si se omite el atributo `verbs` en `<allow>` y `<deny>`, la regla aplica a todos los verbos (seguro). Agregarlo explicitamente con un solo verbo es lo que introduce la vulnerabilidad.