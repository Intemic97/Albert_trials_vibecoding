# 🚀 Guía de Despliegue en Digital Ocean

Esta guía te ayudará a desplegar el microservicio de Prefect en tu servidor de producción.

---

## 📋 Pre-requisitos

1. Servidor Ubuntu/Debian en Digital Ocean
2. Node.js ya instalado (para el backend existente)
3. Acceso SSH al servidor
4. Python 3.10+ (lo instalaremos si no está)

---

## 1️⃣ Variables de Entorno

### Backend Node.js (`server/.env`)

Añade estas nuevas variables a tu archivo `.env` del backend Node.js:

```bash
# Existing variables...
PORT=3001
DATABASE_PATH=./workflow.db
OPENAI_API_KEY=tu_openai_key
# ... otras variables existentes

# ✨ NUEVA: URL del servicio Prefect
PREFECT_SERVICE_URL=http://localhost:8000
```

### Servicio Prefect (`server/prefect-worker/.env`)

Crea un nuevo archivo `.env` en el directorio del worker de Prefect:

```bash
# API Configuration
API_PORT=8000
API_HOST=0.0.0.0

# Database Path (SQLite)
DATABASE_PATH=/var/www/your-app/server/workflow.db

# OpenAI API Key (para el nodo LLM)
OPENAI_API_KEY=tu_openai_key_aqui

# Optional: Logging
LOG_LEVEL=INFO
```

⚠️ **IMPORTANTE**: Usa la **misma** `DATABASE_PATH` que tu backend Node.js para que compartan la misma base de datos.

---

## 2️⃣ Instalación de Python en el Servidor

```bash
# SSH a tu servidor
ssh root@tu-servidor.com

# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar Python 3.11+ y pip
sudo apt install python3.11 python3.11-venv python3-pip -y

# Verificar instalación
python3.11 --version
```

---

## 3️⃣ Configuración del Proyecto en el Servidor

```bash
# Navegar a tu directorio de aplicación
cd /var/www/your-app

# Hacer pull de los últimos cambios
git pull origin main

# Navegar al directorio del worker
cd server/prefect-worker

# Crear entorno virtual con Python 3.11
python3.11 -m venv venv

# Activar el entorno virtual
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Verificar que todo se instaló correctamente
python -c "import fastapi; import prefect; print('✓ Dependencias instaladas')"
```

---

## 4️⃣ Crear Servicio Systemd para Prefect

### Crear archivo de servicio

```bash
sudo nano /etc/systemd/system/prefect-worker.service
```

### Contenido del archivo:

```ini
[Unit]
Description=Prefect Workflow Worker Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/your-app/server/prefect-worker
Environment="PATH=/var/www/your-app/server/prefect-worker/venv/bin"
ExecStart=/var/www/your-app/server/prefect-worker/venv/bin/python start_service.py
Restart=always
RestartSec=10

# Logging
StandardOutput=append:/var/log/prefect-worker.log
StandardError=append:/var/log/prefect-worker-error.log

[Install]
WantedBy=multi-user.target
```

⚠️ **Ajusta estas rutas** según tu configuración:
- `/var/www/your-app` → Ruta real de tu aplicación
- `User=www-data` → Usuario que ejecuta tu app (puede ser `root` o tu usuario específico)

### Crear archivos de log

```bash
sudo touch /var/log/prefect-worker.log
sudo touch /var/log/prefect-worker-error.log
sudo chown www-data:www-data /var/log/prefect-worker*.log
```

### Activar y arrancar el servicio

```bash
# Recargar systemd
sudo systemctl daemon-reload

# Habilitar inicio automático
sudo systemctl enable prefect-worker

# Iniciar el servicio
sudo systemctl start prefect-worker

# Verificar estado
sudo systemctl status prefect-worker
```

---

## 5️⃣ Actualizar tu Servicio Node.js Existente

Si estás usando PM2 para Node.js:

```bash
cd /var/www/your-app/server

# Instalar dependencias actualizadas (si hay nuevas)
npm install

# Reiniciar la aplicación
pm2 restart all
pm2 save
```

Si estás usando systemd para Node.js, simplemente reinicia:

```bash
sudo systemctl restart your-nodejs-app
```

---

## 6️⃣ Configuración de Firewall (UFW)

El servicio Prefect corre en el puerto **8000** internamente, pero NO necesitas exponerlo públicamente:

```bash
# El puerto 8000 solo debe ser accesible localmente
# No añadas ninguna regla UFW para el puerto 8000

# Verifica que solo tienes los puertos necesarios abiertos:
sudo ufw status

# Deberías tener algo como:
# 22/tcp (SSH)
# 80/tcp (HTTP)
# 443/tcp (HTTPS)
# 3001/tcp (API Node.js, si es pública)
```

