// Configuración de la API
const API_BASE_URL = 'https://gestor-nomina.emarodri834.workers.dev';

const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  
  ENDPOINTS: {
    // Health check
    HEALTH: '/health',
    
    // Empleados
    EMPLEADOS: '/api/nomina/empleados',
    EMPLEADOS_TODOS: '/api/nomina/empleados/todos',
    EMPLEADO: (id) => `/api/nomina/empleados/${id}`,
    EMPLEADO_ESTADO: (id) => `/api/nomina/empleados/${id}/estado`,
    
    // FUDO - Mapeo
    FUDO_MAPEAR_USUARIO: (id) => `/api/nomina/fudo/mapear-usuario/${id}`,
    FUDO_VINCULAR_CUSTOMER: (id) => `/api/nomina/fudo/vincular-customer/${id}`,
    FUDO_VERIFICAR_SYNC: (id) => `/api/nomina/fudo/verificar-sync/${id}`,
    
    // FUDO - Sincronización
    FUDO_SINCRONIZAR_CONSUMOS: (id) => `/api/nomina/fudo/sincronizar-consumos/${id}`,
    FUDO_SINCRONIZAR_TODOS_CONSUMOS: '/api/nomina/fudo/sincronizar-todos-consumos',
    FUDO_SINCRONIZAR_MOVIMIENTOS_CAJA: '/api/nomina/fudo/sincronizar-movimientos-caja',
    FUDO_SINCRONIZAR_TODOS_MOVIMIENTOS_CAJA: '/api/nomina/fudo/sincronizar-todos-movimientos-caja',
    FUDO_SINCRONIZAR_AHORA: '/api/nomina/fudo/sincronizar-ahora',
    
    // FUDO - Debug
    FUDO_DEBUG_CUENTA_CORRIENTE: (id) => `/api/nomina/fudo/debug-cuenta-corriente/${id}`,
    FUDO_DEBUG_VENTAS: (id) => `/api/nomina/fudo/debug-ventas/${id}`,
    FUDO_PAYMENT_METHODS: '/api/nomina/fudo/payment-methods',
    
    // Movimientos
    MOVIMIENTOS: '/api/nomina/movimientos',
    MOVIMIENTOS_PENDIENTES: '/api/nomina/movimientos/pendientes',
    MOVIMIENTO: (id) => `/api/nomina/movimientos/${id}`,
    MOVIMIENTO_EDITAR_MONTO: (id) => `/api/nomina/movimientos/${id}/editar-monto`,
    MOVIMIENTO_APLICAR_DESCUENTO_15: (id) => `/api/nomina/movimientos/${id}/aplicar-descuento-15`,
    MOVIMIENTO_SALDO: (id) => `/api/nomina/movimientos/saldo/${id}`,
    MOVIMIENTO_EMPLEADO: (id) => `/api/nomina/movimientos/empleado/${id}`,
    MOVIMIENTO_GENERAR_CODIGO: '/api/nomina/movimientos/generar-codigo',
    MOVIMIENTO_CODIGOS_EMPLEADOS: '/api/nomina/movimientos/codigos-empleados',
    MOVIMIENTO_ADELANTO: '/api/nomina/movimientos/adelanto',
    
    // Nóminas
    NOMINAS: '/api/nomina/nominas',
    NOMINAS_LISTAR: '/api/nomina/nominas/listar',
    NOMINA: (id) => `/api/nomina/nominas/${id}`,
    NOMINA_VER_DESCUENTOS: (id) => `/api/nomina/nominas/${id}/ver-descuentos`,
    NOMINA_MODIFICAR_DESCUENTOS: (id) => `/api/nomina/nominas/${id}/modificar-descuentos`,
    NOMINA_PAGAR: (id) => `/api/nomina/nominas/${id}/pagar`,
    NOMINA_AGREGAR_MOVIMIENTOS: (id) => `/api/nomina/nominas/${id}/agregar-movimientos`,
    NOMINA_PAGO_PARCIAL_GLOBAL: (id) => `/api/nomina/nominas/${id}/pago-parcial-global`,
    NOMINA_ACTUALIZAR: (id) => `/api/nomina/nominas/${id}/actualizar`,
  }
};

// Helper para hacer peticiones
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error en la petición' }));
      throw new Error(errorData.error || `Error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

export default API_CONFIG;
