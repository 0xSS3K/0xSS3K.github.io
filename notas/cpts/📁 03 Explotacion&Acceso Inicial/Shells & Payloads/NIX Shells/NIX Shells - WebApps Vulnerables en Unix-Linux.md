---
tags:
  - nixshells
  - unix
  - linux
  - webapp
---
## Conceptos Clave (TL;DR)

* Más del 70% de los servidores web operan sobre sistemas basados en Unix, lo que los convierte en objetivos primarios.

* Obtener una sesión de shell inicial frecuentemente se logra explotando vulnerabilidades conocidas en las aplicaciones web que estos servidores alojan.

* Aplicaciones de gestión (como rConfig) son objetivos críticos; comprometerlas permite pivotar hacia dispositivos clave en la red interna (enrutadores, switches) y potencialmente tomar el control total de la infraestructura.

* Las shells iniciales obtenidas a través de servicios web (por ejemplo, ejecutadas como el usuario apache) suelen ser "non-tty", lo que limita la ejecución de comandos esenciales para la escalada de privilegios.
  

## Herramientas Clave

* **[Nmap](../../../📂%2008%20Herramientas&Cheatsheets/Nmap.md):** Utilizado para la enumeración inicial del host, descubrimiento de puertos, servicios y versiones del stack web.
* **Buscadores (Web/Exploit-DB):** Para investigar números de versión específicos en búsqueda de vulnerabilidades, CVEs o Proof of Concepts (PoCs).
* **[Metasploit](../../../📂%2008%20Herramientas&Cheatsheets/Metasploit.md) Framework (MSF):** Empleado para buscar y ejecutar módulos de explotación automatizados contra las vulnerabilidades descubiertas.
* [python](../../../📂%2008%20Herramientas&Cheatsheets/python.md): Utilizado para estabilizar una shell limitada (non-tty) y generar una sesión TTY interactiva.
  

## Metodología Paso a Paso

1. **Enumeración del Objetivo:** Realizar escaneos de puertos y servicios para identificar qué está ejecutando el objetivo y encontrar detalles específicos como versiones de Apache, PHP o el sistema operativo Linux.

2. **Interacción con la Aplicación Web:** Navegar mediante un explorador hacia las direcciones IP en los puertos web descubiertos (ej. 80, 443) para identificar la aplicación específica alojada y encontrar su número de versión.

3. **Investigación de Vulnerabilidades:** Utilizar la versión exacta de la aplicación para buscar exploits públicos en línea utilizando palabras clave específicas.

4. **Búsqueda y Preparación de Exploits:** Utilizar la función de búsqueda de Metasploit. Si el exploit no está disponible localmente, investigar en repositorios como GitHub, descargar el código y ubicarlo en el directorio de módulos local.

5. **Ejecución y Estabilización:** Lanzar el exploit para establecer una sesión (ej. Meterpreter) e invocar una shell del sistema. Posteriormente, convertir esa shell restringida en un entorno interactivo TTY usando herramientas presentes en el sistema objetivo.


## Cheat Sheet de Comandos

```bash
# Escaneo de puertos con scripts por defecto y detección de versiones para recopilar información del stack web

nmap -sC -sV <TARGET_IP>
```

```bash
# Buscar un módulo de exploit dentro de Metasploit Framework por nombre de aplicación

search <APP_NAME>
```

```bash
# Actualizar los repositorios e instalar/actualizar Metasploit Framework

apt update; apt install metasploit-framework
```

```bash
# Localizar los directorios internos de Metasploit para añadir exploits manualmente

locate exploits
```

```bash
# Seleccionar un módulo de exploit específico dentro de msfconsole

use <EXPLOIT_PATH>
```

```bash
# Lanzar el exploit configurado en Metasploit

exploit
```

```bash
# Desplegar una shell de sistema estándar desde una sesión de Meterpreter

shell
```

```bash
# Verificar la existencia de Python en el sistema comprometido

which python
```

```bash
# Generar una shell interactiva TTY invocando el binario /bin/sh con el módulo pty de Python

python -c 'import pty; pty.spawn("/bin/sh")'
```

  
## "Gotchas" y Troubleshooting

* **Exploits Faltantes en MSF:** A veces los módulos útiles no están instalados en la versión local de Metasploit ni aparecen en la búsqueda. Se puede buscar el código del exploit directamente en repositorios de GitHub (como los de Rapid7).

* **Ruta de Instalación Manual:** Si copias un exploit de GitHub, guárdalo en la estructura de directorios correspondiente, por ejemplo: `/usr/share/metasploit-framework/modules/exploits/linux/http`.

* **Requisito de Extensión:** Todos los módulos agregados manualmente a MSF deben tener la extensión de archivo `.rb`, ya que están escritos en Ruby.

* **Limitaciones Non-TTY:** La shell obtenida (frecuentemente como el usuario `apache`) a menudo carece de un *prompt* visible y bloquea la ejecución de binarios que requieren TTY interactivo, como `su` y `sudo`. Es indispensable estabilizar la shell inmediatamente utilizando técnicas como `pty.spawn` de Python.