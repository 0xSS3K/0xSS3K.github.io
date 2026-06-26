---
tags:
  - webapp
  - splunk
  - enum
---
## Conceptos Clave (TL;DR)

- Splunk es una herramienta de análisis de registros (logs) que frecuentemente aloja datos sensibles de monitoreo de seguridad corporativa.
- Cuando es comprometido, el nivel de impacto es critico, ya que usualmente corre con privilegios elevados: root en sistemas Linux o SYSTEM en sistemas Windows.
- La version de prueba (Enterprise Trial) se degrada a la version "Free" tras 60 dias, la cual no posee ninguna gestión de roles ni usuarios, permitiendo un acceso total sin autenticacion.
- En lugar de buscar exploits o vulnerabilidades (CVEs) en el software, el vector de ataque principal es obtener acceso administrativo (credenciales debiles o version gratuita) para abusar de funcionalidades legitimas, como aplicaciones personalizadas o "scripted inputs", y obtener ejecución remota de código (RCE).

## Herramientas Clave

- **Nmap:** Herramienta principal para el descubrimiento de servicios y para identificar los puertos de gestion expuestos de Splunk.

## Metodologia Paso a Paso

### 1. Descubrimiento y Enumeracion de Puertos

El objetivo es identificar la presencia de Splunk interactuando en la red. Se escanean puertos especificos para localizar la interfaz web de administracion y el endpoint de la API REST.

### 2. Acceso Inicial

Una vez localizada la interfaz de administracion (por defecto HTTP/HTTPS en el puerto 8000), el objetivo es ingresar a la consola administrativa. Se verifica primero si es la version gratuita que permite el paso directo. De haber panel de inicio de sesion, se aplican intentos de contraseñas predeterminadas y debiles comunes.

### 3. Abuso de Funcionalidades (Post-Acceso)

Al ingresar al sistema, la meta se convierte en pivotar desde la interfaz hacia una consola interactiva en el servidor. Esto se logra abusando de "scripted inputs", una funcion nativa diseñada para integrar datos externos ejecutando scripts de Bash, PowerShell, Batch o Python a nivel de sistema operativo.

## Cheat Sheet de Comandos

```bash
# Escaneo de red enumerando versiones de servicios para descubrir instancias de Splunk (Busca puertos 8000 y 8089) 
sudo nmap -sV <TARGET_IP>
```

## "Gotchas" y Troubleshooting

- **Puertos por defecto:** 8000 (Splunk Web Server) y 8089 (Splunk Management Port para la API REST).
- **Credenciales predeterminadas:** En instalaciones antiguas, las credenciales por defecto son `admin` / `changeme`.
- **Diccionario rapido de contraseñas:** Si la contraseña por defecto no funciona, probar ataques de fuerza bruta cortos con variaciones como `admin`, `Welcome`, `Welcome1`, `Password123`.
- **Ventaja para RCE:** Independientemente de si el objetivo es Windows o Linux, Splunk trae su propio entorno de Python integrado. Esto garantiza que los reverse shells creados en Python siempre se ejecutaran correctamente a traves de los "scripted inputs" sin tener que preocuparse por dependencias faltantes en el sistema operativo host.
- **Vulnerabilidades:** Durante un pentest, los escaneos automatizados pueden mostrar vulnerabilidades para Splunk, pero rara vez son explotables. Es mas practico y efectivo enfocarse en el abuso de funcionalidades tras obtener acceso a la interfaz web.