---
tags:
  - enum
  - webapp
  - CMS
---
## Conceptos Clave (TL;DR)

- El objetivo es construir un inventario de aplicaciones web expuestas en el scope antes de atacar: identificar CMS, paneles de administración, servicios con credenciales por defecto o versiones vulnerables.
- El flujo es iterativo: ping sweep -> port scan (puertos web comunes) -> screenshotting masivo -> identificacion de high-value targets -> escaneo mas profundo sobre hosts seleccionados.
- EyeWitness y Aquatone consumen el XML de Nmap y generan un reporte HTML con screenshots categorizados, lo que permite revisar decenas o cientos de hosts en minutos en lugar de navegar manualmente a cada uno.
- Hosts con `dev`, `qa`, `acc` en el FQDN son prioritarios: suelen tener debug mode activo, autenticacion relajada, o codigo no testeado. GitLab/repositorios internos pueden filtrar credenciales en commits historicos.

## Herramientas Clave

- **Nmap**: escaneo de puertos y deteccion de servicios; genera el XML que alimenta las demas herramientas.
- **EyeWitness**: screenshotting masivo desde XML de Nmap o Nessus; categoriza apps, fingerprinta y sugiere credenciales por defecto.
- **Aquatone**: screenshotting masivo desde XML de Nmap o Masscan; agrupa paginas similares y genera reporte HTML con seccion "High Value Targets".
- **Nessus** (complementario): escaneo de vulnerabilidades; su XML tambien es compatible con EyeWitness.

## Metodologia Paso a Paso

### Fase 1: Escaneo inicial de puertos web comunes

Ejecutar un primer Nmap rapido contra los puertos web mas frecuentes para obtener el XML base que usaran EyeWitness y Aquatone. Se usan `--open` para filtrar solo puertos abiertos y `-oA` para guardar en todos los formatos (incluyendo XML).

### Fase 2: Screenshotting masivo

Alimentar el XML generado en la fase anterior a EyeWitness y/o Aquatone. El reporte HTML resultante organiza los hosts por categorias ("High Value Targets" primero). Revisar el reporte completo sin saltarse paginas: hosts criticos pueden aparecer al final.

### Fase 3: Escaneo de servicios sobre hosts seleccionados

Una vez identificados los hosts de interes en el reporte, ejecutar un escaneo `-sV` (deteccion de version) contra esos targets especificos para confirmar que aplicacion y version exacta esta corriendo. Esto guia la busqueda de exploits y el intento de credenciales por defecto.

### Fase 4: Escaneo profundo en paralelo

Mientras se revisa el reporte inicial, lanzar en paralelo un escaneo de top 10.000 puertos o todos los puertos TCP contra el scope completo. Pasar el nuevo XML por EyeWitness/Aquatone para garantizar cobertura maxima.

### Fase 5: Registro y priorización

Documentar cada aplicacion identificada con URL, puerto, nombre/version de la app y observaciones. Priorizar:

1. Paneles admin con credenciales por defecto (Tomcat `/manager`, Splunk, PRTG, ManageEngine)
2. Aplicaciones con versiones publicamente vulnerables (osTicket, Drupal)
3. Repositorios de codigo (GitLab) - registrar cuenta si permite self-registration
4. Hosts `dev`/`qa` con posibles configuraciones debiles

## Cheat Sheet de Comandos

```bash
# Escaneo inicial de puertos web comunes contra una lista de scope
# -p: puertos objetivo | --open: solo puertos abiertos | -oA: output en todos los formatos | -iL: lista de hosts/IPs como input
sudo nmap -p 80,443,8000,8080,8180,8888,10000 --open -oA web_discovery -iL <SCOPE_LIST_FILE>
```

```bash
# Escaneo de version de servicios contra un host especifico de interes
# --open: filtrar puertos abiertos | -sV: deteccion de version/banner
sudo nmap --open -sV <TARGET_IP>
```

```bash
# Escaneo profundo contra un host (top 10000 puertos) para cobertura maxima
# --open: solo abiertos | -sV: version | --top-ports: los N puertos mas comunes
sudo nmap --open -sV --top-ports 10000 <TARGET_IP> -oA deep_scan_<TARGET_IP>
```

