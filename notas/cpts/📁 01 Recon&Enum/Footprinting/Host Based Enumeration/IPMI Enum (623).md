---
tags:
  - IPMI
  - enum
---
## Conceptos Clave (TL;DR)

* Es un conjunto de especificaciones estandarizadas para la gestión y monitorización de sistemas host a nivel de hardware.
* Funciona de manera independiente del BIOS, CPU, firmware y sistema operativo subyacente.
* Permite gestionar sistemas incluso si están apagados o no responden, ya que utiliza una conexión de red directa al hardware.
* Los sistemas que implementan este protocolo se conocen como Baseboard Management Controllers (BMCs).
* Obtener acceso a un BMC otorga control total sobre la placa base y es casi equivalente a tener acceso físico al sistema.

### Herramientas Clave

* [**Nmap**](../../../%F0%9F%93%81%2001_Reconocimiento_y_Enumeracion/Footprinting/Host%20Based%20Enumeration/brain-not-braining/%F0%9F%93%82%2008_Herramientas_y_Cheatsheets/Nmap.md): Para footprinting del servicio y recolección de banners/versiones.
* [Metasploit](../../../%F0%9F%93%81%2001_Reconocimiento_y_Enumeracion/Footprinting/Host%20Based%20Enumeration/Metasploit.md): Para descubrimiento de versiones a escala y extracción de hashes a través de módulos auxiliares.
* [Hashcat](../../../%F0%9F%93%81%2001_Reconocimiento_y_Enumeracion/Footprinting/Host%20Based%20Enumeration/Hashcat.md): Para el crackeo offline de los hashes capturados.

### Metodología Paso a Paso

1. **Reconocimiento y Footprinting**: Identificar el servicio IPMI expuesto en la red. Se debe buscar el puerto UDP 623 abierto para confirmar la presencia del servicio.
2. **Identificación de Versión**: Confirmar si el objetivo ejecuta la versión 2.0 del protocolo, ya que esta versión contiene la vulnerabilidad específica de diseño en el proceso de autenticación.
3. **Validación de Credenciales por Defecto**: Antes de intentar ataques complejos, se debe probar el acceso a la consola web o servicios remotos (SSH/Telnet) utilizando credenciales de fábrica conocidas, las cuales frecuentemente no son modificadas por los administradores.
4. **Extracción de Hashes (Dumping)**: Si las credenciales por defecto fallan, aprovechar el fallo del protocolo RAKP en IPMI 2.0. Se envía una solicitud de autenticación para que el servidor devuelva el hash de la contraseña del usuario antes de validarlo.
5. **Crackeo Offline**: Someter los hashes obtenidos a ataques de diccionario o fuerza bruta de manera local para recuperar las contraseñas en texto plano.
6. **Movimiento Lateral / Reutilización**: Utilizar las credenciales obtenidas para acceder al BMC o verificar si estas contraseñas han sido reutilizadas en otros sistemas críticos dentro de la red.

### Cheat Sheet de Comandos

```bash
# Escaneo UDP en el puerto 623 para descubrir el servicio y su versión exacta usando un script NSE

sudo nmap -sU --script ipmi-version -p 623 <TARGET_IP>
```

```bash
# Iniciar Metasploit y cargar el módulo de escaneo de versión IPMI

msfconsole -q

use auxiliary/scanner/ipmi/ipmi_version

set RHOSTS <TARGET_IP_OR_CIDR>

set RPORT 623

run
```

```bash
# Cargar el módulo de Metasploit para volcar hashes de contraseñas explotando el fallo RAKP de IPMI 2.0

use auxiliary/scanner/ipmi/ipmi_dumphashes

set RHOSTS <TARGET_IP_OR_CIDR>

set USER_FILE <PATH_TO_USERS_WORDLIST>

set PASS_FILE <PATH_TO_PASSWORDS_WORDLIST>

run
```

```bash
# Crackeo offline de hashes IPMI usando Hashcat (Modo 7300).

# Este ataque de máscara específico (?1 * 8, donde ?1 es mayúsculas y dígitos) está diseñado para romper la contraseña por defecto de fábrica de HP iLO.

hashcat -m 7300 <HASH_FILE> -a 3 ?1?1?1?1?1?1?1?1 -1 ?d?u
```

### "Gotchas" y Troubleshooting

* **Puerto Específico**: IPMI se comunica exclusivamente a través del puerto 623 UDP. Los escaneos TCP no detectarán este servicio.
* **Requisitos de Energía**: Aunque el sistema operativo del host esté apagado, el módulo IPMI responderá a los ataques siempre y cuando tenga una fuente de alimentación y una conexión LAN activa.
* **Fallo a Nivel de Especificación**: No hay un "parche" o corrección directa para el ataque de volcado de hashes, ya que el comportamiento vulnerable es un componente crítico de la especificación oficial de IPMI 2.0.
* **Reutilización de Contraseñas**: Es común encontrar contraseñas únicas pero crackeables en BMCs que los administradores reutilizan para cuentas root o de acceso a otros monitores de red.

### Configuraciones Inseguras

* **Credenciales por defecto activas**: Administradores que despliegan servidores sin cambiar las contraseñas de fábrica de los BMCs. Algunas de las más comunes incluyen:

&#x20; \* Dell iDRAC: `root` : `calvin`

&#x20; \* HP iLO: `Administrator` : `<Cadena aleatoria de 8 caracteres alfanuméricos en mayúsculas>`

&#x20; \* Supermicro IPMI: `ADMIN` : `ADMIN`

* **Protocolo RAKP en IPMI 2.0**: Vulnerabilidad de diseño en la cual el servidor envía un hash (SHA1 o MD5 salteado) de la contraseña del usuario directamente al cliente durante el proceso de autenticación, antes de que este último se haya autenticado. Esto permite solicitar pasivamente el hash de cualquier cuenta de usuario válida en el BMC.
