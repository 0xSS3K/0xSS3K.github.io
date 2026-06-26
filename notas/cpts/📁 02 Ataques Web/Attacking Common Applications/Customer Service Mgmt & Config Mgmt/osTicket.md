---
tags:
  - webapp
  - osticket
  - enum
  - attack
---
## Conceptos Clave (TL;DR)
* osTicket es un sistema de tickets de soporte de código abierto escrito en PHP con backend MySQL, útil como vector de entrada inicial o pivote.
* Estos portales a menudo permiten la creación de correos electrónicos internos temporales asignados a tickets, los cuales pueden utilizarse para evadir restricciones de registro en otros servicios de la empresa.
* Las bases de datos de tickets son minas de oro para la exposición de datos sensibles, conteniendo frecuentemente contraseñas en texto claro dentro de tickets de soporte cerrados o restablecimientos de contraseñas.
* A nivel de vulnerabilidades web, versiones específicas (ej. 1.14.1) sufren de SSRF (CVE-2020-24881), lo que permite escaneo de puertos internos o acceso a recursos internos.

## Herramientas Clave
* **EyeWitness:** Útil para la captura de pantallas y el descubrimiento de aplicaciones web, revelando cabeceras, footers o cookies clave de osTicket.
* **Nmap:** De utilidad limitada para el footprinting directo de la aplicación, ya que solo revelará el servidor web subyacente (Apache, IIS).
* **Dehashed:** Utilizado durante la fase de OSINT para descubrir credenciales filtradas asociadas al dominio objetivo.
* **linkedin2username:** Mencionado como herramienta complementaria para generar listas de usuarios de la empresa y ejecutar ataques de password spraying.

## Metodología Paso a Paso

### 1. Descubrimiento y Enumeración
El objetivo es identificar la presencia del sistema de tickets. Esto se logra buscando la cookie de sesión `OSTSESSID` en las respuestas HTTP o identificando el texto "powered by osTicket" en el pie de página del portal web.

### 2. Abuso de Funcionalidad y Obtención de Correos
Si el portal permite a usuarios externos crear tickets, abre un ticket técnico ("play dumb"). El sistema a menudo asignará un número de ticket que se traduce en una dirección de correo válida (ej. `<ID>@<DOMAIN>`). Utiliza este correo para intentar registrarte en otros portales expuestos (Slack, GitLab, Wikis) que requieran una dirección corporativa.

### 3. Explotación de Vulnerabilidades Conocidas
Busca la versión exacta del sistema de tickets y cruza la información con bases de datos de exploits. Identifica si es vulnerable a SSRF, Local/Remote File Inclusion, SQLi o XSS.

### 4. Compromiso de Cuentas y Exposición de Datos
Utiliza credenciales descubiertas en volcados de datos (OSINT) para intentar acceder al panel de agente o administrador. Una vez dentro, revisa tickets cerrados en busca de restablecimientos de contraseñas u otros datos sensibles compartidos por error humano. Finalmente, exporta la libreta de direcciones para obtener correos y usuarios válidos para ataques de password spraying.

## Cheat Sheet de Comandos

```bash
# Búsqueda de credenciales filtradas asociadas a un dominio específico usando Dehashed
sudo python3 dehashed.py -q <DOMAIN> -p
```

```bash
# Lectura rápida de subdominios enumerados para identificar portales de soporte o VPNs
cat <SUBDOMAINS_FILE>
```

## "Gotchas" y Troubleshooting
* **Nmap no es suficiente:** Un escaneo de Nmap no te ayudará a perfilar osTicket, solo te dará información del servidor web. Requiere inspección manual o herramientas como EyeWitness.
* **Formatos de Login:** El portal de inicio de sesión de osTicket a menudo acepta tanto nombres de usuario como direcciones de correo electrónico. Si un nombre de usuario falla (ej. `jclayton`), siempre prueba con el correo electrónico completo (ej. `<USER>@<DOMAIN>`) antes de descartar las credenciales.
* **Restricciones de Panel:** Solo el personal (staff) y los usuarios con privilegios de administrador pueden acceder al panel de administración de osTicket.
* **Contraseñas por Defecto:** Es común que los agentes de soporte utilicen una contraseña estándar para los nuevos empleados o para restablecer cuentas. Si encuentras una en un ticket, pruébala contra otros portales (como VPNs) para otros usuarios.