---
tags:
  - webapp
  - jenkins
  - enum
---
## Conceptos Clave (TL;DR)
* Jenkins es un servidor de automatización de Integración Continua (CI) de código abierto basado en Java, típicamente ejecutado en contenedores de servlets como Tomcat.
* Es un objetivo de alto valor crítico: en entornos Windows suele instalarse ejecutándose bajo la cuenta `SYSTEM`.
* Obtener Ejecución Remota de Código (RCE) en Jenkins proporciona frecuentemente un "foothold" inicial con privilegios máximos locales, ideal para comenzar la enumeración y compromiso de Active Directory.
* Históricamente posee múltiples vulnerabilidades, incluyendo vectores de RCE que no requieren autenticación previa.

## Herramientas Clave
* **Navegador Web / cURL:** Esenciales para la interacción inicial, validación de paneles de autenticación y revisión de configuraciones de seguridad expuestas.

## Metodología Paso a Paso

**Fase 1: Descubrimiento y Fingerprinting**
El objetivo es identificar el servicio en la red. Jenkins se puede identificar rápidamente al inspeccionar los puertos web y visualizar su página de inicio de sesión característica.

**Fase 2: Evaluación de Autenticación**
Una vez identificado, se debe determinar el esquema de autenticación. Jenkins permite delegar la seguridad a bases de datos locales, LDAP, Unix o incluso no requerir autenticación. Durante pruebas internas, es muy común encontrar instancias sin ningún tipo de autenticación.

**Fase 3: Explotación de Accesos Débiles**
Si existe un panel de inicio de sesión, se procede a probar credenciales por defecto o débiles (como `admin:admin`), lo cual es una vulnerabilidad frecuente.

**Fase 4: Enumeración de Configuraciones de Seguridad**
Si se logra acceso (o si no hay autenticación), se debe revisar la configuración global de seguridad para entender qué permisos existen y si se permite el registro arbitrario de nuevas cuentas por parte de los usuarios (aunque por defecto esto está deshabilitado y utiliza la base de datos propia de Jenkins).

## Cheat Sheet de Comandos

```bash
# Acceder a la ruta por defecto del panel de login de Jenkins para fingerprinting y pruebas manuales de credenciales.
# Reemplazar <TARGET_IP> y <PORT> con los datos del objetivo.
curl -i -s -k -X GET "http://<TARGET_IP>:<PORT>/login?from=%2F"
```

```bash
# Acceder a la página de Configuración de Seguridad Global (requiere acceso previo o instancia sin autenticación).
# Permite enumerar opciones de 'security realm' y políticas de registro de usuarios.
curl -i -s -k -X GET "http://<TARGET_IP>:<PORT>/configureSecurity/"
```

## "Gotchas" y Troubleshooting
* **Puertos por defecto:** Generalmente corre sobre Tomcat en el puerto `8080`. Los ejemplos prácticos también muestran el puerto `8000`.
* **Puerto de arquitectura Master/Slave:** Prestar atención al puerto `5000`. Jenkins lo utiliza exclusivamente para la comunicación interna entre servidores maestros y esclavos.
* **Credenciales por defecto:** Nunca omitir probar la combinación `admin:admin`.
* **Frecuencia de exposición:** Aunque es un hallazgo clásico y sumamente común en pruebas de penetración internas, no se debe descartar en el perímetro; de manera rara, es posible encontrar instancias de Jenkins atacables expuestas externamente.
* **Perspectiva de AD:** Comprometer un Jenkins en Windows significa, casi por regla general, obtener un shell como `SYSTEM`. Tratar este servicio como una puerta de entrada directa al dominio.