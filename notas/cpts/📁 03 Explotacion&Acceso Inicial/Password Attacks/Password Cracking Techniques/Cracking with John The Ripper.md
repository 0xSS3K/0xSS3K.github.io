---
tags:
  - jtr
  - cracking
---
## Conceptos Clave (TL;DR)

* Herramienta open-source para cracking de contraseñas mediante ataques de fuerza bruta y de diccionario.
* Se recomienda la variante "jumbo" por sus optimizaciones de rendimiento, soporte para arquitecturas de 64 bits y características adicionales como listas de palabras multilingües.
* Cuenta con tres modos principales de ataque: Single crack (basado en reglas y metadatos del usuario), Wordlist (diccionario tradicional) e Incremental (fuerza bruta estadística).
* Incluye utilidades para convertir archivos protegidos o encriptados a formatos de hash que JtR puede procesar.

### Herramientas Clave

* **John the Ripper (JtR):** El motor principal de cracking.
* **hashID:** Herramienta para identificar el formato de un hash desconocido y correlacionarlo con los formatos soportados por JtR.
* \*_Herramientas 2john:_ Suite de scripts incluidos con JtR (ej. pdf2john, ssh2john, zip2john) para extraer hashes atacables desde archivos o capturas.

### Metodología Paso a Paso

* **Fase 1: Extracción del Hash.** Si el objetivo es un archivo (ej. un ZIP, PDF o llave SSH), se debe utilizar la herramienta `*2john` correspondiente para extraer el hash y guardarlo en un archivo de texto.
* **Fase 2: Identificación del Formato.** Si se obtiene un hash aislado de formato desconocido, analizar su contexto o utilizar herramientas como `hashID` o listas de referencia para determinar qué argumento pasarle a JtR.
* **Fase 3: Ejecución del Ataque.** Determinar la estrategia de cracking:   \* Emplear **Single crack mode** si se tienen archivos de cuentas de Linux (ej. passwd), ya que genera candidatos basados en el nombre de usuario y datos GECOS.   \* Emplear **Wordlist mode** para ejecutar listas de contraseñas conocidas, pudiendo aplicar transformaciones mediante reglas.   \* Emplear **Incremental mode** como último recurso para un ataque exhaustivo basado en modelos estadísticos cuando los diccionarios fallan.

### Cheat Sheet de Comandos

```bash
# Identifica el formato de un hash y muestra directamente el formato compatible con JtR (-j)
hashid -j <HASH_STRING>

  
# Busca todas las herramientas de extracción de hashes instaladas en el sistema
locate *2john*

  
# Extrae el hash de un archivo protegido y lo guarda en un archivo de texto para su posterior cracking
<TOOL_2JOHN> <TARGET_FILE> > <HASH_FILE>

  
# Ejecuta el modo "Single crack" ideal para credenciales Linux (aprovecha la información del usuario en el archivo)
john --single <HASH_FILE>

  
# Ejecuta un ataque de diccionario básico utilizando una lista de palabras en texto plano
john --wordlist=<WORDLIST_FILE> <HASH_FILE>

  
# Ejecuta un ataque de diccionario aplicando reglas de mutación (ej. añadir números o mayúsculas)
john --wordlist=<WORDLIST_FILE> --rules <HASH_FILE>


# Ejecuta el modo "Incremental" (fuerza bruta basada en cadenas de Markov) con los parámetros por defecto
john --incremental <HASH_FILE>

  
# Inspecciona los modos incrementales configurados en el sistema (juegos de caracteres y longitudes)
grep '# Incremental modes' -A 100 /etc/john/john.conf

  
# Ejecuta un ataque especificando manualmente el formato del hash (útil cuando JtR no lo autodetecta)
john --format=<HASH_FORMAT> <HASH_FILE>
```

### "Gotchas" y Troubleshooting

* **Ataques en Linux:** El modo "Single crack" depende en gran medida de que el archivo a crackear contenga información del usuario (como el nombre de usuario, directorio home o valores GECOS) para generar los candidatos correctamente.
* **Formatos ambiguos:** JtR o `hashID` no siempre pueden identificar un hash con total certeza. En casos ambiguos, el contexto de la obtención del hash (ej. el servicio de donde se extrajo) es clave para deducir el formato correcto.
* **Listas de palabras:** El archivo utilizado en el modo wordlist debe estar estrictamente en texto plano, conteniendo una palabra por línea. Se pueden usar múltiples diccionarios separándolos por comas.
* **Consumo de recursos:** El modo Incremental es extremadamente exhaustivo, intensivo en recursos y lento. Para mejorar su rendimiento, se debe personalizar el juego de caracteres y la longitud objetivo en el archivo de configuración.
