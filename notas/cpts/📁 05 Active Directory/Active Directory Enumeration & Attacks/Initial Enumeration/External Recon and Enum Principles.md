---
tags:
  - enum
  - AD
---
## Conceptos Clave (TL;DR)

* El reconocimiento externo es una fase crítica antes de iniciar cualquier prueba de penetración para obtener una visión completa del entorno y mapear la superficie de ataque del cliente.

* Esta fase sirve para validar la información del alcance (scope) proporcionada por el cliente y descubrir infraestructura adicional (espacios IP, ASNs, subdominios).

* El objetivo principal es identificar fugas de información, formatos de nombres de usuario (schemas), documentos expuestos y datos de brechas de seguridad que puedan facilitar el acceso.

* La enumeración es un proceso iterativo que comienza con técnicas pasivas amplias y se va reduciendo hacia la enumeración activa y validación de datos.

  

## Herramientas Clave

* **BGP Toolkit (Hurricane Electric) / IANA / ARIN / RIPE:** Búsqueda y validación de bloques de direcciones IP y ASNs asociados a la infraestructura de la organización.

* **Domaintools / ViewDNS.info:** Herramientas para validación de IPs, historial DNS, búsqueda inversa y descubrimiento de dominios adicionales asociados al objetivo.

* **ICANN / nslookup:** Consultas manuales de registros DNS contra el dominio o servidores DNS públicos para descubrir subdominios o servidores de correo.

* **Trufflehog / Greyhat Warfare:** Búsqueda de credenciales y secretos olvidados en repositorios de código (GitHub) o contenedores de almacenamiento en la nube (AWS S3, Azure).

* **HaveIBeenPwned / Dehashed:** Identificación de correos corporativos comprometidos y recuperación de contraseñas en texto claro o hashes a partir de brechas públicas.

* **linkedin2username:** Herramienta para extraer datos de LinkedIn y generar listas combinadas de posibles nombres de usuario válidos para la organización.

  
## Metodología Paso a Paso

* **Fase 1: Mapeo de Infraestructura e IPs:** Comienza buscando el ASN, netblocks y registros DNS para identificar la presencia de la organización en internet. Esto permite delimitar la infraestructura propia frente a la alojada por terceros.

* **Fase 2: Validación y Expansión DNS:** Utiliza consultas DNS inversas y herramientas web para confirmar las direcciones IP descubiertas y encontrar subdominios ocultos que resuelvan a IPs dentro del alcance permitido.

* **Fase 3: Búsqueda de Información Pública y Fugas:** Rastrea el sitio web principal, redes sociales y repositorios utilizando "Dorks" para encontrar documentos expuestos (PDFs, DOCX) y correos electrónicos que revelen el organigrama y el esquema de nombres de usuario.

* **Fase 4: Recolección de Credenciales:** Consulta bases de datos de brechas de seguridad para recopilar contraseñas antiguas o actuales. Estas credenciales se usarán posteriormente para ataques de "password spraying" contra portales externos (VPN, OWA, Citrix) o servicios internos.

  
## Cheat Sheet de Comandos

```bash
# Consultar un registro DNS específico para descubrir direcciones IP asociadas a un subdominio/nameserver

nslookup <SUBDOMAIN>.<TARGET_DOMAIN>
```

```text
# Google Dork: Buscar archivos PDF expuestos en el dominio objetivo (útil para extraer metadatos o rutas internas)

filetype:pdf inurl:<TARGET_DOMAIN>
```

```text
# Google Dork: Buscar menciones o formatos de direcciones de correo electrónico dentro del sitio web objetivo

intext:"@<TARGET_DOMAIN>" inurl:<TARGET_DOMAIN>
```

```bash
# Consultar Dehashed a través de su script API para extraer contraseñas en texto claro o hashes asociados al dominio

sudo python3 dehashed.py -q <TARGET_DOMAIN> -p
```

  
## "Gotchas" y Troubleshooting

* **Cuidado con la infraestructura compartida:** Empresas pequeñas suelen alojar sus servicios en proveedores de terceros (Cloudflare, AWS, Azure, Google Cloud). Atacar ciegamente estas IPs puede impactar a otras organizaciones fuera del alcance.

* **Verificación de permisos en la nube:** Algunos proveedores como AWS permiten ciertas pruebas sin aviso, pero otros como Oracle requieren notificaciones formales de seguridad (Cloud Security Testing Notification). Si hay dudas sobre un servicio externo, escala el caso antes de atacar.

* **Contraseñas antiguas:** Es común que las contraseñas encontradas en brechas ya no funcionen en portales externos con autenticación de Active Directory, pero aún así son extremadamente útiles para entender patrones de contraseñas o para intentos de "password spraying".

* **Registro de hallazgos:** Guarda inmediatamente archivos, capturas de pantalla y salidas de herramientas en el momento que los encuentres para no perder datos críticos ni olvidar su ubicación original.

* **Cambios en APIs:** Si utilizas scripts automatizados (como el de Dehashed), ten en cuenta que las estructuras de las APIs cambian y pueden requerir modificaciones en el código del script para funcionar correctamente.