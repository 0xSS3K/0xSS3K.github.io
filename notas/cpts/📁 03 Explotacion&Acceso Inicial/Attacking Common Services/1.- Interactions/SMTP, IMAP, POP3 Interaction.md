# 📧 Guía de Interacción con Servicios: Email (SMTP, IMAP, POP3)

Servicios utilizados para el envío (SMTP) y la recepción o recuperación (POP3 e IMAP) de mensajes.

## Clientes y Conexión

* **Cliente GUI en Linux (Evolution):** Instalación mediante `sudo apt-get install evolution`. Permite configurar cuentas especificando el dominio o la dirección IP del servidor, así como el método de cifrado (como TLS o STARTTLS).
    * *Nota sobre inicio (Si hay errores de bwrap):* `export WEBKIT_FORCE_SANDBOX=0 && evolution`.
* **Conexión manual por consola al servidor SMTP:** `telnet 10.10.110.20 25`.
