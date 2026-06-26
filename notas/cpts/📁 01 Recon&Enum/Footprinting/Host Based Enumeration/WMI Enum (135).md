---
tags:
  - enum/service
  - WMI
---
## Conceptos Clave (TL;DR)

* WMI es la implementacion de Microsoft del Common Information Model (CIM) y es una funcionalidad central del Web-Based Enterprise Management (WBEM) para Windows.
* Es la interfaz mas critica para la administracion y mantenimiento remoto, ya que permite acceso de lectura y escritura a casi todas las configuraciones en sistemas Windows, sean PCs o servidores.
* Su arquitectura no se basa en un unico ejecutable, sino que consiste en varios programas y diversas bases de datos conocidas como repositorios.
 

## Herramientas Clave

* **PowerShell, VBScript, WMIC**: Metodos nativos utilizados tipicamente para acceder e interactuar con la infraestructura WMI desde el sistema operativo.
* **Impacket (wmiexec.py)**: Toolkit de terceros esencial en pentesting para instanciar shells o ejecutar comandos remotos abusando del protocolo WMI.

  
## Metodologia Paso a Paso


### 1. Fase de Footprinting e Identificacion

La logica en esta fase es identificar si el servicio esta expuesto en la red. Debemos apuntar a los puertos de inicializacion. La comunicacion WMI siempre se inicializa en el puerto TCP 135.

### 2. Fase de Ejecucion Remota (RCE)

Una vez identificado el servicio y teniendo en posesion credenciales validas, el objetivo es obtener ejecucion de comandos. WMI permite la administracion profunda del sistema operativo. Herramientas como `wmiexec.py` aprovechan esto para ejecutar comandos silenciosamente, moviendo la comunicacion a un puerto aleatorio negociado tras la conexion inicial.

## Cheat Sheet de Comandos
```bash
# Ejecuta un comando simple de forma remota a traves de WMI.

# <USER>: Nombre de usuario valido en el dominio o maquina local.

# <PASSWORD>: Contrasena en texto claro del usuario.

# <TARGET_IP>: Direccion IP de la maquina objetivo.

# "comando": El comando a ejecutar (ej. "hostname", "whoami").

wmiexec.py <USER>:"<PASSWORD>"@<TARGET_IP> "comando"
```

  

## "Gotchas" y Troubleshooting

* **Problemas de Firewall y Puertos Efimeros**: WMI solo utiliza el puerto TCP 135 para la inicializacion de la comunicacion. Despues de establecer la conexion exitosamente, la comunicacion real se traslada a un puerto aleatorio de rango alto. Si el puerto 135 esta abierto pero los comandos fallan, es probable que un firewall este bloqueando los puertos dinamicos.

* **Dialecto SMB**: Herramientas como `wmiexec.py` dependen de la capa de transporte SMB y negociaran el dialecto correspondiente, como SMBv3.0.

* **Requisito de Laboratorio**: Comprender WMI en profundidad requiere practica. Es altamente recomendado configurar un Windows Server propio para escanear repetidamente los servicios, interactuar con ellos y analizar las diferencias en las configuraciones, ya que los manuales no reemplazan el entendimiento del principio funcional desde el punto de vista del administrador.

  

## Configuraciones Inseguras

* **Exposicion de Puertos RPC/WMI**: Permitir el acceso externo o desde redes de bajo privilegio al puerto TCP 135 y al rango de puertos aleatorios utilizados por WMI.

* **Credenciales Debiles con Permisos de Administracion**: Permitir que cuentas con contrasenas predecibles o comprometidas tengan acceso de lectura y escritura a las configuraciones del sistema a traves de WMI.