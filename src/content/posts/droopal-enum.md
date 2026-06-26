---
title: "enum // drupal"
date: 2026-05-31
description: "metodología de enumeración sobre un objetivo drupal: footprinting por headers y código fuente, versión del núcleo, nodos, módulos y temas, usuarios desde varios frentes, archivos sensibles, nuclei..."
tags: ["drupal", "web", "enumeracion", "recon"]
draft: false
---

Drupal suele estar presente en universidades, gobierno y harto sitio
corporativo grande corren sobre él. Igual que con wp,
el `core` no posee tantas vulns como los módulos de terceros y la config (tiene un security team serio y saca advisories (`SA-CORE-...`) con su propio
versionado).

Antes de partir, dos cosas que conviene tener en cuenta es que: Primero, drupal indexa su contenido
por nodos, con uris del tipo `/node/<id>`, y eso por sí solo ya es una firma: si ves `/node/1`
respondiendo, puedes hacerte la idea de que es drupal. La segunda son los
roles. Drupal trae tres por defecto: anónimo (solo lectura), usuario autenticado (puede crear o editar
según permisos) y administrador (control total). Y al igual que en wp, tener credenciales válidas (aún si son de bajos privilegios) te abre funcionalidad que como anónimo tienes, así que es un buen punto de partida.

---

## fase 0 — confirmar que es drupal

Drupal deja firmas por todos lados y casi nunca necesitas mandar algo que parezca un
ataque para confirmarlo. Lo primero que miro son los headers.

```bash
# X-Generator suelta "Drupal N" directo; X-Drupal-Cache y X-Drupal-Dynamic-Cache
# (HIT/MISS/UNCACHEABLE) son casi una firma exclusiva del core
curl -sI http://target/ | grep -iE 'x-generator|x-drupal'

# en el cuerpo: meta generator, rutas /core/ y /sites/, y el objeto Drupal.settings del js
curl -s http://target/ | grep -iE 'name="generator"|/core/|/sites/|Drupal.settings'

# el clásico "Powered by Drupal" que arrastran muchos temas en el footer
curl -s http://target/ | grep -i 'powered by drupal'

# robots.txt de drupal bloquea /core/, /admin/, /user/, /modules/... y referencia rutas /node
curl -s http://target/robots.txt
```

Ojillo con `X-Generator` y `Drupal.settings` ya que son justo lo que apaga cualquier instalación
endurecida (hay módulos dedicados a borrar esos headers y la meta tag). Si vienen vacíos no descartes
drupal: te quedan las rutas `/core/` y `/sites/`, que es muchísimo más difícil que las escondan porque
de ahí cargan los assets. Una sola de esas pistas ya alcanza.

Por otro lado, un `whatweb http://target/` o mirar lo que dice wappalyzer en el navegador te confirma el stack.

Y si ya tienes `nuclei` a mano (lo vemos en serio en la fase 6), el template de detección te lo confirma rápido.

```bash
# drupal-detect: tech detection puro, te dice "es drupal" sin tocar nada raro
nuclei -u http://target/ -id drupal-detect
```

---

## fase 1 — versión del núcleo

La versión define todo lo que viene: qué advisories aplican y si estás frente a algo mantenido o
abandonado. Y acá hay un cambio importante según la rama, porque drupal movió de lugar el archivo que contiene la versión.

En drupal 7 el `CHANGELOG.txt` vive en la raíz. Desde drupal 8 en adelante (8/9/10/11) se movió a
`/core/`. La línea de arriba del archivo es siempre la versión más nueva instalada.

```bash
# drupal 7: changelog en la raíz; la primera línea es la versión actual
curl -s http://target/CHANGELOG.txt | head -n 2

# drupal 8+: el mismo archivo, ahora bajo /core/
curl -s http://target/core/CHANGELOG.txt | head -n 2
# salida esperada -> "Drupal 10.2.5, 2024-04-04"
```

Como en wp, no te quedes con una sola fuente. El `X-Generator` y otros `.txt` del core también filtran,
y a veces el admin tapa el changelog pero se olvida del resto.

```bash
# X-Generator suele traer "Drupal 10 (https://www.drupal.org)"
curl -sI http://target/ | grep -i x-generator

# barrido de los .txt que delatan al menos la versión mayor
for f in core/CHANGELOG.txt CHANGELOG.txt core/MAINTAINERS.txt MAINTAINERS.txt \
         core/COPYRIGHT.txt README.txt INSTALL.txt; do
  curl -s -o /dev/null -w "$f -> %{http_code}\n" "http://target/$f"
done
```

