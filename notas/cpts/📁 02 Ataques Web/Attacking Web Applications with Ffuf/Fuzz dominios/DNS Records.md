---
tags:
  - mitigation
  - webapp
---
## Conceptos Clave (TL;DR)

* Los navegadores asignan las URLs a direcciones IP revisando primero el archivo local `/etc/hosts` y posteriormente el Sistema de Nombres de Dominio (DNS) público.

* Si una URL no se encuentra en el archivo local ni en el DNS público, el navegador no sabrá cómo conectarse y fallará.

* Las redes y ejercicios locales (como HTB) no son sitios web públicos, por lo que sus dominios no tienen registros en el DNS público.

* Para conectarnos a un dominio interno o local, es mandatorio agregar su registro a nuestro archivo `/etc/hosts`.

  

## Herramientas Clave

* **/etc/hosts**: Archivo del sistema operativo utilizado para mapear direcciones IP a nombres de host de manera local, antes de realizar consultas DNS externas.

* **Navegador Web / Herramientas HTTP**: Para interactuar con el servidor web una vez que el dominio puede ser resuelto correctamente.

  

## Metodología Paso a Paso

* **Fase 1: Identificación del Dominio**

  Durante la navegación o escaneo, si nos encontramos con un dominio filtrado o un panel movido (por ejemplo, a un nuevo dominio), intentar visitarlo directamente fallará.

* **Fase 2: Configuración de Resolución Local**

  Añadir el dominio identificado junto a su dirección IP en el archivo `/etc/hosts` de nuestra máquina de ataque. Esto permite que nuestro sistema sepa exactamente a qué IP enviar el tráfico cuando solicitamos ese nombre de dominio.

* **Fase 3: Acceso y Verificación**

  Visitar el dominio a través de un navegador web para confirmar la conectividad y observar si se revela nueva información o funcionalidad.

* **Fase 4: Transición a Enumeración de Subdominios**

  Si el acceso por dominio muestra exactamente la misma información que la IP directa, y los escaneos recursivos no encontraron paneles ocultos, el siguiente paso es buscar subdominios bajo la estructura del dominio base (ej. `*.<DOMAIN>`).


## Cheat Sheet de Comandos

```bash
# Utiliza sh y echo con privilegios de sudo para concatenar (>>) una nueva línea en el archivo de hosts.

# Esta línea mapea la IP del objetivo a su nombre de dominio local sin sobreescribir configuraciones existentes.

sudo sh -c 'echo "<TARGET_IP>  <DOMAIN>" >> /etc/hosts'
```


## "Gotchas" y Troubleshooting

* Si el servicio web corre en un puerto no estándar, asegúrate de añadir el puerto en la URL al visitar la página por su dominio.

* Acceder a un servidor web apuntando directamente a su IP puede dar resultados diferentes u ocultar paneles web; si no encuentras vectores en la IP mediante escaneos recursivos completos, siempre intenta acceder por dominio o enumerar subdominios.