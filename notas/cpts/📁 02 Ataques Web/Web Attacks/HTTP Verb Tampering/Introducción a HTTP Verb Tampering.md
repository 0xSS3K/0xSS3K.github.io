---
tags:
  - webapp
  - attack
---
## Conceptos Clave (TL;DR)

- El protocolo HTTP soporta 9 verbos (GET, POST, HEAD, PUT, DELETE, OPTIONS, PATCH, entre otros). Si el servidor o la aplicacion no restringen explicitamente que metodos aceptan, un atacante puede usar verbos no contemplados para eludir controles de seguridad.
- **Insecure Configuration**: Los controles de autenticacion en el servidor web (ej. directiva `<Limit>` en Apache) pueden estar definidos solo para GET y POST, dejando otros verbos como HEAD accesibles sin autenticacion.
- **Insecure Coding**: Los filtros de validacion/sanitizacion pueden aplicarse sobre una superglobal (`$_GET`) mientras la query final usa otra (`$_REQUEST`), que acepta tanto GET como POST. Cambiar el verbo permite saltarse el filtro e inyectar directamente via el cuerpo de la peticion.
- El vector es critico porque combina facilidad de explotacion con origen dual: misconfiguracion de servidor O error de desarrollo.

## Herramientas Clave

| Herramienta | Proposito en este vector |
|---|---|
| `curl` | Enviar peticiones HTTP con verbos arbitrarios (`-X`) para probar respuestas del servidor |
| `Burp Suite` | Interceptar y modificar el metodo HTTP de cualquier peticion en tiempo real |
| Browser DevTools | Observar respuestas a peticiones OPTIONS para enumerar verbos permitidos |

## Metodologia Paso a Paso

### Fase 1: Enumeracion de Verbos Permitidos

Determinar que metodos acepta el servidor objetivo antes de intentar cualquier bypass. El servidor puede revelarlos a traves del header `Allow` en la respuesta a una peticion OPTIONS.

### Fase 2: Identificar el Mecanismo de Control

Determinar si la restriccion es a nivel de servidor (config de autenticacion tipo `<Limit>`) o a nivel de aplicacion (filtros en codigo). Esto define que tecnica de bypass aplicar.

- Si al cambiar el verbo se elimina el prompt de autenticacion o se accede a la funcion protegida: es **misconfiguracion de servidor**.
- Si al cambiar el verbo (ej. de GET a POST) se ejecuta una accion que debia estar filtrada: es **insecure coding**.

### Fase 3: Bypass de Autenticacion (Insecure Config)

Enviar la peticion a la ruta protegida usando un verbo que no este cubierto por la directiva de autenticacion del servidor (tipicamente HEAD, OPTIONS, PUT). Si el servidor procesa la peticion sin solicitar credenciales, el bypass es exitoso.

### Fase 4: Bypass de Filtro / Inyeccion (Insecure Coding)

Identificar en que parametro y con que metodo se aplica el filtro (ej. solo sobre `$_GET["param"]`). Reenviar el payload malicioso usando el verbo alternativo (ej. POST) de forma que el parametro filtrado llegue vacio pero la query use `$_REQUEST["param"]`, recibiendo el payload del cuerpo de la peticion sin pasar por el filtro.

## Cheat Sheet de Comandos

```bash
# Enumerar verbos HTTP aceptados por el servidor objetivo
# -I: solo headers (HEAD request), -X: especificar metodo, -i: incluir headers en output
curl -X OPTIONS <TARGET_URL> -i
```

```bash
# Enviar peticion con verbo HEAD para intentar bypass de autenticacion en ruta protegida
# -X HEAD: usa el metodo HEAD; omite body pero el servidor ejecuta la logica de la ruta
curl -X HEAD <TARGET_URL>/<PROTECTED_PATH>/ -i
```

```bash
# Intentar bypass con verbo GET alternativo cuando la restriccion cubre solo POST (o viceversa)
curl -X GET <TARGET_URL>/<PROTECTED_PATH>/ -i
```

```bash
# Bypass de filtro SQLi: enviar payload via POST cuando el filtro solo valida $_GET
# --data: envia el payload en el body como parametro POST, eludiendo el filtro sobre $_GET
curl -X POST <TARGET_URL>/<VULNERABLE_PAGE> --data "code=<SQLI_PAYLOAD>" -i
```

```bash
# Probar con PUT si el servidor permite escritura en el webroot (riesgo critico)
# --data o --upload-file: contenido a escribir en la ruta especificada
curl -X PUT <TARGET_URL>/<REMOTE_PATH>/<FILENAME> --data "<FILE_CONTENT>"
```

```bash
# Usar curl para probar DELETE sobre un recurso (verificar si el servidor permite borrado sin auth)
curl -X DELETE <TARGET_URL>/<REMOTE_RESOURCE_PATH> -i
```

**Burp Suite (flujo manual):**

```
1. Interceptar la peticion con Proxy > Intercept ON
2. Click derecho sobre la peticion > "Change request method"
   (alterna entre GET y POST automaticamente)
3. Para otros verbos (HEAD, PUT, OPTIONS): editar manualmente
   la primera linea del request:
   Antes: GET /protected/page HTTP/1.1
   Despues: HEAD /protected/page HTTP/1.1
4. Forward y observar la respuesta
```

## "Gotchas" y Troubleshooting

- **HEAD no devuelve body**: El verbo HEAD es identico a GET pero la respuesta no incluye cuerpo. Un codigo de respuesta 200 sin body al usar HEAD sobre una ruta protegida confirma el bypass aunque no se vea contenido.
- **La directiva `<Limit>` de Apache es la trampa clasica**: Solo protege los verbos listados explicitamente. Cualquier verbo fuera de esa lista pasa sin autenticacion. La directiva correcta seria `<LimitExcept>` que bloquea todo excepto los listados.
- **`$_REQUEST` en PHP absorbe GET, POST y COOKIE**: Si un filtro valida `$_GET["param"]` pero la query usa `$_REQUEST["param"]`, el payload puede entrar via POST body o incluso via cookie sin ser filtrado.
- **Prerequisito para escritura via PUT/DELETE**: El servidor debe tener el modulo WebDAV habilitado o una configuracion explicita que permita esos metodos. No todos los servidores lo tienen activo por defecto.
- **Verbos no estandar pueden generar errores 405 (Method Not Allowed)**: Una respuesta 405 confirma que el servidor reconoce el verbo pero no lo permite; una respuesta 200 o 302 inesperada indica el bypass. Una respuesta 200 donde antes habia 401/403 es el indicador de exito principal.
- **La segunda variante (insecure coding) es mucho mas frecuente** que la misconfiguracion de servidor, ya que suele ser un error silencioso durante el desarrollo y los scanners automaticos no siempre la detectan.