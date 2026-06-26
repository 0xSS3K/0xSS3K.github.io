---
tags:
  - AD
  - enum
  - linux
  - password
---
## Conceptos Clave

* Para ejecutar enumeración autenticada, es obligatorio disponer de credenciales válidas a nivel de dominio (contraseña en texto claro, hash NTLM o acceso SYSTEM en un host unido al dominio).
* El objetivo principal es extraer **atributos de usuarios** y **equipos**, **membresía de grupos**, **Políticas de Grupo** (GPOs), **listas de control de acceso** (ACLs) y **relaciones de confianza** (trusts).
* La enumeración se enfoca típicamente contra el Controlador de Dominio, ya que aloja la base de datos central de Active Directory.
* Las herramientas interactúan mediante protocolos como SMB, MS-RPC, WMI y LDAP.

  
## Herramientas Clave

* **[NetExec](../../../📂%2008%20Herramientas&Cheatsheets/NetExec.md) (CME / NetExec):** Suite versátil para evaluar entornos AD mediante SMB, MSSQL, SSH o WinRM. Permite enumerar usuarios, grupos, sesiones de logueo, shares y extraer archivos recursivamente.

* **SMBMap:** Herramienta para enumerar recursos compartidos (shares) SMB, determinar permisos de acceso y navegar recursivamente por directorios desde Linux.

* **rpcclient:** Herramienta para interactuar con MS-RPC sobre Samba, permitiendo consultas profundas a objetos de AD (usuarios por RID) mediante sesiones autenticadas o sesiones nulas (NULL sessions).

* **Impacket (psexec.py / wmiexec.py):** Scripts de Python para la interacción y explotación de protocolos Windows. Útiles para ejecución de comandos y obtención de shells interactivas o semi-interactivas.

* **Windapsearch:** Script de Python basado en consultas LDAP para enumerar usuarios, grupos, equipos y cazar usuarios altamente privilegiados ocultos por anidamiento de grupos.

* **BloodHound.py & [BloodHound](../../../📂%2008%20Herramientas&Cheatsheets/BloodHound.md) GUI:** Ingestor de Python y aplicación gráfica para recolectar, visualizar y analizar caminos de ataque (Attack Paths) usando teoría de grafos y consultas Cypher.

  
## Metodología Paso a Paso

1. **Enumeración General:** Validar el acceso con CrackMapExec o SMBMap apuntando al Controlador de Dominio. Identificar qué acceso de lectura existe en recursos no estándar (como carpetas de departamentos o archivos).

2. **Descubrimiento de Usuarios y Grupos:** Volcar la lista completa de usuarios del dominio y los grupos críticos (Domain Admins, Administrators, IT). Rastrear el atributo de bloqueo de cuenta (badPwdCount) antes de realizar fuerza bruta.

3. **Cacería de Sesiones y Archivos Sensibles (Pillaging):** Buscar qué usuarios tienen sesiones iniciadas en servidores de archivos o de salto. Si hay administradores logueados y tenemos acceso local admin, podemos comprometer sus credenciales en memoria. Al mismo tiempo, usar spidering para extraer archivos interesantes (ej. web.config o scripts).

4. **Mapeo de Privilegios y Anidamientos LDAP:** Consultar el servicio LDAP con Windapsearch para listar miembros de Enterprise y Domain Admins, exponiendo permisos ocultos derivados de membresía en grupos anidados.

5. **Mapeo de Grafo y Ejecución:** Ingestar todo el dominio vía BloodHound.py, importar a la interfaz gráfica y analizar la ruta más corta hacia "Domain Admin". Utilizar técnicas de Impacket (psexec o wmiexec) sobre máquinas donde se tenga permiso de Administrador Local para avanzar.

  
## Cheat Sheet de Comandos

