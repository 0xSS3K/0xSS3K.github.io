---
tags:
  - linux
  - prevention
  - mitigation
  - privex
---
## Conceptos Clave (TL;DR)

- El hardening adecuado de Linux elimina casi todas las oportunidades de privesc local. Leído al revés: **cada control de hardening ausente es un vector de escalada**. Esta checklist es tu mapa de enumeración.
- "Low hanging fruit" más explotable: kernels/servicios desactualizados con exploits públicos, binarios con bit SUID, cron jobs y sudo sin ruta absoluta (PATH hijacking), credenciales en texto plano en archivos world-readable, e historial de bash.
- **Lynis** es la herramienta de auditoría de configuración para sistemas Unix (Linux/macOS/BSD) que usan tanto defensores como pentesters para sacar un "baseline" de seguridad y, textualmente, **informar rutas de escalada de privilegios**.
- Auditoría != pentest. La revisión de configuración (manual o con Lynis) complementa, pero NO reemplaza, la enumeración manual y el testing hands-on.

## Herramientas Clave

- **Lynis** - Auditoría de configuración/hardening de Unix. Devuelve `Warnings` y `Suggestions` con un Control ID cada uno. Para ti: enumeración rápida de misconfigs en una máquina ya comprometida.
- **unattended-upgrades** (Ubuntu/Debian) - Parcheo automático. Por defecto desde Ubuntu 18.04. Su presencia/ausencia indica si esperar kernels viejos.
- **yum-cron** (Red Hat/RHEL) - Equivalente de parcheo automático en sistemas Red Hat.
- **Puppet / SaltStack / Zabbix / Nagios** - Automatización de config management. Zabbix usa el item `vfs.file.cksum` para verificación de integridad/checksum de binarios sensibles (detecta binarios manipulados).
- **DISA STIGs / ISO27001 / PCI-DSS / HIPAA** - Baselines y frameworks de referencia (contexto de auditoría, no comandos).

## Metodología Paso a Paso

### Fase 1 - Auditoría automatizada rápida (Lynis)
La lógica: en lugar de revisar 256 controles a mano, lanzas Lynis sobre la caja comprometida para que enumere misconfigs y te apunte rutas de privesc en minutos. El **Hardening Index** te dice de un vistazo cómo de jugosa es la máquina (índice bajo = muchas misconfigs).

1. Clonar el repo y ejecutar `./lynis audit system`.
2. Leer la sección `Warnings` primero (problemas activos, ej. cronjobs con permisos incorrectos = privesc directo).
3. Revisar `Suggestions` para hardening ausente que puedas explotar.
4. Abrir los archivos de log/reporte para el detalle (la consola solo muestra el resumen).

### Fase 2 - Mapeo inverso del checklist de hardening a vectores de privesc
La lógica: cada punto que un sysadmin "debería" endurecer es exactamente lo que tú buscas que NO esté endurecido.

1. **Updates/Patching** -> Comprobar versión de kernel y de servicios contra exploits públicos conocidos.
2. **Writable files/dirs + binarios SUID** -> Auditar archivos/directorios escribibles y todo binario con bit SUID.
3. **Cron jobs y sudo sin ruta absoluta** -> Oportunidad de PATH hijacking / inyección de binario.
4. **Credenciales en texto plano** -> Buscar secretos en archivos world-readable.
5. **Home dirs e historial de bash** -> Revisar `.bash_history` y home dirs por credenciales/info filtrada.
6. **Librerías custom modificables** -> Si un usuario sin privilegios puede modificar una librería que llama un programa privilegiado -> library hijacking.
7. **Pertenencia a grupos / sudo excesivos** -> Buscar violaciones del principio de mínimo privilegio (grupos con derechos de más).
8. **SELinux ausente** -> Sin controles de acceso adicionales, los vectores anteriores son más directos.

## Cheat Sheet de Comandos

```bash
# Paso previo descrito en el texto: clonar el repositorio completo de Lynis.
# (CISOfy/lynis es el repo oficial). Entrar al directorio para ejecutar el binario local.
git clone https://github.com/CISOfy/lynis
cd lynis

# Ejecutar la auditoria completa del sistema.
# 'audit system' = perfil que corre los 256+ tests de configuracion y hardening.
# Sin root, arranca en NON-PRIVILEGED SCAN MODE (saltea tests que requieren privilegios).
./lynis audit system
```

```bash
# Localizacion del output detallado tras la ejecucion (NO sale en consola, solo el resumen).
# <USER> = la cuenta con la que corriste Lynis (en el modulo era 'mrb3n').
cat /home/<USER>/lynis.log          # Test & debug information (detalle completo de cada test)
cat /home/<USER>/lynis-report.dat   # Report data (datos estructurados del reporte)
```

```text
# (Zabbix) Item key mencionado en el texto para verificar checksum/integridad de un binario sensible.
# Util para detectar si un binario privilegiado fue manipulado (o para localizar el control que lo audita).
vfs.file.cksum[/ruta/al/binario]
```

## "Gotchas" y Troubleshooting

- **NON-PRIVILEGED SCAN MODE**: si ejecutas Lynis sin root, algunos tests se saltan, fallan en silencio o dan resultados distintos. **Corre como root** para checks completos -> el texto confirma que así "realiza aún más comprobaciones" y es más útil para rutas de privesc.
- **El detalle no está en consola**: la terminal solo muestra warnings, suggestions y el resumen. El detalle real está en `/home/<USER>/lynis.log` y `/home/<USER>/lynis-report.dat`.
- **Hardening Index** (ej. `60 [############        ]`): úsalo como termómetro rápido. Índice bajo = caja con muchas misconfigs = más vías de escalada.
- **Control IDs**: cada warning/suggestion trae un ID (ej. `SCHD-7704`, `BOOT-5122`, `KRNL-5820`, `AUTH-9228`, `AUTH-9230`). Puedes consultar cada control en `https://cisofy.com/lynis/controls/<ID>/`.
- **Warning de oro para privesc**: `SCHD-7704` = "cronjob files with incorrect file permissions". Cron + permisos malos suele ser escalada directa. Priorízalo.
- **Multiplataforma**: Lynis no es solo Linux; corre también en macOS y BSD.
- **Indicador de parcheo**: `unattended-upgrades` viene por defecto en Ubuntu 18.04+ (instalable desde 10.04 / Debian pre-Jessie); en RHEL el equivalente es `yum-cron`. Su ausencia sugiere que esperes kernels/servicios viejos explotables.
- **Aviso para el examen**: Lynis es ruidoso (256 tests) y automatizado. Complementa, NO reemplaza, tu enumeración manual (LinPEAS, LinEnum, checks a mano). No bases tu privesc solo en su output; valida los hallazgos.