Desde hace varias versiones drupal trae un `.htaccess` que bloquea estos
`.txt` por defecto, así que en instalaciones nuevas (o donde el server respete ese `.htaccess`) vas a
ver `404`. No es que no sea drupal, es que el archivo está protegido. Cuando el changelog no
está, la versión podemos inferirla de otras formas que veremos más adelante.

`nuclei` también te lee el changelog dentro del set de drupal, así que si la ruta está accesible te
saca la versión sin que tú hagas nada:

```bash
# los templates info/detección del tag drupal incluyen el parseo del changelog
nuclei -u http://target/ -tags drupal -severity info
```

---

## fase 2 — nodos

Esto es lo más drupalero que existe señoras y señores. Aunque el tema esté
100% customizado y no veas panel de login por ninguna parte, los nodos siguen ahí. Pedir `/node/1`,
`/node/2`, etc., te confirma drupal. Puedes hacer lo mismo con Intruder de BurpSuite y así mapeas el sitio. Acá dejo el bucle para hacerlo desde consola.

```bash
# /node/N existe -> 200 con contenido. Recorre los primeros ids
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "node/$i -> %{http_code}\n" "http://target/node/$i"
done

# si las clean urls están off (típico en d7 mal configurado), el acceso es por ?q=
curl -s -o /dev/null -w "%{http_code}\n" "http://target/?q=node/1"
```

`/node/1` suele ser el primer contenido publicado, normalmente algo del admin. Un `200` sobre esa ruta es confirmación de que estás sobre drupal.

---

## fase 3 — módulos y temas

Bueno, acá llegamos a la superficie de verdad. Igual que los plugins en wp, los módulos contrib son, el 99% de las veces, el punto débil de la aplicación.

Primero siempre hacemos un escaneo pasivo. El html ya referencia cada módulo y tema activo por la ruta de sus assets. Y
ojo con las rutas, que cambian entre ramas. En drupal 7 los contrib viven en `/sites/all/modules/` (y
`/sites/all/themes/`), con el core en `/modules/` y `/themes/`. En drupal 8+ los contrib pasaron a
`/modules/` y `/themes/` a secas, el core quedó en `/core/modules/` y `/core/themes/`, y aparece
`/profiles/`.

```bash
# saca slugs de módulos y temas referenciados, cubriendo las rutas de d7 y d8+
curl -s http://target/ | grep -oP '(?:/core|/sites/all)?/(?:modules|themes)/\K[^/'"'"'"?]+' | sort -u
```

Para las versiones, el campo cambia según la rama: drupal 7 usa un `.info` con la línea `version = `,
y drupal 8+ usa un `.info.yml`. Muchos módulos contrib además dejan un `README.txt` legible.

```bash
# d8+: el .info.yml trae name, version y core_version_requirement
curl -s http://target/modules/MODULE/MODULE.info.yml | grep -iE 'version|core'

# d7: el .info clásico
curl -s http://target/sites/all/modules/MODULE/MODULE.info | grep -i version

# y el readme, que a veces es lo único que queda legible
curl -s http://target/modules/MODULE/README.txt
```

Listado de directorios, si `autoindex` está activo:

```bash
# un 200 con "Index of" en el cuerpo y la enumeración se reduce a leer
curl -s http://target/modules/ | grep -i 'index of'
curl -s http://target/sites/all/modules/ | grep -i 'index of'
```

---

## fase 4 — usuarios
 
Un nombre de usuario es media credencial, y drupal los filtra por varias vías. Las ordeno de la más
limpia y fiable a la más frágil.

**1. JSON:API.** Desde drupal 8+ el módulo JSON:API (que viene en el core y suele estar activo) expone
las entidades, usuarios incluidos, en `/jsonapi/user/user`. Cuando los permisos están mal configurados un request anónimo te devuelve la lista completa de usuarios.

```bash
# lista de usuarios en json; saca el name de cada cuenta
curl -s http://target/jsonapi/user/user | jq -r '.data[].attributes | .name // .display_name'
```

**2. La página de perfil `/user/N`.** Cada usuario tiene su perfil en `/user/<id>`. Si el perfil es
visible para anónimos, el nombre de usuario aparece en el `<title>` y en el `h1` de la página. Recorres
ids igual que con `?author=N` en wp.

```bash
for i in $(seq 1 10); do
  curl -s "http://target/user/$i" | grep -oP '<title>\K[^<|]+'
done
```

**3. El formulario de recuperación.** `/user/password` (request de reset) en versiones viejas respondía
distinto si el nombre/correo existía que si no, delatando cuentas válidas. Le podemos pasar una lista y luego comparar las respuestas.

