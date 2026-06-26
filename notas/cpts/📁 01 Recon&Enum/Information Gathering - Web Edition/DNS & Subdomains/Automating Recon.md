---
tags:
  - autorecon
  - webapp
  - fuzzing
  - dns
---
## Conceptos Clave (TL;DR)

* La automatización del reconocimiento web incrementa drásticamente la eficiencia y permite recopilar información a gran escala identificando vulnerabilidades más rápido.
* Elimina el riesgo de errores humanos inherentes al análisis manual, asegurando resultados consistentes y reproducibles mediante procedimientos predefinidos.
* Facilita la cobertura exhaustiva de múltiples vectores simultáneamente (DNS, subdominios, puertos, rastreo web) y se integra con otras plataformas de análisis y explotación.

  
## Herramientas Clave

* **FinalRecon**: Herramienta modular en Python de "todo en uno" para obtener headers, Whois, información SSL, realizar crawling, enumeración de directorios/DNS/subdominios y consultas a la Wayback Machine.

* **Recon-ng**: Framework en Python con estructura modular para enumeración de DNS, descubrimiento de subdominios, escaneo de puertos, rastreo web e incluso explotación de vulnerabilidades conocidas.

* **theHarvester**: CLI en Python diseñado para recopilar correos electrónicos, subdominios, hosts, nombres de empleados y puertos abiertos utilizando fuentes públicas como motores de búsqueda y SHODAN.

* **SpiderFoot**: Herramienta de automatización OSINT que se integra con diversas fuentes para extraer IPs, dominios, correos y perfiles de redes sociales, además de realizar búsquedas DNS y escaneo de puertos.

* **OSINT Framework**: Colección integral de recursos web para la recopilación de inteligencia de código abierto que abarca redes sociales, registros públicos y motores de búsqueda.

  
## Metodología Paso a Paso

* **Fase 1: Preparación del Entorno**: Clonar el repositorio de la herramienta e instalar sus dependencias en el sistema atacante. Esto asegura que los scripts tengan las librerías necesarias y los permisos correctos para ejecutarse.

* **Fase 2: Ejecución Selectiva o Completa**: Lanzar la herramienta de automatización contra el objetivo. Se puede optar por un enfoque quirúrgico llamando a módulos específicos (ej. solo enumerar directorios o subdominios) o un enfoque ruidoso pero exhaustivo usando un escaneo completo.

* **Fase 3: Revisión de Resultados Exportados**: Analizar el output generado. Revisar los enlaces extraídos (internos/externos, archivos JS, Wayback Machine), verificar los registros de DNS (como DMARC para ataques de correo) e investigar las configuraciones de los servidores desde los Headers.

  
## Cheat Sheet de Comandos
```bash
# Clonar el repositorio de FinalRecon e ingresar al directorio de trabajo

git clone [https://github.com/thewhiteh4t/FinalRecon.git](https://github.com/thewhiteh4t/FinalRecon.git)

cd FinalRecon
```

```bash  
# Instalar los requerimientos de Python necesarios para la herramienta
pip3 install -r requirements.txt
```

```bash  
# Asignar permisos de ejecución al script principal de Python
chmod +x ./finalrecon.py
```

```bash  
# Mostrar el menú de ayuda y listar todos los módulos y opciones disponibles
./finalrecon.py --help
```

```bash  
# Ejecutar reconocimiento selectivo: Obtiene Headers de HTTP y realiza búsqueda Whois sobre el objetivo
./finalrecon.py --headers --whois --url <TARGET_URL>
```

```bash 
# Ejecutar reconocimiento completo: Lanza todos los módulos sobre el objetivo
./finalrecon.py --full --url <TARGET_URL>
```

```bash  
# Ejecutar escaneo completo ajustando hilos (Directorios y Puertos) y definiendo un diccionario personalizado
# -dt: Threads para directorios | -pt: Threads para puertos | -w: Ruta del diccionario

./finalrecon.py --full --url <TARGET_URL> -dt <DIR_THREADS> -pt <PORT_THREADS> -w <PATH_TO_WORDLIST>
```

```bash  
# Ejecutar enumeración de directorios buscando extensiones de archivo específicas

# -e: Extensiones separadas por coma
./finalrecon.py --dir --url <TARGET_URL> -e txt,xml,php
```

```bash  
# Ejecutar escaneo configurando llaves API para maximizar la recolección (ej. Shodan) y cambiando el directorio de output

# -k: Clave de API | -cd: Directorio de exportación personalizado
./finalrecon.py --sub --url <TARGET_URL> -k shodan@<API_KEY> -cd <CUSTOM_OUTPUT_DIR>
```

  

## "Gotchas" y Troubleshooting

* **Almacenamiento Automático**: FinalRecon guarda automáticamente un volcado de los resultados; si no configuras el flag `-cd`, busca los reportes en el directorio predeterminado `~/.local/share/finalrecon/`.

* **Configuración del Wordlist**: Por defecto, la enumeración de directorios usa `wordlists/dirb_common.txt`. Si no encuentra resultados, asegúrate de utilizar el flag `-w` para proporcionar un diccionario más robusto adecuado al objetivo.

* **Gestión de Hilos (Threads)**: Los valores predeterminados son 30 hilos para directorios (`-dt`) y 50 para puertos (`-pt`). Si experimentas bloqueos WAF o pérdida de paquetes (falsos negativos), reduce estos valores de forma manual.

* **Histórico vs Actualidad**: El módulo `--wayback` y la recolección de links pueden traer resultados de hasta los últimos 5 años. Ten en cuenta que algunas rutas encontradas pueden ya no existir en la iteración actual del servidor web, aunque podrían indicar directorios olvidados.

* **Integración con APIs**: La enumeración de subdominios (`--sub`) alcanza su máximo potencial al consultar múltiples bases de datos. Si quieres resultados profundos, configura llaves de API utilizando la opción `-k`.