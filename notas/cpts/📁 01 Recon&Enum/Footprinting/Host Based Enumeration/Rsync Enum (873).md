---
tags:
  - enum/service
  - Rsync
---
## Conceptos Clave (TL;DR)

* Rsync es una herramienta rápida y eficiente utilizada para copiar archivos localmente y hacia o desde hosts remotos.
* Emplea un algoritmo de transferencia delta que minimiza el tráfico de red enviando únicamente las diferencias entre los archivos de origen y destino.
* Opera por defecto en el puerto 873 y es comúnmente utilizado para copias de seguridad y espejos.
* Puede ser abusado para listar contenidos de carpetas compartidas y recuperar archivos de un servidor objetivo, en ocasiones sin necesidad de autenticación.
  

## Herramientas Clave
* **[Nmap](../../../📂%2008%20Herramientas&Cheatsheets/Nmap.md)**: Utilizado para identificar el servicio Rsync en ejecución y la versión del protocolo.
* **Netcat (nc)**: Empleado para conectarse directamente al puerto del servicio e identificar recursos compartidos accesibles.
* **Rsync (cliente)**: Herramienta principal para enumerar el contenido específico de los recursos compartidos y sincronizar/descargar los archivos hacia el equipo atacante.
  

## Metodología Paso a Paso

1. **Descubrimiento del Servicio**: El primer paso es confirmar si el puerto 873 está abierto y determinar la versión del protocolo de Rsync ejecutándose en el objetivo para confirmar nuestra superficie de ataque.
2. **Sondeo de Recursos Accesibles**: Una vez confirmado el servicio, nos conectamos directamente al puerto mediante Netcat para solicitar una lista de los recursos compartidos disponibles en el servidor.
3. **Enumeración del Recurso Compartido**: Con el nombre del recurso obtenido, utilizamos el cliente Rsync configurado para solo listar el contenido. Esto nos permite identificar archivos de interés como scripts, configuraciones o claves SSH sin transferir todo el volumen de datos.
4. **Extracción de Archivos**: Tras identificar archivos útiles, procedemos a sincronizar el recurso compartido completo hacia nuestra máquina atacante para su posterior análisis o uso en escalada de privilegios.

  
## Cheat Sheet de Comandos
```bash
# Escanea el puerto por defecto de Rsync (873) para detectar el servicio y su versión.

# -sV: Determina la versión del servicio.

# -p 873: Especifica el puerto a escanear.

sudo nmap -sV -p 873 <TARGET_IP>
```

```bash
# Se conecta al puerto de Rsync para interactuar manualmente y descubrir recursos compartidos.

# -n: No resuelve nombres de dominio (solo IP).

# -v: Modo verboso para ver detalles de la conexión.

# NOTA: Una vez conectado, escribir "#list" y presionar Enter para ver los recursos compartidos.
nc -nv <TARGET_IP> 873
```

```bash
# Lista el contenido de un recurso compartido específico sin descargar los archivos.

# -a: Modo archivo (archive), preserva permisos, tiempos, etc.

# -v: Modo verboso.

# --list-only: Exige que solo se listen los archivos, evitando la descarga.

rsync -av --list-only rsync://<TARGET_IP>/<SHARE_NAME>
```

```bash
# Sincroniza y descarga todo el contenido del recurso compartido objetivo al directorio actual del atacante.

# -a: Modo archivo.

# -v: Modo verboso.

rsync -av rsync://<TARGET_IP>/<SHARE_NAME> .
```

```bash
# Sincroniza archivos utilizando SSH como medio de transferencia seguro.

# -e ssh: Especifica el uso de SSH como la shell remota.

rsync -av -e ssh rsync://<TARGET_IP>/<SHARE_NAME>
```

```bash
# Sincroniza archivos utilizando SSH en un puerto no estándar.

# -e "ssh -p<PORT>": Especifica el uso de SSH y define un puerto customizado.

rsync -av -e "ssh -p<PORT>" rsync://<TARGET_IP>/<SHARE_NAME>
```

## "Gotchas" y Troubleshooting

* Rsync puede configurarse para operar sobre SSH, aprovechando una conexión de servidor SSH ya establecida en lugar de su puerto por defecto.

* Si el servicio SSH opera en un puerto distinto al 22, es necesario ajustar el comando Rsync para especificar dicho puerto utilizando la sintaxis `-e "ssh -p<PORT>"`.

* Si se descubren credenciales válidas durante un test de intrusión, siempre se debe comprobar si hay reutilización de contraseñas, ya que esto podría permitir la descarga de archivos sensibles que faciliten el acceso remoto.

  

## Configuraciones Inseguras

* La existencia de recursos compartidos de Rsync que permiten listar contenidos y recuperar archivos del servidor objetivo sin requerir ningún tipo de autenticación.