```bash
# versiones viejas: distinguen "usuario no reconocido" vs "se envió un correo"
curl -s http://target/user/password -d 'name=admin'
```

**4. Mensajes de login.** `/user/login` puede diferenciar usuario inexistente de contraseña mala, igual
que `wp-login.php`.

Ojete: drupal lleva años cerrando estos vectores. Las versiones modernas (más el módulo *Username
enumeration prevention*) normalizan los mensajes de `/user/login` y `/user/password`, y por eso quedan
como vectores 3 y 4 y no como los primeros. Hay además un caso conocido vía
`/user/reset/<UID>/1/1`, que filtra el nombre de otro usuario, pero requiere estar autenticado, así que
sirve recién cuando ya tienes una sesión.

---

## fase 5 — endpoints y archivos sensibles

Aparte de los usuarios, una instalación estándar deja varios endpoints que hay que mirar.

```bash
# install.php: si redirige a "Drupal ya está instalado" confirma el cms;
# en algunos casos queda accesible y es problema
curl -s -o /dev/null -w "%{http_code}\n" http://target/core/install.php
curl -s -o /dev/null -w "%{http_code}\n" http://target/install.php

# update.php: corre migraciones de esquema; debería estar restringido por config
curl -s -o /dev/null -w "%{http_code}\n" http://target/update.php

# panel de login por defecto
curl -s -o /dev/null -w "%{http_code}\n" http://target/user/login

# directorio de subidas, casi siempre listable
curl -s http://target/sites/default/files/ | grep -i 'index of'
```

Esto no es drupal como tal, sino lo que se puede olvidar de limpiar, pero revísalo
siempre. En drupal las credenciales de la base de datos viven en `sites/default/settings.php`; ese
archivo lo parsea el servidor (no lo ves crudo), pero un backup o un swap del editor si se sirve en texto
plano.

```bash
# backups/swaps de settings.php: si uno es legible, ahí están las credenciales de la db
for f in sites/default/settings.php.bak sites/default/settings.php~ \
         sites/default/settings.php.save sites/default/settings.php.orig \
         sites/default/settings.php.txt; do
  curl -s -o /dev/null -w "$f -> %{http_code}\n" "http://target/$f"
done

# vcs o comprimidos expuestos en la raíz
curl -s -o /dev/null -w "%{http_code}\n" http://target/.git/config
```

Casi toda esta fase nuclei la cubre con su set de exposiciones (`exposure`), que ya trae checks para
`settings.php` de backup, `.git/config`, `install.php`, el changelog y compañía. Buen sitio para soltarlo
y comparar con lo que sacaste a mano:

```bash
nuclei -u http://target/ -tags drupal,exposure
```

---

## fase 6 — automatización con nuclei

Hoy el escáner que corre todo el mundo es `nuclei`, de ProjectDiscovery. Es template-based (los
templates son YAML), escrito en go, rapidísimo y con un repo de templates de la
comunidad que se actualiza casi a diario: cuando sale un cve nuevo, el template suele aparecer en horas o
días. Eso es justo lo que dejó a `droopescan` medio en desuso: nuclei cubre el mismo terreno (detección,
versión, urls interesantes, cves) y de paso todo el resto del stack, no solo drupal.

No reemplaza las fases 0 a 5 —solo ve lo que tiene template, igual que cualquier escáner—, así que
córrelo en paralelo al trabajo manual y compara.

Lo primero, instalar y —clave— actualizar los templates:

```bash
# binario desde releases, o con go
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

# SIEMPRE actualiza los templates antes de un escaneo serio
nuclei -update-templates
```

El workflow típico sería primero confirmas host vivo con `httpx`, y después le tiras nuclei acotado por tags.
Correr "todo" contra un target es ruidoso y lento.

```bash
# confirma que responde y de paso saca tech/título
echo http://target/ | httpx -title -tech-detect -status-code

# todo lo drupaloso de una: detección, versión, paneles, cves del core
nuclei -u http://target/ -tags drupal
```

Puedes combinar tags para acotar a lo que te interesa.

```bash
# solo cves (cruza directo con la fase de explotación)
nuclei -u http://target/ -tags drupal,cve

# exposiciones: settings.php de backup, .git, install.php, changelog... (cubre la fase 5 casi entera)
nuclei -u http://target/ -tags drupal,exposure

# paneles de login / admin
nuclei -u http://target/ -tags drupal,panel
```

