---
tags:
  - mitigation
  - password
---
## Conceptos Clave (TL;DR)

* Los usuarios gestionan un promedio de 100 contraseñas, lo que fomenta la creación de credenciales débiles y la reutilización de las mismas.

* Un gestor de contraseñas almacena credenciales en una base de datos cifrada, integrando funciones como generación segura, soporte 2FA y sincronización entre dispositivos.

* La seguridad se basa en funciones hash criptográficas y algoritmos de derivación de claves para proteger el acceso a la base de datos.

* La autenticación "Passwordless" elimina la dependencia de un "factor de conocimiento" (vulnerable a robos o reutilización) en favor de un "factor de posesión" o un "factor inherente".
  

## Herramientas Clave

* **Gestores Cloud:** 1Password, Bitwarden, Dashlane, Keeper, Lastpass, NordPass, RoboForm. Sincronizan la base de datos cifrada a través de múltiples dispositivos.

* **Gestores Locales:** KeePass, KWalletManager, Pleasant Password Server, Password Safe. Almacenan la base de datos localmente, delegando la responsabilidad de protección al usuario.

* **Hardware / Autenticación Alternativa:** Dispositivos físicos como YubiKey que utilizan el estándar abierto FIDO2 para inicios de sesión sin contraseña.
  

## Metodología Paso a Paso

Dado que este módulo es de naturaleza teórica y arquitectónica, la "metodología" se enfoca en comprender el flujo de derivación de claves en gestores Cloud (ej. Bitwarden) para identificar vectores de ataque en implementaciones personalizadas.

1. **Derivación de Clave Maestra:** El sistema utiliza una función de derivación de claves (como PBKDF2-SHA256) sobre la contraseña maestra provista por el usuario para generar la clave maestra.

2. **Generación de Hash para Autenticación:** Se genera un hash de la contraseña maestra (frecuentemente usando también la clave maestra) que se envía al servicio en la nube para autenticar al usuario bajo el modelo de "Zero-Knowledge Encryption".

3. **Descifrado de la Bóveda:** La clave maestra se utiliza para formar una clave simétrica (como AES-256), la cual se encarga de descifrar localmente los elementos de la bóveda.

  
## Cheat Sheet de Comandos

*Nota del Pentester: El texto analizado corresponde a fundamentos teóricos de arquitectura y no incluye vectores de explotación activos ni comandos de consola para esta sección.*

## "Gotchas" y Troubleshooting

* **Responsabilidad en Gestores Locales:** A diferencia de los modelos en la nube, si el objetivo utiliza un gestor local, la base de datos reside en el sistema de archivos del objetivo. El almacenamiento, la transmisión y la protección recaen en el usuario.

* **Mecanismos Defensivos Locales:** Las implementaciones locales modernas utilizan "random salt" en sus funciones de derivación para mitigar ataques de diccionario e invalidar ataques con claves precalculadas (Rainbow Tables).

* **Evasión de Keyloggers y Memoria:** Algunos gestores locales emplean protección de memoria y entornos de escritorio seguros (similares a UAC en Windows) para resistir keyloggers, lo que dificultará la extracción de la contraseña maestra post-explotación.

* **Alternativas a Contraseñas:** Si el entorno restringe el uso de contraseñas, busca configuraciones de OTP, TOTP, restricciones por IP o integraciones de MDM/Cumplimiento de dispositivos como Microsoft Endpoint Manager o Workspace ONE.