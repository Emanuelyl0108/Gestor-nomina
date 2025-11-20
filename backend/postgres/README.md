# 💼 Backend - Gestor de Nómina

API REST para gestión de nómina con PostgreSQL.

## 🚀 Instalación Local

```bash
# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
```

## 🗄️ Configuración de Base de Datos

### 1. Crear tablas en PostgreSQL:

```bash
psql "postgresql://asistencia_user:MOfV5aQyRbwD1bSnGntis9VlTTogCcoP@dpg-d4d82r2dbo4c73dm1us0-a.oregon-postgres.render.com/asistencia_uri6" -f crear_tablas.sql
```

### 2. Migrar datos CSV a PostgreSQL:

```bash
# Asegúrate de tener los CSVs en esta carpeta
python migrar_csv_postgresql.py
```

## ▶️ Ejecutar API

```bash
python Sistema_Nomina.py
```

La API estará disponible en: `http://localhost:5000`

## 📡 Endpoints Principales

### Empleados
- `GET /api/nomina/empleados` - Listar empleados
- `POST /api/nomina/empleados` - Crear empleado
- `PUT /api/nomina/empleados/<id>` - Actualizar empleado
- `DELETE /api/nomina/empleados/<id>` - Desactivar empleado

### Movimientos
- `GET /api/nomina/movimientos` - Listar movimientos
- `GET /api/nomina/movimientos/pendientes` - Movimientos sin descontar
- `POST /api/nomina/movimientos` - Registrar adelanto/consumo

### Nóminas
- `POST /api/nomina/calcular` - Calcular nómina
- `GET /api/nomina/pendientes` - Nóminas sin pagar
- `POST /api/nomina/pagar` - Procesar pago

### Propinas/Bonos/Descuentos
- `POST /api/nomina/propinas` - Registrar propina
- `POST /api/nomina/bonos` - Registrar bono
- `POST /api/nomina/descuentos` - Registrar descuento

## 🚀 Deploy en Render

1. Push a GitHub
2. Conectar repositorio en Render
3. Configurar:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn Sistema_Nomina:app`
   - Variables de entorno: `DATABASE_URL`

## 📊 Base de Datos

Usa la misma base de datos PostgreSQL del sistema de asistencia.
