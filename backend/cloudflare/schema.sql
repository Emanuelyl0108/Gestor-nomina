-- =====================================================
-- SCHEMA CLOUDFLARE D1 - GESTOR DE NÓMINA
-- Adaptado desde PostgreSQL a SQLite
-- =====================================================

-- TABLA: empleados (compartida con sistema de asistencia)
CREATE TABLE IF NOT EXISTS empleados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    cedula TEXT UNIQUE,
    email TEXT,
    telefono TEXT,
    rol TEXT NOT NULL,
    sueldo_mensual REAL DEFAULT 0,
    tipo_pago TEXT DEFAULT 'quincenal',
    estado TEXT DEFAULT 'ACTIVO',
    fecha_registro TEXT DEFAULT (datetime('now')),
    CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    CHECK (tipo_pago IN ('quincenal', 'semanal'))
);

-- TABLA: marcajes (del sistema de asistencia)
CREATE TABLE IF NOT EXISTS marcajes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empleado_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    tipo TEXT NOT NULL,
    latitud REAL,
    longitud REAL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    CHECK (tipo IN ('entrada', 'salida'))
);

-- TABLA: turnos
CREATE TABLE IF NOT EXISTS turnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empleado_id INTEGER NOT NULL,
    quincena_inicio TEXT NOT NULL,
    quincena_fin TEXT NOT NULL,
    dias_completos INTEGER DEFAULT 0,
    medios_sustitutos REAL DEFAULT 0,
    medios_adicionales REAL DEFAULT 0,
    dias_extras INTEGER DEFAULT 0,
    faltas INTEGER DEFAULT 0,
    notas TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    UNIQUE(empleado_id, quincena_inicio, quincena_fin)
);

-- TABLA: movimientos (adelantos y consumos)
CREATE TABLE IF NOT EXISTS movimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empleado_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    tipo TEXT NOT NULL,
    monto REAL NOT NULL,
    descripcion TEXT,
    descontado INTEGER DEFAULT 0,
    nomina_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    CHECK (tipo IN ('adelanto', 'consumo')),
    CHECK (monto >= 0),
    CHECK (descontado IN (0, 1))
);

-- TABLA: nominas
CREATE TABLE IF NOT EXISTS nominas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empleado_id INTEGER NOT NULL,
    tipo_nomina TEXT NOT NULL,
    periodo_inicio TEXT NOT NULL,
    periodo_fin TEXT NOT NULL,
    dias_trabajados REAL DEFAULT 0,
    sueldo_base REAL DEFAULT 0,
    monto_base REAL DEFAULT 0,
    total_propinas REAL DEFAULT 0,
    total_bonos REAL DEFAULT 0,
    total_descuentos REAL DEFAULT 0,
    total_movimientos REAL DEFAULT 0,
    total_pagar REAL NOT NULL,
    pagada INTEGER DEFAULT 0,
    fecha_pago TEXT,
    metodo_pago TEXT,
    notas TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    CHECK (tipo_nomina IN ('quincenal', 'semanal')),
    CHECK (pagada IN (0, 1))
);

-- TABLA: propinas
CREATE TABLE IF NOT EXISTS propinas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    tipo TEXT NOT NULL,
    empleado_id INTEGER NOT NULL,
    monto REAL NOT NULL,
    descripcion TEXT,
    aplicada INTEGER DEFAULT 0,
    nomina_id INTEGER,
    es_division INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    FOREIGN KEY (nomina_id) REFERENCES nominas(id) ON DELETE SET NULL,
    CHECK (tipo IN ('individual', 'colectiva')),
    CHECK (monto >= 0),
    CHECK (aplicada IN (0, 1)),
    CHECK (es_division IN (0, 1))
);

-- TABLA: bonos
CREATE TABLE IF NOT EXISTS bonos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    tipo TEXT NOT NULL,
    empleado_id INTEGER NOT NULL,
    monto REAL NOT NULL,
    descripcion TEXT,
    aplicada INTEGER DEFAULT 0,
    nomina_id INTEGER,
    es_division INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    FOREIGN KEY (nomina_id) REFERENCES nominas(id) ON DELETE SET NULL,
    CHECK (tipo IN ('individual', 'colectiva')),
    CHECK (monto >= 0),
    CHECK (aplicada IN (0, 1)),
    CHECK (es_division IN (0, 1))
);

-- TABLA: descuentos
CREATE TABLE IF NOT EXISTS descuentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    tipo TEXT NOT NULL,
    empleado_id INTEGER NOT NULL,
    monto REAL NOT NULL,
    descripcion TEXT,
    aplicada INTEGER DEFAULT 0,
    nomina_id INTEGER,
    es_division INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    FOREIGN KEY (nomina_id) REFERENCES nominas(id) ON DELETE SET NULL,
    CHECK (tipo IN ('individual', 'colectiva')),
    CHECK (monto >= 0),
    CHECK (aplicada IN (0, 1)),
    CHECK (es_division IN (0, 1))
);

