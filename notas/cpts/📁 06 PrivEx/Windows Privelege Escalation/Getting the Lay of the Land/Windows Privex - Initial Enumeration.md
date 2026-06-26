---
tags:
  - windows
  - privex
  - enum
---
## Conceptos Clave (TL;DR)
- La enumeración exhaustiva es el paso más crítico para identificar vectores de escalada de privilegios en Windows.
- El objetivo es mapear el sistema operativo, servicios, configuraciones erróneas, credenciales almacenadas y permisos de usuario para pasar de un shell de bajo privilegio a SYSTEM o Administrador.
- Se debe priorizar la identificación de servicios mal configurados, falta de parches críticos, variables de entorno vulnerables (PATH) y privilegios sensibles (SeImpersonatePrivilege).

## Herramientas Clave
- tasklist: Enumerar procesos en ejecución y servicios asociados.
- set: Inspeccionar variables de entorno del sistema y del usuario.
- systeminfo: Obtener metadatos del sistema operativo, hardware y parches instalados.
- wmic / Get-HotFix: Consultar actualizaciones y software instalado.
- netstat: Identificar puertos en escucha y conexiones activas.
- whoami: Determinar el contexto de seguridad, privilegios y membresías de grupo actuales.
- net user / net localgroup: Enumerar cuentas y grupos locales.
- LaZagne: Extraer credenciales almacenadas en aplicaciones de terceros.
- Juicy Potato: Explotar privilegios de suplantación como SeImpersonatePrivilege.

## Metodología Paso a Paso
1. Reconocimiento del Sistema Operativo y Parches
   - Lógica: Identificar la versión exacta de Windows y el nivel de parches. Las versiones antiguas o sin parchear son susceptibles a exploits públicos de kernel o servicios.
2. Análisis de Procesos y Servicios
   - Lógica: Detectar aplicaciones de terceros o servicios mal configurados que corran en contexto de SYSTEM. Identificar procesos no estándar para buscar vulnerabilidades específicas.
3. Inspección de Variables de Entorno
   - Lógica: Revisar la variable PATH para detectar directorios con permisos de escritura que precedan a las rutas del sistema, lo que permitiría secuestro de binarios o DLL Hijacking. Revisar HOMEDRIVE para encontrar recursos compartidos accesibles.
4. Enumeración de Red y Puertos
   - Lógica: Identificar servicios escuchando en puertos internos que no son accesibles desde el exterior pero que pueden ser explotados localmente.
5. Análisis de Usuarios, Grupos y Privilegios
   - Lógica: Determinar qué permisos especiales tiene el usuario actual, si pertenece a grupos que otorgan privilegios administrativos, y revisar otros usuarios para detectar reutilización de credenciales o directorios personales con información sensible.

## Cheat Sheet de Comandos

```cmd
# Listar procesos en ejecución y los servicios que aloja cada uno
tasklist /svc

# Mostrar todas las variables de entorno (prestar atención a PATH y HOMEDRIVE)
set

# Obtener información detallada del SO, versión, arquitectura y parches (Hotfixes)
systeminfo

# Consultar parches instalados mediante WMI (útil si systeminfo no los muestra)
wmic qfe

# Consultar parches instalados mediante PowerShell
Get-HotFix | ft -AutoSize

# Listar todo el software instalado en el sistema mediante WMI
wmic product get name

# Listar software instalado y sus versiones mediante PowerShell
Get-WmiObject -Class Win32_Product | select Name, Version

# Mostrar conexiones activas, puertos en escucha y los PIDs asociados
netstat -ano

# Listar sesiones de usuarios actualmente conectados al sistema
query user

# Imprimir el nombre del usuario bajo el cual se ejecuta la sesión actual
echo %USERNAME%

# Enumerar los privilegios asignados al usuario actual (buscar SeImpersonatePrivilege, etc.)
whoami /priv

# Enumerar los grupos a los que pertenece el usuario actual
whoami /groups

# Listar todas las cuentas de usuario locales o de dominio en el host
net user

# Listar todos los grupos locales existentes en el host
net localgroup

# Mostrar los miembros de un grupo específico (ej. grupo de administradores)
net localgroup administrators

# Mostrar la política de contraseñas, bloqueo de cuentas y rol del equipo
net accounts
```

## "Gotchas" y Troubleshooting
- Los exploits de kernel o de versión de Windows pueden causar inestabilidad o pantallazos azules (BSOD) en sistemas en producción. Úselos con precaución y solo si comprende las ramificaciones.
- Windows busca ejecutables primero en el directorio de trabajo actual (CWD) y luego recorre la variable PATH de izquierda a derecha. Si un directorio writable por el usuario está antes de C:\Windows\System32 en el PATH, es altamente peligroso y explotable.
- Si el "System Boot Time" en systeminfo indica que el equipo no se ha reiniciado en más de seis meses, es muy probable que no esté recibiendo parches de seguridad.
- La salida de systeminfo a veces oculta los hotfixes para usuarios no administradores. En esos casos, utilice wmic qfe o Get-HotFix para forzar la consulta.
- Al enumerar usuarios, preste atención a cuentas con nombres similares (ej. <USER> y <USER>_adm). Si una cuenta estándar tiene acceso al perfil de una cuenta administrativa, puede haber credenciales o claves SSH reutilizadas.
- Si el usuario actual posee SeImpersonatePrivilege o SeAssignPrimaryTokenPrivilege, la escalada a SYSTEM suele ser trivial utilizando herramientas como Juicy Potato o PrintSpoofer.
- Revise las descripciones de los grupos locales no estándar; en ocasiones los administradores almacenan contraseñas o información sensible en el campo de comentarios del grupo.