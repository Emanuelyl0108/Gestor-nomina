#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sistema de Gestión de Nómina - Enruanados Gourmet
API REST con Flask + PostgreSQL
Integrado con Sistema de Asistencia
"""

import os
import sys
from datetime import datetime, timedelta, date
from decimal import Decimal
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify
from flask_cors import CORS
import pytz

# ==================== CONFIGURACIÓN ====================

app = Flask(__name__)
CORS(app)

# Base de datos PostgreSQL (misma que sistema de asistencia)
DATABASE_URL = os.environ.get(
    'DATABASE_URL',
    'postgresql://asistencia_user:MOfV5aQyRbwD1bSnGntis9VlTTogCcoP@dpg-d4d82r2dbo4c73dm1us0-a.oregon-postgres.render.com/asistencia_uri6'
)

# Zona horaria de Colombia
COLOMBIA_TZ = pytz.timezone('America/Bogota')

def now_colombia():
    """Obtener fecha/hora actual de Colombia"""
    return datetime.now(COLOMBIA_TZ)

# ==================== CONEXIÓN BD ====================

def get_db_connection():
    """Conectar a PostgreSQL"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Error conectando a BD: {e}")
        raise

# ==================== UTILIDADES ====================

def serializar_decimal(obj):
    """Convertir Decimals a float para JSON"""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    return obj

def serializar_dict(d):
    """Serializar diccionario para JSON"""
    return {k: serializar_decimal(v) for k, v in d.items()}

def calcular_dias_trabajados_desde_marcajes(empleado_id, fecha_inicio, fecha_fin):
    """
    Calcular días trabajados desde los marcajes del sistema de asistencia.
    Cuenta los días únicos donde el empleado marcó entrada.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT COUNT(DISTINCT fecha) as dias
        FROM marcajes
        WHERE empleado_id = %s
          AND fecha BETWEEN %s AND %s
          AND tipo = 'entrada'
    """, (empleado_id, fecha_inicio, fecha_fin))
    
    resultado = cursor.fetchone()
    cursor.close()
    conn.close()
    
    return resultado[0] if resultado else 0