-- TABLA: pagos
CREATE TABLE IF NOT EXISTS pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nomina_id INTEGER NOT NULL,
    empleado_id INTEGER NOT NULL,
    fecha_pago TEXT NOT NULL,
    periodo TEXT NOT NULL,
    monto_base REAL DEFAULT 0,
    propinas REAL DEFAULT 0,
    bonos REAL DEFAULT 0,
    descuentos REAL DEFAULT 0,
    movimientos REAL DEFAULT 0,
    total_pagado REAL NOT NULL,
    metodo_pago TEXT,
    notas TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (nomina_id) REFERENCES nominas(id) ON DELETE CASCADE,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    CHECK (total_pagado >= 0)
);

-- TABLA: pagos_revertidos
CREATE TABLE IF NOT EXISTS pagos_revertidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pago_id INTEGER NOT NULL,
    empleado_id INTEGER NOT NULL,
    fecha_reversion TEXT NOT NULL,
    pago_original_fecha TEXT NOT NULL,
    monto_revertido REAL NOT NULL,
    propina_revertida REAL DEFAULT 0,
    motivo TEXT,
    comentario TEXT,
    nominas_restauradas TEXT,
    movimientos_restaurados TEXT,
    revertido_por TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_empleados_estado ON empleados(estado);
CREATE INDEX IF NOT EXISTS idx_empleados_cedula ON empleados(cedula);

CREATE INDEX IF NOT EXISTS idx_marcajes_empleado ON marcajes(empleado_id);
CREATE INDEX IF NOT EXISTS idx_marcajes_fecha ON marcajes(fecha);
CREATE INDEX IF NOT EXISTS idx_marcajes_tipo ON marcajes(tipo);

CREATE INDEX IF NOT EXISTS idx_turnos_empleado ON turnos(empleado_id);
CREATE INDEX IF NOT EXISTS idx_turnos_periodo ON turnos(quincena_inicio, quincena_fin);

CREATE INDEX IF NOT EXISTS idx_movimientos_empleado ON movimientos(empleado_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_descontado ON movimientos(descontado);

CREATE INDEX IF NOT EXISTS idx_nominas_empleado ON nominas(empleado_id);
CREATE INDEX IF NOT EXISTS idx_nominas_periodo ON nominas(periodo_inicio, periodo_fin);
CREATE INDEX IF NOT EXISTS idx_nominas_pagada ON nominas(pagada);

CREATE INDEX IF NOT EXISTS idx_propinas_empleado ON propinas(empleado_id);
CREATE INDEX IF NOT EXISTS idx_propinas_aplicada ON propinas(aplicada);
CREATE INDEX IF NOT EXISTS idx_propinas_fecha ON propinas(fecha);

CREATE INDEX IF NOT EXISTS idx_bonos_empleado ON bonos(empleado_id);
CREATE INDEX IF NOT EXISTS idx_bonos_aplicada ON bonos(aplicada);
CREATE INDEX IF NOT EXISTS idx_bonos_fecha ON bonos(fecha);

CREATE INDEX IF NOT EXISTS idx_descuentos_empleado ON descuentos(empleado_id);
CREATE INDEX IF NOT EXISTS idx_descuentos_aplicada ON descuentos(aplicada);
CREATE INDEX IF NOT EXISTS idx_descuentos_fecha ON descuentos(fecha);

CREATE INDEX IF NOT EXISTS idx_pagos_empleado ON pagos(empleado_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_nomina ON pagos(nomina_id);

CREATE INDEX IF NOT EXISTS idx_pagos_revertidos_empleado ON pagos_revertidos(empleado_id);
CREATE INDEX IF NOT EXISTS idx_pagos_revertidos_fecha ON pagos_revertidos(fecha_reversion);

-- =====================================================
-- DATOS DE PRUEBA (OPCIONAL)
-- =====================================================

-- Insertar empleados de ejemplo
INSERT OR IGNORE INTO empleados (nombre, cedula, email, rol, sueldo_mensual, tipo_pago, estado) VALUES
('Juan Pérez', '1234567890', 'juan@example.com', 'Mesero', 1300000, 'quincenal', 'ACTIVO'),
('María García', '0987654321', 'maria@example.com', 'Cocinera', 1500000, 'quincenal', 'ACTIVO'),
('Carlos López', '5555555555', 'carlos@example.com', 'Cajero', 1200000, 'semanal', 'ACTIVO');
