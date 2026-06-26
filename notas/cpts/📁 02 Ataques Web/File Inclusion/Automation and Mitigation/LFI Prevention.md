---
tags:
  - LFI
  - mitigation
  - webapp
---
## Conceptos Clave (TL;DR)

* La estrategia fundamental es evitar el paso de entradas controladas por el usuario directamente a funciones o APIs de inclusión y lectura de archivos.

* En caso de requerir cargas dinámicas, se deben utilizar listas blancas (whitelists) estrictas, como bases de datos o mapas estáticos JSON, para validar y emparejar la entrada del usuario con los archivos permitidos.

* El Directory Traversal expone archivos críticos del sistema operativo, código fuente y configuraciones de otros servicios; prevenirlo requiere extraer únicamente el nombre del archivo o limpiar el input de forma recursiva.

* La seguridad perimetral (WAF) y las configuraciones restrictivas a nivel del servidor web no eliminan la vulnerabilidad, pero reducen drásticamente su impacto y proporcionan tiempo de reacción a los defensores.

  

## Herramientas Clave

* **Listas Blancas (Whitelists):** Mecanismo de control interno (DB, arrays, JSON) utilizado para restringir las peticiones del usuario unicamente a recursos autorizados y conocidos.

* **Funciones nativas del Framework (ej. basename):** Herramientas integradas en lenguajes de programación diseñadas para extraer exclusivamente la porción del nombre de archivo de una ruta completa.

* **Docker:** Plataforma de contenedores utilizada para encerrar la aplicación web y restringir físicamente su acceso a directorios no relacionados con la web.

* **ModSecurity (WAF):** Firewall de aplicaciones web implementado para detectar y registrar intentos de ataque (idealmente en modo permisivo inicialmente para evitar falsos positivos).

  

## Metodología Paso a Paso

  

1. **Implementacion de Listas Blancas (Whitelisting)**

   En lugar de pasar el input directamente a la función vulnerable, se crea un mapa de las rutas existentes en el frontend. El input se compara con este mapa; si hay coincidencia, el backend carga el archivo asociado, neutralizando la manipulación arbitraria.

  

2. **Mitigacion de Directory Traversal**

   Se debe utilizar la función nativa del lenguaje (como `basename()` en PHP) para procesar el input. Esto elimina cualquier estructura de directorios insertada por el atacante, garantizando que el sistema interprete la carga útil unicamente como un nombre de archivo local.

  

3. **Sanitizacion Recursiva (Alternativa)**

   Si la arquitectura de la aplicación obliga a transitar por directorios, se implementa una sanitización profunda. Consiste en buscar iterativamente cadenas de salto de directorio (como `../`) y eliminarlas hasta que la cadena resultante quede limpia de estos patrones.

  

4. **Hardening a nivel de Servidor y Framework**

   Consiste en aplicar el principio de mínimo privilegio en el entorno de ejecución. Se deshabilitan las directivas que permiten cargar recursos remotos, se anula la carga de módulos innecesarios y se confina la ejecución del código al directorio de trabajo del servidor web (Web Root).

  

## Cheat Sheet de Comandos

```bash
# Prueba de concepto en Bash para saltar directorios usando comodines (?) y (*) en lugar de (..)

cd ~
cat .?/.*/.?/<TARGET_FILE_PATH>
```

```bash
# Acceso al shell interactivo de PHP para pruebas locales

php -a
```

```php
# Prueba de concepto en PHP para validar el manejo de comodines (PHP no los interpreta igual que Bash nativo)

echo file_get_contents('.?/.*/.?/<TARGET_FILE_PATH>');
```

```php
# Implementacion de limpieza recursiva de saltos de directorio en PHP

while(substr_count($input, '../', 0)) {
    $input = str_replace('../', '', $input);
};
```

```ini
# Hardening basico en php.ini para mitigar el impacto de File Inclusion
# Deshabilita la lectura e inclusion de URLs remotas (Mitiga RFI)

allow_url_fopen = Off
allow_url_include = Off
  

# Restringe a la aplicacion web para que no lea archivos fuera de su directorio base (Mitiga impacto de LFI)

open_basedir = /var/www
```


## "Gotchas" y Troubleshooting

* **Objetivos Post-Explotacion LFI:** Si un Traversal tiene éxito, los atacantes buscarán claves SSH o usuarios válidos en `/etc/passwd`, secuestro de sesiones en archivos temporales de PHP, código fuente para revisión, o credenciales en servicios locales (ej. `tomcat-users.xml`).

* **Peligro de Funciones Custom:** Crear funciones propias para prevenir saltos de directorio a menudo falla debido a casos límite (edge cases). Por ejemplo, si una aplicación de PHP pasa una entrada sanitizada erróneamente a `system()`, las reglas de expansión de Bash podrían ser abusadas usando `?` o `*` para reconstruir un path directory traversal. Es mejor depender de funciones nativas del lenguaje que ya tienen estos casos parcheados.

* **Limitacion de `basename()`:** Si usas esta función nativa, bloquearás los ataques LFI, pero si tu aplicación depende de navegar entre carpetas o directorios internos legítimos de manera dinámica, la aplicación se romperá.

* **Falsos Positivos del WAF:** Implementar un WAF como ModSecurity directamente en modo de bloqueo sin afinar las reglas cortará tráfico legítimo. Se debe usar primero el modo permisivo (sólo reportes) para afinar las alertas.

* **Falsa Sensacion de Seguridad:** Tener un sistema fortificado o configurado no lo hace "inhackeable". Un LFI zero-day podría seguir siendo funcional, pero un entorno bien hardenizado garantiza que dicho exploit genere logs detectables o cause una alerta atípica.