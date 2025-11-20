-- =====================================================
-- TABLAS GESTOR DE NÓMINA - ENRUANADOS GOURMET
-- =====================================================

-- Nota: La tabla empleados ya existe desde el sistema de asistencia
-- Solo agregamos los campos faltantes

ALTER TABLE empleados 
ADD COLUMN IF NOT EXISTS sueldo_mensual DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tipo_pago VARCHAR(20) DEFAULT 'quincenal';

-- =====================================================
-- TABLA: turnos
-- Registro de días trabajados por quincena/semana
-- =====================================================
CREATE TABLE IF NOT EXISTS turnos (
    id SERIAL PRIMARY KEY,
    empleado_id INTEGER REFERENCES empleados(id) ON DELETE CASCADE,
    quincena_inicio DATE NOT NULL,
    quincena_fin DATE NOT NULL,
    
    -- Días trabajados
    dias_completos INTEGER DEFAULT 0,
    medios_sustitutos FLOAT DEFAULT 0,  -- 0.5 por cada medio
    medios_adicionales FLOAT DEFAULT 0,  -- 0.5 por cada medio extra
    dias_extras INTEGER DEFAULT 0,
    faltas INTEGER DEFAULT 0,
    
    -- Calculado
    total_dias_efectivos FLOAT GENERATED ALWAYS AS (
        dias_completos + medios_sustitutos + medios_adicionales + dias_extras
    ) STORED,
    
    notas TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(empleado_id, quincena_inicio, quincena_fin)
);

CREATE INDEX idx_turnos_empleado ON turnos(empleado_id);
CREATE INDEX idx_turnos_periodo ON turnos(quincena_inicio, quincena_fin);

