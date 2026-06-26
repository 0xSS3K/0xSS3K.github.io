---
tags:
  - bypass
  - verbtamp
  - attack
  - webapp
---
## Conceptos Clave (TL;DR)

- Los filtros de seguridad mal implementados solo validan un subconjunto de métodos HTTP (normalmente POST), dejando otros métodos como GET sin validar, lo que permite evadir controles de seguridad.
- Al cambiar el método HTTP de la petición (ej. de POST a GET), el back-end puede procesar el parámetro malicioso por una ruta de código que no aplica el filtro.
- Esta técnica no explota una vulnerabilidad directamente, sino que actúa como bypass para llegar a una vulnerabilidad subyacente (ej. Command Injection, SQLi).
- La raíz del problema es un error de desarrollo: el filtro chequea `$_POST['parameter']` pero no `$_GET['parameter']`, lo que deja expuesta la funcionalidad si se cambia el verbo.

## Herramientas Clave

- **Burp Suite**: Interceptar y modificar peticiones HTTP en tránsito; usar la función "Change Request Method" para alternar entre verbos (GET, POST, PUT, etc.).

## Metodología Paso a Paso

### Fase 1: Identificacion del Filtro

1. Interactuar con la funcionalidad objetivo enviando un payload malicioso (ej. caracteres especiales como `;`) usando el método HTTP por defecto.
2. Confirmar que la aplicación detecta y bloquea la peticion (respuesta del tipo "Malicious Request Denied" o similar).
3. Esto prueba que existe un filtro activo, pero tambien que la funcionalidad procesa input del usuario, lo que hace viable un bypass.

### Fase 2: Intento de Bypass por Verbo

1. Interceptar la peticion bloqueada con Burp Suite antes de que llegue al servidor.
2. Usar "Change Request Method" (clic derecho sobre la peticion en Burp) para cambiar el verbo HTTP al opuesto (POST -> GET o GET -> POST).
3. Reenviar la peticion con el mismo payload que fue bloqueado.
4. Si la aplicacion no devuelve el mensaje de bloqueo, el filtro no cubre ese verbo: bypass exitoso.

### Fase 3: Confirmacion de Explotacion

1. Una vez confirmado el bypass, escalar el payload de prueba a un payload funcional para la vulnerabilidad subyacente (ej. Command Injection).
2. Usar un payload que produzca un efecto verificable en el servidor (ej. crear dos archivos con `file1; touch file2;`).
3. Verificar el resultado en la aplicacion (ej. ambos archivos aparecen listados) para confirmar ejecucion remota de comandos.

## Cheat Sheet de Comandos

```bash
# Payload de prueba inicial: caracter especial para activar el filtro y confirmar que existe
# Se envia como nombre de archivo o parametro segun la funcionalidad
test;
```

```bash
# Payload de Command Injection para confirmar ejecucion de comandos en el servidor
# El comando 'touch file2' crea un segundo archivo; si ambos aparecen, hay RCE
file1; touch file2;
```

```http
# Peticion original bloqueada (metodo POST con filtro activo)
POST /<ENDPOINT> HTTP/1.1
Host: <TARGET_IP>:<PORT>
Content-Type: application/x-www-form-urlencoded

filename=test%3B
```

```http
# Peticion modificada con verbo cambiado a GET para bypassear el filtro
# El parametro se mueve a la query string; el filtro que solo revisa $_POST no lo procesa
GET /<ENDPOINT>?filename=test%3B HTTP/1.1
Host: <TARGET_IP>:<PORT>
```

```http
# Peticion final con payload de Command Injection via GET para confirmar RCE
# %3B = ';' URL-encoded; '+' = espacio URL-encoded
GET /<ENDPOINT>?filename=file1%3B+touch+file2%3B HTTP/1.1
Host: <TARGET_IP>:<PORT>
```

## "Gotchas" y Troubleshooting

- **La direction del bypass puede ser inversa**: si la funcionalidad usa GET por defecto y el filtro solo cubre GET, el bypass se hace cambiando a POST. Siempre probar en ambas direcciones.
- **Burp Suite "Change Request Method" reubica los parametros automaticamente**: al pasar de POST a GET, Burp mueve el body a la query string. Verificar que el parametro malicioso se haya trasladado correctamente antes de reenviar.
- **El bypass de filtro no implica RCE automatico**: HTTP Verb Tampering solo evade el WAF/filtro. La vulnerabilidad explotable (SQLi, CMDi, etc.) debe existir de forma independiente en el back-end.
- **Otros verbos a probar**: ademas de GET/POST, considerar HEAD, PUT, PATCH, OPTIONS o verbos arbitrarios/invalidos; algunos frameworks procesan parametros de formas inesperadas con estos metodos.
- **URL encoding**: caracteres como `;` se encodean como `%3B` en la query string. Burp lo maneja automaticamente, pero al construir peticiones manuales hay que tenerlo en cuenta.
- **Verificacion de exito**: siempre usar un payload con efecto observable y determinista (crear un archivo, generar un delay con `sleep`, etc.) para confirmar ejecucion antes de escalar el ataque.