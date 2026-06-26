---
tags:
  - webapp
  - webshell
---
## Conceptos Clave (TL;DR)

* Laudanum es un repositorio con archivos listos para inyectar en víctimas, permitiendo ejecución de comandos desde el navegador o el establecimiento de reverse shells.
* Soporta múltiples lenguajes de aplicaciones web, incluyendo ASP, ASPX, JSP y PHP.
* Está integrado por defecto en distribuciones orientadas al pentesting como Kali Linux y Parrot OS.
* Los payloads suelen requerir modificación previa para autorizar la IP del atacante antes de su despliegue.

  
## Herramientas Clave

* **Laudanum**: Colección de scripts y webshells ubicada en `/usr/share/laudanum`.

  
## Metodología Paso a Paso
### 1. Preparación de Resolución DNS

Si el objetivo utiliza enrutamiento basado en nombres de host virtuales (VHosts), es necesario apuntar la IP del objetivo al dominio correspondiente en el archivo hosts local de la máquina atacante.

### 2. Selección y Copia del Payload

Ubicar el directorio de Laudanum y copiar la webshell correspondiente al lenguaje de la aplicación objetivo hacia un directorio de trabajo local para evitar modificar el archivo original.


### 3. Modificación del Payload y Evasión (OPSEC)

Editar el archivo copiado para insertar la IP de la máquina atacante en la lista de IPs permitidas (ej. la variable `allowedIps`). Como medida de evasión básica, se deben eliminar los comentarios y el arte ASCII presentes en el código fuente, ya que los defensores y soluciones Antivirus suelen crear firmas basadas en estos elementos para detectar la amenaza.
  

### 4. Explotación vía Upload de Archivos

Aprovechar funcionalidades de subida de archivos inseguras en la aplicación web para cargar la webshell modificada. Es imperativo anotar la ruta o el mensaje de éxito que devuelve la aplicación para saber exactamente dónde se guardó el archivo.
  

### 5. Navegación y Ejecución

Acceder a la ruta pública donde se alojó la webshell a través del navegador web. Una vez en la interfaz de la webshell, se pueden introducir comandos del sistema operativo subyacente para enumeración inicial o escalada de privilegios.

  
## Cheat Sheet de Comandos
```bash
# Agregar el dominio del objetivo al archivo hosts local para resolución DNS

echo "<TARGET_IP> <DOMAIN>" >> /etc/hosts
```

```bash
# Copiar una webshell específica (ej. aspx) de Laudanum al directorio de trabajo local

cp /usr/share/laudanum/<LANGUAGE_EXTENSION>/<SHELL_FILE> <LOCAL_DESTINATION_FILE>
```

```powershell
# Comando de ejemplo para ejecutar a través de la interfaz de la webshell subida (Windows)

systeminfo
```

## "Gotchas" y Troubleshooting

* **Modificación Obligatoria**: Muchos scripts de Laudanum, especialmente las webshells, no funcionarán ni permitirán acceso si no insertas tu `<ATTACKER_IP>` en las variables de configuración de red correspondientes dentro del código.

* **Evasión de Firmas**: Si la subida del archivo es bloqueada por el servidor, asegúrate de haber eliminado comentarios y arte ASCII del payload; son vectores comunes de detección por firmas de Antivirus.

* **Manejo de Rutas Alteradas**: Las aplicaciones pueden devolver rutas de guardado utilizando sintaxis no estándar (como `\\` o `\` en lugar de `/`). Al navegar, introduce la ruta utilizando la sintaxis devuelta, el navegador limpiará y normalizará la URL automáticamente (ej. convirtiendo `\` a `/`).

* **Mecanismos de Defensa en el Upload**: No asumas que siempre se mantendrá el nombre del archivo original o que se guardará en un directorio accesible públicamente. Algunos servidores implementan renombramiento aleatorio u otros controles que requerirán técnicas adicionales de enumeración para localizar el payload una vez subido.