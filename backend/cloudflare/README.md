# 🚀 Gestor de Nómina - Cloudflare Workers + D1

Backend completo del sistema de nómina desplegado en Cloudflare Workers con base de datos D1.

## 📋 Requisitos Previos

1. Cuenta de Cloudflare (gratis)
2. Node.js instalado (v18 o superior)
3. Terminal/línea de comandos

## 🔧 Instalación y Despliegue

### Paso 1: Instalar Wrangler CLI

```bash
npm install
```

### Paso 2: Autenticarse en Cloudflare

```bash
npx wrangler login
```

Esto abrirá tu navegador para autorizar Wrangler.

### Paso 3: Crear la base de datos D1

```bash
npm run db:create
```

Esto creará tu base de datos y te dará un `database_id`. **Copia este ID**.

### Paso 4: Configurar database_id

Edita el archivo `wrangler.toml` y pega tu `database_id`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "nomina-db"
database_id = "TU_DATABASE_ID_AQUI"  # ← Pega aquí
```

### Paso 5: Ejecutar el schema SQL

```bash
npm run db:execute
```

Esto creará todas las tablas y datos de prueba en tu base de datos.

### Paso 6: Desplegar el Worker

```bash
npm run deploy
```

¡Listo! Tu API estará disponible en: `https://gestor-nomina-api.TU-SUBDOMINIO.workers.dev`

## 🧪 Probar la API

### Health Check
```bash
curl https://gestor-nomina-api.TU-SUBDOMINIO.workers.dev/health
```

### Listar Empleados
```bash
curl https://gestor-nomina-api.TU-SUBDOMINIO.workers.dev/api/nomina/empleados
```

## 📡 Endpoints Disponibles

### Empleados
- `GET /api/nomina/empleados` - Listar empleados activos
- `POST /api/nomina/empleados` - Crear empleado
- `PUT /api/nomina/empleados/:id` - Actualizar empleado
- `DELETE /api/nomina/empleados/:id` - Desactivar empleado

### Movimientos
- `GET /api/nomina/movimientos` - Listar movimientos
- `GET /api/nomina/movimientos/pendientes` - Movimientos sin descontar
- `POST /api/nomina/movimientos` - Registrar adelanto/consumo

### Propinas/Bonos/Descuentos
- `POST /api/nomina/propinas` - Registrar propina
- `POST /api/nomina/bonos` - Registrar bono
- `POST /api/nomina/descuentos` - Registrar descuento

### Nóminas
- `POST /api/nomina/calcular` - Calcular nómina
- `POST /api/nomina/guardar` - Guardar nómina calculada
- `GET /api/nomina/pendientes` - Nóminas sin pagar
- `POST /api/nomina/pagar` - Procesar pago

### Reportes
- `GET /api/nomina/pagos` - Histórico de pagos

## 🔍 Desarrollo Local

Para probar localmente antes de desplegar:

```bash
npm run dev
```

Tu API estará en `http://localhost:8787`

## 📊 Ver Logs en Tiempo Real

```bash
npm run tail
```

## 💾 Backup de Base de Datos

```bash
npm run db:backup
```

## 🌐 Conectar con Frontend

Actualiza tu frontend en `src/pages/*.jsx` para usar la nueva URL:

```javascript
const API_URL = 'https://gestor-nomina-api.TU-SUBDOMINIO.workers.dev/api';
```

## 🎯 Ventajas de Cloudflare

- ⚡ **Ultra rápido**: Respuestas en <50ms
- 🌍 **Global**: Edge computing en 300+ ciudades
- 💰 **Gratis**: 100,000 requests/día incluidos
- 🔒 **Seguro**: DDoS protection incluido
- 📈 **Escalable**: Soporta millones de requests

## 🔗 Integración con Sistema de Asistencia

La tabla `marcajes` permite calcular automáticamente días trabajados:

```javascript
// En el endpoint /api/nomina/calcular
// Si no envías dias_completos, se calcula automáticamente desde marcajes
```

## 📝 Notas Importantes

- Los datos de prueba (3 empleados) se crean automáticamente al ejecutar el schema
- La zona horaria está configurada para Colombia (America/Bogota)
- Todos los endpoints tienen CORS habilitado
- SQLite usa INTEGER (0/1) en lugar de BOOLEAN

## 🆘 Solución de Problemas

### Error: "Database not found"
- Verifica que copiaste correctamente el `database_id` en `wrangler.toml`

### Error: "Table already exists"
- Ya ejecutaste el schema. Puedes ignorarlo o crear una nueva DB

### Error: "Unauthorized"
- Ejecuta `npx wrangler login` nuevamente

## 📦 Archivos del Proyecto

```
cloudflare-nomina/
├── worker.js           # Worker principal (API)
├── schema.sql          # Schema de base de datos
├── wrangler.toml       # Configuración de Cloudflare
├── package.json        # Dependencias y scripts
└── README.md          # Este archivo
```

## 🚀 Próximos Pasos

1. Despliega el backend
2. Prueba los endpoints
3. Actualiza el frontend con la nueva URL
4. Despliega el frontend en Cloudflare Pages
5. ¡Disfruta tu sistema ultra-rápido!

---

**¿Dudas?** Revisa la [documentación de Cloudflare Workers](https://developers.cloudflare.com/workers/)
