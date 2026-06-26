---
title: "enum // wordpress"
date: 2026-05-31
description: "metodología de enumeración sobre un objetivo wordpress: fingerprinting, temas y plugins, usuarios, abuso de xml-rpc..."
tags: ["wordpress", "web", "enumeracion", "recon"]
draft: false
---

Wordpress mueve cerca del 40% de la web en la actualidad. Eso lo vuelve casi omnipresente y, a la vez, terreno conocido.
Después de 20 años de desarrollo, WP está bastante maduro en seguridad por lo que rara vez se encuentran fallos en esta app en sí. El problema son los temas y plugins de terceros que se instalan.

Antes que nada tienes que saber que  wordpress trae cinco roles por defecto: suscriptor, colaborador, autor, editor y administrador. Admin es básicamente rce, porque el editor de temas y plugins te deja escribir php directo al disco*. Pero no subestimes a
los otros roles. Un autor o un editor suele tener acceso a funcionalidad de plugins que una petición
anónima jamás alcanza, así que una credencial de bajo privilegio es un buen punto de partida.

---

## fase 0 — confirmar que es wordpress

Empieza pasivo. Casi siempre se puede identificar wordpress sin mandar nada que parezca un ataque,
porque el código fuente tiene hartos datos.

```bash
# rutas wp-content / wp-includes y la meta tag generator
curl -s http://target/ | grep -iE 'wp-content|wp-includes|generator'

# robots.txt casi siempre bloquea los directorios de admin e includes en una instalación wp
curl -s http://target/robots.txt
```

Si `/robots.txt` deshabilita `/wp-admin/` y `/wp-includes/`, ojete. Lo mismo con
cualquier asset que cargue desde `/wp-content/`. Una sola de estas pistas ya alcanza para saber qué
tienes delante.

También ten en cuenta que en el mundo real los sitios suelen estar tras un waf, por lo que llegar y lanzar un wpscan en blackbox no sería lo más óptimo.

---

## fase 1 — versión del núcleo

La versión define casi todo lo que viene después: qué cves aplican, qué plugins suelen acompañarla, y
si estás frente a una webapp mantenida o a una olvidada. No te quedes con una única fuente, porque lo
habitual es que el/los admin(s) tape(n) la pista obvia y se olvide(n) del resto.

```bash
# la meta tag generator (la más común, pero la primera que quitan los plugins de hardening)
curl -s http://target/ | grep -oP 'content="WordPress \K[0-9.]+'

# los query strings de cache-busting: ver=X.Y.Z en el css/js del núcleo
curl -s http://target/ | grep -oP 'ver=\K[0-9.]+' | sort -u

# la tag generator del feed rss, que se olvida mucho más seguido que la meta tag
curl -s "http://target/?feed=rss2" | grep -i generator

# readme.html en la raíz, aparece en instalaciones viejas e imprime la versión en un <h1>
curl -s http://target/readme.html | grep -iA1 'version'

# opml y xmlrpc también sueltan info de versión en algunos puntos
curl -s http://target/xmlrpc.php
```

Si ya las cuatro fuentes coinciden, esa es tu versión. Si no, lo normal es que el número más bajo sea el
núcleo y los más altos vengan de los assets de algún plugin. Ten en cuenta ambos.

---

## fase 2 — temas y plugins

Acá está la superficie de verdad. Y yo al menos hago dos pasadas: una pasiva, leyendo lo que la página ya cuenta, y otra activa, buscando lo que no contó.

En la pasiva, el html ya referencia cada tema y plugin activo por su ruta. Saca los nombres y después ve por las versiones.

```bash
# tema(s) activo(s) referenciados en el fuente
curl -s http://target/ | grep -oP 'wp-content/themes/\K[^/'"'"'"?]+' | sort -u

# plugins activos referenciados en el código fuente
curl -s http://target/ | grep -oP 'wp-content/plugins/\K[^/'"'"'"?]+' | sort -u
```

Para las versiones: los temas guardan una cabecera en `style.css` y los plugins una en `readme.txt`,
donde la línea que importa es `Stable tag:`. ambos archivos son legibles por defecto.

