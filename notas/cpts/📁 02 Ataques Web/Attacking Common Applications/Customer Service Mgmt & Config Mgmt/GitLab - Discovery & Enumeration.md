---
tags:
  - webapp
  - gitlab
  - enum
---
## Conceptos Clave (TL;DR)

* GitLab es una plataforma de repositorios Git que incluye wikis, seguimiento de problemas y pipelines CI/CD.
* El objetivo principal en esta fase es encontrar configuraciones, scripts o repositorios que contengan secretos en texto plano, claves SSH privadas o credenciales reutilizables.
* Los repositorios se dividen en tres niveles de visibilidad: públicos (sin autenticación), internos (solo usuarios autenticados) y privados (usuarios específicos).
* Una mala configuración común es permitir el libre registro de usuarios, lo que otorga acceso a los repositorios internos de la empresa.

  
## Herramientas Clave

* **Navegador Web / cURL:** Herramientas principales para interactuar con las rutas públicas, extraer información de repositorios y enumerar usuarios a través de los formularios.
* **Dehashed (o similares):** Mencionado para buscar credenciales en bases de datos filtradas (password dumps) una vez que se obtiene una lista válida de usuarios o correos electrónicos.

  
## Metodología Paso a Paso

### Fase 1: Footprinting y Detección de Versión
Navega a la aplicación web para confirmar la presencia de GitLab.  La versión exacta de GitLab normalmente solo puede visualizarse si tienes una cuenta autenticada navegando a la ruta de ayuda.

### Fase 2: Enumeración de Repositorios Públicos
Sin estar autenticado, revisa la ruta de exploración pública.  Analiza los proyectos listados, el código fuente y el historial de commits en busca de secretos, credenciales hardcodeadas o información sobre la infraestructura de la empresa.

### Fase 3: Registro y Acceso a Repositorios Internos
Intenta registrar una cuenta nueva. A menudo, las empresas no restringen el registro a correos corporativos o no requieren aprobación del administrador.  Si logras registrarte e iniciar sesión, vuelve a la ruta de exploración; ahora tendrás acceso a los repositorios "Internos" que antes estaban ocultos.

### Fase 4: Enumeración de Usuarios y Correos Electrónicos
Utiliza el formulario de registro para comprobar la existencia de usuarios.  Si introduces un nombre de usuario o correo que ya existe en la base de datos de GitLab, la aplicación devolverá un error específico, permitiéndote generar listas de usuarios válidos para ataques de fuerza bruta o credential stuffing.

## Cheat Sheet de Comandos
A continuación se presentan las rutas clave para interactuar con la instancia objetivo. Aunque gran parte de esto se realiza en el navegador, se pueden automatizar las peticiones.

```bash
# Navegar a la página de inicio de sesión para confirmar la instancia de GitLab
curl -s -I http://<TARGET_IP>:<PORT>/users/sign_in

  
# Revisar proyectos públicos, grupos y snippets (No requiere autenticación)
curl -s http://<TARGET_IP>:<PORT>/explore

  
# Obtener la versión de GitLab (Requiere estar autenticado con una sesión válida)
curl -s -b "session_cookie=<SESSION_TOKEN>" http://<TARGET_IP>:<PORT>/help
 

# Acceder al formulario de registro para intentar crear un usuario o enumerar los existentes
curl -s http://<TARGET_IP>:<PORT>/users/sign_up
```


## "Gotchas" y Troubleshooting

* **Enumeración sin Registro Habilitado:** Incluso si la opción "Sign-up enabled" está desactivada en la configuración, la página `/users/sign_up` puede seguir siendo accesible para realizar la enumeración de usuarios basándose en los mensajes de error.

* **Mensajes de Error Clave:** Durante la enumeración, busca los errores exactos: `"Email has already been taken"` y `"Username is already taken"`.

* **Peligro de Exploits a Ciegas:** No se recomienda lanzar exploits a ciegas contra la aplicación. Si no puedes enumerar la versión (mediante la página `/help`, fechas de commits o registrando un usuario), limítate a buscar secretos en repositorios en lugar de probar exploits al azar.  Existen vulnerabilidades críticas en versiones específicas (ej. 11.4.7, 12.9.0, 13.x), pero requieren confirmación de versión.

* **Falta de 2FA:** La autenticación de dos factores está deshabilitada por defecto en GitLab, lo que hace que los ataques de adivinación de contraseñas sean muy viables una vez obtenidos los nombres de usuario.