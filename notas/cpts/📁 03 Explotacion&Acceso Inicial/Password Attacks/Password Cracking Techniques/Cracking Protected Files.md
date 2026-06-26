---
tags:
  - cracking
  - encryption
---
## Conceptos Clave (TL;DR)

* **Tipos de Cifrado**: Se utiliza cifrado simétrico (como AES-256) para almacenar archivos locales  y cifrado asimétrico (par de llaves pública/privada) para la transmisión segura de datos.

* **Identificación de Objetivos**: La búsqueda se basa en extensiones de archivo comunes (.pdf, .docx, .xlsx, .odt)  o en firmas/cabeceras específicas (headers) en archivos que no usan extensiones estándar, como las llaves SSH.

* **Metodología de Ataque**: El proceso consiste en extraer el hash del archivo protegido mediante scripts especializados (familia *2john)  para realizar posteriormente un ataque de cracking offline por fuerza bruta o diccionario.

  
## Herramientas Clave

* **find / grep**: Utilizados para el descubrimiento de archivos sensibles y llaves privadas en el sistema de archivos.
* **ssh-keygen**: Permite validar si una llave SSH está protegida por contraseña y visualizar su contenido.
* **Scripts *2john (ssh2john, office2john, pdf2john)**: Herramientas de John the Ripper diseñadas para convertir archivos protegidos en hashes procesables.
* **John the Ripper (JtR)**: Suite de cracking para procesar los hashes extraídos y obtener las contraseñas en texto claro.

  
## Metodología Paso a Paso

1.  **Enumeración y Descubrimiento**: Localizar archivos con extensiones ofimáticas o buscar dentro de archivos sin extensión patrones que indiquen llaves criptográficas ``(ej. "-----BEGIN ... PRIVATE KEY-----").``

2.  **Validación de Cifrado**: Confirmar si el archivo requiere una contraseña. En llaves SSH, esto se verifica intentando leerla con ssh-keygen; si solicita "passphrase", está cifrada.

3.  **Extracción de Hash**: Ejecutar el script correspondiente de John the Ripper (ubicados usualmente en``/usr/bin/`` o ``/usr/share/john/``) para extraer el hash y redirigirlo a un archivo de texto.

4.  **Cracking Offline**: Utilizar JtR o Hashcat con un diccionario (como rockyou.txt) para identificar la contraseña.

## Cheat Sheet de Comandos

```bash
# Buscar archivos ofimáticos y PDFs comunes en el sistema de archivos Linux
# Filtra directorios de sistema comunes para reducir ruido

for ext in $(echo ".xls .xls* .xltx .od* .doc .doc* .pdf .pot .pot* .pp*"); do echo -e "\nExtension: " $ext; find / -name *$ext 2>/dev/null | grep -v "lib\|fonts\|share\|core" ; done
```
  
```bash
# Buscar recursivamente llaves privadas SSH mediante expresiones regulares en cabeceras

grep -rnE '^\-{5}BEGIN [A-Z0-9]+ PRIVATE KEY\-{5}$' <TARGET_DIRECTORY> 2>/dev/null
```
  
```bash
# Verificar si una llave SSH específica está cifrada (solicitará contraseña si lo está)

ssh-keygen -yf <PRIVATE_KEY_PATH>
```
  
```bash
# Localizar todos los scripts de conversión *2john disponibles en el sistema

locate *2john*
```
  
```bash
# Extraer hash de una llave privada SSH y crackearlo con John the Ripper

python3 /usr/share/john/ssh2john.py <SSH_PRIVATE_KEY> > <OUTPUT_HASH_FILE>

john --wordlist=<PATH_TO_WORDLIST> <OUTPUT_HASH_FILE>
```
  
```bash
# Extraer hash de documentos de Microsoft Office (Word, Excel, PPT) y crackearlo

office2john.py <OFFICE_FILE> > <OUTPUT_HASH_FILE>

john --wordlist=<PATH_TO_WORDLIST> <OUTPUT_HASH_FILE>
```
  
```bash
# Extraer hash de un archivo PDF y crackearlo

pdf2john.py <PDF_FILE> > <OUTPUT_HASH_FILE>

john --wordlist=<PATH_TO_WORDLIST> <OUTPUT_HASH_FILE>
```
  
```bash
# Mostrar la contraseña crackeada almacenada en la base de datos de John

john <HASH_FILE> --show
```
  

## "Gotchas" y Troubleshooting

* **Formatos SSH**: Las llaves PEM antiguas indican explícitamente "ENCRYPTED" en su cabecera , pero las llaves modernas tienen la misma apariencia visual estén cifradas o no.

* **Falsos Positivos**: El formato de cracking para SSH en John the Ripper puede generar falsos positivos; la herramienta continuará probando candidatos incluso si cree haber encontrado uno.

* **Eficacia de Diccionarios**: El éxito depende de la calidad de la lista de palabras. Si el objetivo usa contraseñas largas o aleatorias, los diccionarios estándar pueden fallar, requiriendo mutaciones de reglas o listas personalizadas.

* **Ubicación de Scripts**: Si los scripts *2john no están en el PATH, suelen encontrarse en /usr/share/john/.