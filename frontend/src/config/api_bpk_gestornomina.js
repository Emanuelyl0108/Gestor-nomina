const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'https://asistencia-backend.emarodri834.workers.dev',
  
  ENDPOINTS: {
    EMPLEADOS: '/api/admin/empleados/todos',
    ROLES: '/api/nomina/roles',
    TURNOS: '/api/nomina/turnos',
    DESCANSOS: '/api/nomina/descansos',
    MOVIMIENTOS: '/api/nomina/movimientos',
    PROPINAS: '/api/nomina/propinas',
    BONOS: '/api/nomina/bonos',
    DESCUENTOS: '/api/nomina/descuentos',
    NOMINA_CALCULAR: '/api/nomina/calcular',
    NOMINA_GUARDAR: '/api/nomina/guardar',
    NOMINA_PAGAR: '/api/nomina/pagar',
    NOMINA_PENDIENTES: '/api/nomina/pendientes',
    PAGOS: '/api/nomina/pagos',
  },
};

export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

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
    
    // Si es un PDF, devolver el blob
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/pdf')) {
      return await response.blob();
    }
    
    // Si es HTML, devolver texto
    if (contentType?.includes('text/html')) {
      return await response.text();
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

export default API_CONFIG;
