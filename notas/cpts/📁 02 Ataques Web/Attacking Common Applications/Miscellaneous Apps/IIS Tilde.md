---
tags:
  - webapp
  - IIS
  - enum
---
## Conceptos Clave (TL;DR)

* La enumeración de directorios mediante tilde en IIS es una técnica empleada para descubrir archivos, directorios ocultos y nombres de archivo cortos en formato 8.3 dentro de servidores web Microsoft IIS.
* Esta técnica aprovecha una vulnerabilidad específica en la gestión de nombres cortos por parte de IIS dentro de sus directorios.
* El formato 8.3 de Windows genera nombres compuestos por ocho caracteres para el nombre, un punto y tres caracteres para la extensión.
* Estos nombres cortos permiten obtener acceso a los archivos y carpetas reales correspondientes, incluso si se configuraron para permanecer ocultos o inaccesibles.
* El uso del carácter tilde (~) seguido de un número secuencial denota un nombre corto en una URL , lo que permite realizar peticiones HTTP iterativas analizando las respuestas del servidor (como códigos de estado 200 OK) para deducir los caracteres del recurso.

---
## Herramientas Clave

* **Nmap**: Utilizado en la fase inicial de reconocimiento para mapear el objetivo, identificar puertos abiertos y detectar la versión del servicio web IIS ejecutándose en el servidor.
* **IIS-ShortName-Scanner**: Herramienta automatizada escrita en Java que optimiza el proceso de enumeración al evitar el envío manual de peticiones HTTP para cada combinación de caracteres del alfabeto.
* **egrep / sed**: Utilidades de la línea de comandos de Linux empleadas de forma conjunta para filtrar de manera recursiva diccionarios existentes y limpiar la estructura del texto para generar un diccionario personalizado.
* **GoBuster**: Herramienta de fuerza bruta de código abierto escrita en Go, empleada para realizar fuzzing de directorios y archivos ocultos a partir de un diccionario estructurado.  

---
## Metodología Paso a Paso

### Fase 1: Mapeo y Detección del Servicio
El proceso comienza identificando los servicios activos y sus versiones en los puertos del objetivo. Si se detecta una versión compatible de Microsoft IIS (como IIS 7.5), la ejecución de un ataque de enumeración por tilde se convierte en un vector viable.

### Fase 2: Enumeración Automatizada de Nombres Cortos
Para evitar la tarea tediosa de enviar peticiones manuales letra por letra , se ejecuta la herramienta automatizada `IIS-ShortName-Scanner`. El escáner utiliza métodos HTTP específicos (como OPTIONS) para identificar qué nombres cortos de directorios o archivos existen en la raíz del servidor.

### Fase 3: Generación de un Diccionario Personalizado
Cuando el servidor web prohíbe el acceso directo mediante peticiones GET a los nombres cortos descubiertos, es obligatorio realizar un ataque de fuerza bruta para descubrir el nombre real completo. Se aprovechan los diccionarios del sistema filtrándolos con comandos de procesamiento de texto para aislar únicamente las palabras que comiencen con el prefijo corto identificado.

### Fase 4: Fuerza Bruta con Extensiones Especificadas
Con el diccionario limpio y enfocado, se configura una herramienta de fuzzing de directorios. Se alimenta el comando con la lista personalizada y las extensiones web comunes o deducidas en el escaneo previo para revelar con éxito la nomenclatura final y completa del archivo o directorio protegido.

---
## Cheat Sheet de Comandos

```bash
# Escaneo general de puertos con scripts por defecto y detección de versiones en el objetivo
# flags: -p- (todos los puertos), -sV (versión), -sC (scripts estándar), --open (solo puertos abiertos)
nmap -p- -sV -sC --open <TARGET_IP>

# Instalar shortscan
go install github.com/bitquark/shortscan/cmd/shortscan@latest

# Usar shortscan
shortscan http://10.129.15.53:9000  
  
# Ejecución de la herramienta automatizada para buscar vulnerabilidades y nombres cortos en IIS
# flags: <parámetros_de_configuración> <URL_objetivo>
java -jar iis_shortname_scanner.jar 0 5 http://<TARGET_IP>/

  
# Filtrado recursivo de palabras en diccionarios locales y limpieza sintáctica del prefijo detectado
# flags: -r (búsqueda recursiva), ^<PREFIX> (coincidencia al inicio de línea)
egrep -r ^<PREFIX> /usr/share/wordlists/* | sed 's/^[^:]*://' > /tmp/list.txt
 

# Ataque de fuerza bruta de directorios empleando el diccionario personalizado y extensiones específicas
# flags: dir (modo directorio), -u (URL), -w (diccionario), -x (extensiones de archivo a evaluar)
gobuster dir -u http://<TARGET_IP>/ -w /tmp/list.txt -x .aspx,.asp
```
  
---
## "Gotchas" y Troubleshooting

* **Requisito de Software**: Para poder inicializar el binario `iis_shortname_scanner.jar`, es indispensable contar con Oracle Java instalado en el sistema local o en el entorno de ataque.

* **Interacción del Escáner**: Al arrancar el escáner de nombres cortos, el programa solicitará de manera interactiva la configuración de un proxy; si no se requiere uno, se debe presionar Enter directamente para continuar.

* **Restricción de Peticiones GET**: Un hallazgo positivo en el escáner de nombres cortos no siempre implica acceso inmediato; si el servidor web restringe el método GET hacia el nombre corto (ej. `TRANSF~1.ASP`), se volverá mandatorio realizar la fase de fuerza bruta para expandir el nombre real del archivo.

* **Estructura del Identificador 8.3**: El número entero ubicado inmediatamente después del símbolo de la tilde (ej. el 1 en `somefi~1.txt`) funciona como un indexador único asignado por el sistema de archivos para diferenciar elementos cuyos primeros caracteres coincidan dentro del mismo directorio.

```