def calcular_nomina(empleado_id, tipo_nomina, periodo_inicio, periodo_fin, 
                    dias_completos=None, medios_sustitutos=0, medios_adicionales=0):
    """
    Calcular nómina de un empleado.
    
    Lógica:
    - Quincenal: Base 15 días, 2 descansos permitidos (13 días efectivos mínimo)
    - Semanal: Base 7 días, 1 descanso opcional
    - Si trabaja menos de lo esperado: descuenta
    - Si trabaja más: paga días extras
    """
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Obtener datos del empleado
    cursor.execute("""
        SELECT id, nombre, sueldo_mensual, tipo_pago
        FROM empleados
        WHERE id = %s
    """, (empleado_id,))
    
    empleado = cursor.fetchone()
    if not empleado:
        cursor.close()
        conn.close()
        return {'error': 'Empleado no encontrado'}
    
    sueldo_mensual = float(empleado['sueldo_mensual'])
    
    # Cálculo según tipo de nómina
    if tipo_nomina == 'quincenal':
        sueldo_base = sueldo_mensual / 2
        dias_periodo = 15
        dias_minimos = 13  # 15 - 2 descansos
        valor_dia = sueldo_base / 15
    elif tipo_nomina == 'semanal':
        sueldo_base = sueldo_mensual / 4
        dias_periodo = 7
        dias_minimos = 6  # 1 descanso opcional
        valor_dia = sueldo_base / 7
    else:
        cursor.close()
        conn.close()
        return {'error': 'Tipo de nómina inválido'}
    
    # Calcular días efectivos
    if dias_completos is None:
        # Calcular automáticamente desde marcajes
        dias_completos = calcular_dias_trabajados_desde_marcajes(
            empleado_id, periodo_inicio, periodo_fin
        )
    
    dias_efectivos = dias_completos + medios_sustitutos + medios_adicionales
    
    # Calcular monto base
    if dias_efectivos >= dias_minimos:
        # Cumple o supera los días mínimos
        dias_a_pagar = dias_periodo
        
        # Días extras
        if dias_efectivos > dias_minimos:
            dias_extras = dias_efectivos - dias_minimos
            dias_a_pagar += dias_extras
    else:
        # No cumple días mínimos, hay descuento
        dias_faltantes = dias_minimos - dias_efectivos
        dias_a_pagar = dias_periodo - dias_faltantes
    
    monto_base = dias_a_pagar * valor_dia
    
    # Obtener propinas pendientes
    cursor.execute("""
        SELECT COALESCE(SUM(monto), 0) as total
        FROM propinas
        WHERE empleado_id = %s
          AND aplicada = FALSE
    """, (empleado_id,))
    total_propinas = float(cursor.fetchone()['total'])
    
    # Obtener bonos pendientes
    cursor.execute("""
        SELECT COALESCE(SUM(monto), 0) as total
        FROM bonos
        WHERE empleado_id = %s
          AND aplicada = FALSE
    """, (empleado_id,))
    total_bonos = float(cursor.fetchone()['total'])
    
    # Obtener descuentos pendientes
    cursor.execute("""
        SELECT COALESCE(SUM(monto), 0) as total
        FROM descuentos
        WHERE empleado_id = %s
          AND aplicada = FALSE
    """, (empleado_id,))
    total_descuentos = float(cursor.fetchone()['total'])
    
    # Obtener movimientos pendientes (adelantos + consumos)
    cursor.execute("""
        SELECT COALESCE(SUM(monto), 0) as total
        FROM movimientos
        WHERE empleado_id = %s
          AND descontado = FALSE
    """, (empleado_id,))
    total_movimientos = float(cursor.fetchone()['total'])
    
    cursor.close()
    conn.close()
    
    # Total a pagar
    total_pagar = (
        monto_base
        + total_propinas
        + total_bonos
        - total_descuentos
        - total_movimientos
    )
    
    return {
        'empleado_id': empleado_id,
        'empleado_nombre': empleado['nombre'],
        'tipo_nomina': tipo_nomina,
        'periodo_inicio': periodo_inicio,
        'periodo_fin': periodo_fin,
        
        'dias_completos': dias_completos,
        'medios_sustitutos': medios_sustitutos,
        'medios_adicionales': medios_adicionales,
        'dias_efectivos': dias_efectivos,
        'dias_a_pagar': dias_a_pagar,
        
        'sueldo_mensual': sueldo_mensual,
        'sueldo_base': sueldo_base,
        'valor_dia': valor_dia,
        'monto_base': monto_base,
        
        'total_propinas': total_propinas,
        'total_bonos': total_bonos,
        'total_descuentos': total_descuentos,
        'total_movimientos': total_movimientos,
        
        'total_pagar': total_pagar
    }

# ==================== ENDPOINTS: EMPLEADOS ====================

@app.route('/api/nomina/empleados', methods=['GET', 'OPTIONS'])
def listar_empleados():
    """Listar empleados activos con sus sueldos"""
    if request.method == 'OPTIONS':
        return '', 204
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("""
        SELECT id, nombre, cedula, email, telefono, rol, 
               sueldo_mensual, tipo_pago, estado, fecha_registro
        FROM empleados
        WHERE estado = 'ACTIVO'
        ORDER BY nombre
    """)
    
    empleados = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return jsonify([serializar_dict(dict(e)) for e in empleados])

@app.route('/api/nomina/empleados/<int:id>', methods=['PUT', 'OPTIONS'])
def actualizar_empleado(id):
    """Actualizar sueldo y tipo de pago de empleado"""
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json
    sueldo = data.get('sueldo_mensual')
    tipo_pago = data.get('tipo_pago')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE empleados
        SET sueldo_mensual = %s, tipo_pago = %s
        WHERE id = %s
    """, (sueldo, tipo_pago, id))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'success': True, 'mensaje': 'Empleado actualizado'})

@app.route('/api/nomina/empleados/<int:id>/desactivar', methods=['POST', 'OPTIONS'])
def desactivar_empleado(id):
    """Desactivar empleado (no aparecerá en sistema de asistencia)"""
    if request.method == 'OPTIONS':
        return '', 204
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE empleados
        SET estado = 'INACTIVO'
        WHERE id = %s
    """, (id,))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'success': True, 'mensaje': 'Empleado desactivado'})

# ==================== ENDPOINTS: MOVIMIENTOS ====================

