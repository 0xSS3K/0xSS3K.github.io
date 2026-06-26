---
tags:
  - webapp
  - webshell
---
## Conceptos Clave (TL;DR)

* ASPX (Active Server Page Extended) es un tipo de archivo escrito para el framework ASP.NET de Microsoft.
* Las páginas web ASP.NET convierten la información en HTML del lado del servidor, lo que permite utilizar una web shell ASPX para controlar el sistema operativo Windows subyacente.
* Antak es una web shell basada en ASP.Net, incluida en el proyecto Nishang, que utiliza PowerShell para interactuar con el host.
* Antak actúa como una consola de PowerShell, pero ejecuta cada comando como un proceso nuevo.

  
## Herramientas Clave

* **Antak Webshell (Nishang):** Web shell con interfaz similar a PowerShell que permite ejecución de comandos, carga/descarga de archivos, y ejecución de scripts en memoria dentro de un entorno Windows.
* **Gobuster:** Herramienta útil para realizar fuerza bruta y descubrir páginas con extensión ASPX en aplicaciones web.

  
## Metodología Paso a Paso

**1. Resolución de DNS Local**

Para interactuar correctamente con la aplicación web y el virtual hosting, añade el dominio objetivo a tu archivo de hosts local apuntando a la IP de la máquina víctima.

  

**2. Preparación de la Web Shell**

Localiza la shell Antak en tu sistema de ataque y crea una copia en tu directorio de trabajo. Esto asegura que el código base se mantenga intacto y te permite personalizar tu payload.

  

**3. Modificación y Evasión (OPSEC)**

Edita el archivo copiado. Modifica la línea 14 para establecer un usuario y contraseña fuertes, previniendo que terceros utilicen tu shell. Elimina los comentarios y el arte ASCII del código fuente, ya que estas cadenas suelen activar firmas de antivirus (AV) y alertar a los defensores.

  

**4. Carga y Ejecución**

Aprovecha la funcionalidad de subida de archivos de la aplicación vulnerable para cargar el archivo modificado en el servidor web (por ejemplo, mediante HTTP). Navega desde el navegador a la ruta donde se almacenó el archivo y autentícate con tus credenciales.

  

**5. Post-Explotación (C2 Callback)**

Utiliza la interfaz de Antak para ejecutar comandos. Emplea la función de carga (Upload) o ejecuta un one-liner de PowerShell para descargar y ejecutar un payload que te devuelva una conexión a tu plataforma de Command and Control (C2).

  
## Cheat Sheet de Comandos
```bash
# Añade la IP y el dominio al archivo hosts para resolución local

echo "<TARGET_IP> <DOMAIN>" >> /etc/hosts
```

```bash
# Copia la shell base de Nishang a tu directorio de trabajo para modificarla

cp /usr/share/nishang/Antak-WebShell/antak.aspx <LOCAL_PATH>/<FILENAME>.aspx
```

```powershell
# (Dentro de la shell Antak) Comando para listar opciones de ayuda disponibles

help
```

## "Gotchas" y Troubleshooting

* **Persistencia de variables:** Antak ejecuta cada instrucción como un proceso nuevo. Tenlo en cuenta al ejecutar scripts que requieran mantener un estado o variables entre diferentes envíos de comandos.

* **Firmas estáticas (AV):** Nunca subas la shell de Antak por defecto. Los comentarios y el arte ASCII están fuertemente marcados por firmas de seguridad. Elimínalos siempre antes de la fase de carga.

* **Navegación intuitiva:** La interfaz web de Antak cuenta con botones dedicados para "Upload the File", "Encode and Execute" y "Download". En lugar de escribir comandos complejos para transferencia de archivos, puedes interactuar directamente con la UI.

* **Comandos en blanco:** Si te bloqueas o no sabes cómo proceder una vez autenticado en la shell web, ingresa `help` en la barra de comandos para obtener una guía directa.