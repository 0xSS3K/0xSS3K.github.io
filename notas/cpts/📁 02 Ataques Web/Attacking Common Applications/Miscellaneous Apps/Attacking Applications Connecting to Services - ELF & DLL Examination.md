## Conceptos Clave (TL;DR)

* Las aplicaciones conectadas a servicios frecuentemente contienen cadenas de conexión (connection strings) que pueden filtrar credenciales si no están debidamente protegidas.
* La extracción de estas credenciales permite recolectar información valiosa, realizar movimientos laterales o escalar privilegios en pruebas de penetración.
* Para binarios en Linux (ELF) se utilizan técnicas de depuración e ingeniería inversa en la línea de comandos.
* Para ensamblados de Windows (.NET DLLs) se utilizan analizadores y decompiladores gráficos para leer el código fuente original.

## Herramientas Clave

* **GDB (GNU Debugger):** Herramienta de línea de comandos utilizada para depurar programas en C y C++. Permite avanzar a través del código, configurar puntos de interrupción (breakpoints), y examinar/cambiar variables.
* **PEDA (Python Exploit Development Assistance):** Extensión de GDB que facilita la lectura y el análisis del entorno de depuración para desarrollo de exploits e ingeniería inversa.
* **Get-FileMetaData:** Script o módulo de PowerShell utilizado para extraer y visualizar metadatos de archivos, útil para identificar la versión del framework subyacente de un binario.
* **dnSpy:** Editor y depurador de ensamblados .NET. Permite leer, editar y depurar el código fuente de aplicaciones desarrolladas en C# y Visual Basic de forma visual.

## Metodología Paso a Paso

**Fase 1: Análisis de Ejecutables ELF (Linux)**

1. **Ejecución local preliminar:** Ejecuta el binario localmente para observar su comportamiento natural. Esto suele revelar el motor de base de datos objetivo o librerías faltantes mediante los errores arrojados (ej. `ODBC Driver 17 for SQL Server`).
2. **Carga y configuración de depuración:** Inicia el binario dentro de GDB. Configura la sintaxis de desensamblado a formato Intel para facilitar la lectura del código máquina.
3. **Análisis del flujo principal:** Desensambla la función `main`. Busca llamadas (calls) a funciones externas de conexión, como `SQLDriverConnect`.
4. **Intercepción de memoria:** Establece un breakpoint exactamente en la dirección de memoria de la llamada a la función de conexión descubierta.
5. **Extracción de credenciales:** Corre el programa hasta chocar con el breakpoint. Revisa los registros del procesador (particularmente `RDX` o similares dependiendo de la arquitectura) para leer la cadena de conexión completa enviada a la función.

**Fase 2: Análisis de Archivos DLL (Windows)**

1. **Verificación de dependencias:** Utiliza PowerShell para extraer los metadatos de la DLL obtenida y confirmar que es un ensamblado .NET válido.
2. **Decompilación estática:** Abre la DLL en `dnSpy` para obtener acceso al código fuente legible.
3. **Búsqueda de secretos:** Navega por la estructura de clases del código (ej. carpetas lógicas como `Controllers`) en busca de cadenas de conexión incrustadas estáticamente en el código (hardcoded strings).

## Cheat Sheet de Comandos

```bash
# Fase 1: Análisis Dinámico de ELF en Linux

# Ejecuta el binario para provocar errores de conexión y descubrir dependencias
./<BINARY_NAME>

# Inicia la herramienta GDB apuntando al binario objetivo
gdb ./<BINARY_NAME>

# (Dentro de GDB) Configura la sintaxis de lectura de código máquina a formato Intel
set disassembly-flavor intel

# (Dentro de GDB) Muestra el código ensamblador de la función principal
disas main

# (Dentro de GDB) Establece un punto de interrupción (breakpoint) en la dirección de memoria específica
# Nota: La dirección (ej. 0x5555555551b0) se obtiene del output del comando 'disas main'
b *<MEMORY_ADDRESS>

# (Dentro de GDB) Inicia la ejecución del binario hasta alcanzar el breakpoint definido
run

# (Dentro de GDB) Nota: Una vez que 'run' se detenga en el breakpoint provisto por PEDA,
# inspecciona visualmente la sección de [registers] para leer las cadenas desencriptadas en RDX, RAX, etc.
```

```powershell
# Fase 2: Enumeración de DLL en Windows

# Imprime los metadatos del archivo para confirmar si es un binario construido en .NET Framework
Get-FileMetaData .\<FILE_NAME>.dll
```

## "Gotchas" y Troubleshooting

* **Símbolos de depuración faltantes:** Es habitual que el output de GDB indique `No debugging symbols found`. Esto es normal en binarios de producción; requiere lectura manual del código ensamblador sin nombres de variables descriptivos.

* **Reconstrucción de Strings y Endianness:** Al leer cadenas en la memoria o ensamblador, ten en cuenta que las partes de una cadena SQL pueden no aparecer en orden lógico. Además, el *Endianness* de la arquitectura determina cómo se leen los bytes, lo que podría hacer que el texto aparezca invertido.

* **Alcance del Ataque (Password Spraying):** Nunca asumas que las credenciales encontradas sirven únicamente para la base de datos (ej. MS SQL). Utiliza esos mismos usuarios y contraseñas para ejecutar ataques de *password spraying* contra otros servicios y usuarios dentro de la misma red corporativa.