```bash
# versión del tema
curl -s http://target/wp-content/themes/THEME/style.css | grep -i version

# versión del plugin (Stable tag es el campo que manda)
curl -s http://target/wp-content/plugins/PLUGIN/readme.txt | grep -i 'stable tag'
```

El problema de quedarse solo en lo pasivo es que únicamente ves lo que se carga en la página que
pediste. Los plugins instalados que solo corren en rutas concretas, o los que están desactivados pero
presentes, no van a aparecer. Para esos hay dos opciones:

La primera es el listado de directorios. Si autoindex está activo (que es bastante común), `/wp-content/plugins/` y `/wp-content/uploads/` se enumeran solos, así que revísalo siempre.

```bash
# un 200 con "Index of" en el cuerpo significa que está activo
curl -s http://target/wp-content/uploads/ | grep -i 'index of'
```

La segunda es sondear rutas a mano. Pide un archivo conocido dentro de un plugin que sospechas
(`/readme.txt`, `/changelog.txt`); un `200` confirma que está ahí aunque la `home` no lo mencionara.
wpscan automatiza esto contra una wordlist de slugs conocidos, y de eso hablo más abajo, pero no te saltes el enum manual, enserio. 

---

## fase 3 — usuarios

Un nombre de usuario es media credencial. Wordpress los filtra por más vías de las que la mayoría
revisa, y como son independientes entre sí, si una está parcheada simplemente pasas a la siguiente.

**1. el redirect `?author=N`.** Pedir un archivo de autor por id redirige al permalink "bonito", que
trae el nombre de usuario incrustado. Solo hay que recorrer los ids.

```bash
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "id=$i -> %{redirect_url}\n" "http://target/?author=$i"
done
# /author/admin/  ->  el usuario es "admin"
```

**2. La rest api.** Un wp moderno expone los usuarios en json, y es la fuente más cómoda: te da el
slug y el nombre visible de una, sin adivinar nada.

```bash
curl -s http://target/wp-json/wp/v2/users | jq -r '.[] | "\(.id)\t\(.slug)\t\(.name)"'
```

**3. Errores de login.** `wp-login.php` responde distinto si el usuario no existe que si
existe pero la contraseña está mal. Esa diferencia es dios: le pasas una lista y los válidos se
delatan por el mensaje. Ojo, algunos plugins de hardening normalizan los textos, y por eso este queda
como tercer vector y no como el primero.

```bash
# usuario válido -> "The password you entered for the username X is incorrect"
# usuario malo    -> "Unknown username" / "is not registered"
curl -s http://target/wp-login.php -d 'log=admin&pwd=x' | grep -oiE 'incorrect|not registered|unknown'
```

**4. Sitemaps y archivos de autor.** Desde wp 5.5 el sitemap del núcleo lista las páginas de autor en
`/wp-sitemap-users-1.xml`. y el feed rss (`?feed=rss2`) etiqueta cada post con el nombre visible de
quien lo escribió.

**5. Oembed.** `/wp-json/oembed/1.0/embed?url=<url-del-post>` devuelve el `author_name` de un post.
Sirve sobre todo cuando el endpoint masivo de usuarios está bloqueado pero los posts sueltos no.

---

## fase 4 — endpoints y archivos sensibles

Aparte de los usuarios, una instalación estándar deja expuestos varios endpoints que conviene anotar.

```bash
# xml-rpc, que suele quedar activo; vuelvo a esto más abajo
curl -s http://target/xmlrpc.php

# toda la superficie de la rest api: namespaces, rutas y, a veces, endpoints custom que filtran
curl -s http://target/wp-json/ | jq '.routes | keys'

# wp-cron, el pseudo-cron, a veces abusable para dos o ssrf
curl -s -o /dev/null -w "%{http_code}\n" http://target/wp-cron.php
```

y después los archivos que pueden quedar olvidados. Esto ya no es parte de wordpress, es
basura que queda atrás, pero mejor revisarlo siempre.

```bash
# backups de config en la raíz (swaps del editor, copias .bak hechas a mano)
for f in wp-config.php.bak wp-config.php~ wp-config.php.save .wp-config.php.swp \
         wp-config.php.orig wp-config.php.txt; do
  curl -s -o /dev/null -w "$f -> %{http_code}\n" "http://target/$f"
done

# log de debug: wp_debug_log escribe acá y puede tener rutas, queries o hasta credenciales
curl -s -o /dev/null -w "%{http_code}\n" http://target/wp-content/debug.log

# vcs o comprimidos expuestos
curl -s -o /dev/null -w "%{http_code}\n" http://target/.git/config
```

