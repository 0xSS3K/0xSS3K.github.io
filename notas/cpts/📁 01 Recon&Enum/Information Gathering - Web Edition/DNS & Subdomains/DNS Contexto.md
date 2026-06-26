---
tags:
  - webapp
  - webrecon
  - dns
---
## Conceptos Clave (TL;DR)

* DNS traduce nombres de dominio legibles para humanos en direcciones IP numéricas requeridas para la comunicación de red.
* La resolución sigue una jerarquía estricta si no está en caché: Computadora -> Resolver local/ISP -> Servidor Raíz -> Servidor TLD -> Servidor Autoritativo.
* Los archivos de zona almacenan registros (A, AAAA, CNAME, MX, TXT, etc.) que definen cómo se resuelven los dominios y subdominios dentro de una zona administrada.
* En escenarios de web recon, DNS es fundamental para el descubrimiento de activos, mapeo de infraestructura e identificación de servicios internos (o de terceros).

### Herramientas Clave

* **Editor de texto (con privilegios de administrador/root):** Esencial para la modificación manual de las resoluciones de dominio mediante el archivo hosts. (Nota: El texto base no menciona herramientas activas de escaneo, el enfoque es conceptual y de manipulación local).

### Metodología Paso a Paso

#### 1. Manipulación de Resolución Local (Archivo Hosts)

En pruebas de penetración o entornos de desarrollo, a menudo es necesario forzar la resolución de un dominio hacia un servidor controlado o de prueba sin afectar la infraestructura global. Modificar el archivo hosts permite anular la respuesta DNS estándar.

#### 2. Descubrimiento de Activos (Reconocimiento Pasivo/Activo)

Extraer los distintos tipos de registros DNS del objetivo para expandir la superficie de ataque:

* **Registros A / AAAA:** Revelan direcciones IP (IPv4/IPv6) directas de servidores web, balanceadores de carga o endpoints de VPN.
* **Registros NS:** Identifican los servidores de nombres autoritativos, revelando a menudo el proveedor de alojamiento.
* **Registros MX:** Exponen la infraestructura de correo electrónico.
* **Registros SRV:** Permiten descubrir servicios específicos y sus puertos asociados en el objetivo.

#### 3. Mapeo de Infraestructura y Búsqueda de Vulnerabilidades

Cruzar los datos DNS obtenidos para encontrar debilidades:

* **Registros CNAME:** Analizar alias que puedan estar apuntando a servidores desactualizados o servicios en la nube no reclamados (potencial Subdomain Takeover).
* **Registros TXT:** Inspeccionar en busca de información de verificación, políticas SPF (para suplantación de correo) o fugas de configuración de software de terceros (ej. gestores de contraseñas).

### Cheat Sheet de Comandos

```bash
# Formato estándar para agregar entradas al archivo hosts (Linux/macOS/Windows)
# Redirigir un dominio objetivo a una IP controlada o de prueba

<ATTACKER_IP>    <TARGET_DOMAIN>

  

# Ejemplo práctico: Redirigir un subdominio a un servidor local para pruebas
127.0.0.1       <SUBDOMAIN>.<TARGET_DOMAIN>.local

  

# Ejemplo práctico: Bloquear la resolución de un dominio problemático
0.0.0.0         <UNWANTED_DOMAIN>.com
```

### "Gotchas" y Troubleshooting

* **Ubicación del Archivo Hosts:**

&#x20;   \* Windows: `C:\Windows\System32\drivers\etc\hosts`.

&#x20;   \* Linux/macOS: `/etc/hosts`.

* **Aplicación de cambios:** Las modificaciones en el archivo hosts tienen efecto inmediato; no es necesario reiniciar el sistema o el servicio de red.
* **Fugas de Información en TXT:** Los registros TXT a menudo contienen datos sensibles. Valores como `_1password=...` pueden revelar el uso de plataformas específicas, útiles para ingeniería social.
* **Peligro en CNAMEs:** Un registro CNAME apuntando a infraestructura antigua (`oldserver.<TARGET_DOMAIN>`) es un vector primario para comprometer sistemas olvidados o vulnerables.
* **La clase "IN":** Al examinar archivos de zona volcados, la nomenclatura `IN` en los registros (ej. `IN A`, `IN TXT`) simplemente significa "Internet", que denota la suite de protocolos estándar; no es un acrónimo de un servicio oculto.
