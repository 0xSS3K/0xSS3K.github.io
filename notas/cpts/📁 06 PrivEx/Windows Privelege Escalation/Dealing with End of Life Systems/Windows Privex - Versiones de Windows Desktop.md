---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)

- Windows 7 alcanzó su End-of-Life (EOL) el 14 de enero de 2020, pero sigue presente en entornos legacy (POS, sistemas embebidos, sectores salud/finanzas/gobierno). Carece de varias protecciones modernas (Credential Guard, Device Guard, Control Flow Guard, AppLocker completo, BitLocker completo, MFA nativo).
- La metodología consiste en: extraer `systeminfo` del objetivo, compararlo contra una base de datos de boletines de seguridad de Microsoft (vía Windows-Exploit-Suggester) y filtrar manualmente los hotfixes faltantes que correspondan a exploits de escalada de privilegios (LPE) viables.
- MS16-032 es una vulnerabilidad en el Secondary Logon Service que permite a un usuario sin privilegios obtener un token de SYSTEM mediante una condición de carrera (race condition) al duplicar un token de impersonación.
- Si se dispone de una sesión Meterpreter, Metasploit posee un módulo "local exploit suggester" que automatiza este mismo proceso y puede lanzar directamente los módulos correspondientes.

## Herramientas Clave

- **systeminfo**: comando nativo de Windows para extraer versión de OS, build, hotfixes instalados y arquitectura. Es el insumo necesario para el siguiente paso.
- **Windows-Exploit-Suggester (windows-exploit-suggester.py)**: script en Python 2 que compara la salida de `systeminfo` contra la base de datos de boletines de seguridad de Microsoft (MSSB) para listar exploits potenciales (PoC en Exploit-DB o módulos de Metasploit).
- **Invoke-MS16-032.ps1**: PoC en PowerShell que explota MS16-032 (Secondary Logon Service) para obtener una shell SYSTEM.
- **Metasploit (post/multi/recon/local_exploit_suggester)**: módulo equivalente a Windows-Exploit-Suggester pero ejecutado dentro de una sesión Meterpreter; sugiere y puede lanzar automáticamente módulos de explotación disponibles.

## Metodología Paso a Paso

### Fase 1 - Recolección de información (Enumeración local)
Se obtiene la huella del sistema objetivo (versión exacta de OS, build, hotfixes) necesaria para identificar vulnerabilidades conocidas sin tener que adivinar el parche level del host.

### Fase 2 - Preparación de la base de datos de vulnerabilidades
Se actualiza la base de datos local de boletines de seguridad de Microsoft (archivo XLS) que usará la herramienta para hacer el cruce de información.

### Fase 3 - Cruce y filtrado de vulnerabilidades
Se ejecuta el script comparando los hotfixes instalados contra los boletines conocidos. El resultado lista posibles exploits, marcados como `[E]` (PoC en Exploit-DB) o `[M]` (módulo de Metasploit). Es obligatorio filtrar manualmente: descartar DoS, descartar lo que no aplique a la arquitectura/versión objetivo, y priorizar vulnerabilidades con PoC funcional y de impacto real (LPE/RCE).

### Fase 4 - Explotación
Se selecciona el vector identificado (en este caso MS16-032) y se ejecuta la PoC correspondiente en el sistema objetivo para escalar privilegios hasta NT AUTHORITY\SYSTEM.

### Fase 5 - Verificación post-explotación
Se confirma el nivel de privilegio obtenido y se procede a la recolección de evidencia/flags requeridas.

## Cheat Sheet de Comandos

```cmd
:: Recolectar información del sistema objetivo desde una shell en el host comprometido
:: Esta salida debe guardarse en un archivo .txt para usarla como input del exploit suggester
C:\htb> systeminfo
```

```bash
# Actualizar la base de datos local de vulnerabilidades de Microsoft (MSSB)
# --update descarga/refresca el archivo XLS con los boletines de seguridad más recientes
# Se ejecuta con python2 porque el script es compatible solo con esa versión
sudo python2 windows-exploit-suggester.py --update
```

```bash
# Ejecutar Windows Exploit Suggester contra el systeminfo capturado del objetivo
# --database     -> archivo XLS/XLSX descargado en el paso anterior
# --systeminfo   -> archivo de texto con la salida de systeminfo del host <TARGET_IP>
python2 windows-exploit-suggester.py --database <FECHA>-mssb.xls --systeminfo <SYSTEMINFO_OUTPUT>.txt
```

```powershell
# Cambiar la política de ejecución de PowerShell solo para el proceso actual
# bypass + -scope process evita restricciones de ExecutionPolicy sin tocar la config global del sistema
Set-ExecutionPolicy bypass -scope process

# Importar el módulo PowerShell que contiene la PoC de MS16-032
Import-Module .\Invoke-MS16-032.ps1

# Ejecutar el exploit; aprovecha una condición de carrera en el Secondary Logon Service
# para construir y duplicar un token de impersonación de SYSTEM
Invoke-MS16-032
```

```cmd
:: Verificar el nivel de privilegio obtenido tras una explotación exitosa
C:\htb> whoami
:: Salida esperada: nt authority\system
```

```text
# Dentro de Metasploit, tras obtener una sesión Meterpreter en <TARGET_IP>:
use post/multi/recon/local_exploit_suggester
set SESSION <SESSION_ID>
run
# El módulo lista vulnerabilidades aplicables y permite lanzar directamente
# el módulo de explotación correspondiente si existe uno en el framework
```

## "Gotchas" y Troubleshooting

- Windows-Exploit-Suggester requiere **Python 2**, no Python 3; si se ejecuta con Python 3 fallará o dará errores de sintaxis.
- El archivo de base de datos generado por `--update` es un **Excel (.xls/.xlsx)**; el nombre incluye la fecha de descarga (ej. `2021-05-13-mssb.xls`), debe coincidir con el parámetro `--database` al ejecutar la herramienta.
- El archivo de `systeminfo` debe guardarse con codificación correcta (utf-8); la herramienta valida explícitamente que pueda leerlo ("systeminfo input file read successfully (utf-8)"). Si fue capturado desde una sesión RDP/consola con otra code page, puede fallar la lectura.
- Los resultados de la herramienta son **ruidosos**: incluyen muchos boletines irrelevantes (DoS, exploits para versiones de IE no instaladas, parches que no aplican a la arquitectura x64/x86). Es obligatorio filtrar manualmente antes de intentar explotar nada.
- `[E]` indica que solo existe un PoC externo (Exploit-DB/GitHub); `[M]` indica que existe un módulo nativo de Metasploit, lo cual suele ser más confiable y rápido de ejecutar.
- MS16-032 explota una condición de carrera (race condition): la ejecución de la PoC puede no ser 100% determinista en el primer intento; si falla, reintentar la ejecución del script.
- Antes de ejecutar `Invoke-MS16-032.ps1` es necesario relajar la ExecutionPolicy de PowerShell (`Set-ExecutionPolicy bypass -scope process`), de lo contrario el import del módulo será bloqueado.
- Si ya se tiene una sesión Meterpreter, no es necesario repetir manualmente todo el proceso de Windows-Exploit-Suggester: el módulo `local_exploit_suggester` de Metasploit automatiza la detección y puede lanzar el exploit directamente.
- Importante para el reporte/contexto del cliente: un hallazgo de EOL (como Windows 7) no debe presentarse sin contexto de negocio; sistemas embebidos (POS) pueden no ser viables de actualizar de inmediato, a diferencia de un sistema aislado en un entorno corporativo pequeño. Documentar mitigaciones alternativas si la actualización inmediata no es viable.