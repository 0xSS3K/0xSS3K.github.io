---
tags:
  - AD
  - mitigation
---
## Conceptos Clave (TL;DR)

* El endurecimiento de Active Directory (AD) se divide en tres pilares: Personas, Procesos y Tecnología, con el objetivo de contener atacantes, prevenir el movimiento lateral y evitar la escalada de privilegios.
* Una postura de seguridad sólida comienza con una auditoría y documentación exhaustiva (convenciones de nombres, GPOs, roles FSMO, inventarios) antes de depender de herramientas costosas como EDR o SIEM.
* El grupo "Protected Users" mitiga el robo y abuso de credenciales en memoria al evitar el almacenamiento en texto claro e impedir el uso de protocolos débiles como NTLM, DES y RC4.

### Herramientas Clave

* **BloodHound, PingCastle y Grouper:** Herramientas utilizadas para identificar periódicamente vulnerabilidades y malas configuraciones dentro del entorno de AD.
* **LAPS (Local Administrator Password Solution):** Empleado para la administración y rotación automatizada de las contraseñas de cuentas de administrador local.
* **SIEM / EDR / NIDS / Firewalls:** Utilizados en conjunto para detectar reconocimiento de red, bloquear tráfico anómalo (como ráfagas de paquetes) y alertar sobre intentos de fuerza bruta o escaneo.

### Metodología Paso a Paso

* **Fase 1: Auditoría y Documentación Inicial**   Es necesario documentar todas las configuraciones de DNS, GPOs, asignación de roles FSMO, inventario de aplicaciones y relaciones de confianza (trusts) con otros dominios para conocer la superficie de ataque real.
* **Fase 2: Endurecimiento del Factor Humano y Cuentas**   Se deben implementar políticas de contraseñas fuertes (evitando palabras comunes) y rotar periódicamente las credenciales de las cuentas de servicio. Esto previene el éxito de ataques de Password Spraying.
* **Fase 3: Implementación de Procesos de Gestión**   Crear procedimientos estrictos para el aprovisionamiento y desaprovisionamiento de cuentas, así como la eliminación de registros obsoletos de AD para evitar el abuso de cuentas huérfanas.
* **Fase 4: Configuraciones Tecnológicas Preventivas**   Aplicar cambios de configuración en el entorno para mitigar vulnerabilidades conocidas. Esto incluye la restricción de delegaciones, desactivación de servicios innecesarios y la imposición de firmas en protocolos de comunicación.

### Cheat Sheet de Comandos

```powershell
# Mostrar informacion detallada de un grupo de AD, incluyendo su nombre, descripcion y miembros actuales. Ideal para auditar grupos de alta previlegiatura.

Get-ADGroup -Identity "<GROUP_NAME>" -Properties Name,Description,Members
```

### Problemas

* **Reconocimiento Externo e Interno:** Los atacantes recopilan información a través de fuentes públicas (metadatos, BGP) o escaneos activos de red para planificar su ataque.
* **Envenenamiento y Man-in-the-Middle:** Manipulación del tráfico de red para interceptar o retransmitir (relay) autenticaciones.
* **Password Spraying:** Intentos sistemáticos de adivinar contraseñas comunes contra múltiples usuarios del dominio.
* **Enumeración con Credenciales y LOTL (Living off the Land):** Abuso de credenciales legítimas y uso de herramientas nativas del sistema operativo para evadir la detección durante el movimiento lateral.
* **Kerberoasting:** Extracción de tickets de servicio para romper sus hashes offline.

### Soluciones

* **Gestión de Administradores Locales:** Deshabilitar la cuenta RID-500 por defecto, crear una nueva cuenta administrativa y someterla a rotación mediante LAPS.
* **Protección contra Kerberoasting:** Utilizar cuentas Group Managed Service Accounts (gMSA) o Managed Service Accounts (MSA) en lugar de cuentas de servicio normales, y deshabilitar el cifrado RC4 a favor de esquemas más fuertes.
* **Prevención de Ataques noPac y RBCD:** Establecer el atributo `ms-DS-MachineAccountQuota` en 0 para evitar que usuarios estándar agreguen cuentas de máquina al dominio.
* **Defensa contra Relay y Enumeración:** Habilitar las firmas SMB y LDAP. Configurar la clave de registro `RestrictNullSessAccess` en 1 para bloquear la enumeración de sesiones nulas.
* **Saneamiento de Entorno:** Deshabilitar el servicio Print Spooler y la autenticación NTLM en los Controladores de Dominio, además de auditar el recurso SYSVOL para asegurar que no contenga scripts con contraseñas en texto claro.
* **Protección de Datos Públicos:** Limpiar (scrubbing) los metadatos de los documentos antes de hacerlos públicos y evitar la publicación de detalles sobre la infraestructura interna en ofertas de empleo.

### "Gotchas" y Troubleshooting

* **Riesgos del Grupo Protected Users:** Colocar usuarios en este grupo puede causar problemas imprevistos de autenticación y bloqueos de cuenta. Las organizaciones nunca deben colocar usuarios privilegiados en este grupo sin realizar pruebas escalonadas primero.
* **Limitaciones del Grupo Protected Users:** Aunque protege contra delegación no restringida y restringida, colocar cuentas en este grupo puede no deshabilitar ciertos tipos de delegación a nivel de configuración administrativa si no se ajustan las propiedades de la cuenta.
* **Dificultad de Detección:** El reconocimiento externo y la enumeración con credenciales válidas son extremadamente difíciles de defender de forma preventiva. Una vez que el atacante tiene credenciales válidas, las defensas dependen casi por completo de la detección de anomalías y la segmentación de la red.
