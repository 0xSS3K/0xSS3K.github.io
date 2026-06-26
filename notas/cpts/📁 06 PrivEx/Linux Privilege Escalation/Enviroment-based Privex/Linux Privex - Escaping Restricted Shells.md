---
tags:
  - linux
  - privex
  - enum
---
## Conceptos Clave (TL;DR)

* Una shell restringida es un entorno que limita la capacidad del usuario para ejecutar comandos específicos o acceder a ciertos directorios.
* Los administradores las implementan para proporcionar un entorno seguro y controlado, evitando acciones que puedan dañar el sistema o comprometer la seguridad.
* Las variantes más comunes en Linux incluyen rbash, rksh y rzsh, las cuales restringen diferentes funcionalidades como cambiar de directorio, modificar variables de entorno o ejecutar scripts.
* El escape de estas shells se logra explotando vulnerabilidades inherentes de la shell o utilizando técnicas creativas para evadir las restricciones impuestas mediante sintaxis válida.

## Herramientas Clave

* **Comandos integrados (Built-ins):** Comandos permitidos por el entorno (ej. `ls`) que pueden ser abusados para ejecutar otros comandos.
* **Metacaracteres de shell:** Caracteres especiales como comillas invertidas (`` ` ``), punto y coma (`;`) o barras verticales (`|`) utilizados para encadenar o sustituir comandos.
* **Variables de entorno:** Variables del sistema que dictan el comportamiento de la shell y los directorios de ejecución.
* **Funciones de shell:** Bloques de código personalizados que el usuario puede definir para ejecutar acciones evadiendo las restricciones.

## Metodología Paso a Paso

* **Fase 1: Enumeración de restricciones**
  * Determinar qué comandos integrados están permitidos y si la shell acepta argumentos o metacaracteres específicos.

* **Fase 2: Ejecución de técnicas de escape**
  * **Inyección de Comandos:** Si la shell permite pasar argumentos a un comando integrado, se pueden inyectar comandos adicionales no permitidos dentro de esos argumentos.
  * **Sustitución de Comandos:** Consiste en encerrar un comando no restringido entre comillas invertidas dentro de la sintaxis de un comando permitido, forzando su ejecución.
  * **Encadenamiento de Comandos:** Se utilizan separadores como `;` o `|` en una sola línea para ejecutar un comando no restringido justo después de un comando permitido.
  * **Manipulación de Variables de Entorno:** Si el entorno lo permite, se modifican o crean variables de entorno que alteran el directorio desde donde la shell ejecuta los comandos, permitiendo invocar binarios no restringidos.
  * **Definición de Funciones de Shell:** Si está permitido, se define una función de shell que contenga y ejecute comandos que de otro modo estarían restringidos.

## Cheat Sheet de Comandos

```bash
# Entrar a la sesión ssh predefiniendo la shell 
ssh htb-user@10.129.205.109 -t "bash --noprofile"

#revisar los comandos permitidos
compgen -c

# Ejecuta el comando permitido 'ls' e inyecta un comando secundario usando sustitución por comillas invertidas.
# Esto logra que la salida del comando inyectado se pase como argumento, forzando la ejecución del comando secundario aunque esté restringido.
ls -l `<COMMAND_TO_INJECT>`

# Ejemplo directo del texto donde se inyecta 'pwd' dentro de un comando 'ls' permitido.
ls -l `pwd`

# Encadenamiento de comandos: Utiliza un punto y coma para separar comandos.
# Ejecuta un comando permitido seguido de uno que la shell no restringe explícitamente en el encadenamiento.
<ALLOWED_COMMAND> ; <COMMAND_TO_INJECT>

# Encadenamiento de comandos mediante tuberías (pipes).
# Pasa la salida estándar del comando permitido a la entrada de un segundo comando.
<ALLOWED_COMMAND> | <COMMAND_TO_INJECT>
```

## "Gotchas" y Troubleshooting

* **Limitaciones de RBASH:** Restringe severamente cambiar directorios y modificar o establecer variables de entorno. La técnica de "Manipulación de Variables de Entorno" puede fallar aquí.
* **Limitaciones de RKSH:** Impide explícitamente crear o modificar funciones de shell. La técnica de "Definición de Funciones de Shell" no será viable en este entorno.
* **Limitaciones de RZSH:** Bloquea la ejecución de scripts de shell y la definición de alias, a pesar de ser la shell más flexible.
* **Dependencia de la configuración:** El éxito de la Inyección o Sustitución de Comandos depende enteramente de que la shell permita el uso de argumentos específicos o caracteres de sustitución (como las comillas invertidas) en los comandos integrados.