---
tags:
  - filetransfer
  - encryption
---
## Conceptos Clave (TL;DR)

* Es esencial encriptar los datos altamente sensibles (como archivos NTDS.dit, listas de usuarios y datos de enumeración de red) antes de exfiltrarlos para evitar su exposición si son interceptados en tránsito.
* La primera opción siempre debe ser utilizar canales de conexión cifrados (SSH, SFTP, HTTPS). Si no están disponibles, se debe aplicar encriptación manual local al archivo antes de transferirlo.
* Nunca se debe exfiltrar Información Personal Identificable (PII), datos financieros o secretos comerciales a menos que el cliente lo exija explícitamente. Para probar controles de Data Loss Prevention (DLP) o filtros de salida, se deben generar archivos con datos falsos (dummy data) que simulen la información a proteger.
* La fuga de datos durante una evaluación tiene consecuencias severas para el pentester, su empresa y el cliente, por lo que proteger la información es una obligación profesional.

### Herramientas Clave

* **Invoke-AESEncryption.ps1**: Script de PowerShell ligero utilizado en entornos Windows para encriptar cadenas de texto plano y archivos completos a formato `.aes`.
* **OpenSSL**: Utilidad binaria frecuentemente instalada por defecto en distribuciones Linux, útil para aplicar algoritmos de cifrado fuertes a archivos locales simulando transferencias estilo "nc".

### Metodología Paso a Paso

* **Fase 1: Evaluación del Canal de Transferencia**   Antes de mover cualquier archivo, verifica si cuentas con protocolos seguros en el objetivo (ej. SSH, SFTP o HTTPS). Si existen, utilízalos como capa base. Si las opciones seguras no están disponibles, asume la necesidad de cifrar el archivo de forma local.
* **Fase 2: Encriptación Local (Windows)**   Transfiere el script `Invoke-AESEncryption.ps1` al host objetivo mediante cualquier método de transferencia estándar. Importa el script como módulo en tu sesión de PowerShell. Ejecuta la función apuntando al archivo sensible, lo que generará una copia cifrada con la extensión `.aes`.
* **Fase 3: Encriptación Local (Linux)**   Identifica el archivo a exfiltrar. Utiliza la herramienta binaria `openssl` nativa para aplicar un cifrado AES-256. Configura un número alto de iteraciones y deriva la llave para aumentar la resistencia contra ataques de fuerza bruta.

### Cheat Sheet de Comandos

```powershell
# Importar el script como modulo en la sesion actual de PowerShell
Import-Module .\Invoke-AESEncryption.ps1

  
# Encriptar un string de texto y generar una salida codificada en Base64
Invoke-AESEncryption -Mode Encrypt -Key "<PASSWORD>" -Text "<TEXT>"

  
# Desencriptar un string en Base64 para recuperar el texto plano
Invoke-AESEncryption -Mode Decrypt -Key "<PASSWORD>" -Text "<BASE64_STRING>"
 

# Encriptar un archivo local. Generara un archivo de salida llamado <FILE_PATH>.aes
Invoke-AESEncryption -Mode Encrypt -Key "<PASSWORD>" -Path <FILE_PATH>

  
# Desencriptar un archivo .aes protegido para recuperar el archivo original
Invoke-AESEncryption -Mode Decrypt -Key "<PASSWORD>" -Path <FILE_PATH>.aes
```

```bash
# Encriptar un archivo en Linux usando cifrado AES-256, 100000 iteraciones y derivacion PBKDF2
openssl enc -aes256 -iter 100000 -pbkdf2 -in <FILE_PATH> -out <FILE_PATH_ENC>

  
# Desencriptar el archivo previamente cifrado en Linux. Requiere ingresar la misma contraseña
openssl enc -d -aes256 -iter 100000 -pbkdf2 -in <FILE_PATH_ENC> -out <FILE_PATH>
```

### "Gotchas" y Troubleshooting

* **Contraseñas Únicas:** Es imperativo utilizar contraseñas extremadamente fuertes y, sobre todo, únicas para cada empresa y evaluación. Si utilizas la misma contraseña y es filtrada o crackeada por terceros, toda la información de evaluaciones anteriores quedará comprometida.
* **Interacción de OpenSSL:** Al ejecutar los comandos de encriptación y desencriptación con OpenSSL, la terminal pausará la ejecución y te pedirá ingresar (y verificar) la contraseña de forma interactiva.
* **Defensa en Profundidad:** Incluso después de haber encriptado el archivo de forma manual usando PowerShell u OpenSSL, se recomienda enfáticamente utilizar un método de transferencia seguro (HTTPS, SFTP, SSH) para exfiltrar el binario resultante.
