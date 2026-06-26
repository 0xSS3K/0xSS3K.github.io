---
tags:
  - kerberos
  - AD
  - attack
  - linux
---
## Conceptos Clave (TL;DR)

* Es una técnica de movimiento lateral y escalada de privilegios que tiene como objetivo cuentas configuradas con Service Principal Names (SPN).
* Los SPN identifican de forma única una instancia de servicio y la vinculan a la cuenta de servicio en cuyo contexto se ejecuta.
* Cualquier usuario válido del dominio puede solicitar un ticket Kerberos (TGS) para cualquier cuenta de servicio en su mismo dominio.
* El ticket Kerberos devuelto (TGS-REP) está cifrado con el hash NTLM de la cuenta de servicio, lo que permite intentar extraer la contraseña en texto claro mediante ataques de fuerza bruta offline.
* Las cuentas que ejecutan servicios a menudo pertenecen a grupos altamente privilegiados, como "Domain Admins", o son administradores locales en múltiples servidores.

  
## Herramientas Clave

* **GetUserSPNs.py (Impacket):** Se utiliza desde hosts Linux no unidos al dominio para enumerar cuentas SPN y solicitar los tickets TGS-REP en formato crackeable.
* **[Hashcat](../../../📂%2008%20Herramientas&Cheatsheets/Hashcat.md):** Herramienta utilizada para someter los tickets TGS obtenidos a ataques de fuerza bruta offline y recuperar la contraseña.
* [NetExec](../../../📂%2008%20Herramientas&Cheatsheets/NetExec.md) Herramienta para validar las credenciales obtenidas (texto claro o hash) contra los sistemas objetivo, como un Domain Controller.

  
## Metodología Paso a Paso

1. **Enumeración de SPNs:** Utilizando credenciales de un usuario válido del dominio, se consulta al Domain Controller (DC) para obtener una lista de cuentas con un SPN asignado, prestando especial atención a los grupos a los que pertenecen.

2. **Solicitud de Tickets TGS:** Se solicita al DC que emita tickets de servicio (TGS) para las cuentas identificadas.

3. **Extracción y Guardado:** Los tickets solicitados se extraen y se guardan localmente en la máquina del atacante en un formato compatible con herramientas de cracking.

4. **Cracking Offline:** Se emplea una herramienta de fuerza bruta (como Hashcat) junto con un diccionario de contraseñas para crackear el ticket e intentar obtener la contraseña en texto claro.

5. **Validación:** Una vez crackeada la contraseña, se verifica el nivel de acceso autenticándose contra el DC o cualquier otro sistema del dominio.

  
## Cheat Sheet de Comandos
```bash
# Listar cuentas con SPNs configurados usando una contraseña en texto claro (requiere IP del DC y credenciales).

GetUserSPNs.py -dc-ip <DC_IP> <DOMAIN>/<USER>
```
  
```bash
# Solicitar todos los tickets TGS disponibles en el dominio y mostrarlos en pantalla.

GetUserSPNs.py -dc-ip <DC_IP> <DOMAIN>/<USER> -request
```
  
```bash
# Solicitar el ticket TGS para un usuario SPN especifico.

GetUserSPNs.py -dc-ip <DC_IP> <DOMAIN>/<USER> -request-user <TARGET_SPN_USER>
```
  
```bash
# Solicitar el/los ticket(s) TGS y guardarlos directamente en un archivo de salida para su cracking offline.

GetUserSPNs.py -dc-ip <DC_IP> <DOMAIN>/<USER> -request -outputfile <OUTPUT_FILE>
```
  
```bash
# Crackear el ticket TGS guardado utilizando Hashcat y un diccionario (El modo de Kerberos 5 TGS-REP etype 23 es el 13100).

hashcat -m 13100 <OUTPUT_FILE> <WORDLIST_PATH>
```
  
```bash
# Validar las credenciales obtenidas contra el Domain Controller a traves de SMB.

crackmapexec smb <DC_IP> -u <CRACKED_USER> -p <CRACKED_PASSWORD>
```

  
## "Gotchas" y Troubleshooting

* **Requisitos Previos:** Para ejecutar el ataque necesitas la IP de un Domain Controller y acceso a una cuenta de dominio válida (contraseña en texto claro, hash NTLM para usar con Impacket, ticket Kerberos, o una shell en contexto SYSTEM/Domain User).

* **Velocidad de Cracking:** Los tickets TGS toman significativamente más tiempo en crackearse que otros formatos de hashes (como NTLM). Si la cuenta tiene una contraseña robusta, el ataque de fuerza bruta podría fallar.

* **Falsas Esperanzas:** Obtener un ticket TGS mediante Kerberoasting no garantiza ningún acceso o compromiso. El ataque depende en su totalidad de tu capacidad para crackear el ticket offline.

* **Ticket Request vs. Ejecución:** Recuperar un ticket Kerberos para una cuenta no permite ejecutar comandos en el contexto de dicha cuenta por sí solo; debe crackearse primero o usarse para falsificar tickets de servicio (si el privilegio lo permite).