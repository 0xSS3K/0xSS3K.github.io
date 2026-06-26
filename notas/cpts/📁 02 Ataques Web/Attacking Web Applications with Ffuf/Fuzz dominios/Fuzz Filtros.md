---
tags:
  - fuzzing
  - webapp
---
## Conceptos Clave (TL;DR)

* Por defecto, ffuf filtra las respuestas con código HTTP 404 (NOT FOUND) y mantiene el resto de los resultados en pantalla.

* Durante la enumeración de VHosts, es altamente probable obtener respuestas masivas con código 200, lo que hace necesario aplicar filtros adicionales para discriminar resultados.

* Ffuf permite tanto aislar (match) como descartar (filter) resultados basándose en métricas exactas: código HTTP, tamaño de la respuesta, cantidad de palabras o cantidad de líneas.

* En la enumeración de VHosts no es viable utilizar la función de coincidencia (match), dado que no es posible predecir el tamaño del sitio objetivo.

  

## Herramientas Clave

* **ffuf**: Fuzzer web principal utilizado para iterar listas de palabras contra cabeceras HTTP y descartar falsos positivos mediante su motor de filtrado por tamaño o palabras.

  

## Metodología Paso a Paso

* **1. Determinación de la línea base (Baseline):** Identifica el tamaño (o conteo de palabras/líneas) de la respuesta incorrecta por defecto, la cual satura los resultados iniciales del fuzzing.

* **2. Ejecución con filtros de descarte:** En lugar de buscar respuestas correctas, aplica el flag de filtrado de ffuf correspondiente para ocultar la respuesta incorrecta conocida.

* **3. Modificación del archivo hosts:** Todo VHost o subdominio descubierto debe ser inyectado en el archivo de resolución DNS local del sistema atacante para permitir la conexión.

* **4. Validación visual y confirmación:** Visita el objetivo recién resuelto desde el navegador para verificar que despliega un contenido diferente al del dominio principal, confirmando la existencia del VHost.

* **5. Prueba de estado 404:** Navega hacia un directorio ficticio dentro del nuevo VHost para confirmar que el servidor devuelve un 404 PAGE NOT FOUND, lo que reafirma que estás interactuando con una estructura independiente.

* **6. Escaneo en profundidad:** Una vez confirmado el nuevo VHost, ejecuta un escaneo recursivo de directorios directamente sobre él para descubrir su superficie de ataque interna.

  
## Cheat Sheet de Comandos

```bash
#-----------------------------------
# OPCIONES DE COINCIDENCIA (MATCHER)
#-----------------------------------
# Útil cuando se sabe exactamente qué buscar. Valores por defecto: 200,204,301,302,307,401,403

ffuf -mc <HTTP_CODES> # Hace coincidir los códigos de estado HTTP o "all" para todos

ffuf -ml <LINES>      # Hace coincidir la cantidad de líneas en la respuesta

ffuf -mr <REGEX>      # Hace coincidir en base a una expresión regular

ffuf -ms <SIZE>       # Hace coincidir el tamaño exacto de la respuesta HTTP

ffuf -mw <WORDS>      # Hace coincidir la cantidad exacta de palabras en la respuesta

  
#--------------------------------
# OPCIONES DE FILTRADO (FILTER)
#--------------------------------
# Crítico para descartar respuestas "basura" repetitivas

ffuf -fc <HTTP_CODES> # Filtra códigos de estado HTTP desde la respuesta (lista separada por comas)

ffuf -fl <LINES>      # Filtra por cantidad de líneas en la respuesta (lista y rangos)

ffuf -fr <REGEX>      # Filtra usando una expresión regular

ffuf -fs <SIZE>       # Filtra por el tamaño de la respuesta HTTP (lista y rangos)

ffuf -fw <WORDS>      # Filtra por la cantidad de palabras en la respuesta (lista y rangos)

  
#-------------------------------------
# FUZZING DE VHOSTS APLICANDO FILTRADO
#-------------------------------------
# Fuzzea la cabecera "Host" y filtra el tamaño de respuesta basura identificado (ej. -fs 900)

ffuf -w <WORDLIST_PATH>:FUZZ -u http://<DOMAIN>:<PORT>/ -H 'Host: FUZZ.<DOMAIN>' -fs <SIZE>
```

  
## "Gotchas" y Troubleshooting

* **Error de Resolución:** Si el navegador no encuentra el sitio tras el descubrimiento, es casi seguro que olvidaste agregar `<SUBDOMINIO>.<DOMAIN>` a `/etc/hosts`.

* **Puertos Dinámicos:** Si la máquina objetivo o el laboratorio ha sido reiniciado, valida que estés indicando el `<PORT>` correcto, ya que los entornos suelen cambiarlo.

* **Falso Negativo por Matching:** No uses flags de matching (como `-ms`) para descubrir VHosts; utiliza siempre flags de filter (como `-fs`) apuntando a las medidas del sitio por defecto.