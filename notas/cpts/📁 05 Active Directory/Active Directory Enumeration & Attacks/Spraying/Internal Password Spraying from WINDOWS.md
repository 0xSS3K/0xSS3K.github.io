---
tags:
  - AD
  - windows
  - spraying
---
## Conceptos Clave (TL;DR)

* El password spraying permite a un atacante con acceso inicial autenticarse en el dominio y probar una única contraseña contra múltiples cuentas para escalar privilegios.
* Las herramientas automatizadas pueden consultar el Directorio Activo para generar listas de usuarios, revisar políticas de contraseñas y excluir cuentas a un intento de bloquearse.
* Si las políticas de bloqueo son muy restrictivas, un ataque descuidado o manual podría bloquear masivamente las cuentas, provocando una denegación de servicio en el entorno.

  
## Herramientas Clave

* **DomainPasswordSpray**: Herramienta en PowerShell altamente efectiva en hosts unidos al dominio que automatiza la extracción de usuarios y la exclusión de cuentas en riesgo de bloqueo.
* **Kerbrute**: Herramienta alternativa que puede ser utilizada para lograr los mismos pasos de enumeración de usuarios y spraying de contraseñas.

  
## Metodología Paso a Paso

* **Fase 1: Validación de Autenticación**: Determinar si se opera desde un host unido al dominio. Si existe autenticación válida, la herramienta automatizará la generación de la lista de usuarios. Si no se está autenticado, será necesario suministrar una lista de usuarios manualmente.

* **Fase 2: Ejecución del Ataque**: Se carga el módulo de la herramienta en la sesión de PowerShell y se suministra una única contraseña a evaluar contra el dominio.

* **Fase 3: Exportación y Movimiento Lateral**: Se guardan los resultados exitosos en un archivo de texto. Con estas credenciales válidas, se procede a la enumeración autenticada para buscar movimiento lateral y vertical en el dominio.

  
## Cheat Sheet de Comandos

Los siguientes comandos demuestran cómo importar y ejecutar la herramienta directamente desde una sesión de PowerShell:
```powershell
# Importa el modulo de DomainPasswordSpray a la sesion actual de PowerShell para habilitar sus comandos
Import-Module .\DomainPasswordSpray.ps1
```
  
```powershell
# Ejecuta el password spray omitiendo el flag de lista de usuarios (si esta unido al dominio), prueba una sola contrasena y guarda los aciertos
Invoke-DomainPasswordSpray -Password <PASSWORD> -OutFile <OUTPUT_FILE> -ErrorAction SilentlyContinue
```

  
## "Gotchas" y Troubleshooting

* Al operar desde un host unido al dominio, es imperativo omitir el flag `-UserList` para que la herramienta lea la política de contraseñas de AD y excluya proactivamente los usuarios próximos al límite de intentos fallidos.

* Si se opera desde un host Windows provisto por el cliente durante la auditoría, es posible encontrar herramientas complementarias como Kerbrute pre-cargadas en rutas comunes como `C:\Tools`.

* El ataque de password spraying tradicional mediante SMB deja rastros en los registros de seguridad de Windows mediante el Event ID 4625 (fallo de inicio de sesión). Atacantes más experimentados pueden optar por apuntar al servicio LDAP, lo cual requiere que los defensores monitoreen el Event ID 4771 (fallo de pre-autenticación Kerberos).

* Si el ataque interno no es viable, el spraying externo sigue siendo altamente efectivo contra servicios conectados a AD como portales RDS, implementaciones VDI (VMware Horizon), portales VPN (Citrix, SonicWall, Fortinet), O365 y aplicaciones web personalizadas.