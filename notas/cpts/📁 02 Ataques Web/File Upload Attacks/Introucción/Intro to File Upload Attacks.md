---
tags:
  - fileupload
  - webapp
---
## Conceptos Clave (TL;DR)

* Las funcionalidades de subida de archivos permiten a los usuarios almacenar datos en el servidor backend, lo que representa un gran riesgo si no se filtran y validan correctamente.

* La variante más grave es la subida arbitraria de archivos sin autenticación, ya que permite a cualquier usuario ejecutar código en el servidor.

* Muchos desarrolladores implementan filtros de contenido o extensión, pero si son inseguros, pueden ser evadidos para lograr subidas arbitrarias.

* Aunque la aplicación limite el tipo de archivos permitidos, la falta de protección puede introducir otras vulnerabilidades como XSS, XXE, DoS y sobreescritura de archivos críticos.

  

## Herramientas Clave

* **Web Shells:** Se utilizan para ejecutar comandos específicos en el backend y pueden transformarse en shells interactivas para enumerar el sistema y explotar la red.

* **Reverse Shell Scripts:** Se utilizan para enviar una conexión (shell inversa) desde el servidor comprometido hacia un listener en la máquina del atacante.

  

## Metodología Paso a Paso

1. **Identificación de Funcionalidad:** Localizar puntos de entrada donde la aplicación web permita subir archivos, como imágenes de perfil en redes sociales o documentos corporativos.

2. **Evaluación de Controles:** Determinar el nivel de validación implementado sobre las extensiones y el contenido de los archivos.

3. **Evasión de Filtros:** Si las validaciones existen pero son débiles, aplicar técnicas de bypass para subir archivos no permitidos.

4. **Ejecución de Código (RCE):** Aprovechar la subida arbitraria para inyectar una web shell o un script de reverse shell, tomando así el control del servidor backend.

5. **Explotación Secundaria:** Si solo se permite subir tipos de archivos específicos y no se logra RCE, pivotar hacia ataques de XSS, XXE, sobre escritura de configuraciones o causar una denegación de servicio (DoS).

## Cheat Sheet de Comandos

*Nota del pentester: no hay comandos relacionados a este módulo*
  

## "Gotchas" y Troubleshooting

* **Criticidad:** La mayoría de estas vulnerabilidades se clasifican como Altas o Críticas; siempre dales prioridad en tu evaluación.

* **Librerías de Terceros:** Las vulnerabilidades de subida de archivos no siempre se deben a código personalizado mal escrito; a menudo son causadas por el uso de librerías desactualizadas en el servidor.

* **Falsos Negativos:** Que no puedas subir una web shell (PHP/ASP/JSP) no significa que la función sea segura. Debes probar obligatoriamente vectores de XSS, XXE o DoS con los tipos de archivos que sí están permitidos.