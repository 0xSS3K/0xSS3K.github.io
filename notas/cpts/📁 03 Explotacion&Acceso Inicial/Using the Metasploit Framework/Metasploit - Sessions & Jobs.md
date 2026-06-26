---
tags:
  - metasploit/sessions
  - metasploit/jobs
---
## Conceptos Clave (TL;DR)

* MSFconsole permite gestionar múltiples módulos simultáneamente mediante el uso de "Sessions", creando interfaces de control dedicadas para cada módulo desplegado.

* Las sesiones pueden enviarse a segundo plano (background) manteniendo viva y persistente la conexión con el host objetivo.

* Los "Jobs" son tareas activas que se ejecutan en segundo plano, como los handlers de puertos. Permiten liberar la terminal y asegurar la continuidad de procesos subyacentes aunque se pierda una sesión.

  

## Herramientas Clave

* **msfconsole**: Consola principal para el manejo de módulos, payloads, sesiones y trabajos.
* **sessions**: Comando integrado para listar, interactuar y gestionar los canales de comunicación activos con los objetivos comprometidos.
* **jobs**: Comando integrado para manipular y monitorizar tareas en ejecución en segundo plano (ej. listeners/handlers activos).

  
## Metodología Paso a Paso

### Fase 1: Envío de Sesiones a Segundo Plano

Al obtener una sesión (como Meterpreter o shell), la lógica principal es enviarla a segundo plano para poder seguir utilizando la consola de [Metasploit](../../📂%2008%20Herramientas&Cheatsheets/Metasploit.md) sin perder el acceso al objetivo.

  
### Fase 2: Gestión e Interacción de Sesiones

Una vez que se tienen varias sesiones, es necesario visualizarlas y elegir con cuál interactuar dependiendo del sistema objetivo. Esta fase permite cambiar de contexto rápidamente entre múltiples máquinas vulneradas.

  
### Fase 3: Ejecución de Tareas en Segundo Plano (Jobs)

Durante la explotación, es común requerir mantener un listener activo (multi/handler) sin bloquear la consola. La metodología consiste en ejecutar el exploit en el contexto de un "job" para que escuche en segundo plano, permitiendo el uso de otros módulos simultáneamente.

  
### Fase 4: Limpieza y Liberación de Puertos

Si un módulo falla o se necesita reutilizar un puerto (ej. puerto 4444), simplemente cerrar la sesión no detendrá el proceso que está escuchando en ese puerto. La metodología dicta que se deben listar los trabajos activos y matar el proceso específico (job) para liberar el recurso de red.

  
### Fase 5: Post-Explotación sobre Sesiones Existentes

Con un canal estable establecido, la lógica dicta utilizar módulos de la categoría `post` (recolección de credenciales, sugerencias de exploits locales o escaneo interno). Se configuran para apuntar al ID de una sesión existente, lanzando el ataque sin necesidad de una nueva conexión.

  

## Cheat Sheet de Comandos
```bash
# Enviar sesión activa (ej. Meterpreter) a segundo plano directamente desde su prompt

background
```
*(Nota: También se puede usar la combinación de teclas `[CTRL] + [Z]` dentro de la sesión) *

```bash
# Listar todas las sesiones activas detallando ID, tipo, información y conexión

sessions
```

```bash
# Interactuar con una sesión específica (Reemplazar <SESSION_ID> por el número de sesión)

sessions -i <SESSION_ID>
```

```bash
# Ejecutar un intento de explotación en el contexto de un job (segundo plano)

exploit -j
```

```bash
# Listar todos los trabajos (jobs) activos corriendo en segundo plano

jobs -l
```

```bash
# Terminar un trabajo específico para liberar puertos (Reemplazar <JOB_ID> por el índice del trabajo)

kill <JOB_ID>
```

```bash
# Terminar (matar) absolutamente todos los trabajos en ejecución

jobs -K
```

  
## "Gotchas" y Troubleshooting

* **El falso cierre de puertos:** Intentar cerrar una sesión o un módulo activo usando `[CTRL] + [C]` NO terminará el proceso de escucha si el puerto está anclado a un módulo de fondo. Si intentas levantar otro handler en el mismo puerto, fallará indicando que está en uso. Debes usar `jobs` para identificarlo y `kill <JOB_ID>` para liberar el puerto.

* **Muerte de sesiones:** Las sesiones no son infalibles; pueden morir (desconectarse) de forma inesperada si ocurre algún error durante el tiempo de ejecución del payload o si el canal de comunicación experimenta cortes en la red objetivo.

* **Selección de sesión en módulos Post:** Al usar módulos de post-explotación, asegúrate de utilizar el menú `show options` para confirmar e ingresar el número de sesión correcto (`set SESSION <SESSION_ID>`) sobre el cual quieres que se ejecute el módulo.