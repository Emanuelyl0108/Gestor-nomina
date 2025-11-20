// src/config/api.js
// Configuración centralizada de la API

const API_CONFIG = {
  // URL base de la API (Cloudflare Workers)
  BASE_URL: process.env.REACT_APP_API_URL || 'https://gestor-nomina-api.emarodri834.workers.dev',
  
  // Endpoints principales
  ENDPOINTS: {
    // Empleados
    EMPLEADOS: '/api/nomina/empleados',
    EMPLEADO: (id) => `/api/nomina/empleados/${id}`,
    
    // Movimientos
    MOVIMIENTOS: '/api/nomina/movimientos',
    MOVIMIENTOS_PENDIENTES: '/api/nomina/movimientos/pendientes',
    
    // Propinas, Bonos, Descuentos
    PROPINAS: '/api/nomina/propinas',
    BONOS: '/api/nomina/bonos',
    DESCUENTOS: '/api/nomina/descuentos',
    
    // Nóminas
    NOMINA_CALCULAR: '/api/nomina/calcular',
    NOMINA_GUARDAR: '/api/nomina/guardar',
    NOMINA_PAGAR: '/api/nomina/pagar',
    NOMINA_PENDIENTES: '/api/nomina/pendientes',
    
    // Reportes
    PAGOS: '/api/nomina/pagos',
    
    // Health
    HEALTH: '/health',
  },
  
  // Timeout para requests (30 segundos)
  TIMEOUT: 30000,
};

// Helper para construir URLs completas
export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper para hacer requests con configuración común
export const apiRequest = async (endpoint, options = {}) => {
  const url = getApiUrl(endpoint);
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };
  
  try {
    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

export default API_CONFIG;
