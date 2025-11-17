#!/usr/bin/env python3
"""
Migración de Gestor de Nómina CSV → PostgreSQL
Enruanados Gourmet

Este script migra todos los datos históricos del gestor de nómina
desde archivos CSV a la base de datos PostgreSQL.
"""

import os
import sys
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime
import uuid

# Configuración de la base de datos
DATABASE_URL = "postgresql://asistencia_user:MOfV5aQyRbwD1bSnGntis9VlTTogCcoP@dpg-d4d82r2dbo4c73dm1us0-a.oregon-postgres.render.com/asistencia_uri6"

# Archivos CSV
ARCHIVOS = {
    "empleados": "empleados.csv",
    "turnos": "turnos.csv",
    "movimientos": "movimientos.csv",
    "nominas": "nominas_activas.csv",
    "pagos": "pagos.csv",
    "propinas": "propinas.csv",
    "bonos": "bonos.csv",
    "descuentos": "descuentos.csv",
    "pagos_revertidos": "pagos_revertidos.csv"
}

def conectar_db():
    """Conectar a PostgreSQL"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"❌ Error conectando a PostgreSQL: {e}")
        sys.exit(1)

def limpiar_valor(valor, es_numero=False):
    """Limpia y normaliza valores de CSV"""
    if pd.isna(valor) or valor == '' or valor == 'nan':
        return None if not es_numero else 0.0
    
    if es_numero:
        try:
            return float(valor)
        except (ValueError, TypeError):
            return 0.0
    else:
        return str(valor).strip()

def obtener_o_crear_empleado(cursor, nombre, sueldo=None, tipo_pago=None, estado=None):
    """
    Obtiene el ID de un empleado por nombre, o lo crea si no existe.
    Si ya existe en la BD del sistema de asistencia, actualiza sueldo y tipo_pago.
    """
    nombre_limpio = limpiar_valor(nombre)
    if not nombre_limpio:
        return None
    
    # Buscar empleado existente
    cursor.execute("SELECT id, sueldo_mensual, tipo_pago FROM empleados WHERE nombre ILIKE %s", (nombre_limpio,))
    empleado = cursor.fetchone()
    
    if empleado:
        empleado_id = empleado[0]
        # Actualizar sueldo y tipo_pago si se proporcionan
        if sueldo is not None or tipo_pago is not None:
            updates = []
            params = []
            
            if sueldo is not None and sueldo > 0:
                updates.append("sueldo_mensual = %s")
                params.append(sueldo)
            
            if tipo_pago is not None:
                updates.append("tipo_pago = %s")
                params.append(tipo_pago)
            
            if updates:
                params.append(empleado_id)
                query = f"UPDATE empleados SET {', '.join(updates)} WHERE id = %s"
                cursor.execute(query, params)
        
        return empleado_id
    else:
        # Crear empleado nuevo (por si acaso hay empleados en CSV que no están en la BD)
        estado_final = estado if estado else 'ACTIVO'
        cedula_temp = f"NOM-{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO empleados (nombre, cedula, sueldo_mensual, tipo_pago, estado, fecha_registro)
            VALUES (%s, %s, %s, %s, %s, NOW())
            RETURNING id
        """, (nombre_limpio, cedula_temp, sueldo or 0, tipo_pago or 'quincenal', estado_final))
        return cursor.fetchone()[0]

def migrar_empleados(conn):
    """Migrar empleados.csv y actualizar sueldos en la BD"""
    print("\n🔄 Migrando empleados...")
    
    if not os.path.exists(ARCHIVOS["empleados"]):
        print("⚠️  Archivo empleados.csv no encontrado")
        return
    
    df = pd.read_csv(ARCHIVOS["empleados"])
    cursor = conn.cursor()
    
    actualizados = 0
    creados = 0
    
    for _, row in df.iterrows():
        nombre = limpiar_valor(row.get('nombre'))
        sueldo = limpiar_valor(row.get('sueldo_mensual'), es_numero=True)
        tipo_pago = limpiar_valor(row.get('tipo_pago')) or 'quincenal'
        estado = limpiar_valor(row.get('estado')) or 'ACTIVO'
        
        if not nombre:
            continue
        
        # Verificar si existe
        cursor.execute("SELECT id FROM empleados WHERE nombre ILIKE %s", (nombre,))
        existe = cursor.fetchone()
        
        if existe:
            # Actualizar
            cursor.execute("""
                UPDATE empleados 
                SET sueldo_mensual = %s, tipo_pago = %s, estado = %s
                WHERE nombre ILIKE %s
            """, (sueldo, tipo_pago, estado, nombre))
            actualizados += 1
        else:
            # Crear con cédula temporal si no existe
            import uuid
            cedula_temp = f"NOM-{str(uuid.uuid4())[:8]}"
            cursor.execute("""
                INSERT INTO empleados (nombre, cedula, sueldo_mensual, tipo_pago, estado, fecha_registro)
                VALUES (%s, %s, %s, %s, %s, NOW())
            """, (nombre, cedula_temp, sueldo, tipo_pago, estado))
            creados += 1
    
    conn.commit()
    cursor.close()
    print(f"✅ Empleados: {actualizados} actualizados, {creados} creados")

