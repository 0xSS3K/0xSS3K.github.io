---
tags:
  - mitigation
  - password
---
## Conceptos Clave (TL;DR)

* Una política de contraseñas abarca el ciclo de vida completo: creación, almacenamiento, gestión y transmisión. Se divide en definición (las reglas y expectativas) y aplicación o enforcement (la tecnología utilizada para obligar su cumplimiento).

* Los estándares de la industria (como NIST SP800-63B, CIS Password Policy Guide y PCI DSS) establecen una lineal base para los controles. Sin embargo, la industria actual recomienda deshabilitar la expiración de contraseñas porque frecuentemente fomenta patrones débiles y predecibles en los usuarios.

* Las frases de contraseña (passphrases) largas, compuestas por palabras ordinarias o letras de canciones, suelen ser mas efectivas y fáciles de recordar que cadenas cortas de alta complejidad que resultan difíciles de memorizar.


## Herramientas Clave

* **PasswordMonster**: Herramienta utilizada para evaluar la fortaleza y el tiempo de craqueo estimado de una contraseña.

* **1Password Password Generator**: Herramienta enfocada en la generación de contraseñas seguras y complejas.

* **Active Directory (Group Policy Objects - GPO)**: Utilizado para aplicar técnicamente y de forma centralizada las políticas de contraseñas en entornos corporativos.

  
## Metodologia Paso a Paso

Dado que este texto base es conceptual y defensivo, la metodología se centra en la definición y aplicación de controles corporativos:

  
1. **Definición de la Política Base**
   Establecer una longitud mínima (por ejemplo, 8 caracteres) y requisitos de complejidad estándar (letras mayúsculas, minúsculas, números y caracteres especiales).

2. **Implementación de Listas Negras (Blacklists)**
   Restringir términos predecibles en la creación de contraseñas. Estas listas deben bloquear: el nombre de la empresa, palabras asociadas a la misma, meses, estaciones del ano, y variaciones de palabras como "welcome" o "password".

3. **Aplicacion Tecnica (Enforcement)**
   Configurar las soluciones de gestión de identidades o sistemas de autenticación (como Active Directory Password Policy GPO) para que el sistema rechace automáticamente las contraseñas que no cumplan la política definida.

4. **Educación y Gestión**
   Comunicar la política a los empleados. Fomentar el uso de gestores de contraseñas para evitar la carga mental de memorizar múltiples credenciales fuertes y mitigar la reutilización.


## "Gotchas" y Troubleshooting

* **Falso Sentido de Seguridad (Complejidad vs Predictibilidad)**: Una contraseña como `NombreEmpresa01!` puede cumplir con todas las reglas de complejidad, pero sigue siendo extremadamente débil y susceptible a ser adivinada.

* **El Problema de la Mutación de Contraseñas**: Las políticas de expiración (ej. cambiar credenciales cada 60 o 90 días) provocan que los usuarios simplemente incrementen un numero al final de su contraseña anterior (cambiando `01` a `02`). Los atacantes conocen este comportamiento de mutación y lo incorporan en sus diccionarios de ataque.

* **OSINT contra Passphrases**: Aunque las frases de contraseña (ej. `The name of my dog is Popy`) son robustas matemáticamente , si incluyen información personal (como el nombre de una mascota), los atacantes pueden adivinarlas mediante técnicas de recolección de información de fuentes abiertas (OSINT).