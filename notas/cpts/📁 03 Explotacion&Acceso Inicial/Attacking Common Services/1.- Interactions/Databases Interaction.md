# 🗄️ Guía de Interacción con Servicios: Bases de Datos (MSSQL & MySQL)

Sistemas utilizados típicamente en entornos corporativos para almacenar y gestionar información.

## Clientes y Conexión Interactiva

* **MSSQL desde Linux (sqsh):** `sqsh -S 10.129.20.13 -U username -P Password123`.
* **MSSQL desde Linux usando Autenticación de Windows (sqsh):** `sqsh -S 10.129.203.7 -U .\julio -P 'MyPassword!' -h`.
* **MSSQL desde Windows (sqlcmd):** `sqlcmd -S 10.129.20.13 -U username -P Password123`.
* **MySQL desde Linux:** `mysql -u username -pPassword123 -h 10.129.20.13`.
* **MySQL desde Windows:** `mysql.exe -u username -pPassword123 -h 10.129.20.13`.
* **Cliente GUI (DBeaver):** Herramienta multiplataforma para interactuar con bases de datos (soporta MySQL, MSSQL, entre otras).
    * Instalación: `sudo dpkg -i dbeaver-<version>.deb`.
    * Ejecución: `dbeaver &`.

## Consultas Básicas - MySQL

* **Mostrar bases de datos disponibles:** `SHOW DATABASES;`.
* **Seleccionar una base de datos:** `USE htbusers;`.
* **Mostrar tablas de la base de datos seleccionada:** `SHOW TABLES;`.
* **Visualizar todas las entradas de una tabla:** `SELECT * FROM users;`.

## Consultas Básicas - MSSQL

* **Mostrar bases de datos disponibles:** `SELECT name FROM master.dbo.sysdatabases`.
* **Seleccionar una base de datos:** `USE htbusers`.
* **Mostrar tablas de la base de datos seleccionada:** `SELECT * FROM htbusers.INFORMATION_SCHEMA.TABLES`.
* **Visualizar todas las entradas de una tabla:** `SELECT * FROM users`.
