---
tags:
  - AD
  - attack
---
## Conceptos Clave (TL;DR)

* Las relaciones de confianza (trusts) permiten a los sistemas de autenticación de dos dominios vincularse, facilitando que los usuarios de un dominio accedan a recursos de otro sin necesidad de migrar objetos.
* La direccionalidad define el flujo de acceso: Unidireccional (usuarios del dominio de confianza acceden al dominio que confía, pero no viceversa) o Bidireccional/Two-way (el acceso está permitido en ambas direcciones).
* El enrutamiento puede ser Transitivo (la confianza se extiende automáticamente a los dominios en los que el dominio hijo confía) o No Transitivo (la confianza es directa y estricta, limitándose únicamente al dominio especificado).

### Herramientas Clave

* **Active Directory PowerShell Module:** Permite la enumeración nativa ('Living off the Land') en entornos donde las herramientas de terceros están restringidas o fuertemente monitorizadas.
* **PowerView:** Herramienta esencial para el abuso y enumeración avanzada de Active Directory, capaz de mapear trusts y enumerar objetos en dominios remotos.
* **netdom:** Utilidad de línea de comandos integrada en Windows, útil para consultar trusts, domain controllers y estaciones de trabajo sin necesidad de módulos adicionales.
* **[BloodHound](../../../📂%2008%20Herramientas&Cheatsheets/BloodHound.md)** Plataforma para la visualización gráfica de rutas de ataque, que incluye la consulta preconstruida "Map Domain Trusts" para identificar rápidamente relaciones bidireccionales y topología.

### Metodología Paso a Paso

1. **Fase 1: Identificación y Mapeo de Confianzas**

El objetivo inicial es descubrir las relaciones del dominio comprometido con otros subdominios, bosques o entidades externas. Al mapear la red completa, podemos identificar posibles dominios con posturas de seguridad más débiles (como en casos de fusiones y adquisiciones recientes) para utilizarlos como trampolín.

2. **Fase 2: Análisis de Direccionalidad y Transitividad**

Se debe analizar la salida de las herramientas para determinar si las propiedades de la confianza (ej. `IntraForest`, `ForestTransitive`, `Direction`) permiten la interacción bidireccional o la transitividad hacia objetivos más profundos. Esto define si es técnicamente posible autenticarse hacia el otro lado.

3. **Fase 3: Enumeración Cruzada (Cross-Domain)**

Una vez confirmada la posibilidad de autenticación a través de la relación de confianza, procedemos a enumerar objetos (usuarios, grupos, computadoras) en el dominio objetivo remoto para buscar vectores de ataque (ej. Kerberoasting) que permitan obtener privilegios administrativos en el dominio principal.

### Cheat Sheet de Comandos

#### Usando Módulo ActiveDirectory Nativo
```powershell
# Importa el modulo de Active Directory en la sesion actual de PowerShell
Import-Module activedirectory

  
# Consulta y filtra todas las relaciones de confianza del dominio en el que estamos posicionados
Get-ADTrust -Filter *
```

#### Usando PowerView
```powershell
# Enumera las relaciones de confianza directas existentes para el dominio actual
Get-DomainTrust

  
# Realiza un mapeo exhaustivo de las confianzas en la red, mostrando direccion y tipo
Get-DomainTrustMapping

  
# Enumera los nombres de usuario (SamAccountName) del dominio especificado a traves de la confianza
Get-DomainUser -Domain <TARGET_DOMAIN> | select SamAccountName
```

#### Usando Netdom (CMD)
```cmd
# Consulta la lista de dominios de confianza asociados al dominio objetivo
netdom query /domain:<TARGET_DOMAIN> trust

  
# Lista los Domain Controllers con cuenta en el dominio objetivo
netdom query /domain:<TARGET_DOMAIN> dc

  
# Lista las estaciones de trabajo y servidores asociados al dominio objetivo
netdom query /domain:<TARGET_DOMAIN> workstation
```

### "Gotchas" y Troubleshooting

* **Requisito de Autenticación:** Si los controles técnicos impiden autenticarse a través de la relación de confianza (a pesar de su existencia), es imposible realizar ataques o enumeración hacia el otro dominio.
* **SID Filtering:** Los trusts de tipo "External" (entre distintos bosques no unidos por un forest trust) utilizan SID Filtering por diseño. Esto filtra los requests de autenticación basándose en el SID para asegurar que provengan del dominio confiable legítimo, lo cual puede bloquear ataques de escalada de privilegios que dependen de inyección de SIDs (ej. SID History).
* **Alcance del Assessment (Rules of Engagement):** Es sumamente común descubrir confianzas hacia empresas adquiridas, divisiones en otras regiones geográficas o MSPs de los cuales el cliente no tiene constancia. Nunca ataques ni enumeres de forma invasiva estos dominios externos sin re-validar explícitamente con el cliente si están dentro del Scope (RoE).
* **El vector "End-Around":** A menudo no encontrarás un foothold inicial en el dominio principal, pero sí en un dominio de confianza con configuraciones más débiles. Un ataque exitoso en ese dominio periférico puede escalar hasta comprometer el dominio principal.
