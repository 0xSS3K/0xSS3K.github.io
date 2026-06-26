---
tags:
  - enum/service
  - ssh
---
## Conceptos Clave (TL;DR)

* Protocolo que establece una conexión directa y cifrada, por defecto en el puerto TCP 22, para prevenir la interceptación de datos.
* Existen dos versiones principales: SSH-1 es vulnerable a ataques MITM, mientras que SSH-2 ofrece cifrado, velocidad y seguridad superiores.
* Utiliza múltiples métodos de autenticación, destacando el uso de contraseñas y la autenticación de clave pública, donde un par de claves (pública en el servidor, privada local) gestiona el acceso seguro.
* Es nativo en Unix/Linux y macOS, pero también es ejecutable en Windows y se utiliza para gestión remota, ejecución de comandos, transferencia de archivos y port forwarding.
  

## Herramientas Clave

* **ssh-audit**: Script utilizado para realizar footprinting del servicio. Verifica configuraciones tanto del lado del cliente como del servidor, mostrando los algoritmos de cifrado vigentes y detectando el uso de curvas elípticas o hashes débiles.
* **ssh (Cliente OpenSSH)**: Herramienta estándar para conectar, interactuar con el servicio, analizar la verbosidad de la conexión (para listar métodos de autenticación) y forzar parámetros específicos.
  

## Metodología Paso a Paso

### Fase 1: Reconocimiento y Footprinting

El objetivo es identificar la versión del servicio, protocolos soportados y algoritmos criptográficos para buscar vulnerabilidades (como CVE-2020-14145) y malas prácticas de configuración. Se debe leer el banner emitido por el servicio para determinar el vector de ataque. 

### Fase 2: Enumeración de Métodos de Autenticación

Al iniciar una conexión con alta verbosidad, el servidor listará los métodos de autenticación que soporta (ej. publickey, password, keyboard-interactive). Esta información dictamina si se puede proceder con un ataque de fuerza bruta. 

### Fase 3: Explotación

Si la enumeración revela que la autenticación por contraseña está permitida, se procede a ejecutar ataques de fuerza bruta o adivinación basados en mutaciones de contraseñas comunes (ya que los usuarios suelen usar patrones predecibles) forzando al cliente a usar este método.

## Cheat Sheet de Comandos
```bash
# Auditar la configuracion y algoritmos del servidor SSH remoto
# Extrae banners, software y fallos criptograficos del lado del servidor
git clone [https://github.com/jtesta/ssh-audit.git](https://github.com/jtesta/ssh-audit.git) && cd ssh-audit

./ssh-audit.py <TARGET_IP>

  
# Iniciar conexion con alta verbosidad para enumerar metodos de autenticacion
# La flag -v (verbose) muestra el proceso de handshake y los metodos aceptados (Authentications that can continue)
ssh -v <USER>@<TARGET_IP>

  
# Forzar la autenticacion exclusivamente por contrasena
# -o PreferredAuthentications=password ignora llaves publicas u otros metodos, util para validar credenciales obtenidas
ssh -v <USER>@<TARGET_IP> -o PreferredAuthentications=password

  
# Leer la configuracion local del servidor SSH (Si se tiene acceso al sistema)
# Filtra comentarios (#) y lineas en blanco para una lectura limpia del archivo sshd_config
cat /etc/ssh/sshd_config | grep -v "#" | sed -r '/^\s*$/d'
```

  
## Configuraciones Inseguras

Durante la enumeración interna de un servidor o la auditoría de `/etc/ssh/sshd_config`, estas son las directivas que abren vectores de ataque o facilitan el movimiento lateral:

* `PasswordAuthentication yes`: Habilita el uso de contraseñas, permitiendo ataques de fuerza bruta.

* `PermitEmptyPasswords yes`: Permite el acceso a cuentas que no tienen contraseña configurada.

* `PermitRootLogin yes`: Permite el inicio de sesión directo a la cuenta de máxima prioridad (root).

* `Protocol 1`: Fuerza el uso de cifrado obsoleto vulnerable a ataques.

* `X11Forwarding yes`: Permite reenviar tráfico de aplicaciones GUI (versiones antiguas como 7.2p1 fueron vulnerables a inyección de comandos por esta directiva).

* `AllowTcpForwarding yes` / `PermitTunnel`: Directivas críticas que permiten al atacante crear túneles y hacer forwarding de puertos para pivotar en la red.

* `DebianBanner yes`: Expone información detallada del sistema operativo al momento de conectarse.

  

## "Gotchas" y Troubleshooting

* **Interpretación de Banners**: El banner inicial es clave. Si el banner dice `SSH-1.99-OpenSSH_3.9p1`, significa que el servidor soporta tanto SSH-1 como SSH-2 (retrocompatibilidad). Si el banner es `SSH-2.0-OpenSSH_8.2p1`, el servidor rechaza SSH-1 y solo opera bajo el protocolo seguro.

* **Riesgo MITM Inicial**: En la autenticación de clave pública, el único momento donde existe riesgo real de intercepción es durante el primer contacto, cuando el cliente debe aceptar y validar la identidad (host key) del servidor.

* **Llaves Privadas Protegidas**: Si extraes una clave privada local (id_rsa) de un usuario, ten en cuenta que podría estar protegida por una *passphrase*. Sin ella, no podrás usar la clave para autenticarte, ya que el cliente no podrá descifrar el reto criptográfico que envía el servidor.