## Conceptos Clave (TL;DR)

* La variable de entorno PATH especifica el conjunto de directorios donde el sistema puede localizar un archivo ejecutable.
* Esta configuración es lo que permite a un usuario teclear un comando directamente sin necesidad de especificar la ruta absoluta del binario.
* Añadir `.` al PATH de un usuario incorpora su directorio de trabajo actual a la lista de búsqueda de ejecutables.
* Si un atacante logra modificar la ruta del usuario, puede reemplazar un binario común por un script malicioso, como una shell inversa.

## Herramientas Clave

* **Comandos integrados del sistema (Built-ins)**: Herramientas nativas como `env`, `echo` y `export` se utilizan para enumerar y manipular las variables de entorno sin necesidad de transferir herramientas externas.

## Metodología Paso a Paso

* **Fase 1: Enumeración**. Se requiere verificar el contenido actual de la variable PATH para identificar la estructura de directorios y buscar posibles deficiencias.
* **Fase 2: Modificación del PATH**. Si se cuenta con los privilegios o el acceso necesario, se altera la variable PATH para anteponer el directorio de trabajo actual (`.`) a los directorios del sistema.
* **Fase 3: Implantación del Payload**. Se procede a crear un script malicioso en el directorio de trabajo y se le nombra exactamente igual que un binario estándar del sistema. Se otorgan los permisos de ejecución necesarios.
* **Fase 4: Ejecución (Hijacking)**. Al introducir únicamente el nombre del archivo o comando desde el directorio actual, el sistema ejecuta el script malicioso en lugar del binario legítimo.

## Cheat Sheet de Comandos

Para comprobar los contenidos de la variable PATH:
```bash
# Muestra todas las variables de entorno y filtra por PATH para inspeccionar su valor
env | grep PATH

# Muestra directamente el valor contenido en la variable de entorno PATH
echo $PATH
```

Para modificar el PATH y secuestrar la ejecución de comandos:
```bash
# Asigna el directorio actual (.) al inicio del PATH existente, priorizando su lectura
PATH=.:${PATH}

# Exporta la nueva configuracion del PATH a la sesion actual del usuario
export PATH
```

Para crear el ejecutable falso y explotar la vulnerabilidad:
```bash
# Crea un archivo vacio nombrandolo como el comando legitimo a suplantar (ej. ls, cat, ping)
touch <TARGET_COMMAND>

# Inserta el payload malicioso deseado dentro del script falso creado
echo '<MALICIOUS_PAYLOAD>' > <TARGET_COMMAND>

# La bandera +x otorga permisos de ejecucion al archivo falso recien creado
chmod +x <TARGET_COMMAND>

# Ejecuta el nombre del comando, detonando el payload al encontrarse en el nuevo PATH
<TARGET_COMMAND>
```

## "Gotchas" y Troubleshooting

* Crear un script o programa en cualquier directorio que ya esté especificado en el PATH hará que sea ejecutable desde cualquier otro directorio del sistema.
* Por ejemplo, un script creado en una ruta válida del PATH (como `/usr/local/sbin`) se ejecutará correctamente incluso si el usuario lanza el comando estando posicionado en el directorio `/tmp`.
* Las modificaciones hechas al PATH con el comando `export` generalmente no son persistentes; el secuestro de comandos funcionará solo durante la sesión activa en la que se alteró la variable.