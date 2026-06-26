---
tags:
  - prevention
  - mitigation
---
## Conceptos Clave (TL;DR)

* El framework MITRE ATT&CK permite categorizar tácticas clave como Acceso Inicial, Ejecución y Command & Control (C2) para entender la metodología del atacante.

* La detección temprana depende de monitorear anomalías locales (ejecución de binarios del sistema por usuarios sin privilegios) y eventos de red anómalos (conexiones SMB inusuales, puertos no estándar).

* Las defensas de red modernas (DPI, Firewalls L7) pueden actuar como antivirus a nivel de red, identificando e interrumpiendo comunicaciones de payloads.

* El éxito de la mitigación radica en una arquitectura de defensa en profundidad: segmentación (DMZ), políticas de privilegios mínimos (Least Privilege), endurecimiento (Hardening) y Sandboxing.

  

## Herramientas Clave

* **Wireshark / Analizadores de Protocolos:** Fundamental para inspeccionar capturas de paquetes (PCAP) y detectar comandos en texto claro enviados a través de shells no cifradas.

* **SIEMs / Monitores de Red:** Utilizados para analizar datos NetFlow, centralizar logs e identificar picos anómalos, "top talkers" o heartbeats de C2.

* **Herramientas de Topología (Draw.io, Netbrain):** Cruciales para establecer la línea base de la red y visualizar el flujo de tráfico autorizado.

* **Windows Defender / Soluciones AV:** Primera línea de defensa en los endpoints y servidores para prevenir la ejecución de payloads en disco o en memoria.

  

## Metodología Paso a Paso

  

### Fase 1: Análisis de Logs y Comportamiento del Endpoint

El objetivo es identificar indicadores tempranos de compromiso (IoC) generados durante las fases de acceso inicial y ejecución.

1. Auditar logs de aplicaciones web buscando subidas de archivos (file uploads) sospechosas que puedan resultar en una web shell.

2. Revisar la telemetría de línea de comandos (Bash, cmd, PowerShell) buscando usuarios no administrativos ejecutando comandos de enumeración de entorno.

3. Analizar conexiones SMB de host a host que desvíen de los patrones normales de conexión hacia servidores de infraestructura.

  

### Fase 2: Inspección de Tráfico de Red y C2

El objetivo es detectar la infraestructura de control del atacante analizando los flujos de datos.

1. Comparar el tráfico actual contra la línea base de la red (baselines) para aislar sesiones anómalas.

2. Buscar conexiones hacia el exterior en puertos comúnmente asociados a frameworks de explotación o revisar ráfagas inusuales de peticiones GET/POST.

3. Realizar inspección profunda de paquetes (DPI) para localizar interacciones no cifradas, extrayendo los comandos emitidos en canales de texto claro.

  

### Fase 3: Aplicación de Estrategias de Mitigación

El objetivo es limitar el radio de explosión una vez que un atacante obtiene ejecución de código.

1. Implementar Sandboxing en aplicaciones expuestas a internet para contener brechas.

2. Segmentar la red colocando activos expuestos en zonas desmilitarizadas (DMZ) y aplicar guías de Hardening (ej. STIGs) para dificultar el movimiento lateral.

3. Configurar firewalls de capa de aplicación y física con reglas estrictas de salida (Egress Filtering) para bloquear callbacks de reverse shells.

  

## Cheat Sheet de Comandos

```bash
# Comando de enumeración básica a menudo detectado en logs cuando es usado por usuarios estándar.

whoami
```

```powershell
# Creación de un usuario local para persistencia, comúnmente detectado en tráfico de texto claro.
net user <USER> <PASSWORD> /add
  

# Adición del usuario recién creado a un grupo privilegiado local (ej. Administradores).
net localgroup <GROUP> <USER> /add
```


## "Gotchas" y Troubleshooting

* **Tráfico en Texto Claro:** Las herramientas básicas de conexión (como Netcat) no cifran su tráfico. Un analista defensivo puede capturar los paquetes y leer todo el flujo de comandos (ej. `net user`, `dir`) entre el atacante y el objetivo.

* **El Problema del NAT:** Las arquitecturas defensivas que implementan Network Address Translation (NAT) pueden romper la funcionalidad de los payloads de red si el atacante no toma en cuenta el ruteo durante la creación de la shell.

* **Puertos Quemados:** Utilizar puertos por defecto de herramientas ofensivas (como el 4444 de Meterpreter) es altamente sospechoso y genera alertas casi inmediatas en herramientas de monitoreo.

* **Evasión de C2:** Ten en cuenta que los adversarios modernos ofuscarán su C2 usando protocolos estándar (HTTP/S, DNS) o camuflando el tráfico a través de aplicaciones corporativas permitidas (Slack, Teams) para evadir las reglas de firewall.

* **Excepciones de Firewall:** Los firewalls de host (como Windows Defender Firewall) deben tener sus tres perfiles activados (Domain, Private, Public) y las reglas de salida fuertemente restringidas para ahogar las reverse shells.