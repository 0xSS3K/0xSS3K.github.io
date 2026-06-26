---
tags:
  - webapp
  - commandinjection
  - RCE
  - mitigation
---
## Conceptos Clave (TL;DR)

- La raiz del problema es pasar input de usuario (directa o indirectamente) a funciones que ejecutan comandos del sistema. La solucion es eliminar esa dependencia usando funciones built-in del lenguaje.
- La defensa en profundidad requiere tres capas en orden: Validacion de input (formato correcto) -> Sanitizacion de input (eliminar caracteres peligrosos) -> Configuracion segura del servidor (limitar el impacto si falla lo anterior).
- Las blacklists de caracteres/comandos son un enfoque fragil y bypasseable; siempre se prefieren whitelists (regex o funciones nativas que solo permiten lo esperado).
- La sanitizacion via escapado (escapeshellcmd) es considerada insegura porque existen tecnicas para evadirla; es preferible eliminar los caracteres especiales por completo con una whitelist.

## Herramientas Clave

| Herramienta / Funcion | Lenguaje | Proposito especifico |
|---|---|---|
| `filter_var()` con `FILTER_VALIDATE_IP` | PHP | Validar que el input tiene formato de IP valida |
| `preg_match()` | PHP | Validar input contra un patron regex personalizado |
| `preg_replace()` | PHP | Sanitizar input eliminando caracteres fuera de whitelist |
| `filter_var()` con `escapeshellcmd` | PHP | Escapar caracteres especiales (opcion debil, evitar) |
| `fsockopen()` | PHP | Alternativa segura built-in para testear conectividad de host |
| `DOMPurify` | NodeJS | Libreria de sanitizacion para back-end JS |
| `is-ip` (npm) | NodeJS | Libreria para validar formato de IP en NodeJS |
| `escape()` | NodeJS | Escapar caracteres especiales en JS (opcion debil, evitar) |
| `mod_security` | Apache | WAF integrado en el servidor web |
| `disable_functions` | PHP (php.ini) | Deshabilitar funciones peligrosas del sistema |
| `open_basedir` | PHP (php.ini) | Restringir el sistema de archivos accesible por PHP |

## Metodologia Paso a Paso

### Fase 1: Eliminar la dependencia de comandos del sistema

**Logica:** Si no se llama a `system()`, `exec()`, `shell_exec()`, etc., no hay superficie de ataque para Command Injection. Antes de escribir una llamada al sistema, verificar si el lenguaje ofrece una alternativa nativa.

- Mapear cada llamada a funcion de ejecucion de sistema en el codigo (`system`, `exec`, `shell_exec`, `passthru`, `popen` en PHP; `child_process` en NodeJS).
- Sustituir por equivalentes built-in seguros (ej. `fsockopen` en lugar de `ping` via shell).
- Si no existe alternativa, proceder obligatoriamente con las fases 2 y 3.

### Fase 2: Implementar Validacion de Input (Whitelist de formato)

**Logica:** Rechazar la peticion en cuanto el input no coincida con el patron esperado. Esto se hace ANTES de procesar el dato. Nunca confiar solo en validacion front-end; replicarla siempre en el back-end.

- Definir el formato exacto esperado (ej. "debe ser una IPv4").
- Usar funciones de validacion nativas del lenguaje para formatos estandar (IP, email, URL).
- Para formatos personalizados, construir una regex estricta con `preg_match` (PHP) o `.test()` (JS).
- Denegar y registrar cualquier request que no supere la validacion.

### Fase 3: Implementar Sanitizacion de Input (Whitelist de caracteres)

**Logica:** Incluso si la validacion paso, eliminar cualquier caracter que no sea estrictamente necesario para el formato. Esto actua como red de seguridad contra regex mal construidas o casos borde.

- Definir el conjunto minimo de caracteres validos (ej. para una IP: `A-Za-z0-9.`).
- Usar `preg_replace` (PHP) o `.replace()` (JS) con la logica de "eliminar todo lo que NO este en la whitelist".
- Aplicar sanitizacion DESPUES de la validacion.
- Evitar el enfoque de escapado (`escapeshellcmd`, `escape()`) como unica medida.

### Fase 4: Hardenizar la configuracion del servidor

**Logica:** Asumir que el codigo puede tener fallos. Configurar el servidor para que, en caso de explotacion, el impacto sea minimo (contener el blast radius).

- Aplicar Principio de Minimo Privilegio: el proceso del servidor web corre como usuario sin privilegios (ej. `www-data`).
- Deshabilitar funciones peligrosas en `php.ini`.
- Restringir el acceso al sistema de archivos con `open_basedir`.
- Habilitar el WAF del servidor y complementar con un WAF externo.
- Rechazar requests con double-encoding o caracteres no-ASCII en URLs.
- Remover librerias/modulos obsoletos (ej. PHP CGI).

## Cheat Sheet de Comandos

### PHP - Validacion de Input

```php
# Validar formato IPv4 con funcion nativa. Devuelve false si no es una IP valida.
if (filter_var($_GET['ip'], FILTER_VALIDATE_IP)) {
    // logica de la aplicacion
} else {
    // denegar request
}
```

