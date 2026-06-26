---
tags:
  - webapp
  - fuzzing
---
## Conceptos Clave (TL;DR)

* Es una técnica activa de descubrimiento que utiliza listas predefinidas para identificar subdominios válidos probándolos sistemáticamente contra el dominio objetivo.
* Incrementa significativamente la eficiencia del descubrimiento al usar diccionarios específicos, los cuales pueden ser Generales, Enfocados o Personalizados.
* El proceso metodológico consta de cuatro fases secuenciales: Selección de wordlist, Iteración y consulta, Búsqueda DNS (registros A/AAAA) y Filtrado/Validación.  

## Herramientas Clave

* **dnsenum**: Kit de herramientas completo (escrito en Perl) para reconocimiento DNS. Soporta fuerza bruta, enumeración de registros, intentos de transferencia de zona, scraping de Google y búsquedas inversas.
* **fierce**: Herramienta enfocada en el descubrimiento recursivo y que cuenta con detección de wildcards.
* **dnsrecon**: Combina múltiples técnicas de reconocimiento DNS y ofrece formatos de salida personalizables.
* **amass**: Orientada al descubrimiento de subdominios, destaca por su integración con otras herramientas y el uso de fuentes de datos extensas.
* **assetfinder**: Ideal para escaneos rápidos y ligeros.
* **puredns**: Opción flexible y potente para fuerza bruta, capaz de resolver y filtrar resultados de forma efectiva.


## Metodología Paso a Paso

  
### 1. Selección de Wordlist

Se debe elegir un diccionario basándose en el nivel de conocimiento sobre el objetivo. Un enfoque generalizado es útil cuando se desconocen las convenciones de nomenclatura, mientras que un diccionario enfocado/personalizado reduce los falsos positivos.


### 2. Iteración y Consulta

Un script o herramienta (como dnsenum) automatiza la creación de los posibles subdominios concatenando cada entrada del wordlist con el dominio principal.
  

### 3. DNS Lookup

Se lanzan consultas DNS para cada subdominio generado con el objetivo de verificar si resuelve a una dirección IP, apuntando generalmente a registros de tipo A o AAAA.
  

### 4. Filtrado y Validación

Se extraen y almacenan únicamente las resoluciones exitosas. Posteriormente, se procede a validar la existencia real y funcionalidad de los activos (ej. comprobando acceso web).
  
## Cheat Sheet de Comandos
```bash
# Ejecuta una enumeracion completa con fuerza bruta por diccionario sobre el dominio objetivo.

# --enum: Especifica el dominio objetivo y activa un atajo de configuraciones de tuning.

# -f <WORDLIST>: Indica la ruta del diccionario a utilizar.

# -r: Activa la fuerza bruta de manera recursiva (enumera subdominios dentro de los subdominios descubiertos).

dnsenum --enum <DOMAIN> -f <WORDLIST_PATH> -r
```

  
## "Gotchas" y Troubleshooting

* **Zone Transfers (Transferencia de Zona):** Por defecto, dnsenum intentará realizar una transferencia de zona. Aunque casi siempre está bloqueado por configuraciones de seguridad, un intento exitoso volcará toda la configuración DNS del objetivo de forma pasiva.

* **Rutas de SecLists:** El path predeterminado en entornos como Kali o Parrot suele ser `/usr/share/seclists/...`, pero asegúrate de ajustar el placeholder `<WORDLIST_PATH>` si tu instalación de SecLists reside en otro directorio.

* **Subdominios Ocultos:** Si la resolución directa falla, dnsenum también puede aprovechar el scraping de Google para identificar subdominios expuestos que no figuran directamente en los registros DNS estándar.