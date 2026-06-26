---
tags:
  - enum/service
  - RDP
---
## Conceptos Clave (TL;DR)

* Protocolo desarrollado por Microsoft que permite acceso remoto y control mediante interfaz grafica (GUI) a sistemas operativos Windows, operando en la capa de aplicacion.
* Utiliza primariamente el puerto TCP 3389, aunque el puerto UDP 3389 tambien puede emplearse para administracion remota.
* El servicio viene instalado por defecto en servidores Windows; comunmente, su configuracion predeterminada exige Network Level Authentication (NLA) para permitir conexiones.
* Aunque soporta cifrado TLS/SSL para proteger la red y el proceso de login, por defecto los certificados de identidad son meramente autofirmados.

  
## Herramientas Clave

* **[Nmap](../../../📂%2008%20Herramientas&Cheatsheets/Nmap.md)**: Utilizado para realizar footprinting del servicio, confirmar el uso de NLA, obtener el hostname y la version del producto.
* **rdp-sec-check.pl**: Script desarrollado por Cisco CX Security Labs para identificar configuraciones de seguridad, cifrados soportados y protocolos sin requerir autenticacion.
* **xfreerdp / rdesktop / Remmina**: Clientes de acceso remoto para Linux que permiten conectarse e interactuar con la GUI del servidor atacado.

  
## Metodologia Paso a Paso

  
**Fase 1: Reconocimiento y Footprinting**

El objetivo es identificar informacion critica del host (hostname, dominio, version del SO) y determinar si NLA esta habilitado. Esto nos indicara si es posible interactuar con el servicio antes de autenticarnos.

  
**Fase 2: Analisis de Seguridad del Protocolo**

Se realiza una inspeccion de las capacidades criptograficas del servidor. Se busca identificar si el servidor soporta protocolos de seguridad anticuados o cifrado debil (como RDP Security en lugar de TLS) que podrian facilitar ataques de intercepcion.


**Fase 3: Inicio de Sesion y Acceso**

Una vez obtenidas credenciales validas durante el pentest, se utilizan herramientas cliente para iniciar una sesion en la GUI. Durante este paso, es comun tener que aceptar manualmente advertencias por discordancia o invalidez del certificado autofirmado.

## Cheat Sheet de Comandos

Identificacion de informacion, versionado y scripts predeterminados:
```bash
# -sV: Deteccion de version | -sC: Scripts por defecto | --script rdp*: Ejecuta todos los scripts relacionados con RDP

nmap -sV -sC <TARGET_IP> -p3389 --script rdp*
```

Trazado manual de paquetes para inspeccion de cookies y flujos:
```bash
# --packet-trace: Muestra los paquetes enviados/recibidos | --disable-arp-ping: Omite descubrimiento ARP | -n: Omite resolucion DNS

nmap -sV -sC <TARGET_IP> -p3389 --packet-trace --disable-arp-ping -n
```

Instalacion de dependencias para rdp-sec-check:
```bash
# Instala el modulo de Perl necesario para parsear las respuestas del servidor

sudo cpan
install Encoding::BER
```

Descarga y ejecucion de rdp-sec-check.pl:
```bash
# Clona el repositorio y ejecuta el script contra el objetivo para enumerar su seguridad

git clone [https://github.com/CiscoCXSecurity/rdp-sec-check.git](https://github.com/CiscoCXSecurity/rdp-sec-check.git) && cd rdp-sec-check

./rdp-sec-check.pl <TARGET_IP>
```

Conexion interactiva utilizando xfreerdp:
```bash
# /u: Usuario | /p: Contrasena | /v: IP Objetivo

xfreerdp /u:<USER> /p:"<PASSWORD>" /v:<TARGET_IP>
``` 

## "Gotchas" y Troubleshooting

* **Deteccion por EDR:** Nmap interactua con el servidor inyectando cookies hardcodeadas (`mstshash=nmap`). Esto es facilmente identificable por Threat Hunters y soluciones EDR, lo cual puede resultar en bloqueos durante evaluaciones en redes fortificadas.

* **Advertencias de Certificado:** Al conectar con xfreerdp, es normal recibir errores de "CERTIFICATE NAME MISMATCH" o fallos de verificacion. Esto ocurre porque el cliente no puede verificar la legitimidad de un certificado autofirmado; debe ser aceptado manualmente (opcion 'Y').

* **Enrutamiento Externo:** Si el RDP no es accesible, considera que para llegar desde el exterior, se requiere que el firewall del servidor, el firewall de red y las reglas de Port Forwarding (NAT) esten correctamente configuradas hacia la IP publica y el puerto.

## Configuraciones Inseguras

* **Cifrado Inadecuado:** Algunos sistemas Windows no imponen el uso de TLS/SSL y continuan aceptando cifrado deficiente a traves del protocolo legado "RDP Security".

* **Certificados Autofirmados:** El uso de certificados que proveen identidad de forma autofirmada no protege verdaderamente contra ataques Man-In-The-Middle (MITM), ya que el cliente no puede distinguir un certificado falso del real.