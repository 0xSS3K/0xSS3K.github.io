---
tags:
  - spraying
  - stuffing
---
## Conceptos Clave (TL;DR)

* Password spraying es un tipo de ataque de fuerza bruta en el cual se intenta utilizar una única contraseña en múltiples cuentas de usuario diferentes.

* El spraying es particularmente efectivo en entornos donde las cuentas se inicializan con una contraseña estándar o por defecto que los usuarios no han actualizado.

* Credential stuffing es otro ataque de fuerza bruta que utiliza credenciales robadas de un servicio para intentar obtener acceso a otros sistemas.

* Muchos sistemas, como routers, firewalls y bases de datos, incluyen credenciales por defecto que representan un grave riesgo de seguridad si no son modificadas durante su configuración.

  
## Herramientas Clave

* **Burp Suite:** Opción robusta para realizar ataques dirigidos a aplicaciones web.

* **[NetExec](../../../📂%2008%20Herramientas&Cheatsheets/NetExec.md) y Kerbrute:** Herramientas comúnmente utilizadas para ejecutar ataques en entornos de Active Directory.

* **Hydra:** Herramienta que permite realizar ataques de credential stuffing contra servicios específicos utilizando listas de credenciales.

* **Default Credentials Cheat Sheet:** Herramienta de automatización instalable vía pip3 para buscar credenciales por defecto de diversos productos.

  
## Metodología Paso a Paso

* **Fase 1 (Enumeración):** 
Identificar las aplicaciones, servicios y dispositivos de red específicos que se encuentran en uso dentro del entorno objetivo.

* **Fase 2 (Investigación de Defaults):** 
Consultar la documentación oficial de los productos o utilizar herramientas y listas públicas en línea para buscar las credenciales por defecto correspondientes a los servicios identificados.

* **Fase 3 (Preparación de Diccionarios):** 
Para el stuffing, combinar las credenciales obtenidas de filtraciones o investigaciones en una lista nueva, formateada estrictamente como usuario:contraseña.

* **Fase 4 (Ejecución):** 
Utilizar la herramienta adecuada según el protocolo objetivo para probar sistemáticamente el acceso, aplicando una sola contraseña a múltiples usuarios (spraying) o listas de credenciales conocidas (stuffing).

## Cheat Sheet de Comandos
```bash
# Instalación de la herramienta Default Credentials Cheat Sheet mediante pip3
pip3 install defaultcreds-cheat-sheet

  
# Búsqueda de credenciales por defecto conocidas asociadas a un producto o fabricante específico
creds search <VENDOR_OR_PRODUCT>

  
# Ejecución de un ataque de Password Spraying contra servicios SMB en un segmento de red completo
# -u: Define el archivo que contiene la lista de nombres de usuario
# -p: Define la contraseña única estática que se intentará con cada usuario
netexec smb <TARGET_NETWORK_CIDR> -u <USER_LIST_PATH> -p '<TARGET_PASSWORD>'

  
# Ejecución de un ataque de Credential Stuffing contra un servicio SSH específico
# -C: Especifica el archivo de diccionario que contiene las credenciales en formato usuario:contraseña
hydra -C <USER_PASS_LIST_PATH> ssh://<TARGET_IP>
```

## "Gotchas" y Troubleshooting

* El éxito del credential stuffing depende directamente de que los usuarios reutilicen sus nombres de usuario y contraseñas en múltiples plataformas, como correos electrónicos, redes sociales y sistemas empresariales.

* Al configurar dispositivos, algunas aplicaciones obligan a establecer una contraseña nueva durante la instalación, pero otras asignan contraseñas por defecto que suelen ser muy débiles.

* Los routers utilizados en entornos de pruebas internos suelen ser olvidados con sus configuraciones por defecto intactas, lo que permite explotarlos para obtener mayor acceso a la red.

* Las credenciales por defecto pueden variar incluso dentro del mismo dispositivo dependiendo del servicio que se esté atacando; por ejemplo, el acceso web y el acceso SSH de un mismo router pueden requerir credenciales diferentes.