```php
# Validar formato personalizado con regex. preg_match devuelve 1 si hay match, 0 si no.
# El patron de ejemplo valida IPv4.
if (preg_match('/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/', $_GET['ip'])) {
    // logica de la aplicacion
} else {
    // denegar request
}
```

### PHP - Sanitizacion de Input

```php
# ENFOQUE RECOMENDADO: Whitelist de caracteres.
# preg_replace elimina CUALQUIER caracter que no sea alfanumerico o un punto.
# El resultado solo puede contener A-Z, a-z, 0-9 y "." -> seguro para IPs.
$ip = preg_replace('/[^A-Za-z0-9.]/', '', $_GET['ip']);
```

```php
# ENFOQUE DEBIL (solo si se necesitan caracteres especiales, ej. comentarios de usuario):
# escapeshellcmd escapa caracteres especiales pero puede ser bypasseado. Usar con precaucion.
$ip = filter_var($_GET['ip'], FILTER_SANITIZE_ADD_SLASHES);
```

### JavaScript / NodeJS - Validacion de Input

```javascript
// Validar IPv4 con regex nativa en front-end o NodeJS.
// .test() devuelve true si el string coincide con el patron.
if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip)) {
    // logica de la aplicacion
} else {
    // denegar request
}
```

```bash
# Instalar la libreria 'is-ip' para validacion de IP en proyectos NodeJS
npm install is-ip
```

```javascript
// Usar la libreria is-ip para validacion limpia de formato IP en NodeJS
import isIp from 'is-ip';
if (isIp(ip)) {
    // logica de la aplicacion
}
```

### JavaScript / NodeJS - Sanitizacion de Input

```javascript
// ENFOQUE RECOMENDADO en JS: Whitelist de caracteres.
// .replace() con flag /g elimina todas las ocurrencias de caracteres no permitidos.
var ip = ip.replace(/[^A-Za-z0-9.]/g, '');
```

```javascript
// Sanitizacion con DOMPurify para back-end NodeJS.
// Util cuando se necesita permitir HTML o contenido mas complejo con seguridad.
import DOMPurify from 'dompurify';
var ip = DOMPurify.sanitize(ip);
```

### PHP - Configuracion de Servidor (php.ini / .htaccess)

```ini
# Deshabilitar funciones de ejecucion de sistema en php.ini
# Impide que PHP pueda llamar a estos comandos aunque el codigo sea vulnerable.
disable_functions=system,exec,shell_exec,passthru,popen,proc_open,pcntl_exec

# Restringir el sistema de archivos accesible por PHP a la carpeta de la app.
# Cualquier intento de path traversal fuera de este directorio sera bloqueado.
open_basedir = '/var/www/html'
```

```bash
# Verificar que el proceso del servidor web corre como usuario de bajos privilegios.
# El output deberia mostrar 'www-data' o un usuario equivalente, NO 'root'.
ps aux | grep apache
ps aux | grep nginx
```

## "Gotchas" y Troubleshooting

- **Validacion solo en front-end = sin validacion:** El modulo enfatiza explicitamente que la validacion en el front-end es trivialmente bypasseable (interceptando la request con Burp Suite). La validacion back-end es la unica que cuenta.

- **Blacklist != Seguridad:** El modulo describe como las blacklists de caracteres y comandos son el enfoque incorrecto porque son bypasseables con encoding, case variation, etc. Siempre argumentar (y buscar) implementaciones basadas en whitelist durante un pentest.

- **Escapado != Sanitizacion:** `escapeshellcmd` y `escape()` son consideradas practicas inseguras por el modulo porque "can often be bypassed through various techniques". No confundirlas con sanitizacion real.

- **La sanitizacion va DESPUES de la validacion:** El orden de las operaciones importa. Validar el formato primero, luego sanitizar los caracteres. Sanitizar antes puede alterar el input y hacer que pase una validacion que no deberia.

- **PHP CGI es un modulo obsoleto y peligroso:** El modulo lo menciona explicitamente como un componente a eliminar. Durante un pentest, identificar si el servidor usa PHP CGI es un finding relevante.

- **Double Encoding y non-ASCII en URLs:** El modulo recomienda rechazar estas requests a nivel de servidor/WAF. Durante un pentest, intentar double-encoding (`%2527` en lugar de `%27`) es una tecnica de bypass valida contra WAFs mal configurados.

- **WAF no es suficiente por si solo:** El modulo lo presenta como una capa complementaria, no como la solucion principal. Un WAF bypasseado no debe ser la unica linea de defensa. En un pentest, demostrar un WAF bypass es un finding critico independientemente de si hay otras capas.

- **Principio de Minimo Privilegio como control de impacto:** Si despues de explotar un RCE el proceso web corre como `www-data` en lugar de `root`, el impacto real del finding (escalada a root, movimiento lateral) puede ser diferente. Siempre verificar el contexto del usuario del servidor web tras conseguir ejecucion de comandos.