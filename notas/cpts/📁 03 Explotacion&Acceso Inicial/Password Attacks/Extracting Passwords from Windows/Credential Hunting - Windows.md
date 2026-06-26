---
tags:
  - windows
  - hunting
---
## Conceptos Clave (TL;DR)

* Búsqueda detallada en el sistema de archivos y aplicaciones para descubrir credenciales almacenadas de forma insegura.

* Los administradores de TI frecuentemente documentan contraseñas en archivos de texto, scripts o utilizan aplicaciones con almacenamiento vulnerable.

* El proceso no debe ser aleatorio; debe basarse en la función del sistema comprometido (Servidor vs. Escritorio) para identificar qué herramientas y datos podrían estar presentes.

  
## Herramientas Clave

* **Windows Search:** Búsqueda nativa desde la interfaz gráfica (GUI) para localizar archivos de configuración o notas utilizando palabras clave.

* **LaZagne:** Herramienta de terceros enfocada en extraer contraseñas de navegadores, clientes de correo, chats, memoria y herramientas de administración (ej. WinSCP, OpenVPN).

* **findstr:** Utilidad de línea de comandos en Windows para buscar patrones de texto o palabras clave dentro de múltiples tipos de archivos de forma masiva.

* **firefox_decrypt / decrypt-chrome-passwords:** Herramientas externas útiles para descifrar bases de datos de credenciales locales obtenidas de navegadores web.

  
## Metodología Paso a Paso

* **Fase 1: Análisis del Contexto del Objetivo**
  Identificar el propósito de la máquina (ej. estación de un administrador de TI) para inferir qué tareas realiza diariamente y deducir en qué lugares podría haber guardado credenciales.

* **Fase 2: Búsqueda Manual de Archivos**
  Buscar términos clave en el sistema de archivos utilizando la GUI o CLI. Palabras clave recomendadas: password, creds, configuration, dbcredential, pwd, keys. Explorar ubicaciones críticas como SYSVOL, recursos compartidos y descripciones de AD.

* **Fase 3: Ejecución de Herramientas de Extracción**
  Transferir un binario independiente al objetivo mediante RDP. Ejecutar la herramienta para volcar de manera automatizada las contraseñas almacenadas en aplicaciones locales, memoria y navegadores.

## Cheat Sheet de Comandos

```cmd
# Buscar de forma recursiva palabras clave en tipos de archivos comunes que suelen contener configuraciones o credenciales.

# /S: Subdirectorios, /I: Ignorar mayúsculas/minúsculas, /M: Mostrar solo nombre de archivo, /C: Cadena de texto.

findstr /SIM /C:"<KEYWORD>" *.txt *.ini *.cfg *.config *.xml *.git *.ps1 *.yml
```

```cmd
# Ejecutar LaZagne para que corra todos los módulos disponibles y extraiga credenciales de software soportado (ej. navegadores, WinSCP).

start LaZagne.exe all
```

```cmd
# Ejecutar LaZagne con el flag de verbosidad para observar en segundo plano los intentos de recolección de contraseñas.

start LaZagne.exe all -vv
```

## "Gotchas" y Troubleshooting

* **Transferencia de archivos:** Si tienes acceso vía RDP usando `xfreerdp`, puedes transferir herramientas (como LaZagne.exe) simplemente usando la función de copiar y pegar desde tu máquina atacante a la sesión RDP.

* **Cifrado de Navegadores:** Navegadores populares (Chrome, Edge, Firefox) cifran las credenciales. Si LaZagne falla, es posible que necesites extraer las bases de datos manualmente y descifrarlas offline usando herramientas como `firefox_decrypt`.

* **Bases de datos KeePass:** Si encuentras archivos de KeePass, el acceso no es directo; requerirás adivinar o crackear la contraseña maestra para acceder a las credenciales internas.

* **Ubicaciones Frecuentes a revisar:**

  * Contraseñas en Políticas de Grupo (GPO) o scripts en el recurso compartido SYSVOL.

  * Archivos `web.config` en máquinas de desarrollo o recursos compartidos de TI.

  * Archivo `unattend.xml`.

  * Campos de descripción de usuarios o computadoras en Active Directory (AD).

  * Archivos ofimáticos con nombres obvios (ej. `pass.txt`, `passwords.xlsx`) en sistemas de usuarios y SharePoint.