---
tags:
  - AD
  - attack
---
## Conceptos Clave (TL;DR)

* La auditoría profunda de Active Directory (AD) permite recopilar evidencia contundente sobre configuraciones deficientes, justificando técnica y visualmente la necesidad de remediación.
* La metodología se basa en tomar capturas (snapshots) de la base de datos para análisis offline, evaluar el riesgo a nivel de dominio mediante frameworks de madurez, y escrutar las Políticas de Grupo (GPO).
* Estas técnicas suelen ser "ruidosas" y están enfocadas en despliegues donde el sigilo no es un requisito prioritario (como pruebas de caja blanca o auditorías internas).

### Herramientas Clave

* **Active Directory Explorer (AD Explorer):** Visor y editor avanzado de la suite Sysinternals. Permite navegar la estructura, ver propiedades y permisos, y tomar "snapshots" del AD para análisis y comparaciones offline.
* **PingCastle:** Evaluador rápido de la postura de seguridad del AD. Genera mapas, gráficos y un informe de madurez/riesgo (basado en CMMI) identificando vulnerabilidades, confianzas y delegaciones.
* **Group3r:** Herramienta especializada en auditar y encontrar vulnerabilidades exclusivamente en las configuraciones de Group Policy (GPO).
* **ADRecon:** Script de extracción masiva que recopila una gran cantidad de datos del dominio (usuarios, GPOs, LAPS, BitLocker, etc.) y genera reportes en HTML, CSV y Excel.

### Metodología Paso a Paso

1. **Captura del Estado Actual del AD (AD Explorer):**    \* _Lógica:_ Antes de interactuar agresivamente, se extrae un "snapshot" de la base de datos utilizando credenciales de un usuario de dominio estándar. Esto permite revisar atributos, permisos y el esquema de forma pasiva y sin generar tráfico continuo en el DC.
2. **Evaluación de Riesgo a Nivel Dominio (PingCastle):**    \* _Lógica:_ Se ejecuta el módulo interactivo o la opción "healthcheck" para establecer una línea base. Esto automatiza la revisión de vulnerabilidades conocidas (ej. ZeroLogon, Spooler), listas de control de acceso (ACLs) y recursos compartidos de forma rápida.
3. **Auditoría Específica de Políticas de Grupo (Group3r):**    \* _Lógica:_ Dado que las GPO controlan el comportamiento de todos los objetos, se analiza su estructura. Se busca encontrar rutas u objetos vulnerables que otros escáneres genéricos suelen pasar por alto.
4. **Recolección Integral de Datos (ADRecon):**    \* _Lógica:_ Ejecutar una extracción masiva de artefactos del dominio al finalizar las enumeraciones manuales. Garantiza que no se omita información útil sobre políticas de contraseñas, LAPS, BitLocker, DNS o subredes.

### Cheat Sheet de Comandos

```cmd
# ==========================================
# PINGCASTLE
# ==========================================
 

# Ver el menú de ayuda y opciones disponibles de PingCastle
PingCastle.exe --help

  
# Ejecutar el "healthcheck" apuntando a un DC específico con credenciales explícitas
PingCastle.exe --server <DOMAIN_CONTROLLER_IP_OR_FQDN> --user <USERNAME> --password <PASSWORD>

  
# ==========================================
# GROUP3R
# ==========================================

  
# Ejecutar Group3r guardando los resultados directamente en un archivo de log
group3r.exe -f <OUTPUT_FILE>.log

  
# Ejecutar Group3r y mostrar los resultados en la salida estándar (consola)
group3r.exe -s
```

```powershell
# ==========================================
# ADRECON
# ==========================================

# Ejecutar el script completo de ADRecon para extraer información de AD
# Requiere estar en una máquina unida al dominio o ejecutarse bajo contexto de dominio
.\ADRecon.ps1

  
# Generar un reporte en Excel a partir de los archivos CSV extraídos previamente
# Utilizar si el host donde se corrió ADRecon inicialmente no tenía Excel instalado
.\ADRecon.ps1 -GenExcel <PATH_TO_ADRECON_REPORT_FOLDER>
```

### "Gotchas" y Troubleshooting

* **PingCastle - Error de Fecha (End of Support):** Si la herramienta falla al iniciar, cambia la fecha del sistema a un día anterior al 31 de Julio de 2023 desde el Panel de Control.
* **Group3r - Requisitos de Ejecución:** Debe ejecutarse desde un equipo unido al dominio con un usuario del dominio (no requiere ser admin). Si se ejecuta desde un equipo no unido, debe usarse el contexto de un usuario del dominio mediante `runas /netonly`.
* **Group3r - Lectura de Resultados:** El output utiliza indentación para indicar jerarquía. Cero indentación = GPO; una indentación = Configuración de la política; dos indentaciones = Hallazgo/Vulnerabilidad específica.
* **ADRecon - Dependencia de Excel:** Para que genere automáticamente el reporte final unificado, Microsoft Excel debe estar instalado en la máquina desde donde se ejecuta. Si no lo está, solo se generarán archivos `.csv`.
* **ADRecon - Dependencia de GPOs:** Si deseas que extraiga la información correspondiente a las Group Policies, el host desde el cual ejecutas el script debe tener instalado el módulo de PowerShell "GroupPolicy".
* **PingCastle - Ruido en la Red:** Utilizar las opciones del escáner (Scanner options) contra múltiples estaciones de trabajo simultáneamente puede levantar múltiples alertas de seguridad en un entorno monitoreado.
