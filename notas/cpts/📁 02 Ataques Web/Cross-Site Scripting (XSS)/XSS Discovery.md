---
tags:
  - xss
  - webapp
---
## Conceptos Clave (TL;DR)

* El descubrimiento de XSS consiste en identificar puntos donde una aplicacion permite inyectar codigo JavaScript en el codigo fuente de la pagina del lado del cliente.

* Las metodologias de descubrimiento se dividen en analisis automatizado (escaneos activos/pasivos) y analisis manual (prueba de payloads y revision de codigo).

* Encontrar la vulnerabilidad puede ser tan dificil como explotarla; ademas, que un payload se refleje en el codigo fuente no garantiza su ejecucion, por lo que la verificacion manual siempre es obligatoria.

  
## Herramientas Clave

* **Escaneres Web Comerciales (Nessus, Burp Pro, ZAP):** Realizan escaneos pasivos buscando vulnerabilidades basadas en DOM y escaneos activos inyectando payloads; suelen ser mas precisos para evadir mecanismos de seguridad.

* **XSStrike, Brute XSS, XSSer:** Herramientas de codigo abierto para la automatizacion del descubrimiento; identifican campos de entrada, inyectan payloads y comparan el renderizado del codigo fuente.

* **PayloadAllTheThings / Payload-Box:** Repositorios publicos online utilizados para obtener listas extensas de payloads para pruebas manuales.


## Metodologia Paso a Paso  

**Fase 1: Escaneo y Descubrimiento Automatizado**

Utilizar herramientas automatizadas (comerciales o de codigo abierto) para iterar rapidamente sobre los parametros de la aplicacion. Estas herramientas envian multiples payloads e identifican si la entrada se refleja en el codigo fuente renderizado de la pagina.

  

**Fase 2: Verificacion Manual de Falsos Positivos**

Tomar los payloads que las herramientas automatizadas marcaron como exitosos e inyectarlos manualmente en el navegador. Esto es necesario porque el reflejo del payload no equivale a la ejecucion del codigo debido a varias razones de renderizado o bloqueos.

  

**Fase 3: Pruebas Manuales con Payloads**

Si los escaneres fallan o la aplicacion esta altamente protegida, recurrir a probar listas de payloads de forma manual campo por campo, observando si se ejecutan las alertas. En entornos avanzados, se recomienda crear scripts en Python propios para automatizar este envio y comparacion, adaptandose especificamente a la aplicacion objetivo.

  

**Fase 4: Revision de Codigo (Si se dispone de acceso)**

Aplicar un enfoque de caja blanca analizando el codigo del front-end y back-end. Al entender exactamente como se maneja la entrada desde el "Source" hasta el "Sink", se pueden construir payloads personalizados con alta probabilidad de exito.
  

## Cheat Sheet de Comandos

```bash
# Clonar el repositorio de XSStrike en la maquina local
git clone https://github.com/s0md3v/XSStrike.git

  
# Navegar al directorio de la herramienta
cd XSStrike
 

# Instalar los requerimientos necesarios de Python
pip install -r requirements.txt

  
# Ejecutar la ayuda de XSStrike para verificar la instalacion
python xsstrike.py

  
# Ejecutar un escaneo basico contra una URL vulnerable, pasando el parametro a testear usando la flag -u
python xsstrike.py -u "<TARGET_URL_WITH_PARAMETER>"
```


## "Gotchas" y Troubleshooting

* **Fallo en listas de Payloads:** Es comun que la mayoria de los payloads copiados de listas publicas fallen en aplicaciones basicas. Esto ocurre porque muchos payloads estan disenados para vectores de inyeccion muy especificos (como inyectar despues de una comilla simple) o para evadir filtros de sanitizacion concretos.

* **Vectores de Inyeccion Ocultos:** Las inyecciones XSS no se limitan a los campos de entrada HTML (formularios). Deben probarse cabeceras HTTP como `Cookie` o `User-Agent`, especialmente si esos valores se reflejan y muestran en la pagina.

* **Diversidad de Atributos:** Los payloads pueden requerir variar el vector de inyeccion, utilizando etiquetas basicas como `<script>`, atributos HTML como `<img>`, o incluso atributos de estilo CSS.

* **Falsos Positivos en Herramientas:** Las herramientas de codigo abierto comparan el payload inyectado con el codigo renderizado; si el texto coincide, indican exito. Sin embargo, esto ignora el contexto de ejecucion, por lo que es critico verificar todo manualmente.

* **Limitaciones de las Herramientas vs Aplicaciones Modernas:** Es poco probable encontrar XSS con herramientas automatizadas en aplicaciones web comunes modernas, ya que los desarrolladores suelen pasarlas por herramientas de evaluacion antes del lanzamiento. Para estos casos, la revision manual de codigo es la mejor opcion.