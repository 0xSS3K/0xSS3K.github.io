---
tags:
  - cracking
  - hashcat
---
## Conceptos Clave (TL;DR)

* Hashcat es una herramienta de código abierto especializada en el craqueo de contraseñas, destacada por su excelente soporte para aceleración por GPU.
* Su funcionamiento principal se basa en múltiples modos de ataque, siendo los más comunes el ataque de diccionario y el de máscara.
* La sintaxis base exige definir explícitamente el modo de ataque mediante la bandera `-a` y el tipo de hash objetivo con `-m`.

### Herramientas Clave

* [**Hashcat**](../../../%F0%9F%93%81%2003_Explotacion_y_Acceso_Inicial/Password%20Attacks/Password%20Cracking%20Techniques/Hashcat.md): El motor principal de craqueo utilizado para realizar ataques de diccionario, aplicar reglas de mutación y ejecutar ataques de máscara sobre hashes capturados.
* **HashID**: Herramienta auxiliar empleada para analizar una cadena hash desconocida y determinar rápidamente su tipo, proporcionando directamente el identificador numérico necesario para Hashcat.

### Metodología Paso a Paso

1. **Identificación del Hash**: Es imposible iniciar el craqueo sin conocer el tipo de hash. Esta fase implica analizar el hash obtenido (ej. de una base de datos) utilizando herramientas como HashID o consultando la lista de ejemplos de la web de Hashcat para obtener el ID del modo (`-m`).
2. **Ataque de Diccionario (Fase Inicial)**: Se somete el hash a un ataque directo utilizando una lista de palabras común. Hashcat probará cada entrada del diccionario secuencialmente hasta encontrar coincidencias o agotar la lista.
3. **Aplicación de Reglas (Fase de Mutación)**: Si el diccionario base falla, se introducen archivos de reglas. Estas reglas aplican transformaciones comunes (como añadir números, sustitución "leet speak", etc.) a las palabras del diccionario para ampliar el espacio de búsqueda.
4. **Ataque de Máscara (Fase de Fuerza Bruta Dirigida)**: Cuando se tiene conocimiento previo sobre la estructura de la contraseña (por ejemplo, longitud fija o patrones específicos), se define un espacio de claves explícito combinando conjuntos de caracteres para realizar una búsqueda exhaustiva pero optimizada.

### Cheat Sheet de Comandos

```bash
# Ver la ayuda principal y listar los identificadores (IDs) de los tipos de hash soportados.
hashcat --help

  
# Identificar el tipo de un hash desconocido y obtener su ID para Hashcat.
hashid -m '<HASH_STRING>'

  
# Ejecutar un ataque de diccionario básico.
# -a 0 : Define el modo de ataque como diccionario.
# -m <HASH_ID> : Define el tipo de hash.
hashcat -a 0 -m <HASH_ID> <HASH_STRING_O_ARCHIVO> <RUTA_WORDLIST>

  
# Listar los archivos de reglas disponibles incluidos por defecto en la instalación de Hashcat.
ls -l /usr/share/hashcat/rules

  
# Ejecutar un ataque de diccionario aplicando modificaciones mediante un archivo de reglas.
# -r <RUTA_REGLA> : Especifica el archivo de reglas a aplicar sobre el wordlist.
hashcat -a 0 -m <HASH_ID> <HASH_STRING_O_ARCHIVO> <RUTA_WORDLIST> -r <RUTA_REGLA>

  
# Ejecutar un ataque de máscara definiendo un patrón explícito.
# -a 3 : Define el modo de ataque como máscara.
hashcat -a 3 -m <HASH_ID> <HASH_STRING_O_ARCHIVO> '<MASCARA>'
```

### "Gotchas" y Troubleshooting

* **Reglas comunes**: Un archivo de reglas muy efectivo y estándar para transformaciones iniciales es `best64.rule`. Los archivos de reglas en distribuciones estándar suelen ubicarse en `/usr/share/hashcat/rules`.
* **Dependencia de Diccionarios**: Un diccionario estático rara vez es suficiente por sí solo en entornos reales; el uso de reglas suele ser un paso obligatorio si el primer ataque falla.
* **Definición de Máscaras**: Para construir ataques con el modo `-a 3`, debes utilizar los conjuntos de caracteres integrados (charsets) de Hashcat:

&#x20; \* `?l` : Letras minúsculas (a-z).

&#x20; \* `?u` : Letras mayúsculas (A-Z).

&#x20; \* `?d` : Dígitos (0-9).

&#x20; \* `?h` : Hexadecimal minúscula (0-f).

&#x20; \* `?H` : Hexadecimal mayúscula (0-F).

&#x20; \* `?s` : Símbolos y caracteres especiales.

&#x20; \* `?a` : Todos los anteriores combinados (?l?u?d?s).

&#x20; \* `?b` : Todos los bytes (0x00 - 0xff).

* **Custom Charsets**: Puedes definir hasta cuatro conjuntos de caracteres personalizados usando las banderas `-1`, `-2`, `-3` y `-4`, y luego llamarlos en tu máscara con `?1`, `?2`, `?3` y `?4`.
