---
tags:
  - nse
  - nmap
  - script
---
## Conceptos Clave

* Nmap Scripting Engine (NSE) permite interactuar con servicios específicos utilizando scripts escritos en el lenguaje Lua.
* Los scripts se agrupan en 14 categorías principales, permitiendo desde el descubrimiento pasivo hasta la explotación y ataques de fuerza bruta.
* La ejecución de scripts es altamente modular; se pueden lanzar scripts por defecto, categorías enteras o especificar nombres de scripts particulares separados por comas.


## Herramientas Clave

* **[Nmap](../../../📂%2008%20Herramientas&Cheatsheets/Nmap.md):** Herramienta base utilizada para el descubrimiento de puertos, detección de versiones de servicios, identificación del sistema operativo y ejecución del motor de scripts NSE.


## Metodología Paso a Paso

**Fase 1: Escaneo Base y Detección de Servicios**

Se busca obtener un panorama general del objetivo utilizando scripts por defecto y detección exhaustiva de configuraciones y rutas de red. Esto proporciona información de versiones y posibles sistemas operativos.


**Fase 2: Enumeración Específica por Servicio**

Una vez identificados los puertos abiertos, se ejecutan scripts individuales (ej. `banner`, `smtp-commands`) contra servicios particulares para extraer información de configuración y comandos permitidos que puedan revelar vectores de ataque adicionales, como la enumeración de usuarios.


**Fase 3: Búsqueda de Vulnerabilidades**

Con los servicios y versiones definidos, se hace uso de la categoría `vuln` combinada con la detección de versiones para que Nmap confronte el servicio contra bases de datos de vulnerabilidades, identificando CVEs, rutas administrativas (ej. en CMS) y fallos conocidos.

  
## Cheat Sheet de Comandos
```bash
# Ejecuta los scripts categorizados como "default" usando la bandera -sC
sudo nmap <TARGET_IP> -sC
 

# Ejecuta todos los scripts pertenecientes a una categoría específica (ej. vuln, exploit, auth)
sudo nmap <TARGET_IP> --script <CATEGORY>
  

# Ejecuta uno o múltiples scripts específicos pasados por su nombre exacto, separados por comas
sudo nmap <TARGET_IP> --script <SCRIPT_NAME_1>,<SCRIPT_NAME_2>


# Escanea un puerto específico (-p) y ejecuta scripts para obtener el banner del servicio y comandos admitidos
sudo nmap <TARGET_IP> -p <PORT> --script banner,smtp-commands

  
# Escaneo Agresivo (-A): Realiza detección de sistema operativo (-O), detección de versiones (-sV), traceroute y aplica los scripts por defecto (-sC)
sudo nmap <TARGET_IP> -p <PORT> -A

  
# Escaneo de Vulnerabilidades: Combina la detección de versiones de servicio (-sV) con la categoría de scripts de vulnerabilidad (--script vuln)
sudo nmap <TARGET_IP> -p <PORT> -sV --script vuln
```


## "Gotchas" y Troubleshooting

* **Fiabilidad de la Detección de OS:** Los resultados del escaneo agresivo para adivinar el sistema operativo pueden ser poco fiables o no encontrar coincidencias exactas si no existen las condiciones ideales, es decir, si Nmap no logra encontrar al menos 1 puerto abierto y 1 puerto cerrado.

* **Impacto en el Objetivo:** Las categorías de scripts `dos` e `intrusive` deben usarse con extrema precaución; los scripts `dos` buscan vulnerabilidades de denegación de servicio y dañan los servicios, mientras que los `intrusive` pueden afectar negativamente al sistema objetivo.

* **Identificación de Distribuciones:** El uso de scripts simples como `banner` es a menudo suficiente para identificar con precisión la distribución de Linux subyacente (ej. Ubuntu) antes de intentar vectores más ruidosos.

* **Enumeración a través de Comandos:** Interactuar con servidores mediante scripts como `smtp-commands` es crucial para descubrir características habilitadas (ej. VRFY, EXPN) que ayudan a validar o enumerar usuarios existentes en el sistema.