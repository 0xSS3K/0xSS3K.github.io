---
tags:
  - bypass
  - commandinjection
  - webapp
---
## Conceptos Clave (TL;DR)

- Las técnicas manuales de ofuscación pueden ser insuficientes contra herramientas de seguridad avanzadas; los tools automatizados generan payloads más complejos y menos predecibles.
- **Bashfuscator** opera sobre Bash/Linux, permite seleccionar técnicas, capas y tamaño de payload para ajustar el nivel de ofuscación y la longitud del output.
- **DOSfuscation (Invoke-DOSfuscation)** opera sobre CMD/PowerShell en Windows; es interactivo y ofrece módulos de encoding mediante variables de entorno del sistema.
- Siempre validar el payload ofuscado localmente (`bash -c '...'` o CMD) antes de lanzarlo contra el objetivo.


## Herramientas Clave

| Herramienta | SO | Propósito |
|---|---|---|
| Bashfuscator | Linux | Ofuscación automática de comandos Bash para evadir filtros y WAFs |
| Invoke-DOSfuscation | Windows | Ofuscación interactiva de comandos CMD/PowerShell mediante encoding de variables de entorno |
| pwsh | Linux | Permite ejecutar Invoke-DOSfuscation en Linux sin necesidad de VM Windows |


## Metodología Paso a Paso

### Fase 1 - Reconocimiento del entorno de filtrado

Determinar qué tipo de filtros/WAF/EDR está activo en el objetivo.
Si los filtros bloquean comandos básicos o incluso ofuscación manual simple, pasar a herramientas automatizadas.

### Fase 2 - Selección de herramienta según SO objetivo

- Objetivo Linux/Bash → Bashfuscator
- Objetivo Windows CMD/PowerShell → Invoke-DOSfuscation

### Fase 3 - Generación del payload ofuscado

**Linux:** Ajustar flags `-s` (size), `-t` (tipo), `--layers` y `--no-mangling` para obtener un payload corto y funcional.
Sin flags específicos, la herramienta elige aleatoriamente y puede generar payloads de más de un millón de caracteres, impracticables para inyección.

**Windows:** Definir el comando objetivo con `SET COMMAND`, elegir el módulo de encoding y seleccionar una variante numerada.
El encoding usa variables de entorno del sistema (`%TEMP%`, `%TMP%`, etc.) con slicing de cadenas para reconstruir el comando original en tiempo de ejecución.

### Fase 4 - Validación local del payload

Antes de enviar el payload al objetivo, verificar que ejecuta correctamente en un entorno local equivalente para confirmar que la ofuscación no rompió la sintaxis.

### Fase 5 - Inyección contra el objetivo

Enviar el payload validado al vector de ataque (campo web, parámetro, RCE, etc.) y verificar la respuesta.


## Cheat Sheet de Comandos

### Bashfuscator - Instalación

```bash
# Clonar el repositorio
git clone https://github.com/Bashfuscator/Bashfuscator

# Entrar al directorio e instalar dependencias
cd Bashfuscator
pip3 install setuptools==65
python3 setup.py install --user
```

### Bashfuscator - Uso básico

```bash
# Moverse al directorio del binario
cd ./bashfuscator/bin/

# Ver todas las opciones disponibles
./bashfuscator -h

# Listar todos los ofuscadores, compresores y encoders disponibles
./bashfuscator -l
```

```bash
# Ofuscacion basica aleatoria de un comando (puede generar payloads muy largos)
# -c : comando a ofuscar
./bashfuscator -c '<COMMAND_TO_OBFUSCATE>'
```

```bash
# Ofuscacion controlada con parametros finos (RECOMENDADO para examen)
# -c : comando objetivo
# -s 1 : nivel de tamanio minimo (payload mas corto)
# -t 1 : seleccionar el primer tipo/mutador disponible
# --no-mangling : deshabilitar alteraciones adicionales de caracteres
# --layers 1 : aplicar solo una capa de ofuscacion
./bashfuscator -c '<COMMAND_TO_OBFUSCATE>' -s 1 -t 1 --no-mangling --layers 1
```

