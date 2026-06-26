---
tags:
  - webapp
  - ldap
  - attack
---
## Conceptos Clave (TL;DR)

* LDAP (Lightweight Directory Access Protocol) es un protocolo cliente-servidor usado para acceder y gestionar información en servicios de directorio jerárquicos (usuarios, computadoras, grupos).
* Opera típicamente sobre el puerto 389 (texto claro) o 636 (LDAPS/SSL cifrado) utilizando mensajes codificados en ASN.1 sobre TCP/IP.
* La Inyección LDAP ocurre cuando una aplicación web no sanitiza la entrada del usuario antes de pasarla a una consulta LDAP en el backend (similar a SQLi), permitiendo a un atacante alterar la lógica de la consulta.
* El ataque más común es inyectar un comodín (`*`) o caracteres lógicos (`()`, `&`, `|`) para forzar que una condición de autenticación devuelva verdadero, logrando un bypass.

## Herramientas Clave

* **nmap**: Escaneo de red para identificar puertos expuestos y deducir servicios en ejecución (como servidores HTTP o LDAP).
* **ldapsearch**: Utilidad de línea de comandos para consultar, autenticarse (bind) y recuperar datos desde un servicio de directorio LDAP.

## Metodología Paso a Paso

1. **Enumeración de Superficie**: Identificar puertos expuestos en el objetivo mediante un escaneo completo. La presencia simultánea de un puerto HTTP (80/443) y un puerto LDAP (389/636) sugiere que la web podría usar LDAP para el inicio de sesión.
2. **Interacción y Consulta (Opcional)**: Si se dispone de credenciales válidas u operaciones anónimas permitidas, conectar directamente al servicio LDAP para extraer la estructura del directorio, nombres distinguidos (DN) y atributos de usuario.
3. **Fuzzing e Identificación de Inyección**: En los formularios web de la aplicación (ej. login), introducir caracteres especiales propios de consultas LDAP (`*`, `(`, `)`, `&`, `|`) para evaluar si la aplicación arroja errores o altera su comportamiento.
4. **Explotación y Auth Bypass**: Inyectar cargas útiles de derivación, como enviar un asterisco (`*`) en los campos de usuario o contraseña. Si el backend usa el input de forma cruda, la consulta coincidirá con cualquier usuario existente o contraseña, permitiendo el acceso no autorizado al sistema.

## Cheat Sheet de Comandos

```bash
# Escaneo de todos los puertos TCP, con scripts por defecto y detección de versión

nmap -p- -sC -sV --open --min-rate=1000 <TARGET_IP>
```

```bash
# Conectar al servicio LDAP y realizar una búsqueda con credenciales conocidas
# -H: Especifica la URI del servidor LDAP
# -D: Bind DN (Nombre distinguido del usuario para autenticarse)
# -w: Contraseña del Bind DN
# -b: Base DN (El punto de partida de la búsqueda en el árbol del directorio)
# "(<FILTER>)": El filtro de búsqueda para encontrar entradas específicas

ldapsearch -H ldap://<TARGET_IP>:389 -D "<USER_DN>" -w <PASSWORD> -b "<BASE_DN>" "(<FILTER>)"
```

```bash
# Ejemplo práctico (Modificar según la enumeración):
# Búsqueda de un usuario por correo electrónico en un dominio específico

ldapsearch -H ldap://<TARGET_IP>:389 -D "cn=admin,dc=<DOMAIN>,dc=com" -w <PASSWORD> -b "ou=people,dc=<DOMAIN>,dc=com" "(mail=<USER>@<DOMAIN>.com)"
```

```http
# Payload típico para LDAP Injection (Auth Bypass) en formularios web
# Se inyecta en el campo 'username' o 'password' capturado vía Burp Suite

username=*&password=*

# o

username=<KNOWN_USER>&password=*
```

## "Gotchas" y Troubleshooting

* **Diferencia Crítica**: No confundir LDAP con Active Directory (AD). AD es el servicio de directorio (propiedad de Microsoft, basado en Windows) mientras que LDAP es el protocolo para consultarlo y modificarlo.

* **Tráfico en Texto Claro**: Por defecto, LDAP no cifra su tráfico. Las operaciones de "Bind" enviarán las contraseñas en texto claro a menos que se fuerce el uso de LDAPS o StartTLS.

* **Lógica del Comodín (`*`)**: El asterisco actúa capturando cualquier número de caracteres. Si un backend procesa `(&(objectClass=user)(sAMAccountName=$username)(userPassword=$password))` e inyectas `*` en `$username`, estás instruyendo al backend a validar la contraseña contra *cualquier* usuario que tenga ese valor.

* **Impacto**: Una inyección LDAP exitosa puede ir desde la elevación de privilegios hasta el control total de la aplicación dependiente del directorio o la alteración y borrado de los datos almacenados en el mismo.