✅ **El puerto 8000 NO debe estar expuesto públicamente** - solo Node.js se comunica con él localmente.

---

## 7️⃣ Configuración de Nginx (Opcional pero Recomendado)

Si quieres que Prefect API también esté disponible vía proxy reverso (para monitoreo externo):

```nginx
# /etc/nginx/sites-available/your-app

server {
    listen 80;
    server_name your-domain.com;

    # Existing Node.js API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # ✨ NUEVO: Prefect API (opcional, solo si necesitas acceso externo)
    location /prefect-api/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Existing frontend
    location / {
        root /var/www/your-app/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Reiniciar Nginx
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8️⃣ Verificación del Despliegue

### Verificar que ambos servicios están corriendo:

```bash
# 1. Verificar Node.js backend
pm2 status
# O si usas systemd:
sudo systemctl status your-nodejs-app

# 2. Verificar Prefect worker
sudo systemctl status prefect-worker

# 3. Verificar logs de Prefect
sudo tail -f /var/log/prefect-worker.log

# 4. Probar conexión local al servicio Prefect
curl http://localhost:8000/
# Debe responder: {"status":"running","version":"1.0.0"}

# 5. Verificar que Node.js puede comunicarse con Prefect
curl http://localhost:3001/api/prefect/health
# Debe responder: {"available":true,...}
```

---

## 9️⃣ Comandos Útiles para Administración

### Gestionar el servicio Prefect:

```bash
# Ver logs en tiempo real
sudo journalctl -u prefect-worker -f

# Ver logs de errores
sudo tail -f /var/log/prefect-worker-error.log

# Reiniciar servicio
sudo systemctl restart prefect-worker

# Detener servicio
sudo systemctl stop prefect-worker

# Ver estado detallado
sudo systemctl status prefect-worker
```

### Actualizar la aplicación:

```bash
# 1. Navegar al directorio
cd /var/www/your-app

# 2. Pull últimos cambios
git pull origin main

# 3. Actualizar dependencias Python (si es necesario)
cd server/prefect-worker
source venv/bin/activate
pip install -r requirements.txt
deactivate

# 4. Reiniciar ambos servicios
sudo systemctl restart prefect-worker
pm2 restart all
```

---

## 🔟 Troubleshooting

### Problema: Prefect no inicia

```bash
# Ver logs detallados
sudo journalctl -u prefect-worker -n 50

# Verificar permisos
ls -la /var/www/your-app/server/prefect-worker

# Verificar que el entorno virtual existe
ls /var/www/your-app/server/prefect-worker/venv/bin/python
```

### Problema: Node.js no puede conectarse a Prefect

```bash
# Verificar que Prefect está escuchando
netstat -tulpn | grep 8000

# Probar conexión directa
curl http://localhost:8000/

# Verificar variable de entorno en Node.js
pm2 env 0  # O el ID de tu app
```

### Problema: Base de datos no compartida

```bash
# Verificar que ambos servicios usan la misma DB
# Node.js:
cat /var/www/your-app/server/.env | grep DATABASE_PATH

# Prefect:
cat /var/www/your-app/server/prefect-worker/.env | grep DATABASE_PATH

# Deben apuntar al MISMO archivo
```

---

## ✅ Checklist Final

- [ ] Python 3.11+ instalado
- [ ] Entorno virtual creado en `server/prefect-worker/venv`
- [ ] Dependencias instaladas (`requirements.txt`)
- [ ] Archivo `.env` configurado en `server/prefect-worker/`
- [ ] Variable `PREFECT_SERVICE_URL` añadida al `.env` de Node.js
- [ ] Servicio systemd creado y habilitado
- [ ] Prefect worker corriendo (`systemctl status prefect-worker`)
- [ ] Node.js backend reiniciado
- [ ] Ambos servicios pueden comunicarse (`/api/prefect/health`)
- [ ] Logs sin errores
- [ ] Workflows ejecutándose en background ✨

---

## 🎯 Resultado Final

Una vez completados estos pasos, tendrás:

✅ **Backend Node.js** corriendo en puerto 3001  
✅ **Servicio Prefect** corriendo en puerto 8000 (interno)  
✅ **Ambos servicios** compartiendo la misma base de datos  
✅ **Workflows ejecutándose** en background independiente del frontend  
✅ **Inicio automático** de ambos servicios al reiniciar el servidor  
✅ **Logs centralizados** para debugging  

---

## 📚 Recursos Adicionales

- [Documentación Prefect](https://docs.prefect.io/)
- [Systemd Service Guide](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
- [PM2 Documentation](https://pm2.keymetrics.io/)

---

**¿Necesitas ayuda con algún paso específico?** 🚀