```bash
# Validar localmente que el payload ofuscado funciona antes de inyectarlo
# Reemplazar <OBFUSCATED_PAYLOAD> con el output completo de Bashfuscator
bash -c '<OBFUSCATED_PAYLOAD>'
```

### Invoke-DOSfuscation - Instalacion y arranque

```powershell
# Clonar el repositorio desde PowerShell (Windows o pwsh en Linux)
git clone https://github.com/danielbohannon/Invoke-DOSfuscation.git
cd Invoke-DOSfuscation

# Importar el modulo
Import-Module .\Invoke-DOSfuscation.psd1

# Lanzar la herramienta interactiva
Invoke-DOSfuscation
```

```powershell
# Ver el menu de ayuda dentro de la herramienta
Invoke-DOSfuscation> help

# Ver tutorial de uso
Invoke-DOSfuscation> TUTORIAL
```

### Invoke-DOSfuscation - Generacion de payload

```powershell
# Paso 1: Definir el comando a ofuscar
# Reemplazar <WINDOWS_COMMAND> con el comando objetivo (ej: type C:\ruta\archivo.txt)
Invoke-DOSfuscation> SET COMMAND <WINDOWS_COMMAND>

# Paso 2: Seleccionar el modulo de encoding por variables de entorno
Invoke-DOSfuscation> encoding

# Paso 3: Seleccionar variante (1 = primera opcion disponible)
Invoke-DOSfuscation\Encoding> 1
```

```cmd
# Validar el payload ofuscado directamente en CMD
# Reemplazar <DOSFUSCATED_PAYLOAD> con el output de Invoke-DOSfuscation
<DOSFUSCATED_PAYLOAD>
```

### Ejecutar Invoke-DOSfuscation en Linux (sin VM Windows)

```bash
# Iniciar PowerShell en Linux (pwsh viene instalado en Pwnbox)
pwsh

# Luego seguir los mismos pasos de PowerShell descritos arriba
```


## "Gotchas" y Troubleshooting

- **Bashfuscator sin flags genera payloads inutilizables:** El tamaño puede superar el millón de caracteres. Siempre usar `-s 1 -t 1 --no-mangling --layers 1` como punto de partida en el examen.
- **Payload funciona en local pero falla en el target:** El filtro puede estar bloqueando caracteres específicos que genera el mutador seleccionado. Probar distintos mutadores (`-t 2`, `-t 3`) o combinaciones de `--layers`.
- **Invoke-DOSfuscation es interactivo, no apto para scripting directo:** No se puede encadenar en pipelines de bash directamente; requiere interacción manual en cada sesion.
- **Invoke-DOSfuscation en Linux requiere `pwsh` instalado:** En Pwnbox viene por defecto, pero en otras distribuciones puede necesitar instalacion manual.
- **El encoding de DOSfuscation depende de variables de entorno del sistema Windows:** El payload generado asume que variables como `%TEMP%`, `%TMP%`, `%SystemRoot%`, `%CommonProgramFiles%`, `%ALLUSERSPROFILE%` existen en el sistema destino con sus valores por defecto. En sistemas con variables modificadas o hardened, el payload puede fallar.
- **Siempre validar el payload antes de inyectar:** Un payload roto enviado al target puede triggear alertas adicionales o generar ruido innecesario.
- **El modulo de ofuscacion elegido afecta la detectabilidad:** Algunos mutadores de Bashfuscator usan tecnicas conocidas (reverse, forcode, etc.). Si un WAF los detecta, cambiar el mutador con `-t` o agregar mas `--layers`.
- **Prerequisito de red/acceso:** Para clonar los repositorios desde el target o desde el atacante, se necesita salida a internet o tener los tools pre-descargados en el entorno de trabajo.