### CrackMapExec (SMB)
```bash
# Enumerar usuarios del dominio apuntando al DC
sudo crackmapexec smb <DC_IP> -u <USER> -p <PASSWORD> --users


# Enumerar grupos del dominio y cantidad de miembros
sudo crackmapexec smb <DC_IP> -u <USER> -p <PASSWORD> --groups
 

# Encontrar usuarios logueados (útil en file servers o jump hosts)
sudo crackmapexec smb <TARGET_IP> -u <USER> -p <PASSWORD> --loggedon-users
  

# Enumerar recursos compartidos (shares) y permisos
sudo crackmapexec smb <DC_IP> -u <USER> -p <PASSWORD> --shares
 

# Hacer spidering buscando archivos legibles en un share específico (los resultados se guardan en /tmp/cme_spider_plus/)
sudo crackmapexec smb <DC_IP> -u <USER> -p <PASSWORD> -M spider_plus --share '<SHARE_NAME>'
```

  
### SMBMap
```bash
# Verificar recursos compartidos y niveles de permiso sobre una IP
smbmap -u <USER> -p <PASSWORD> -d <DOMAIN> -H <TARGET_IP>
 

# Listar directorios de manera recursiva en un share específico (solo directorios, no archivos)
smbmap -u <USER> -p <PASSWORD> -d <DOMAIN> -H <TARGET_IP> -R '<SHARE_NAME>' --dir-only
```

  
### rpcclient
```bash
# Conexión sin autenticación (SMB NULL Session, si está habilitado)
rpcclient -U "" -N <DC_IP>
  

# Consultar información de un usuario específico usando su RID en formato Hex (se ejecuta en el prompt de rpcclient)
queryuser <RID_HEX>
  

# Enumerar todos los usuarios del dominio y sus respectivos RIDs (se ejecuta en el prompt de rpcclient)
enumdomusers
```

  
### Impacket (Ejecución de Comandos)
```bash
# Ejecutar Psexec (requiere privilegios de Admin Local). Retorna shell SYSTEM.
psexec.py <DOMAIN>/<USER>:'<PASSWORD>'@<TARGET_IP>
  

# Ejecutar Wmiexec (requiere privilegios de Admin Local). Retorna shell interactiva silenciosa bajo el contexto del usuario.
wmiexec.py <DOMAIN>/<USER>:'<PASSWORD>'@<TARGET_IP>
```

  
### Windapsearch (LDAP)
```bash
# Enumerar los miembros del grupo Domain Admins
python3 windapsearch.py --dc-ip <DC_IP> -u <USER>@<DOMAIN> -p <PASSWORD> --da
  

# Enumerar usuarios privilegiados verificando membresía de grupos anidados recursivamente
python3 windapsearch.py --dc-ip <DC_IP> -u <USER>@<DOMAIN> -p <PASSWORD> -PU
```

  
### BloodHound.py (Ingesta de datos)
```bash
# Recolectar toda la información del AD, resolviendo contra la IP del DC
sudo bloodhound-python -u '<USER>' -p '<PASSWORD>' -ns <DC_IP> -d <DOMAIN> -c all
  

# Iniciar base de datos Neo4j en el entorno de ataque (previo a abrir GUI)
sudo neo4j start
  

# Comprimir los archivos JSON generados para cargarlos rápidamente en la GUI
zip -r ilfreight_bh.zip *.json
```

  
## "Gotchas" y Troubleshooting

* **Indicador de Admin Local:** Al ejecutar CrackMapExec (CME), si aparece el tag `(Pwn3d!)` al lado de las credenciales, significa que el usuario cuenta con permisos de Administrador Local sobre esa máquina objetivo específica.

* **Impacket `psexec.py`:** Genera mucho ruido. Sube un ejecutable con nombre aleatorio al recurso `ADMIN$`, lo registra en el Service Control Manager vía RPC y se comunica por una tubería con nombre (named pipe) para brindar una shell como `SYSTEM`.

* **Impacket `wmiexec.py`:** Es más sigiloso que `psexec` ya que no deposita archivos en disco. Ejecuta el proceso bajo el contexto del usuario en lugar de SYSTEM. Sin embargo, cada comando ejecutado levanta un nuevo proceso `cmd.exe` detectable en los registros de Windows como el Event ID 4688.

* **Atributo `badPwdCount`:** La salida de CME `--users` revela este atributo. Utilizar esta información para filtrar listas de usuarios al hacer password spraying y evitar bloquear cuentas accidentalmente.

* **RIDs Estáticos:** Existen RIDs universales. El Administrador de dominio incorporado (built-in) siempre tendrá el RID `500` (hex `0x1f4`), independientemente del host.

* **Herramientas de Referencia:** El texto recomienda el proyecto `WADComs` como una excelente cheat sheet interactiva para recordar la sintaxis de las herramientas cubiertas.