@app.route('/api/nomina/movimientos', methods=['GET', 'OPTIONS'])
def listar_movimientos():
    """Listar todos los movimientos"""
    if request.method == 'OPTIONS':
        return '', 204
    
    empleado_id = request.args.get('empleado_id')
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    if empleado_id:
        cursor.execute("""
            SELECT m.*, e.nombre as empleado_nombre
            FROM movimientos m
            JOIN empleados e ON m.empleado_id = e.id
            WHERE m.empleado_id = %s
            ORDER BY m.fecha DESC
            LIMIT 100
        """, (empleado_id,))
    else:
        cursor.execute("""
            SELECT m.*, e.nombre as empleado_nombre
            FROM movimientos m
            JOIN empleados e ON m.empleado_id = e.id
            ORDER BY m.fecha DESC
            LIMIT 100
        """)
    
    movimientos = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return jsonify([serializar_dict(dict(m)) for m in movimientos])

@app.route('/api/nomina/movimientos/pendientes', methods=['GET', 'OPTIONS'])
def movimientos_pendientes():
    """Listar movimientos sin descontar"""
    if request.method == 'OPTIONS':
        return '', 204
    
    empleado_id = request.args.get('empleado_id')
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    if empleado_id:
        cursor.execute("""
            SELECT m.*, e.nombre as empleado_nombre
            FROM movimientos m
            JOIN empleados e ON m.empleado_id = e.id
            WHERE m.empleado_id = %s
              AND m.descontado = FALSE
            ORDER BY m.fecha DESC
        """, (empleado_id,))
    else:
        cursor.execute("""
            SELECT m.*, e.nombre as empleado_nombre
            FROM movimientos m
            JOIN empleados e ON m.empleado_id = e.id
            WHERE m.descontado = FALSE
            ORDER BY m.fecha DESC
        """)
    
    movimientos = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return jsonify([serializar_dict(dict(m)) for m in movimientos])

