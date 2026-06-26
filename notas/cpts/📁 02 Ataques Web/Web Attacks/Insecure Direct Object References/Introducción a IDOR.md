---
tags:
  - IDOR
  - webapp
---
## Conceptos Clave (TL;DR)

- IDOR ocurre cuando una aplicación expone referencias directas a objetos internos (IDs de base de datos, parámetros de URL, rutas de archivo) que el usuario puede manipular para acceder a recursos de otros usuarios.
- La vulnerabilidad real no es la exposición del objeto en sí, sino la **ausencia de un sistema de control de acceso en el back-end** que valide si el usuario autenticado tiene permisos sobre ese recurso específico.
- Existen dos variantes principales: **IDOR Information Disclosure** (lectura de datos ajenos) e **IDOR Insecure Function Calls** (ejecución de funciones privilegiadas, p. ej. endpoints de administrador, lo que puede llevar a escalada de privilegios o account takeover total).
- La protección en el front-end (ocultar botones, filtrar resultados en la UI) no es un control de seguridad válido; cualquier usuario puede manipular peticiones HTTP directamente y saltársela.

## Herramientas Clave

| Herramienta | Propósito en este vector |
|---|---|
| Burp Suite / OWASP ZAP | Interceptar y modificar peticiones HTTP para cambiar parámetros de referencia directa (IDs, nombres de archivo, etc.) |
| curl / wget | Enviar peticiones manuales con IDs manipulados desde la línea de comandos |
| ffuf / wfuzz | Automatizar la enumeración (fuzzing) de IDs numéricos o alfanuméricos para descubrir recursos accesibles |
| Browser DevTools | Inspeccionar el código fuente front-end en busca de endpoints de administrador o parámetros expuestos |

## Metodología Paso a Paso

### Fase 1 — Reconocimiento y Mapeo de Referencias

Identificar todos los puntos donde la aplicación expone referencias directas a objetos. El objetivo es construir un inventario de parámetros controlables por el usuario.

- Revisar URLs, parámetros GET/POST, cabeceras, cookies y respuestas JSON/XML.
- Buscar patrones predecibles: IDs numéricos secuenciales, UUIDs, nombres de archivo, hashes MD5 de datos predecibles.
- Inspeccionar el código fuente front-end y el JavaScript en busca de endpoints de API ocultos o parámetros de funciones administrativas que el front-end deshabilita pero no el back-end.

### Fase 2 — Prueba Manual de Acceso Horizontal

Verificar si un usuario puede acceder a recursos que pertenecen a otro usuario del mismo nivel de privilegio.

- Autenticarse como Usuario A, capturar una petición que referencie un objeto propio (p. ej. `file_id=123`).
- Modificar el valor del parámetro por el de un objeto ajeno (`file_id=124`, `file_id=1`, etc.).
- Analizar la respuesta: si el servidor devuelve datos del otro usuario sin error 403/401, la vulnerabilidad está confirmada.

### Fase 3 — Enumeración Automatizada

Una vez confirmada la vulnerabilidad manualmente, automatizar para extraer datos a escala.

- Usar ffuf o un script propio para iterar sobre rangos de IDs.
- Prestar atención a diferencias en el tamaño de respuesta (`Content-Length`) o códigos HTTP para distinguir registros válidos de inválidos.

### Fase 4 — Prueba de Escalada de Privilegios (IDOR Insecure Function Calls)

Verificar si es posible invocar funciones de administrador con credenciales de usuario estándar.

- Localizar en el código front-end o en el tráfico interceptado parámetros o endpoints destinados a roles superiores (p. ej. `/api/admin/change_password`, `role=admin`).
- Enviar la petición directamente al back-end con la sesión del usuario estándar.
- Si el back-end no valida el rol en el servidor, la operación se ejecutará con éxito.

## Cheat Sheet de Comandos

```bash
# Prueba manual básica: cambiar file_id para acceder a recurso de otro usuario
# -s: modo silencioso, -b: enviar cookie de sesión
curl -s -b "session=<SESSION_COOKIE>" "http://<TARGET_IP>/download.php?file_id=<TARGET_ID>"
```