-- =====================================================
-- TABLA: movimientos
-- Adelantos y consumos de empleados
-- =====================================================
CREATE TABLE IF NOT EXISTS movimientos (
    id SERIAL PRIMARY KEY,
    empleado_id INTEGER REFERENCES empleados(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    tipo VARCHAR(20) NOT NULL,  -- 'adelanto', 'consumo'
    monto DECIMAL(10,2) NOT NULL,
    descripcion TEXT,
    descontado BOOLEAN DEFAULT FALSE,
    nomina_id INTEGER,  -- Referencia a la nómina donde se descontó
    created_at TIMESTAMP DEFAULT NOW(),
    
    CHECK (tipo IN ('adelanto', 'consumo')),
    CHECK (monto >= 0)
);

CREATE INDEX idx_movimientos_empleado ON movimientos(empleado_id);
CREATE INDEX idx_movimientos_fecha ON movimientos(fecha);
CREATE INDEX idx_movimientos_descontado ON movimientos(descontado);

-- =====================================================
-- TABLA: nominas
-- Nóminas generadas (quincenales/semanales)
-- =====================================================
CREATE TABLE IF NOT EXISTS nominas (
    id SERIAL PRIMARY KEY,
    empleado_id INTEGER REFERENCES empleados(id) ON DELETE CASCADE,
    tipo_nomina VARCHAR(20) NOT NULL,  -- 'quincenal', 'semanal'
    periodo_inicio DATE NOT NULL,
    periodo_fin DATE NOT NULL,
    
    -- Cálculos base
    dias_trabajados FLOAT DEFAULT 0,
    sueldo_base DECIMAL(10,2) DEFAULT 0,
    monto_base DECIMAL(10,2) DEFAULT 0,  -- Después de descuentos por faltas
    
    -- Ajustes
    total_propinas DECIMAL(10,2) DEFAULT 0,
    total_bonos DECIMAL(10,2) DEFAULT 0,
    total_descuentos DECIMAL(10,2) DEFAULT 0,
    total_movimientos DECIMAL(10,2) DEFAULT 0,
    
    -- Total final
    total_pagar DECIMAL(10,2) NOT NULL,
    
    -- Estado
    pagada BOOLEAN DEFAULT FALSE,
    fecha_pago TIMESTAMP,
    metodo_pago VARCHAR(50),
    notas TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CHECK (tipo_nomina IN ('quincenal', 'semanal'))
);

CREATE INDEX idx_nominas_empleado ON nominas(empleado_id);
CREATE INDEX idx_nominas_periodo ON nominas(periodo_inicio, periodo_fin);
CREATE INDEX idx_nominas_pagada ON nominas(pagada);

-- =====================================================
-- TABLA: propinas
-- Propinas individuales o colectivas
-- =====================================================
CREATE TABLE IF NOT EXISTS propinas (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    tipo VARCHAR(20) NOT NULL,  -- 'individual', 'colectiva'
    empleado_id INTEGER REFERENCES empleados(id) ON DELETE CASCADE,
    monto DECIMAL(10,2) NOT NULL,
    descripcion TEXT,
    aplicada BOOLEAN DEFAULT FALSE,
    nomina_id INTEGER REFERENCES nominas(id) ON DELETE SET NULL,
    es_division BOOLEAN DEFAULT FALSE,  -- Si es colectiva: true=dividir, false=valor completo
    created_at TIMESTAMP DEFAULT NOW(),
    
    CHECK (tipo IN ('individual', 'colectiva')),
    CHECK (monto >= 0)
);

CREATE INDEX idx_propinas_empleado ON propinas(empleado_id);
CREATE INDEX idx_propinas_aplicada ON propinas(aplicada);
CREATE INDEX idx_propinas_fecha ON propinas(fecha);

-- =====================================================
-- TABLA: bonos
-- Bonos por desempeño individuales o colectivos
-- =====================================================
CREATE TABLE IF NOT EXISTS bonos (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    tipo VARCHAR(20) NOT NULL,  -- 'individual', 'colectiva'
    empleado_id INTEGER REFERENCES empleados(id) ON DELETE CASCADE,
    monto DECIMAL(10,2) NOT NULL,
    descripcion TEXT,
    aplicada BOOLEAN DEFAULT FALSE,
    nomina_id INTEGER REFERENCES nominas(id) ON DELETE SET NULL,
    es_division BOOLEAN DEFAULT FALSE,  -- Si es colectiva: true=dividir, false=valor completo
    created_at TIMESTAMP DEFAULT NOW(),
    
    CHECK (tipo IN ('individual', 'colectiva')),
    CHECK (monto >= 0)
);

CREATE INDEX idx_bonos_empleado ON bonos(empleado_id);
CREATE INDEX idx_bonos_aplicada ON bonos(aplicada);
CREATE INDEX idx_bonos_fecha ON bonos(fecha);

-- =====================================================
-- TABLA: descuentos
-- Descuentos o deducciones
-- =====================================================
CREATE TABLE IF NOT EXISTS descuentos (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    tipo VARCHAR(20) NOT NULL,  -- 'individual', 'colectiva'
    empleado_id INTEGER REFERENCES empleados(id) ON DELETE CASCADE,
    monto DECIMAL(10,2) NOT NULL,
    descripcion TEXT,
    aplicada BOOLEAN DEFAULT FALSE,
    nomina_id INTEGER REFERENCES nominas(id) ON DELETE SET NULL,
    es_division BOOLEAN DEFAULT FALSE,  -- Si es colectiva: true=dividir, false=valor completo
    created_at TIMESTAMP DEFAULT NOW(),
    
    CHECK (tipo IN ('individual', 'colectiva')),
    CHECK (monto >= 0)
);

CREATE INDEX idx_descuentos_empleado ON descuentos(empleado_id);
CREATE INDEX idx_descuentos_aplicada ON descuentos(aplicada);
CREATE INDEX idx_descuentos_fecha ON descuentos(fecha);

-- =====================================================
-- TABLA: pagos
-- Histórico de pagos realizados
-- =====================================================
CREATE TABLE IF NOT EXISTS pagos (
    id SERIAL PRIMARY KEY,
    nomina_id INTEGER REFERENCES nominas(id) ON DELETE CASCADE,
    empleado_id INTEGER REFERENCES empleados(id) ON DELETE CASCADE,
    fecha_pago TIMESTAMP NOT NULL,
    periodo VARCHAR(100) NOT NULL,
    
    -- Desglose del pago
    monto_base DECIMAL(10,2) DEFAULT 0,
    propinas DECIMAL(10,2) DEFAULT 0,
    bonos DECIMAL(10,2) DEFAULT 0,
    descuentos DECIMAL(10,2) DEFAULT 0,
    movimientos DECIMAL(10,2) DEFAULT 0,
    total_pagado DECIMAL(10,2) NOT NULL,
    
    metodo_pago VARCHAR(50),
    notas TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    
    CHECK (total_pagado >= 0)
);

CREATE INDEX idx_pagos_empleado ON pagos(empleado_id);
CREATE INDEX idx_pagos_fecha ON pagos(fecha_pago);
CREATE INDEX idx_pagos_nomina ON pagos(nomina_id);

-- =====================================================
-- TABLA: pagos_revertidos
-- Histórico de pagos que fueron revertidos
-- =====================================================
CREATE TABLE IF NOT EXISTS pagos_revertidos (
    id SERIAL PRIMARY KEY,
    pago_id INTEGER NOT NULL,  -- ID del pago original
    empleado_id INTEGER REFERENCES empleados(id) ON DELETE CASCADE,
    fecha_reversion TIMESTAMP NOT NULL,
    pago_original_fecha TIMESTAMP NOT NULL,
    monto_revertido DECIMAL(10,2) NOT NULL,
    propina_revertida DECIMAL(10,2) DEFAULT 0,
    motivo VARCHAR(200),
    comentario TEXT,
    nominas_restauradas TEXT,  -- JSON con IDs de nóminas restauradas
    movimientos_restaurados TEXT,  -- JSON con IDs de movimientos restaurados
    revertido_por VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pagos_revertidos_empleado ON pagos_revertidos(empleado_id);
CREATE INDEX idx_pagos_revertidos_fecha ON pagos_revertidos(fecha_reversion);

-- =====================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION actualizar_fecha_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para tabla turnos
DROP TRIGGER IF EXISTS trigger_turnos_updated ON turnos;
CREATE TRIGGER trigger_turnos_updated
    BEFORE UPDATE ON turnos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_modificacion();

-- Trigger para tabla nominas
DROP TRIGGER IF EXISTS trigger_nominas_updated ON nominas;
CREATE TRIGGER trigger_nominas_updated
    BEFORE UPDATE ON nominas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_modificacion();

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de nóminas pendientes con detalles
CREATE OR REPLACE VIEW nominas_pendientes AS
SELECT 
    n.id,
    n.empleado_id,
    e.nombre as empleado_nombre,
    n.tipo_nomina,
    n.periodo_inicio,
    n.periodo_fin,
    n.monto_base,
    n.total_propinas,
    n.total_bonos,
    n.total_descuentos,
    n.total_movimientos,
    n.total_pagar,
    n.created_at
FROM nominas n
JOIN empleados e ON n.empleado_id = e.id
WHERE n.pagada = FALSE
ORDER BY n.periodo_inicio DESC;

-- Vista de movimientos pendientes
CREATE OR REPLACE VIEW movimientos_pendientes AS
SELECT 
    m.id,
    m.empleado_id,
    e.nombre as empleado_nombre,
    m.fecha,
    m.tipo,
    m.monto,
    m.descripcion,
    m.created_at
FROM movimientos m
JOIN empleados e ON m.empleado_id = e.id
WHERE m.descontado = FALSE
ORDER BY m.fecha DESC;

-- Vista de propinas/bonos pendientes por empleado
CREATE OR REPLACE VIEW ajustes_pendientes AS
SELECT 
    empleado_id,
    e.nombre as empleado_nombre,
    SUM(CASE WHEN tipo = 'propina' THEN monto ELSE 0 END) as propinas_pendientes,
    SUM(CASE WHEN tipo = 'bono' THEN monto ELSE 0 END) as bonos_pendientes,
    SUM(CASE WHEN tipo = 'descuento' THEN monto ELSE 0 END) as descuentos_pendientes
FROM (
    SELECT empleado_id, 'propina' as tipo, monto FROM propinas WHERE aplicada = FALSE
    UNION ALL
    SELECT empleado_id, 'bono' as tipo, monto FROM bonos WHERE aplicada = FALSE
    UNION ALL
    SELECT empleado_id, 'descuento' as tipo, monto FROM descuentos WHERE aplicada = FALSE
) ajustes
JOIN empleados e ON ajustes.empleado_id = e.id
GROUP BY empleado_id, e.nombre;

-- =====================================================
-- COMENTARIOS EN TABLAS
-- =====================================================

COMMENT ON TABLE turnos IS 'Registro de días trabajados por periodo (quincena/semana)';
COMMENT ON TABLE movimientos IS 'Adelantos y consumos de empleados';
COMMENT ON TABLE nominas IS 'Nóminas generadas y pagadas';
COMMENT ON TABLE propinas IS 'Propinas individuales o colectivas';
COMMENT ON TABLE bonos IS 'Bonos por desempeño';
COMMENT ON TABLE descuentos IS 'Descuentos o deducciones';
COMMENT ON TABLE pagos IS 'Histórico de pagos realizados';
COMMENT ON TABLE pagos_revertidos IS 'Histórico de reversiones de pagos';

-- =====================================================
-- COMPLETADO
-- =====================================================
-- Las tablas del gestor de nómina han sido creadas exitosamente
