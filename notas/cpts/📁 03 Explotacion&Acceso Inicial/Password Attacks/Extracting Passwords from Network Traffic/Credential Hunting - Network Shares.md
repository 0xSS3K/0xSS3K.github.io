---
tags:
  - shares
  - hunting
---
## Conceptos Clave (TL;DR)

* Los recursos compartidos en red son vitales pero suelen contener datos sensibles expuestos de manera no intencional, como configuraciones o credenciales en texto plano.
* La busqueda debe centrarse en palabras clave especificas (passw, user, token, key, secret) y extensiones de archivo propensas a almacenar secretos (.ini, .cfg, .env, .xlsx, .ps1, .bat).
* Los nombres de archivo que incluyen terminos como config, user, passw, cred o initial revelan informacion valiosa.
* Es importante focalizar la busqueda, utilizando terminos especificos del dominio objetivo o el idioma local (por ejemplo, buscar "Benutzer" en lugar de "User" en entornos alemanes).

  
## Herramientas Clave

* **Comandos nativos (PowerShell):** Para busquedas iniciales rapidas y sin necesidad de herramientas externas.

* **Snaffler:** Binario C# para maquinas unidas al dominio que automatiza el descubrimiento de shares y busqueda de archivos por patrones predefinidos.

* **PowerHuntShares:** Script de PowerShell que no requiere estar en una maquina unida al dominio y genera un reporte HTML detallado.

* **MANSPIDER:** Herramienta desde Linux (via Docker) para buscar por contenido dentro de shares remotos usando expresiones regulares.

* **[NetExec](../../../📂%2008%20Herramientas&Cheatsheets/NetExec.md)** Framework de explotacion que incluye la opcion de hacer spidering en recursos compartidos buscando cadenas de texto.

  
## Metodologia Paso a Paso

**Fase 1: Enfoque y Priorizacion**
Antes de lanzar herramientas masivas, identifica los recursos de mayor valor. Escanear todos los shares puede tomar demasiado tiempo; los recursos del departamento de IT suelen ser objetivos mas ricos que los generales.

  
**Fase 2: Ejecucion y Escaneo (Windows o Linux)**
Ejecuta la busqueda desde tu posicion actual. Si tienes acceso por consola de Windows, puedes usar busquedas nativas o Snaffler/PowerHuntShares. Si estas operando desde tu maquina atacante Linux, utiliza NetExec o MANSPIDER pasando las credenciales comprometidas previamente.

  
**Fase 3: Triage y Analisis Manual**
Todas las herramientas mencionadas generaran una gran cantidad de output. Es necesario realizar una revision manual para descartar los abundantes falsos positivos y extraer los secretos reales encontrados.

  
## Cheat Sheet de Comandos

```powershell
# Busqueda basica nativa en PowerShell.
# -Recurse: Busca en subdirectorios.
# -Include: Filtra por la extension objetivo.
# Select-String -Pattern: Busca la cadena de texto especifica dentro de los archivos.

Get-ChildItem -Recurse -Include *.<EXTENSION> \\<TARGET_SERVER>\<SHARE_NAME> | Select-String -Pattern "<KEYWORD>"
```

```cmd
# Ejecucion basica de Snaffler desde una maquina unida al dominio.
# -s: Imprime el output por consola (stdout).
# Parametros adicionales recomendados:
# -u: Obtiene usuarios de AD y busca referencias de estos en archivos.
# -i / -n: Permiten incluir o excluir shares especificos del escaneo.

Snaffler.exe -s
```

```powershell
# Ejecucion de PowerHuntShares para generar un reporte HTML.
# -Threads: Especifica el numero de hilos a usar para mayor velocidad.
# -OutputDirectory: Carpeta donde se guardaran los resultados y el archivo HTML.

Invoke-HuntSMBShares -Threads 100 -OutputDirectory <OUTPUT_DIR>
```

```bash
# MANSPIDER usando contenedor Docker (recomendado).
# -v: Monta un volumen local para guardar los resultados extraidos (/root/.manspider/loot).
# -c: Especifica la cadena de contenido a buscar (ej. 'passw').
# -u / -p: Credenciales para la autenticacion SMB.

docker run --rm -v ./manspider:/root/.manspider blacklanternsecurity/manspider <TARGET_IP> -c '<KEYWORD>' -u '<USER>' -p '<PASSWORD>'
```

```bash
# Uso de NetExec para busqueda en shares (Spidering).
# --spider: Especifica el nombre del recurso compartido a analizar (ej. 'IT').
# --content: Habilita la lectura del contenido del archivo.
# --pattern: Define el patron o cadena a buscar.

nxc smb <TARGET_IP> -u <USER> -p '<PASSWORD>' --spider <SHARE_NAME> --content --pattern "<KEYWORD>"
```


## "Gotchas" y Troubleshooting

* **Tiempos de Escaneo:** Escanear miles de archivos en decenas de shares requiere mucho tiempo. El script PowerHuntShares, en particular, puede tardar horas si el entorno es grande.

* **Falsos Positivos:** El alto volumen de resultados devuelto por estas herramientas requiere paciencia y revision manual para identificar los verdaderos hallazgos.

* **Dependencias de MANSPIDER:** Para evitar errores con las librerias, siempre es preferible ejecutar MANSPIDER usando su contenedor oficial de Docker.

* **Localizacion de Keywords:** Adapta tus diccionarios de busqueda. Busca el nombre especifico del dominio (ej. `<DOMAIN>\`) y ajusta terminos si la empresa opera en otro idioma.