def migrar_movimientos(conn):
    """Migrar movimientos.csv"""
    print("\n🔄 Migrando movimientos...")
    
    if not os.path.exists(ARCHIVOS["movimientos"]):
        print("⚠️  Archivo movimientos.csv no encontrado")
        return
    
    df = pd.read_csv(ARCHIVOS["movimientos"])
    cursor = conn.cursor()
    
    insertados = 0
    
    for _, row in df.iterrows():
        nombre = limpiar_valor(row.get('nombre_empleado'))
        fecha = limpiar_valor(row.get('fecha'))
        tipo = limpiar_valor(row.get('tipo')) or 'consumo'
        monto = limpiar_valor(row.get('monto'), es_numero=True)
        descripcion = limpiar_valor(row.get('descripcion'))
        descontado = limpiar_valor(row.get('descontado')) == 'si'
        
        if not nombre or not fecha or monto <= 0:
            continue
        
        empleado_id = obtener_o_crear_empleado(cursor, nombre)
        if not empleado_id:
            continue
        
        cursor.execute("""
            INSERT INTO movimientos (empleado_id, fecha, tipo, monto, descripcion, descontado, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (empleado_id, fecha, tipo, monto, descripcion, descontado))
        insertados += 1
    
    conn.commit()
    cursor.close()
    print(f"✅ Movimientos: {insertados} registros insertados")

def migrar_propinas(conn):
    """Migrar propinas.csv"""
    print("\n🔄 Migrando propinas...")
    
    if not os.path.exists(ARCHIVOS["propinas"]):
        print("⚠️  Archivo propinas.csv no encontrado")
        return
    
    df = pd.read_csv(ARCHIVOS["propinas"])
    cursor = conn.cursor()
    
    insertados = 0
    
    for _, row in df.iterrows():
        nombre = limpiar_valor(row.get('nombre_empleado'))
        fecha = limpiar_valor(row.get('fecha'))
        tipo = limpiar_valor(row.get('tipo_propina')) or 'individual'
        monto = limpiar_valor(row.get('monto'), es_numero=True)
        descripcion = limpiar_valor(row.get('descripcion'))
        aplicada = limpiar_valor(row.get('aplicada')) in ['si', 'pagado']
        
        if not nombre or not fecha or monto <= 0:
            continue
        
        empleado_id = obtener_o_crear_empleado(cursor, nombre)
        if not empleado_id:
            continue
        
        cursor.execute("""
            INSERT INTO propinas (empleado_id, fecha, tipo, monto, descripcion, aplicada, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (empleado_id, fecha, tipo, monto, descripcion, aplicada))
        insertados += 1
    
    conn.commit()
    cursor.close()
    print(f"✅ Propinas: {insertados} registros insertados")

def migrar_bonos(conn):
    """Migrar bonos.csv"""
    print("\n🔄 Migrando bonos...")
    
    if not os.path.exists(ARCHIVOS["bonos"]):
        print("⚠️  Archivo bonos.csv no encontrado")
        return
    
    df = pd.read_csv(ARCHIVOS["bonos"])
    cursor = conn.cursor()
    
    insertados = 0
    
    for _, row in df.iterrows():
        nombre = limpiar_valor(row.get('nombre_empleado'))
        fecha = limpiar_valor(row.get('fecha'))
        tipo = limpiar_valor(row.get('tipo_bono')) or 'individual'
        monto = limpiar_valor(row.get('monto'), es_numero=True)
        descripcion = limpiar_valor(row.get('descripcion'))
        aplicada = limpiar_valor(row.get('aplicada')) in ['si', 'pagado']
        
        if not nombre or not fecha or monto <= 0:
            continue
        
        empleado_id = obtener_o_crear_empleado(cursor, nombre)
        if not empleado_id:
            continue
        
        cursor.execute("""
            INSERT INTO bonos (empleado_id, fecha, tipo, monto, descripcion, aplicada, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (empleado_id, fecha, tipo, monto, descripcion, aplicada))
        insertados += 1
    
    conn.commit()
    cursor.close()
    print(f"✅ Bonos: {insertados} registros insertados")

def migrar_descuentos(conn):
    """Migrar descuentos.csv"""
    print("\n🔄 Migrando descuentos...")
    
    if not os.path.exists(ARCHIVOS["descuentos"]):
        print("⚠️  Archivo descuentos.csv no encontrado")
        return
    
    df = pd.read_csv(ARCHIVOS["descuentos"])
    cursor = conn.cursor()
    
    insertados = 0
    
    for _, row in df.iterrows():
        nombre = limpiar_valor(row.get('nombre_empleado'))
        fecha = limpiar_valor(row.get('fecha'))
        tipo = limpiar_valor(row.get('tipo_descuento')) or 'individual'
        monto = limpiar_valor(row.get('monto'), es_numero=True)
        descripcion = limpiar_valor(row.get('descripcion'))
        aplicada = limpiar_valor(row.get('aplicada')) in ['si', 'pagado']
        
        if not nombre or not fecha or monto <= 0:
            continue
        
        empleado_id = obtener_o_crear_empleado(cursor, nombre)
        if not empleado_id:
            continue
        
        cursor.execute("""
            INSERT INTO descuentos (empleado_id, fecha, tipo, monto, descripcion, aplicada, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (empleado_id, fecha, tipo, monto, descripcion, aplicada))
        insertados += 1
    
    conn.commit()
    cursor.close()
    print(f"✅ Descuentos: {insertados} registros insertados")

def crear_backup():
    """Crear backup de los CSVs antes de migrar"""
    print("\n📦 Creando backup de archivos CSV...")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = f"backup_csv_{timestamp}"
    
    try:
        os.makedirs(backup_dir, exist_ok=True)
        
        for nombre, archivo in ARCHIVOS.items():
            if os.path.exists(archivo):
                import shutil
                shutil.copy2(archivo, os.path.join(backup_dir, archivo))
        
        print(f"✅ Backup creado en: {backup_dir}/")
    except Exception as e:
        print(f"⚠️  Error creando backup: {e}")

def main():
    print("="*60)
    print("🚀 MIGRACIÓN: GESTOR DE NÓMINA CSV → PostgreSQL")
    print("="*60)
    
    # Crear backup
    crear_backup()
    
    # Conectar a la base de datos
    print("\n🔌 Conectando a PostgreSQL...")
    conn = conectar_db()
    print("✅ Conexión establecida")
    
    try:
        # Migrar datos
        migrar_empleados(conn)
        migrar_movimientos(conn)
        migrar_propinas(conn)
        migrar_bonos(conn)
        migrar_descuentos(conn)
        
        print("\n" + "="*60)
        print("✅ MIGRACIÓN COMPLETADA EXITOSAMENTE")
        print("="*60)
        print("\n📊 Resumen:")
        
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM empleados WHERE sueldo_mensual > 0")
        empleados_con_sueldo = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM movimientos")
        total_movimientos = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM propinas")
        total_propinas = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM bonos")
        total_bonos = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM descuentos")
        total_descuentos = cursor.fetchone()[0]
        
        print(f"  • Empleados con sueldo: {empleados_con_sueldo}")
        print(f"  • Movimientos: {total_movimientos}")
        print(f"  • Propinas: {total_propinas}")
        print(f"  • Bonos: {total_bonos}")
        print(f"  • Descuentos: {total_descuentos}")
        
        cursor.close()
        
    except Exception as e:
        print(f"\n❌ Error durante la migración: {e}")
        conn.rollback()
    finally:
        conn.close()
        print("\n🔌 Conexión cerrada")

if __name__ == "__main__":
    main()