```bash
# Enumeración de IDs numéricos con ffuf
# -u: URL objetivo con keyword FUZZ, -w: wordlist, -b: cookie, -mc: filtrar por código HTTP 200
ffuf -u "http://<TARGET_IP>/download.php?file_id=FUZZ" \
     -w /usr/share/seclists/Fuzzing/4-digits-0000-9999.txt \
     -b "session=<SESSION_COOKIE>" \
     -mc 200
```

```bash
# Enumeración con wfuzz filtrando por tamaño de respuesta para descartar "not found"
# -c: output con colores, -z range: rango de IDs, --hh: ocultar respuestas con N caracteres (baseline de error)
wfuzz -c -z range,1-500 \
      -b "session=<SESSION_COOKIE>" \
      --hh <BASELINE_CHARS> \
      "http://<TARGET_IP>/profile.php?user_id=FUZZ"
```

```bash
# Prueba de IDOR en endpoint de API con método PUT para modificar datos de otro usuario
# -X: método HTTP, -H: cabecera Content-Type, -d: payload JSON
curl -s -X PUT "http://<TARGET_IP>/api/v1/users/<TARGET_USER_ID>" \
     -H "Content-Type: application/json" \
     -b "session=<SESSION_COOKIE>" \
     -d '{"email":"<ATTACKER_EMAIL>","role":"admin"}'
```

```bash
# Inspeccionar código fuente de página en busca de endpoints o parámetros ocultos
curl -s -b "session=<SESSION_COOKIE>" "http://<TARGET_IP>/dashboard" | grep -iE "(api|admin|id|role|uid|file)"
```

```powershell
# Prueba de IDOR contra API en entornos Windows con PowerShell
# Invoke-WebRequest con cookie de sesión y ID manipulado
Invoke-WebRequest -Uri "http://<TARGET_IP>/api/files/<TARGET_FILE_ID>" `
                  -Headers @{Cookie="session=<SESSION_COOKIE>"} `
                  -Method GET
```

## "Gotchas" y Troubleshooting

- **IDs no secuenciales no implican seguridad:** Las aplicaciones que usan UUIDs o hashes como referencias directas siguen siendo vulnerables si el back-end carece de control de acceso; el esfuerzo de adivinanza es mayor, pero si el ID se puede obtener por otro vector (fuga en respuesta JSON, log, etc.) la vulnerabilidad sigue siendo explotable.
- **El front-end como única defensa es inútil:** Botones deshabilitados, campos ocultos o filtros de UI se saltan trivialmente manipulando la petición HTTP directamente. No confundir ausencia de UI con ausencia de endpoint funcional en el back-end.
- **Endpoints de administrador en el JS:** Revisar siempre los archivos `.js` cargados por la aplicación. Es común encontrar rutas de API privilegiadas comentadas o referenciadas en el código del front-end que el back-end no protege adecuadamente.
- **Prueba con dos sesiones simultáneas:** Para confirmar IDOR de forma limpia, abrir dos cuentas de prueba. Capturar el ID de un recurso del Usuario B e intentar accederlo desde la sesión del Usuario A. Esto elimina ambigüedad en los resultados.
- **Diferencias sutiles en la respuesta:** A veces el servidor devuelve código 200 tanto para acceso válido como inválido. Comparar el `Content-Length` o el cuerpo de respuesta (p. ej. objeto vacío `{}` vs objeto con datos) para determinar si hubo acceso real.
- **IDOR en peticiones POST/PUT:** No limitarse a parámetros GET. Los IDs en el cuerpo de peticiones POST (formularios o JSON) son igualmente vulnerables y a menudo se pasan por alto.
- **Escalada de privilegios vía parámetro `role`:** Un vector frecuente es la modificación del campo `role` o `is_admin` en peticiones de actualización de perfil. Intentar siempre incluir estos campos en peticiones de modificación aunque no aparezcan en la UI.