```bash
# Instalar EyeWitness via apt
sudo apt install eyewitness
```

```bash
# Ejecutar EyeWitness con output XML de Nmap
# --web: modo HTTP via Selenium | -x: archivo XML de Nmap/Nessus como input | -d: directorio de output del reporte
eyewitness --web -x web_discovery.xml -d <OUTPUT_DIRECTORY>
```

```bash
# Ejecutar EyeWitness con una lista de URLs en texto plano
# -f: archivo con URLs (una por linea) | --web: modo HTTP | --no-prompt: no pedir confirmacion interactiva
eyewitness --web -f <URL_LIST_FILE> --no-prompt -d <OUTPUT_DIRECTORY>
```

```bash
# Descargar Aquatone (binario precompilado para Linux x64)
wget https://github.com/michenriksen/aquatone/releases/download/v1.7.0/aquatone_linux_amd64_1.7.0.zip

# Descomprimir el binario
unzip aquatone_linux_amd64_1.7.0.zip

# Mover el binario a un directorio en $PATH para uso global
sudo mv aquatone /usr/local/bin/
```

```bash
# Ejecutar Aquatone con output XML de Nmap (via pipe)
# -nmap: indica que el input es un XML de Nmap
cat web_discovery.xml | aquatone -nmap
```

```bash
# Ejecutar Aquatone con output XML de Nmap especificando directorio de output
cat web_discovery.xml | aquatone -nmap -out <OUTPUT_DIRECTORY>
```

```bash
# Crear un scope_list de ejemplo (formato: un host/IP por linea)
cat << EOF > scope_list
<FQDN_1>
<FQDN_2>
<TARGET_IP>
EOF
```

## "Gotchas" y Troubleshooting

- **Revisar el reporte HTML completo**: la seccion "High Value Targets" aparece primero, pero hosts criticos pueden estar enterrados en categorias "Uncategorized" o al final del reporte. No saltarse paginas.
- **Aquatone y Masscan**: Aquatone acepta XML de Masscan ademas de Nmap. EyeWitness acepta XML de Nessus. Combinar segun las herramientas disponibles.
- **Timeout en EyeWitness**: si aparece `Hit timeout limit`, el host puede ser lento pero accesible. Aumentar el timeout con `--timeout <SEGUNDOS>` (default: 7).
- **Splunk en modo trial expirado**: puede convertirse a una version sin autenticacion requerida. Siempre intentar acceso directo aunque parezca protegido.
- **Tomcat `/manager` y `/host-manager`**: si son accesibles, intentar credenciales por defecto (`tomcat:tomcat`, `admin:admin`, `tomcat:s3cret`). Acceso = upload de WAR malicioso = RCE.
- **GitLab self-registration**: verificar si permite registrar un usuario sin aprobacion de admin. Una vez dentro, revisar repos publicos y privados (si aplica) y commits historicos buscando credenciales hardcodeadas.
- **Impresoras y paneles de red internos (Internal PT)**: los paneles de impresoras pueden filtrar credenciales LDAP en texto claro. Incluirlos en el scope de screenshotting.
- **Puertos alternativos comunes a no omitir**: 8009 (AJP - Tomcat, vector para Ghostcat), 8089 (Splunk SSL), 8180 (Tomcat alternativo), 8888, 10000 (Webmin), 8181, 4848 (GlassFish).
- **AJP en Nmap output**: si se ve el puerto 8009 abierto (`ajp13`), es un indicador directo de Tomcat y potencialmente vulnerable a Ghostcat (CVE-2020-1938).
- **Hosts `dev`/`qa`/`acc`**: no están siempre en el DNS publico. Si el scope incluye rangos de red, buscar activamente con `--resolve` en EyeWitness o fuerza bruta de subdominios (gobuster/ffuf con wordlist de subdominios).
- **Documentacion**: timestampear cada escaneo (comando exacto, hosts objetivo, hora inicio/fin). Ante cualquier incidente durante el engagement, el cliente pedira logs de actividad.
- **No atacar durante discovery**: la fase de screenshotting es pasiva/informativa. Atacar prematuramente puede causar bloqueos de IP o alertas que compliquen el resto del engagement.