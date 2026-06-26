---
tags:
  - windows
  - privex
---
## Conceptos Clave (TL;DR)

- Un sistema entra en "End-of-Life" (EOL) cuando Microsoft deja de publicar actualizaciones de seguridad publicas para esa version. Antes de llegar a EOL pasa por un periodo de "soporte extendido".
- Sin parches oficiales, estos hosts quedan expuestos indefinidamente a fallos de RCE (ejecucion remota de codigo) y privilege escalation. Ejemplos historicos "wormable": EternalBlue (CVE-2017-0144) y SIGRed (CVE-2020-1350).
- Los OS heredados (XP, Server 2000/2003/2008) carecen de mitigaciones de seguridad presentes en versiones modernas (Win10 / Server 2016+), lo que hace la escalada de privilegios local significativamente mas sencilla.
- Es comun encontrar estos sistemas en universidades, hospitales, aseguradoras, utilities y gobiernos locales/estatales, normalmente porque sostienen software de mision critica sin soporte del fabricante original.

## Herramientas Clave

El texto fuente es puramente conceptual/metodologico y no menciona herramientas especificas (no se nombran nmap, msfconsole, searchsploit, etc.). Esta seccion se deja documentada para coherencia del formato; las herramientas de identificacion de version de SO y busqueda de exploits se cubren en otros modulos.

## Metodologia Paso a Paso

**Fase 1 - Identificacion / Enumeracion**
Durante el reconocimiento de un entorno grande, presta atencion especial a hosts que respondan como versiones antiguas de Windows (banners SMB, TTL, fingerprint de servicios). Estos host suelen aparecer en organizaciones con ciclos de actualizacion lentos (salud, gobierno, seguros, universidades).

**Fase 2 - Evaluacion de riesgo antes de atacar**
Antes de explotar cualquier host legacy, valida si es un sistema fragil que corre una aplicacion de mision critica. Un exploit (sobre todo RCE/wormable) puede causar un crash o denegacion de servicio en produccion.

**Fase 3 - Comunicacion con el cliente**
Si identificas un sistema EOL/legacy, es buena practica notificarlo al cliente (dentro del ROE) antes de lanzar exploits agresivos, para confirmar que no es un host critico/fragil y entender por que aun esta en produccion.

**Fase 4 - Explotacion**
Los hosts Server 2003 / Server 2008 (mas comunes que XP / Server 2000 en la practica) suelen ser vulnerables a uno o varios CVEs conocidos de RCE o de escalada de privilegios local. Suelen representar un excelente punto de apoyo (foothold) inicial en el entorno.

**Fase 5 - Reporte y recomendaciones**
Si el cliente no puede actualizar o retirar el sistema (limitaciones de coste/personal, dependencia de proveedor descontinuado), la recomendacion estandar es proponer segmentacion de red estricta para aislar el host legacy hasta que pueda ser tratado.

## Cheat Sheet de Comandos

El texto original no contiene comandos tecnicos (es contenido teorico sobre ciclos de vida de Windows). Como referencia rapida util para el examen, se documentan abajo las tablas de fechas EOL mencionadas y los CVEs criticos citados, para consulta durante la fase de enumeracion/reporte.

### Tabla de referencia - Windows Desktop EOL

| Version | Fecha EOL |
|---|---|
| Windows XP | 8 abril 2014 |
| Windows Vista | 11 abril 2017 |
| Windows 7 | 14 enero 2020 |
| Windows 8 | 12 enero 2016 |
| Windows 8.1 | 10 enero 2023 |
| Windows 10 1507 | 9 mayo 2017 |
| Windows 10 1703 | 9 octubre 2018 |
| Windows 10 1809 | 10 noviembre 2020 |
| Windows 10 1903 | 8 diciembre 2020 |
| Windows 10 1909 | 11 mayo 2021 |
| Windows 10 2004 | 14 diciembre 2021 |
| Windows 10 20H2 | 10 mayo 2022 |

### Tabla de referencia - Windows Server EOL

| Version | Fecha EOL |
|---|---|
| Windows Server 2003 | 8 abril 2014 |
| Windows Server 2003 R2 | 14 julio 2015 |
| Windows Server 2008 | 14 enero 2020 |
| Windows Server 2008 R2 | 14 enero 2020 |
| Windows Server 2012 | 10 octubre 2023 |
| Windows Server 2012 R2 | 10 octubre 2023 |
| Windows Server 2016 | 12 enero 2027 |
| Windows Server 2019 | 9 enero 2029 |

### CVEs criticos citados (para buscar exploit / modulo en el examen)

| CVE | Nombre | Tipo |
|---|---|---|
| CVE-2017-0144 | EternalBlue | RCE wormable (SMB) |
| CVE-2020-1350 | SIGRed | RCE wormable (Windows DNS Server) |
| MS08-067 | (sin CVE moderno asociado en el texto) | RCE en Server 2003 / XP, hoy poco comun de encontrar |

```bash
# Comando de apoyo (no extraido del texto, practica estandar) para
# verificar si existen exploits publicos conocidos para una version/CVE detectada
searchsploit <CVE_O_NOMBRE_VULN>
```

```bash
# Comando de apoyo para lanzar un modulo conocido contra un host legacy
# identificado como vulnerable (ejemplo generico, ajustar modulo segun CVE)
msfconsole -q -x "use exploit/<RUTA_MODULO>; set RHOSTS <TARGET_IP>; set LHOST <ATTACKER_IP>; run"
```

## Gotchas y Troubleshooting

- EOL no siempre significa "sin parches en absoluto": Microsoft puede seguir publicando actualizaciones de seguridad para grandes organizaciones mediante contratos de soporte personalizado a largo plazo.
- No asumas que un host legacy es facil de tumbar sin riesgo: muchos de estos sistemas sostienen aplicaciones de mision critica (comun en salud y gobierno local) cuyo proveedor original ya no existe o no da soporte.
- Siempre consulta con el cliente antes de explotar un host EOL identificado, especialmente si el exploit es de tipo RCE/wormable (riesgo de crash o DoS en produccion).
- En la practica, es mas comun encontrar Server 2003 y Server 2008 vulnerables que estaciones XP o Server 2000 vulnerables a MS08-067 (estas ultimas existen pero son raras).
- Si el cliente no puede actualizar/retirar el sistema, la mitigacion recomendada a reportar es segmentacion de red estricta como control compensatorio temporal.
- Las versiones modernas de Windows (10 / Server 2016+) incluyen protecciones de seguridad que no existen en versiones heredadas; esto explica por que la escalada de privilegios local es mas sencilla en sistemas antiguos durante la evaluacion.