si encuentras un `wp-config.php.bak` legible, ahí están las credenciales de
la base de datos y las salts de autenticación en texto plano.

---

## fase 5 — automatización con wpscan

La enumeración manual sirve para saber que hay, ``wpscan`` te dice qué es vulnerable, y lo hace rápido cruzando las
versiones contra su base de datos. Lo importante es que no reemplaza a las fases 0 a 4: se le escapan
plugins, infiere mal las jerarquías de temas y suelta falsos negativos a cada rato. Corre el escáner
en paralelo al trabajo manual y después compara. Lo que wpscan marque, lo confirmas a mano; lo que
encontraste a mano, lo cruzas contra su base de datos por si hay algo conocido.

Si no lo tienes, se instala con el gestor de paquetes de ruby:

```bash
sudo gem install wpscan
```

Escaneo (mucho ruido xd):

```bash
wpscan --url http://target/ \
  --enumerate vp,vt,tt,cb,dbe,u1-20,m \
  --plugins-detection aggressive \
  --plugins-version-detection aggressive \
  --api-token TU_TOKEN \
  --random-user-agent \
  --throttle 500
```
La API la sacas del sitio web. Solo registrate y copia la API. Al momento de escribir esto, te regalan 25 requests al día (antes eran 50, rip).

Los flags de `--enumerate` son estos:

- `vp` / `ap` / `p` — plugins vulnerables / todos / populares
- `vt` / `at` — temas vulnerables / todos
- `tt` — timthumbs, el viejo script de resize de imágenes, clásico de lfi y rce
- `cb` — backups de config (lo hace con una wordlist)
- `dbe` — exports de base de datos olvidados en la raíz
- `u1-20` — usuarios por rango de id
- `m` — media

`--throttle 500` mete 500 ms entre peticiones y `--random-user-agent` rota el agente. Obviamente si estás haciendo un CTF o algo así, no necesitas ninguno de esos dos parámetros.

Cuando ya tienes la lista de usuarios, el ataque de contraseñas puedes hacerlo con `wpscan`:

```bash
wpscan --url http://target/ -U usuarios.txt -P passwords.txt --password-attack wp-login
```

---

## xml-rpc

Con `xmlrpc.php` Lo primero es enumerar sus métodos, que es lo que te dice qué se puede hacer realmente.

```bash
curl -s http://target/xmlrpc.php -X POST -d \
  '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName></methodCall>'
```

De toda la lista, hay tres métodos a los que prestarles atención. `wp.getUsersBlogs` te deja hacer
fuerza bruta de credenciales por xml-rpc, esquivando el rate limiting de la página de login. Y
`system.multicall` empaqueta muchos intentos de autenticación en una sola petición http,
o sea cientos de pruebas por request (la fuerza bruta es más rápida por acá que por `wp-login.php`).

El tercero es `pingback.ping`. Se puede forzar para que el servidor vaya a buscar una url arbitraria,
lo que te da un ssrf: escaneo de puertos internos, alcanzar servicios que el host ve pero tú no, o
simplemente rebotar peticiones para esconder tu origen.

La idea de fondo es saber qué métodos están expuestos.

---

## Tips:

- Los falsos negativos de ``wpscan`` son lo normal. Si el escaneo vuelve limpio, lo que está limpio es el
  escaneo, no el objetivo. Las pasadas manuales existen justo por eso.
- Revisa `/wp-content/uploads/`,
  `/plugins/` y `/themes/` en todos los casos; cuando está activo, media enumeración se reduce a leer.
- La cuenta gratis de wpvulndb da solo 25 llamadas de api por día.
- Olvidé mencionar la herramienta ``whatweb`` (cli) o wappalyzer (extensión de navegador). Estas son herramientas que ayudan con el footprinting inicial. Ambas intentan encontrar las tecnologías que determinada webapp usa, por lo que hacerle un 
```bash
whatweb http://target/
```
al sitio o mirar los resultados de wappalyzer es clave. 