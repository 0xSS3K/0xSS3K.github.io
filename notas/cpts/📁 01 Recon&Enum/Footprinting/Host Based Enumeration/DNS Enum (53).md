---
tags:
  - enum/service
  - dns
---
## Conceptos Clave (TL;DR)

* [DNS](../../../📂%2008%20Herramientas&Cheatsheets/ServiceEnum.md) traduce nombres de dominio a direcciones IP sin una base de datos centralizada.
* Registros críticos: A (IPv4), AAAA (IPv6), NS (Name Servers), MX (Mail), TXT (Validación/Info), CNAME (Alias), PTR (Resolución inversa), SOA (Info de zona administrativa).
* Los archivos de zona almacenan los registros; las transferencias de zona (AXFR) sincronizan servidores maestro y esclavo mediante TCP puerto 53.

  
## Herramientas Clave

* `dig`: Interacción directa y consultas manuales de registros específicos y transferencias de zona.
* `SecLists`: Listas de palabras para fuerza bruta de subdominios.
* `dnsenum`: Herramienta automatizada para enumeración de registros, transferencias de zona y fuerza bruta de subdominios.
* `Bash`: Creación de bucles (for-loops) para consultas automatizadas de subdominios.
 

## Metodología Paso a Paso

1. **Enumeración de Registros Estándar**: Consultar NS, SOA y ANY para mapear la infraestructura principal y extraer información útil como correos de administradores y otros servidores de nombres.

2. **Identificación de Versión**: Intentar revelar la versión del servidor BIND mediante consultas clase CHAOS para buscar vulnerabilidades específicas en CVE databases.

3. **Intento de Transferencia de Zona (AXFR)**: Solicitar una copia completa de la zona DNS. Si está mal configurado, revelará toda la infraestructura, incluyendo IPs y dominios internos.

4. **Fuerza Bruta de Subdominios**: Si AXFR falla, utilizar listas de palabras para descubrir subdominios activos resolviendo registros A iterativamente.


## Configuraciones Inseguras

* `allow-transfer`: Si se configura en una subred de pruebas o en "any", permite a cualquier atacante obtener el archivo de zona completo mediante AXFR, revelando dominios e IPs internas.

* `allow-query`: Define incorrectamente qué hosts pueden enviar solicitudes al servidor DNS.

* `allow-recursion`: Define incorrectamente qué hosts pueden enviar solicitudes recursivas, lo que podría abusarse para ataques de amplificación o envenenamiento de caché.

* Priorizar la funcionalidad de la infraestructura sobre la seguridad a menudo conduce a estas malas configuraciones en Bind9.

  
## Cheat Sheet de Comandos
```bash
# Consultar el registro SOA (Start of Authority) para obtener datos administrativos
dig soa <DOMAIN>
  

# Consultar los servidores de nombres (NS) apuntando a un servidor DNS especifico
dig ns <DOMAIN> @<TARGET_IP>

  
# Solicitar cualquier registro (ANY) disponible que el servidor este dispuesto a divulgar
dig any <DOMAIN> @<TARGET_IP>

  
# Intentar revelar la version del servidor BIND (Clase CHAOS, tipo TXT)
dig CH TXT version.bind <TARGET_IP>
 

# Intentar una transferencia de zona completa (AXFR) sobre el dominio principal
dig axfr <DOMAIN> @<TARGET_IP>

  
# Intentar una transferencia de zona sobre un subdominio interno descubierto
dig axfr <INTERNAL_SUBDOMAIN>.<DOMAIN> @<TARGET_IP>
  

# Fuerza bruta de subdominios usando un bucle for de Bash y una wordlist
for sub in $(cat <WORDLIST_PATH>);do dig $sub.<DOMAIN> @<TARGET_IP> | grep -v ';\|SOA' | sed -r '/^\s*$/d' | grep $sub | tee -a subdomains.txt;done

  
# Enumeracion automatizada, intento de AXFR y fuerza bruta usando dnsenum
dnsenum --dnsserver <TARGET_IP> --enum -p 0 -s 0 -o subdomains.txt -f <WORDLIST_PATH> <DOMAIN>
```

  
## "Gotchas" y Troubleshooting

* Las transferencias de zona (AXFR) ocurren generalmente a través del puerto TCP 53, a diferencia de las consultas regulares que suelen usar UDP.

* La consulta tipo ANY no siempre muestra todos los registros existentes en las zonas; su output está limitado a lo que el servidor decida divulgar.

* Para que la consulta de versión de BIND funcione mediante la consulta CHAOS, el registro `version.bind` debe existir explícitamente en el servidor.

* Los errores de sintaxis en los archivos de zona de BIND inutilizan la zona completa, y el servidor responderá a las consultas con un mensaje de error SERVFAIL.

* Al leer un registro SOA, recuerda que el primer punto (.) en la cadena de contacto se reemplaza por un símbolo de arroba (@) para formar la dirección de correo electrónico real del administrador.