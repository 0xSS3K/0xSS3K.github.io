---
tags:
  - fuzzing
  - dns
  - webapp
---
## Conceptos Clave (TL;DR)

* El alojamiento virtual (Virtual Hosting) permite a los servidores web alojar múltiples sitios o aplicaciones en una única dirección IP.
* El enrutamiento se basa principalmente en el encabezado HTTP "Host", el cual funciona como un interruptor para que el servidor decida qué directorio o contenido mostrar.
* Existen tres tipos de VHosts: Basados en nombre (usan el encabezado Host), basados en IP (requieren múltiples IPs físicas/virtuales) y basados en puerto (diferentes puertos en la misma IP).
* Muchos subdominios y VHosts no son públicos ni aparecen en registros DNS, por lo que requieren técnicas de fuzzing para ser descubiertos.

  
## Herramientas Clave

* **Gobuster**: Herramienta rápida y multipropósito, ideal para descubrimiento de VHosts mediante el envío sistemático de peticiones con diferentes encabezados Host.
* **Feroxbuster**: Alternativa implementada en Rust, conocida por su velocidad y flexibilidad, con soporte para recursión.
* **ffuf**: Fuzzer web extremadamente rápido que permite realizar ataques de diccionario directamente sobre el parámetro del encabezado Host.


## Metodología Paso a Paso

1. **Fase 1: Identificación del Objetivo.** Antes de iniciar, debes identificar la dirección IP exacta del servidor web mediante consultas DNS o reconocimiento pasivo/activo.

2. **Fase 2: Preparación del Diccionario.** Selecciona un diccionario adecuado (como los directorios de SecLists) o crea uno personalizado basado en la industria o convenciones de nombres del objetivo.

3. **Fase 3: Ejecución del Fuzzing.** Utiliza una herramienta automatizada para enviar peticiones HTTP al servidor modificando el encabezado Host en cada petición. El servidor revelará VHosts ocultos si la respuesta es distinta a la por defecto.

4. **Fase 4: Análisis y Mapeo Manual.** Revisa los hallazgos y, dado que muchos VHosts no tienen un registro DNS público, mapea los dominios descubiertos en tu archivo hosts local para forzar la resolución y acceder a ellos.

  
## Cheat Sheet de Comandos
```bash
# Ejecutar descubrimiento básico de VHosts con Gobuster.
# -u: Especifica la URL objetivo.
# -w: Especifica la ruta del diccionario.
# --append-domain: Añade el dominio base a cada palabra del diccionario.

gobuster vhost -u http://<TARGET_IP> -w <WORDLIST_PATH> --append-domain
```

```bash
# Ejecutar descubrimiento avanzado y optimizado con Gobuster.
# -t <NUM>: Aumenta el número de hilos para mayor velocidad.
# -k: Ignora los errores de certificados SSL/TLS.
# -o <FILE>: Guarda el output en un archivo para análisis posterior.

gobuster vhost -u http://<TARGET_IP>:<PORT> -w <WORDLIST_PATH> --append-domain -t <THREADS> -k -o <OUTPUT_FILE>
```

  
## "Gotchas" y Troubleshooting

* En las versiones nuevas de Gobuster, el flag `--append-domain` es un requisito estricto para que la herramienta construya correctamente los nombres de host completos. Si omites este flag, la enumeración fallará. En versiones antiguas, este flag no era necesario.

* El descubrimiento de VHosts genera una cantidad masiva de tráfico que puede ser fácilmente detectada y bloqueada por un IDS (Sistema de Detección de Intrusos) o WAF (Web Application Firewall).

* Si descubres un VHost pero tu navegador no logra resolverlo, es porque carece de registro DNS. Debes agregarlo manualmente al archivo `/etc/hosts` de tu máquina atacante apuntando a la `<TARGET_IP>`.

* Los VHosts basados en nombre pueden presentar limitaciones operativas al trabajar con ciertos protocolos específicos como SSL/TLS.

* En el caso de encontrar VHosts basados en puerto, no olvides que es obligatorio especificar el número del puerto directamente en la URL para poder interactuar con el servicio.