Si no quieres pensar en tags, el modo `-as` (automatic scan) usa detección de tecnología tipo wappalyzer
y mapea solo a los templates que aplican al stack que encuentre:

```bash
nuclei -u http://target/ -as
```

Otros flags que uso siempre: `-severity` para filtrar ruido, `-jsonl` para sacar salida parseable, y los
de velocidad para no despertar al waf. Por defecto nuclei va a `-rl 150` (requests por segundo) y `-c 25`
(templates en paralelo), que para un objetivo real es demasiado.

```bash
# salida json, solo lo grave
nuclei -u http://target/ -tags drupal -severity critical,high -jsonl -o out.json

# modo educado con el waf rate limit bajo y poca concurrencia
nuclei -u http://target/ -tags drupal -rl 10 -c 5
```

### ¿y droopescan / drupwn?

`droopescan` (el viejo equivalente drupaleto de `wpscan`, en python) todavía existe y conserva un
nicho: su brute-force de slugs de módulos/temas contra wordlist propia a veces saca cosas que nuclei no,
porque nuclei hace checks puntuales, no fuerza slugs. Pero está bastante menos mantenido y la mayoría se
pasó a nuclei. Si lo corres, úsalo justo para eso —enumeración de módulos por wordlist— y poco más:

```bash
# instalar
pip install droopescan
# enumeración de módulos por wordlist (-e p), que es su gracia
droopescan scan drupal -u http://target/ -e p -t 32
```

Ojo: `droopescan` infiere la versión por checksums de archivos del core, así que si el core es más nuevo
que su base de datos el rango te sale viejo o incompleto. Para versión, hoy te fías antes del
`CHANGELOG.txt` a mano (fase 1) o del template de nuclei.

`drupwn` (`github.com/immunIT/drupwn`) es la otra alternativa histórica, con un modo `exploit` y checker
de cves; misma idea, también bastante menos usada hoy. Si lo bajas, revisa el `--help` que la invocación
depende de cómo lo instales.

---

## ¿dónde lleva todo esto?

Con la versión del `core` y la lista de módulos en mano, el siguiente paso es cruzar contra cves
conocidos. Las dos que todo el mundo conoce son las *Drupalgeddon*: `Drupalgeddon2`
(`CVE-2018-7600`, `SA-CORE-2018-002`, marzo 2018), un rce en el `core` que afectó a todo lo anterior a
`7.58`, `8.3.9`, `8.4.6` y `8.5.1`; y poco después `Drupalgeddon3` (`CVE-2018-7602`), relacionada. Si
caes en una instalación vieja sin parchar, ahí tienes la entrada.

Para ese cruce, hoy el camino corto es justo `nuclei`: Drupalgeddon2 y compañía tienen template, así que
`-tags drupal,cve` te salta lo que aplique a la versión que detectaste. Si sumas `kev` te quedas solo con
lo que se explota activamente (la lista KEV de CISA), que es por donde conviene empezar:

```bash
nuclei -u http://target/ -tags drupal,cve,kev
```

Pero lo normal en un objetivo real es que el `core` esté al día. Cuando la versión del núcleo no te da
nada evidente, el enfoque se mueve a lo de siempre: los módulos contrib (que ya enumeraste en la fase 3,
y donde está el 99% de los problemas) o el abuso de funcionalidad nativa con una credencial de bajo
privilegio.

---

## Tips:

- `CHANGELOG.txt` cambió de lugar: raíz en drupal 7, `/core/` en drupal 8+. Y en instalaciones nuevas el
  `.htaccess` lo bloquea, así que un `404` no significa "no es drupal", significa "está protegido".
- Las rutas de módulos/temas cambian entre ramas: `/sites/all/modules/` en d7, `/modules/` a secas en
  d8+, con el core siempre bajo `/core/`. Revisa autoindex en todas; cuando está activo, la enumeración
  se reduce a leer.
- JSON:API (`/jsonapi/user/user`) es el camino corto a la lista de usuarios en d8+, pero solo si está
  activo y mal permisado. Los mensajes de `/user/login` y `/user/password` ya vienen normalizados en
  drupal moderno.
- `nuclei` reemplazó a `droopescan` como el escáner por defecto, pero solo ve lo que tiene template:
  actualízalos cuando puedas (`nuclei -update-templates`) y corre acotado por tags
  (`-tags drupal,cve`). Lo que marque, confírmalo a mano. Para brute-force de slugs de módulos,
  `droopescan -e p` todavía conserva su nicho.
- En el mundo real esto va detrás de un waf y conviene escanear con calma (hilos bajos, delays). En un CTF
  daría igual.