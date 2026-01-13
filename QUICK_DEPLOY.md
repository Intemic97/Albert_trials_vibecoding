# ⚡ Quick Deploy Guide - Digital Ocean

## 🎯 Resumen Rápido para Producción

### 1️⃣ Conectar al Servidor

```bash
ssh root@tu-servidor.com
cd /var/www/your-app  # O donde esté tu app
```

### 2️⃣ Hacer Pull de los Cambios

```bash
git pull origin main
```

### 3️⃣ Ejecutar Script Automático

```bash
cd server/prefect-worker
chmod +x setup-production.sh
./setup-production.sh
```

El script hará **automáticamente**:
- ✅ Instalar Python 3.11 si no está
- ✅ Crear entorno virtual
- ✅ Instalar todas las dependencias
- ✅ Crear archivo `.env` con la configuración
- ✅ Añadir `PREFECT_SERVICE_URL` al backend Node.js
- ✅ Crear servicio systemd
- ✅ Habilitar inicio automático
- ✅ Iniciar el servicio

### 4️⃣ Configurar Variables de Entorno

```bash
# Editar .env del servicio Prefect
nano server/prefect-worker/.env
```

**Cambia esta línea:**
```bash
OPENAI_API_KEY=your_openai_key_here
```

**Por tu API key real:**
```bash
OPENAI_API_KEY=sk-proj-...tu_key_real
```

Guarda con `Ctrl+X`, `Y`, `Enter`

### 5️⃣ Reiniciar Servicios

```bash
# Reiniciar Prefect
sudo systemctl restart prefect-worker

# Reiniciar Node.js (si usas PM2)
cd /var/www/your-app/server
pm2 restart all
pm2 save

# O si usas systemd:
# sudo systemctl restart your-nodejs-service
```

### 6️⃣ Verificar que Todo Funciona

```bash
# ✅ Verificar Prefect
sudo systemctl status prefect-worker

# ✅ Verificar que responde
curl http://localhost:8000/

# ✅ Verificar logs
sudo journalctl -u prefect-worker -n 20

# ✅ Verificar que Node.js puede conectarse
curl http://localhost:3001/api/prefect/health
```

---

## 📊 Resultado Esperado

Si todo está bien, deberías ver:

```json
{
  "status": "running",
  "version": "1.0.0",
  "message": "Prefect Worker Service is running"
}
```

---

## 🔧 Comandos Útiles

```bash
# Ver logs en tiempo real
sudo journalctl -u prefect-worker -f

# Reiniciar servicio
sudo systemctl restart prefect-worker

# Ver estado
sudo systemctl status prefect-worker

# Detener servicio
sudo systemctl stop prefect-worker

# Iniciar servicio
sudo systemctl start prefect-worker
```

---

## ⚠️ Variables de Entorno Críticas

### Backend Node.js (`server/.env`)
```bash
PREFECT_SERVICE_URL=http://localhost:8000  # ← Nueva variable
```

### Servicio Prefect (`server/prefect-worker/.env`)
```bash
API_PORT=8000
API_HOST=0.0.0.0
DATABASE_PATH=/ruta/completa/a/tu/workflow.db  # ← Misma DB que Node.js
OPENAI_API_KEY=tu_openai_key  # ← Tu API key real
```

---

## 🚨 Troubleshooting Rápido

### Error: "Connection refused"
```bash
# Verificar que el servicio está corriendo
sudo systemctl status prefect-worker

# Ver últimos errores
sudo journalctl -u prefect-worker -n 50
```

### Error: "Module not found"
```bash
# Reinstalar dependencias
cd /var/www/your-app/server/prefect-worker
source venv/bin/activate
pip install -r requirements.txt
deactivate
sudo systemctl restart prefect-worker
```

### Error: "Database locked"
```bash
# Asegurarse que ambos servicios usan la misma DB
cat server/.env | grep DATABASE_PATH
cat server/prefect-worker/.env | grep DATABASE_PATH
# Deben ser iguales
```

---

## ✅ Checklist Final

- [ ] Git pull completado
- [ ] Script `setup-production.sh` ejecutado
- [ ] `OPENAI_API_KEY` configurada en `.env`
- [ ] Servicio Prefect corriendo (`systemctl status`)
- [ ] Backend Node.js reiniciado
- [ ] `/api/prefect/health` responde OK
- [ ] Workflows se ejecutan en background

---

## 📚 Documentación Completa

Para más detalles, ver: `DEPLOYMENT_GUIDE.md`

---

**¿Todo listo?** 🚀 ¡Ahora tus workflows corren en background en producción!

