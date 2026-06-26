---
tags:
  - linux
  - privex
  - gtfobins
---
## Conceptos Clave (TL;DR)

* El permiso SUID (Set User ID upon Execution) permite a un usuario ejecutar un programa o script utilizando los permisos del otro usuario propietario del archivo, lo cual suele implicar privilegios elevados como root. El bit SUID se representa con la letra 's' en los permisos del archivo.
* El permiso SGID (Set-Group-ID) es similar, pero permite ejecutar binarios con los privilegios del grupo creador del archivo.
* Es posible escalar privilegios haciendo ingeniería inversa para encontrar vulnerabilidades en estos archivos , o aprovechando funcionalidades integradas del programa para ejecutar comandos del sistema.
* GTFOBins es una lista curada de binarios y scripts de Linux que documenta cómo abusar de sus funciones legítimas para evadir shells restringidas, escalar privilegios o transferir archivos.

## Herramientas Clave

* **find**: Utilidad de línea de comandos de Linux usada para enumerar el sistema de archivos y encontrar binarios con permisos específicos asignados.
* **GTFOBins**: Recurso de consulta indispensable durante la escalación para buscar el comportamiento explotable de binarios legítimos del sistema.
* **apt-get**: Gestor de paquetes que, usado como ejemplo, permite la ejecución de comandos para evadir entornos restringidos mediante parámetros de pre-invocación.

## Metodología Paso a Paso

1. **Enumeracion inicial**: Busca en todo el sistema de archivos aquellos binarios que tengan los bits SUID o SGID configurados y pertenezcan a usuarios con altos privilegios (usualmente root). Esta fase revela la superficie de ataque disponible.
2. **Analisis de binarios y consulta cruzada**: Revisa la lista de archivos obtenidos. Si son binarios estándar, búscalos inmediatamente en GTFOBins para verificar si existen métodos documentados para obtener una shell interactiva o ejecutar comandos como root. Si son binarios personalizados, considera descargarlos para hacer ingeniería inversa en busca de vulnerabilidades.
3. **Explotacion (Abuso de funcionalidades)**: Ejecuta el binario utilizando los comandos y banderas específicos (como los documentados en GTFOBins) para romper el contexto de usuario actual e invocar una shell con los permisos heredados del propietario del archivo.

## Cheat Sheet de Comandos

```bash
# Busca en todo el sistema de archivos (/) archivos del usuario especificado
# -perm -4000: Busca archivos con el bit SUID activo
# -exec ls -ldb {} \; : Ejecuta un listado detallado de cada resultado
# 2>/dev/null: Redirige los errores estándar para evitar ruido en pantalla
find / -user <TARGET_USER> -perm -4000 -exec ls -ldb {} \; 2>/dev/null


# Busca en todo el sistema de archivos por ID de usuario
# -uid 0: Busca archivos cuyo propietario tenga el User ID 0 (root)
# -perm -6000: Busca archivos con el bit SGID (o SUID+SGID) activo
# -type f: Limita la busqueda exclusivamente a archivos (excluye directorios)
find / -uid 0 -perm -6000 -type f 2>/dev/null


# Ejecuta apt-get con permisos elevados para invocar una shell
# -o APT::Update::Pre-Invoke::=/bin/sh: Inyecta un comando (/bin/sh) antes de que apt-get actualice los repositorios
sudo apt-get update -o APT::Update::Pre-Invoke::=/bin/sh
```

## "Gotchas" y Troubleshooting

* **Ruido en la enumeración**: Las búsquedas desde la raíz (`/`) arrojarán decenas de errores de "Permiso denegado". Es obligatorio usar `2>/dev/null` en los comandos de enumeración para poder visualizar correctamente los archivos SUID/SGID encontrados.
* **Familiarización previa**: Es altamente recomendado estudiar y conocer previamente la mayor cantidad posible de binarios documentados en GTFOBins. Esto agilizará drásticamente tu tiempo de respuesta en el examen para identificar rápidamente si un binario listado representa una mala configuración explotable.