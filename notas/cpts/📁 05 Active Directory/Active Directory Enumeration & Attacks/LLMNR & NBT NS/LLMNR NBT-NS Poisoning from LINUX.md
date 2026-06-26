---
tags:
  - LLMNR
  - Poisoning
  - linux
  - NBT-NS
  - AD
---
## Conceptos Clave (TL;DR)

* LLMNR y NBT-NS son componentes de Microsoft Windows que sirven como métodos alternativos de identificación de hosts cuando falla la resolución DNS.
* Si la resolución DNS falla, la máquina realiza una solicitud de difusión (broadcast) a toda la red local preguntando por la ubicación del host. Cualquier host en la red puede responder a estas solicitudes.
* Un atacante puede falsificar una fuente de resolución de nombres autoritativa para engañar a la víctima y hacer que se comunique con el sistema atacante.
* El objetivo es capturar hashes NetNTLM (NTLMv1 o NTLMv2) para realizar ataques de fuerza bruta offline o ejecutar un ataque SMB Relay.

  
## Herramientas Clave

* **Responder:** Herramienta escrita en Python, diseñada específicamente para envenenar LLMNR, NBT-NS y MDNS.
* **Inveigh:** Plataforma MITM multiplataforma (escrita en C# y PowerShell) para ataques de spoofing y envenenamiento.
* **[Metasploit](../../../📂%2008%20Herramientas&Cheatsheets/Metasploit.md):** Contiene escáneres integrados y módulos de spoofing para ataques de envenenamiento.
* **[Hashcat](../../../📂%2008%20Herramientas&Cheatsheets/Hashcat.md) / John the Ripper:** Herramientas utilizadas para intentar crackear los hashes capturados offline.

  
## Metodología Paso a Paso

1. **Fase 1: Enumeración Pasiva (Analyze Mode)** Ejecutar Responder en modo de análisis permite observar las solicitudes de resolución en la red sin enviar paquetes envenenados, actuando de forma pasiva.
2. **Fase 2: Envenenamiento de la Red** Iniciar Responder de manera activa para escuchar y responder a cualquier solicitud LLMNR/NBT-NS en la red. Es recomendable dejar la herramienta ejecutándose durante un tiempo prolongado en segundo plano (ej. tmux) para maximizar la recolección de hashes.
3. **Fase 3: Captura de Hashes** Una vez que el host víctima acepta la respuesta falsificada, envía una solicitud de autenticación que contiene el hash NTLMv2, el cual es capturado y guardado por Responder.
4. **Fase 4: Cracking Offline** Extraer los hashes capturados y utilizar herramientas como Hashcat para obtener la contraseña en texto claro, logrando así un punto de apoyo inicial en el dominio.

  
## Cheat Sheet de Comandos
```bash
# Muestra el menú de ayuda y las opciones disponibles en Responder

responder -h
```
  
```bash
# Ejecuta Responder en modo Análisis (-A) sobre una interfaz específica (-I) para escuchar sin envenenar la red

sudo responder -I <INTERFACE> -A
```
  
```bash
# Ejecuta Responder activamente. -I: Interfaz. -w: Inicia WPAD rogue proxy server. -r: Responde a consultas wredir. -f: Realiza fingerprinting del sistema operativo del host remoto

sudo responder -I <INTERFACE> -wrf
```
  
```bash
# Crackea un hash NetNTLMv2 offline usando Hashcat. -m 5600 especifica el tipo de hash NTLMv2 para diccionarios locales

hashcat -m 5600 <HASH_FILE_PATH> <WORDLIST_PATH>
```

  

## "Gotchas" y Troubleshooting

* **Privilegios:** Responder debe ejecutarse con privilegios de root o sudo.

* **Puertos Requeridos:** Requiere que múltiples puertos estén disponibles en la máquina atacante, incluyendo UDP 137, 138, 53, 5355 y TCP 80, 139, 445, entre otros. Los servidores no autorizados (ej. SMB) pueden desactivarse modificando el archivo `Responder.conf`.

* **Riesgo de Interrupción:** Responder a sufijos de dominio (`-d`) o wredir (`-r`) probablemente romperá cosas en la red.

* **Alertas de Usuario:** Forzar la autenticación WPAD (`-F`) o Proxy (`-P`) puede provocar que aparezca una ventana de inicio de sesión (login prompt) a los usuarios, por lo que deben usarse con moderación.

* **Ubicación de Logs:** Si Responder tiene éxito, los hashes se guardan en `/usr/share/responder/logs` con el formato `(MODULE_NAME)-(HASH_TYPE)-(CLIENT_IP).txt` y también en una base de datos SQLite.

* **Limitaciones del Hash:** Los hashes NetNTLMv2 capturados no pueden usarse para técnicas de Pass-the-Hash; deben ser obligatoriamente crackeados offline o utilizados en un ataque de SMB Relay.

* **Hashcat Modes:** Los hashes NTLMv2 requieren el modo `5600` en Hashcat. Se puede consultar la página de ejemplos de Hashcat para identificar la estructura de hashes desconocidos (ej. NTLMv1).