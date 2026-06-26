---
tags:
  - hashcat
  - cracking
---
## Conceptos Clave (TL;DR)

* Para vulnerar archivos protegidos con contraseña, la técnica estándar consiste en extraer los hashes de las contraseñas del archivo original para realizar ataques de fuerza bruta o diccionario de forma offline.
* Archivos como ZIP y discos virtuales de BitLocker (VHD) tienen utilidades específicas para la extracción de sus hashes.
* Algunos formatos (como GZIP) no soportan cifrado nativo y suelen ser cifrados mediante herramientas de terceros como OpenSSL o GPG, lo que requiere un enfoque de fuerza bruta directa mediante scripts automatizados en lugar de extracción de hashes.

  
## Herramientas Clave

* **zip2john**: Extracción de hashes desde archivos ZIP.
* **john (John The Ripper)**: Utilidad para el crackeo offline de hashes.
* **file**: Análisis de firmas para descubrir el formato real de un archivo aparentemente comprimido.
* **openssl**: Utilidad criptográfica empleada para descifrar contenedores no nativos (ej. GZIP) mediante automatización.
* **bitlocker2john**: Script de extracción de hashes desde imágenes VHD protegidas con BitLocker.
* **[Hashcat](../../../📂%2008%20Herramientas&Cheatsheets/Hashcat.md)**: Utilidad de crackeo acelerado por GPU (modo 22100 para BitLocker).
* **dislocker / losetup**: Utilidades de Linux para montar y descifrar volúmenes BitLocker.

  

## Metodología Paso a Paso

1. **Identificación y Verificación**: Antes de intentar cualquier ataque, confirma la naturaleza del archivo. Extensiones engañosas pueden ocultar datos cifrados con OpenSSL en lugar de un archivo comprimido estándar.

2. **Extracción del Hash**: Usa la variante adecuada de "2john" (zip2john, bitlocker2john) para aislar el hash del archivo contenedor y guardarlo en un archivo de texto independiente.

3. **Crackeo Offline**: Pasa el hash extraído por John The Ripper o Hashcat utilizando un diccionario robusto para recuperar el texto plano.

4. **Descifrado y Montaje**: Utiliza la contraseña recuperada para extraer el contenido (para ZIP) o montar la imagen de disco en el sistema de archivos local para explorar su contenido (para BitLocker).

  

## Cheat Sheet de Comandos

### Archivos ZIP
```bash
# Extraer el hash del archivo ZIP y guardarlo en formato compatible con JtR
zip2john <TARGET_ZIP_FILE> > <OUTPUT_HASH_FILE>

  
# Ejecutar John The Ripper con una wordlist específica contra el hash extraído
john --wordlist=<WORDLIST_PATH> <OUTPUT_HASH_FILE>

  
# Mostrar las contraseñas crackeadas almacenadas en la sesión de John
john <OUTPUT_HASH_FILE> --show
```
  
### Archivos GZIP Cifrados con OpenSSL
```bash
# Verificar el formato real del archivo (útil si sospechas de OpenSSL)
file <TARGET_GZIP_FILE>

  
# Bucle for para fuerza bruta directa sobre OpenSSL.
# Intenta descifrar y extraer (tar xz) usando cada palabra de la wordlist.
for i in $(cat <WORDLIST_PATH>);do openssl enc -aes-256-cbc -d -in <TARGET_GZIP_FILE> -k $i 2>/dev/null| tar xz;done
```

### Discos BitLocker (VHD) - Extracción y Crackeo
```bash
# Extraer todos los hashes del volumen BitLocker a un archivo
bitlocker2john -i <TARGET_VHD_FILE> > <OUTPUT_HASHES_FILE>
  

# Aislar únicamente el hash correspondiente a la contraseña del usuario ($bitlocker$0)
grep "bitlocker\$0" <OUTPUT_HASHES_FILE> > <OUTPUT_CLEAN_HASH_FILE>
  

# Crackear el hash con Hashcat (Modo 22100 = BitLocker).
# IMPORTANTE: El hash debe ir entre comillas simples para evitar expansión de variables en bash.
hashcat -a 0 -m 22100 '<TARGET_HASH_STRING>' <WORDLIST_PATH>
```

### Discos BitLocker (VHD) - Montaje en Linux
```bash
# Instalar utilidad necesaria en caso de no tenerla
sudo apt-get install dislocker
  

# Crear directorios para descifrado temporal y punto de montaje final
sudo mkdir -p /media/bitlocker
sudo mkdir -p /media/bitlockermount
  

# Configurar el archivo VHD como dispositivo loopback
sudo losetup -f -P <TARGET_VHD_FILE>
 

# Descifrar el volumen (reemplazar <DEV_LOOP> con el dispositivo creado, ej. /dev/loop0p2)
# El flag -u pasa la contraseña crackeada inmediatamente sin espacio
sudo dislocker <DEV_LOOP> -u<CRACKED_PASSWORD> -- /media/bitlocker
  

# Montar el archivo descifrado como dispositivo loop en la carpeta destino
sudo mount -o loop /media/bitlocker/dislocker-file /media/bitlockermount
  

# Desmontaje y limpieza una vez terminado el análisis
sudo umount /media/bitlockermount
sudo umount /media/bitlocker
```

## "Gotchas" y Troubleshooting

* **Falsos Positivos en GZIP:** El bucle de `openssl` generará múltiples errores por consola indicando `gzip: stdin: not in gzip format` y errores de `tar`. Estos mensajes son esperados para contraseñas incorrectas; ignóralos y verifica con `ls` si se extrajo un nuevo archivo en el directorio actual.

* **Hashes de BitLocker:** La herramienta `bitlocker2john` arrojará cuatro hashes distintos. Los dos últimos son la clave de recuperación (recovery key), la cual es inmensamente larga y generada aleatoriamente, volviendo inviable su crackeo. Siempre filtra y enfócate en el hash `$bitlocker$0$...` correspondiente a la contraseña.

* **Comillas en Hashcat:** Es crítico encerrar el hash extraído de BitLocker entre comillas simples (`' '`) al pasarlo por línea de comandos a Hashcat. De lo contrario, la shell interpretará los símbolos `$` como variables de entorno y corromperá el input.

* **Identificación del Dispositivo Loop:** Tras ejecutar `losetup -f -P`, es posible que necesites ejecutar `losetup -a` o `lsblk` para identificar el nodo exacto (ej. `/dev/loop0p2`) que debes pasar a `dislocker`.