@app.route('/api/nomina/movimientos', methods=['POST'])
def crear_movimiento():
    """Registrar adelanto o consumo"""
    data = request.json
    
    empleado_id = data.get('empleado_id')
    fecha = data.get('fecha', now_colombia().date().isoformat())
    tipo = data.get('tipo')  # 'adelanto' o 'consumo'
    monto = data.get('monto')
    descripcion = data.get('descripcion', '')
    
    if not all([empleado_id, tipo, monto]):
        return jsonify({'error': 'Datos incompletos'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO movimientos (empleado_id, fecha, tipo, monto, descripcion, descontado)
        VALUES (%s, %s, %s, %s, %s, FALSE)
    """, (empleado_id, fecha, tipo, monto, descripcion))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'success': True, 'mensaje': 'Movimiento registrado'})

# ==================== ENDPOINTS: PROPINAS/BONOS/DESCUENTOS ====================

@app.route('/api/nomina/propinas', methods=['POST', 'OPTIONS'])
def crear_propina():
    """Registrar propina individual o colectiva"""
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json
    
    fecha = data.get('fecha', now_colombia().date().isoformat())
    tipo = data.get('tipo')  # 'individual' o 'colectiva'
    monto = data.get('monto')
    descripcion = data.get('descripcion', '')
    empleados_ids = data.get('empleados_ids', [])  # Lista de IDs
    es_division = data.get('es_division', False)  # Si colectiva: dividir o no
    
    if not all([tipo, monto, empleados_ids]):
        return jsonify({'error': 'Datos incompletos'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Si es colectiva y se divide
    if tipo == 'colectiva' and es_division:
        monto_individual = monto / len(empleados_ids)
    else:
        monto_individual = monto
    
    for empleado_id in empleados_ids:
        cursor.execute("""
            INSERT INTO propinas (empleado_id, fecha, tipo, monto, descripcion, es_division, aplicada)
            VALUES (%s, %s, %s, %s, %s, %s, FALSE)
        """, (empleado_id, fecha, tipo, monto_individual, descripcion, es_division))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'success': True, 'mensaje': 'Propina registrada'})

@app.route('/api/nomina/bonos', methods=['POST', 'OPTIONS'])
def crear_bono():
    """Registrar bono individual o colectivo"""
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json
    
    fecha = data.get('fecha', now_colombia().date().isoformat())
    tipo = data.get('tipo')
    monto = data.get('monto')
    descripcion = data.get('descripcion', '')
    empleados_ids = data.get('empleados_ids', [])
    es_division = data.get('es_division', False)
    
    if not all([tipo, monto, empleados_ids]):
        return jsonify({'error': 'Datos incompletos'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if tipo == 'colectiva' and es_division:
        monto_individual = monto / len(empleados_ids)
    else:
        monto_individual = monto
    
    for empleado_id in empleados_ids:
        cursor.execute("""
            INSERT INTO bonos (empleado_id, fecha, tipo, monto, descripcion, es_division, aplicada)
            VALUES (%s, %s, %s, %s, %s, %s, FALSE)
        """, (empleado_id, fecha, tipo, monto_individual, descripcion, es_division))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'success': True, 'mensaje': 'Bono registrado'})

@app.route('/api/nomina/descuentos', methods=['POST', 'OPTIONS'])
def crear_descuento():
    """Registrar descuento individual o colectivo"""
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json
    
    fecha = data.get('fecha', now_colombia().date().isoformat())
    tipo = data.get('tipo')
    monto = data.get('monto')
    descripcion = data.get('descripcion', '')
    empleados_ids = data.get('empleados_ids', [])
    es_division = data.get('es_division', False)
    
    if not all([tipo, monto, empleados_ids]):
        return jsonify({'error': 'Datos incompletos'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if tipo == 'colectiva' and es_division:
        monto_individual = monto / len(empleados_ids)
    else:
        monto_individual = monto
    
    for empleado_id in empleados_ids:
        cursor.execute("""
            INSERT INTO descuentos (empleado_id, fecha, tipo, monto, descripcion, es_division, aplicada)
            VALUES (%s, %s, %s, %s, %s, %s, FALSE)
        """, (empleado_id, fecha, tipo, monto_individual, descripcion, es_division))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'success': True, 'mensaje': 'Descuento registrado'})

# ==================== ENDPOINTS: NÓMINAS ====================

@app.route('/api/nomina/calcular', methods=['POST', 'OPTIONS'])
def calcular_nomina_endpoint():
    """Calcular nómina de un empleado"""
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json
    
    empleado_id = data.get('empleado_id')
    tipo_nomina = data.get('tipo_nomina')  # 'quincenal' o 'semanal'
    periodo_inicio = data.get('periodo_inicio')
    periodo_fin = data.get('periodo_fin')
    
    # Opcional: ajustes manuales
    dias_completos = data.get('dias_completos')  # Si es None, calcula automático
    medios_sustitutos = data.get('medios_sustitutos', 0)
    medios_adicionales = data.get('medios_adicionales', 0)
    
    if not all([empleado_id, tipo_nomina, periodo_inicio, periodo_fin]):
        return jsonify({'error': 'Datos incompletos'}), 400
    
    resultado = calcular_nomina(
        empleado_id,
        tipo_nomina,
        periodo_inicio,
        periodo_fin,
        dias_completos,
        medios_sustitutos,
        medios_adicionales
    )
    
    if 'error' in resultado:
        return jsonify(resultado), 400
    
    return jsonify(resultado)

@app.route('/api/nomina/guardar', methods=['POST', 'OPTIONS'])
def guardar_nomina():
    """Guardar nómina calculada (sin pagar aún)"""
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json
    
    empleado_id = data.get('empleado_id')
    tipo_nomina = data.get('tipo_nomina')
    periodo_inicio = data.get('periodo_inicio')
    periodo_fin = data.get('periodo_fin')
    dias_trabajados = data.get('dias_trabajados')
    sueldo_base = data.get('sueldo_base')
    monto_base = data.get('monto_base')
    total_propinas = data.get('total_propinas', 0)
    total_bonos = data.get('total_bonos', 0)
    total_descuentos = data.get('total_descuentos', 0)
    total_movimientos = data.get('total_movimientos', 0)
    total_pagar = data.get('total_pagar')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO nominas (
            empleado_id, tipo_nomina, periodo_inicio, periodo_fin,
            dias_trabajados, sueldo_base, monto_base,
            total_propinas, total_bonos, total_descuentos, total_movimientos,
            total_pagar, pagada
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE)
        RETURNING id
    """, (
        empleado_id, tipo_nomina, periodo_inicio, periodo_fin,
        dias_trabajados, sueldo_base, monto_base,
        total_propinas, total_bonos, total_descuentos, total_movimientos,
        total_pagar
    ))
    
    nomina_id = cursor.fetchone()[0]
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'success': True, 'nomina_id': nomina_id})

