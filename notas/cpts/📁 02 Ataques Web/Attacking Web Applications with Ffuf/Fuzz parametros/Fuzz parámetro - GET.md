---
tags:
  - webapp
  - fuzzing
---
## Conceptos Clave (TL;DR)

* Páginas web sin mecanismos de autenticación aparentes (cookies o login) pueden depender de parámetros ocultos para validar el acceso.

* El descubrimiento de parámetros no publicados expone funcionalidades menos probadas y propensas a vulnerabilidades web.

* Los parámetros se envían comúnmente a través de solicitudes HTTP GET (en la URL) o POST.

  

## Herramientas Clave

* **ffuf**: Herramienta principal para enumerar parámetros ocultos mediante solicitudes repetitivas.

* **SecLists**: Provee los diccionarios de ataque, específicamente listas de nombres de parámetros.

  

## Metodología Paso a Paso

1. **Identificación del Endpoint**: Localizar páginas web que restrinjan el acceso o muestren mensajes de error indicando que falta información para proceder.

2. **Configuración del Fuzzing**: Preparar la solicitud GET añadiendo el símbolo `?` al final de la URL e inyectando la palabra clave `FUZZ` como nombre del parámetro, asignándole un valor genérico como prueba (ej. `key`).

3. **Filtrado de Ruido**: Ejecutar el escaneo en la terminal aplicando filtros de tamaño (`-fs`) para omitir las respuestas por defecto y descartar las respuestas inválidas.

4. **Validación Manual**: Probar los parámetros descubiertos inyectándolos directamente en la URL del navegador para observar los cambios en el comportamiento de la aplicación.


## Cheat Sheet de Comandos

```bash
# Fuzzing de parámetros GET usando ffuf.
# -w: Especifica la ruta del diccionario y la palabra clave a usar (FUZZ).
# -u: Define la URL objetivo, colocando FUZZ donde iría el nombre del parámetro GET.
# -fs: Filtra el tamaño de la respuesta por defecto para eliminar los falsos positivos.

ffuf -w /opt/useful/seclists/Discovery/Web-Content/burp-parameter-names.txt:FUZZ -u "http://<TARGET_IP>:<PORT>/<PATH_TO_FILE>?FUZZ=key" -fs <DEFAULT_RESPONSE_SIZE>
```
  

## "Gotchas" y Troubleshooting

* **Ruido en los resultados**: Se obtendrán muchas respuestas inválidas si no se filtra correctamente el tamaño de respuesta base (`-fs`) que devuelve el servidor por defecto.

* **Parámetros obsoletos**: Es posible que la herramienta encuentre un parámetro válido, pero que este haya sido deprecado ("This method is deprecated") o ya no esté en uso por la aplicación.

* **Ruta estándar del diccionario**: Para la enumeración de parámetros en entornos de prueba, se recomienda usar el archivo ubicado en `/opt/useful/seclists/Discovery/Web-Content/burp-parameter-names.txt`.