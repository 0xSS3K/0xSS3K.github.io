---
tags:
  - enum/service
  - R-SERVICES
---
## Conceptos Clave (TL;DR)

* R-Services es una suite de servicios alojada para habilitar el acceso remoto o la ejecución de comandos entre hosts Unix a través de TCP/IP, siendo el estándar de facto antes de ser reemplazados por los protocolos SSH.
* Transmite la información sobre la red en formato no cifrado, lo que hace posible que los atacantes intercepten el tráfico (contraseñas, información de inicio de sesión) mediante ataques Man-In-The-Middle (MITM).
* Se extiende a través de los puertos 512, 513 y 514 y solo es accesible a través de la suite de comandos r.

  
## Configuraciones Inseguras

* Los servicios omiten la autenticación PAM mediante el uso de los archivos `/etc/hosts.equiv` y `.rhosts` en el sistema.
* El archivo `hosts.equiv` se reconoce como la configuración global del sistema, mientras que `.rhosts` proporciona una configuración por usuario.
* Estos archivos contienen una lista de hosts (IPs o nombres de host) y usuarios que el host local considera de confianza cuando se intenta una conexión.
* El modificador `+` puede usarse dentro de estos archivos como un comodín para especificar cualquier cosa, permitiendo que cualquier usuario externo acceda a los comandos r.
* Las configuraciones erróneas en cualquiera de estos archivos permiten a un atacante autenticarse como otro usuario sin credenciales, con potencial para obtener ejecución de código.

  
## Herramientas Clave

* [Nmap](../../../📂%2008%20Herramientas&Cheatsheets/Nmap.md) Utilizado para realizar el footprinting y escanear los puertos asociados a la suite.
* **rlogin**: Comando cliente utilizado para iniciar sesión en un host remoto a través de la red, similar a telnet pero limitado a hosts tipo Unix.
* **rwho**: Comando que lista todas las sesiones interactivas en la red local consultando al demonio respectivo.
* **rusers**: Comando utilizado en conjunto con rwho para proporcionar un recuento más detallado de todos los usuarios conectados en la red.

  

## Metodología Paso a Paso

1. **Escaneo y Descubrimiento**: Se inicia identificando la presencia de R-Services escaneando los puertos TCP 512, 513 y 514 en el host objetivo.

2. **Explotación de Relaciones de Confianza**: Se intenta acceder directamente al sistema utilizando comandos como `rlogin` asumiendo que existen configuraciones erróneas con comodines en los archivos de confianza del objetivo.

3. **Enumeración Post-Explotación**: Una vez dentro de una sesión válida, se recopila información sobre otros usuarios interactivos y sesiones en la red utilizando herramientas como `rwho` o `rusers` para identificar nuevos vectores de ataque laterales.

  

## Cheat Sheet de Comandos
```bash
# -sV: Escanea los puertos para detectar la versión del servicio en ejecución
# -p 512,513,514: Define exactamente los puertos por defecto asociados a r-services

nmap -sV -p 512,513,514 <TARGET_IP>
```

```bash
# Lectura de los archivos de confianza si se dispone de LFI o acceso inicial a nivel de sistema de archivos

cat /etc/hosts.equiv

cat .rhosts
```

```bash
# -l: Especifica el nombre de usuario local con el que se intenta iniciar sesión en el host remoto

rlogin <TARGET_IP> -l <USER>
```

```bash
# Envía solicitudes para listar todos los usuarios interactivos en la red local

rwho
```

```bash
# -a: Lista todas las máquinas que responden, incluso si no hay usuarios conectados
# -l: Imprime un formato largo con detalles como TTY, fecha, hora de inactividad y el host remoto

rusers -al <TARGET_IP>
```


## "Gotchas" y Troubleshooting

* A diferencia de `rsh` o `rlogin`, la herramienta `rexec` sí requiere autenticación a través del uso de un nombre de usuario y contraseña mediante un socket de red no cifrado, a menos que esta sea anulada por los archivos de confianza.

* El demonio `rwho` opera recibiendo solicitudes a través del puerto UDP 513. Además, este demonio transmite periódicamente información sobre los usuarios conectados, por lo que monitorear el tráfico de red puede ser muy útil.

* El comando `rcp` se comporta como `cp` en Linux pero tiene la peculiaridad de no advertir al usuario si está sobrescribiendo archivos existentes en un sistema.