@app.route('/api/nomina/pagar', methods=['POST', 'OPTIONS'])
def pagar_nomina():
    """Procesar pago de nómina"""
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json
    nomina_id = data.get('nomina_id')
    metodo_pago = data.get('metodo_pago', 'Efectivo')
    notas = data.get('notas', '')
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Obtener nómina
    cursor.execute("SELECT * FROM nominas WHERE id = %s", (nomina_id,))
    nomina = cursor.fetchone()
    
    if not nomina:
        cursor.close()
        conn.close()
        return jsonify({'error': 'Nómina no encontrada'}), 404
    
    if nomina['pagada']:
        cursor.close()
        conn.close()
        return jsonify({'error': 'Nómina ya fue pagada'}), 400
    
    # Marcar nómina como pagada
    cursor.execute("""
        UPDATE nominas
        SET pagada = TRUE, fecha_pago = %s, metodo_pago = %s, notas = %s
        WHERE id = %s
    """, (now_colombia(), metodo_pago, notas, nomina_id))
    
    # Marcar movimientos como descontados
    cursor.execute("""
        UPDATE movimientos
        SET descontado = TRUE, nomina_id = %s
        WHERE empleado_id = %s AND descontado = FALSE
    """, (nomina_id, nomina['empleado_id']))
    
    # Marcar propinas como aplicadas
    cursor.execute("""
        UPDATE propinas
        SET aplicada = TRUE, nomina_id = %s
        WHERE empleado_id = %s AND aplicada = FALSE
    """, (nomina_id, nomina['empleado_id']))
    
    # Marcar bonos como aplicados
    cursor.execute("""
        UPDATE bonos
        SET aplicada = TRUE, nomina_id = %s
        WHERE empleado_id = %s AND aplicada = FALSE
    """, (nomina_id, nomina['empleado_id']))
    
    # Marcar descuentos como aplicados
    cursor.execute("""
        UPDATE descuentos
        SET aplicada = TRUE, nomina_id = %s
        WHERE empleado_id = %s AND aplicada = FALSE
    """, (nomina_id, nomina['empleado_id']))
    
    # Registrar pago
    cursor.execute("""
        INSERT INTO pagos (
            nomina_id, empleado_id, fecha_pago, periodo,
            monto_base, propinas, bonos, descuentos, movimientos, total_pagado,
            metodo_pago, notas
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        nomina_id,
        nomina['empleado_id'],
        now_colombia(),
        f"{nomina['periodo_inicio']} a {nomina['periodo_fin']}",
        nomina['monto_base'],
        nomina['total_propinas'],
        nomina['total_bonos'],
        nomina['total_descuentos'],
        nomina['total_movimientos'],
        nomina['total_pagar'],
        metodo_pago,
        notas
    ))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'success': True, 'mensaje': 'Pago procesado exitosamente'})

@app.route('/api/nomina/pendientes', methods=['GET', 'OPTIONS'])
def nominas_pendientes():
    """Listar nóminas sin pagar"""
    if request.method == 'OPTIONS':
        return '', 204
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("""
        SELECT n.*, e.nombre as empleado_nombre
        FROM nominas n
        JOIN empleados e ON n.empleado_id = e.id
        WHERE n.pagada = FALSE
        ORDER BY n.created_at DESC
    """)
    
    nominas = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return jsonify([serializar_dict(dict(n)) for n in nominas])

# ==================== ENDPOINT DE SALUD ====================

@app.route('/health', methods=['GET'])
def health():
    """Health check para Render"""
    return jsonify({'status': 'healthy', 'service': 'gestor-nomina'})

@app.route('/', methods=['GET'])
def home():
    """Ruta raíz"""
    return jsonify({
        'service': 'Gestor de Nómina API',
        'version': '1.0',
        'status': 'running'
    })

# ==================== MAIN ====================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
