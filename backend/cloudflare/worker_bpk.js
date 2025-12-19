/**
 * Cloudflare Worker - Gestor de Nómina con Integración FUDO
 * Enruanados Gourmet
 * Version: 3.0.0-FUDO-Sync
 */

// ==================== CONFIGURACIÓN ====================

const FUDO_CONFIG = {
  AUTH_URL: 'https://auth.fu.do/api',
  BASE_URL: 'https://api.fu.do/v1alpha1',
  TIMEOUT: 30000,
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Cache del token FUDO (en memoria durante la ejecución del worker)
let fudoTokenCache = null;
let fudoTokenExpiry = 0;

// ==================== UTILIDADES ====================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

function nowColombia() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatDateTime(date) {
  return date.toISOString().replace('T', ' ').split('.')[0];
}

// ==================== FUNCIONES FUDO ====================

/**
 * Obtener token de autenticación FUDO
 * El token dura 24 horas, se cachea para no pedirlo en cada petición
 */
async function getFudoToken(env) {
  // Si tenemos token en cache y no ha expirado, usarlo
  const now = Math.floor(Date.now() / 1000);
  if (fudoTokenCache && fudoTokenExpiry > now) {
    console.log('✅ Usando token FUDO en cache');
    return fudoTokenCache;
  }
  
  console.log('🔑 Obteniendo nuevo token FUDO...');
  
  try {
    const response = await fetch(FUDO_CONFIG.AUTH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: env.FUDO_API_KEY,
        apiSecret: env.FUDO_API_SECRET,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error obteniendo token FUDO: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (!data.token) {
      throw new Error('Respuesta de FUDO no contiene token');
    }
    
    // Guardar en cache
    fudoTokenCache = data.token;
    fudoTokenExpiry = data.exp || (now + 86400); // 24 horas por defecto
    
    console.log('✅ Token FUDO obtenido, expira en:', new Date(fudoTokenExpiry * 1000).toISOString());
    
    return fudoTokenCache;
  } catch (error) {
    console.error('❌ Error en getFudoToken:', error);
    throw error;
  }
}

/**
 * Hacer petición a FUDO API con token Bearer
 */
async function fudoApiRequest(env, endpoint, options = {}) {
  const token = await getFudoToken(env);
  
  const response = await fetch(`${FUDO_CONFIG.BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error en petición FUDO: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Buscar usuario FUDO por email
 */
async function buscarUsuarioFudoPorEmail(env, email) {
  try {
    console.log('🔍 Buscando usuario FUDO con email:', email);
    
    const response = await fudoApiRequest(env, `/users?filter[email]=${encodeURIComponent(email)}`);
    
    if (response.data && response.data.length > 0) {
      const user = response.data[0];
      console.log('✅ Usuario FUDO encontrado:', user.id);
      return {
        found: true,
        fudoUserId: user.id,
        email: user.attributes.email,
        name: user.attributes.name,
        active: user.attributes.active,
      };
    }
    
    console.log('❌ Usuario FUDO no encontrado');
    return { found: false };
  } catch (error) {
    console.error('❌ Error buscando usuario FUDO:', error);
    return { found: false, error: error.message };
  }
}

/**
 * Buscar customer FUDO por nombre
 */
async function buscarCustomerFudoPorNombre(env, nombre) {
  try {
    console.log('🔍 Buscando customer FUDO con nombre:', nombre);
    
    // Buscar por nombre exacto con sufijo
    const nombreBusqueda = `${nombre} - Enruanados Gourmet`;
    const response = await fudoApiRequest(env, `/customers?filter[name]=${encodeURIComponent(nombreBusqueda)}`);
    
    if (response.data && response.data.length > 0) {
      const customer = response.data[0];
      console.log('✅ Customer FUDO encontrado:', customer.id);
      return {
        found: true,
        fudoCustomerId: customer.id,
        name: customer.attributes.name,
        houseAccountEnabled: customer.attributes.houseAccountEnabled,
        houseAccountBalance: customer.attributes.houseAccountBalance || 0,
      };
    }
    
    console.log('❌ Customer FUDO no encontrado');
    return { found: false };
  } catch (error) {
    console.error('❌ Error buscando customer FUDO:', error);
    return { found: false, error: error.message };
  }
}

/**
 * Obtener balance de customer FUDO
 */
async function obtenerBalanceCustomer(env, fudoCustomerId) {
  try {
    const response = await fudoApiRequest(env, `/customers/${fudoCustomerId}`);
    
    if (response.data) {
      const balance = response.data.attributes.houseAccountBalance || 0;
      console.log(`💰 Balance de customer ${fudoCustomerId}: ${balance}`);
      return balance;
    }
    
    return 0;
  } catch (error) {
    console.error('❌ Error obteniendo balance:', error);
    throw error;
  }
}

/**
 * Desactivar usuario FUDO
 */
async function desactivarUsuarioFudo(env, fudoUserId) {
  try {
    console.log('🔴 Desactivando usuario FUDO:', fudoUserId);
    
    await fudoApiRequest(env, `/users/${fudoUserId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'User',
          id: fudoUserId,
          attributes: {
            active: false,
          },
        },
      }),
    });
    
    console.log('✅ Usuario FUDO desactivado');
    return { success: true };
  } catch (error) {
    console.error('❌ Error desactivando usuario FUDO:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Activar usuario FUDO
 */
async function activarUsuarioFudo(env, fudoUserId) {
  try {
    console.log('🟢 Activando usuario FUDO:', fudoUserId);
    
    await fudoApiRequest(env, `/users/${fudoUserId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'User',
          id: fudoUserId,
          attributes: {
            active: true,
          },
        },
      }),
    });
    
    console.log('✅ Usuario FUDO activado');
    return { success: true };
  } catch (error) {
    console.error('❌ Error activando usuario FUDO:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Desactivar customer FUDO completamente
 */
async function desactivarCustomerFudo(env, fudoCustomerId) {
  try {
    console.log('🔴 Desactivando customer FUDO:', fudoCustomerId);
    
    await fudoApiRequest(env, `/customers/${fudoCustomerId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'Customer',
          id: fudoCustomerId,
          attributes: {
            active: false,
            houseAccountEnabled: false, // También deshabilitar cuenta corriente
          },
        },
      }),
    });
    
    console.log('✅ Customer FUDO desactivado completamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error desactivando customer FUDO:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Activar customer FUDO completamente
 */
async function activarCustomerFudo(env, fudoCustomerId) {
  try {
    console.log('🟢 Activando customer FUDO:', fudoCustomerId);
    
    await fudoApiRequest(env, `/customers/${fudoCustomerId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'Customer',
          id: fudoCustomerId,
          attributes: {
            active: true,
            houseAccountEnabled: true, // También habilitar cuenta corriente
          },
        },
      }),
    });
    
    console.log('✅ Customer FUDO activado completamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error activando customer FUDO:', error);
    return { success: false, error: error.message };
  }
}

// ==================== LÓGICA DE SINCRONIZACIÓN ====================

/**
 * Sincronizar estado de empleado con FUDO
 * Se ejecuta al activar/desactivar empleado
 */
async function sincronizarEmpleadoConFudo(env, db, empleadoId, nuevoEstado) {
  const empleado = await db.prepare(
    'SELECT * FROM empleados WHERE id = ?'
  ).bind(empleadoId).first();
  
  if (!empleado) {
    return { success: false, error: 'Empleado no encontrado' };
  }
  
  const mensajes = [];
  const errores = [];
  
  // Si es mesero y tiene fudo_user_id → activar/desactivar usuario
  if ((empleado.rol === 'mesero' || empleado.rol === 'Mesero') && empleado.fudo_user_id) {
    if (nuevoEstado === 'ACTIVO') {
      const resultado = await activarUsuarioFudo(env, empleado.fudo_user_id);
      if (resultado.success) {
        mensajes.push('✅ Usuario FUDO activado');
      } else {
        errores.push(`❌ Error activando usuario FUDO: ${resultado.error}`);
      }
    } else {
      const resultado = await desactivarUsuarioFudo(env, empleado.fudo_user_id);
      if (resultado.success) {
        mensajes.push('✅ Usuario FUDO desactivado');
      } else {
        errores.push(`❌ Error desactivando usuario FUDO: ${resultado.error}`);
      }
    }
  }
  
  // Si tiene fudo_customer_id → activar/desactivar customer completamente
  if (empleado.fudo_customer_id) {
    if (nuevoEstado === 'ACTIVO') {
      const resultado = await activarCustomerFudo(env, empleado.fudo_customer_id);
      if (resultado.success) {
        mensajes.push('✅ Customer FUDO activado');
      } else {
        errores.push(`❌ Error activando customer FUDO: ${resultado.error}`);
      }
    } else {
      // Verificar balance antes de desactivar
      try {
        const balance = await obtenerBalanceCustomer(env, empleado.fudo_customer_id);
        
        if (balance < 0) {
          return {
            success: false,
            bloqueado: true,
            error: `No se puede desactivar: el empleado tiene un saldo pendiente de $${Math.abs(balance).toLocaleString('es-CO')}`,
            balance: balance,
          };
        }
        
        const resultado = await desactivarCustomerFudo(env, empleado.fudo_customer_id);
        if (resultado.success) {
          mensajes.push('✅ Customer FUDO desactivado');
        } else {
          errores.push(`❌ Error desactivando customer FUDO: ${resultado.error}`);
        }
      } catch (error) {
        errores.push(`❌ Error verificando balance: ${error.message}`);
      }
    }
  }
  
  // Actualizar timestamp de sincronización
  await db.prepare(
    'UPDATE empleados SET fudo_synced_at = ? WHERE id = ?'
  ).bind(formatDateTime(nowColombia()), empleadoId).run();
  
  return {
    success: errores.length === 0,
    mensajes,
    errores,
    empleado: empleado.nombre,
  };
}

// ==================== ROUTER PRINCIPAL ====================

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // CORS preflight - MANEJAR PRIMERO ANTES DE TODO
  if (method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }
  
  const db = env.DB;
  
  try {
    
    // ==================== HEALTH CHECK ====================
    
    if (path === '/health' || path === '/api/nomina/health') {
      return jsonResponse({
        status: 'healthy',
        service: 'gestor-nomina-fudo-api',
        version: '3.0.0-FUDO-Sync',
        timestamp: formatDateTime(nowColombia()),
      });
    }
    
    // ==================== EMPLEADOS ====================
    
    // Listar empleados activos
    if (path === '/api/nomina/empleados' && method === 'GET') {
      const empleados = await db.prepare(
        'SELECT * FROM empleados WHERE estado = ? ORDER BY nombre'
      ).bind('ACTIVO').all();
      
      return jsonResponse(empleados.results || []);
    }
    
    // Listar TODOS los empleados (con filtro opcional)
    if (path === '/api/nomina/empleados/todos' && method === 'GET') {
      const estadoFiltro = url.searchParams.get('estado');
      
      let query = 'SELECT * FROM empleados';
      let params = [];
      
      if (estadoFiltro) {
        query += ' WHERE estado = ? ORDER BY nombre ASC';
        params = [estadoFiltro];
      } else {
        query += ' ORDER BY nombre ASC';
      }
      
      const result = await db.prepare(query).bind(...params).all();
      return jsonResponse(result.results || []);
    }
    
    // Crear empleado
    if (path === '/api/nomina/empleados' && method === 'POST') {
      const data = await request.json();
      const result = await db.prepare(
        `INSERT INTO empleados (nombre, cedula, email, telefono, rol, sueldo_mensual, tipo_pago, estado, fecha_registro)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        data.nombre,
        data.cedula || null,
        data.email || null,
        data.telefono || null,
        data.rol,
        data.sueldo_mensual,
        data.tipo_pago || 'quincenal',
        'ACTIVO',
        formatDateTime(nowColombia())
      ).run();
      
      return jsonResponse({ success: true, id: result.meta.last_row_id });
    }
    
    // Actualizar empleado
    if (path.match(/^\/api\/nomina\/empleados\/\d+$/) && method === 'PUT') {
      const id = parseInt(path.split('/').pop());
      const data = await request.json();
      
      await db.prepare(
        `UPDATE empleados 
         SET nombre = ?, cedula = ?, email = ?, telefono = ?, rol = ?, sueldo_mensual = ?, tipo_pago = ?
         WHERE id = ?`
      ).bind(
        data.nombre,
        data.cedula,
        data.email,
        data.telefono,
        data.rol,
        data.sueldo_mensual,
        data.tipo_pago,
        id
      ).run();
      
      return jsonResponse({ success: true, mensaje: 'Empleado actualizado' });
    }
    
    // ==================== ACTIVAR/DESACTIVAR CON SINCRONIZACIÓN FUDO ====================
    
    if (path.match(/^\/api\/nomina\/empleados\/\d+\/estado$/) && method === 'PUT') {
      const empleadoId = parseInt(path.split('/')[4]);
      const data = await request.json();
      const nuevoEstado = data.estado;
      
      if (!['ACTIVO', 'INACTIVO'].includes(nuevoEstado)) {
        return jsonResponse({ error: 'Estado inválido' }, 400);
      }
      
      console.log(`🔄 Cambiando estado de empleado ${empleadoId} a ${nuevoEstado}`);
      
      // Sincronizar con FUDO
      const resultadoSync = await sincronizarEmpleadoConFudo(env, db, empleadoId, nuevoEstado);
      
      // Si hay saldo pendiente, bloquear
      if (resultadoSync.bloqueado) {
        return jsonResponse({
          error: resultadoSync.error,
          bloqueado: true,
          balance: resultadoSync.balance,
        }, 400);
      }
      
      // Actualizar estado en BD
      await db.prepare(
        'UPDATE empleados SET estado = ? WHERE id = ?'
      ).bind(nuevoEstado, empleadoId).run();
      
      return jsonResponse({
        success: true,
        mensaje: `Empleado ${nuevoEstado === 'ACTIVO' ? 'activado' : 'desactivado'} correctamente`,
        fudo_sync: resultadoSync,
      });
    }
    
    // ==================== ENDPOINTS DE MAPEO MANUAL ====================
    
    // Mapear usuario FUDO manualmente
    if (path.match(/^\/api\/nomina\/fudo\/mapear-usuario\/\d+$/) && method === 'POST') {
      const empleadoId = parseInt(path.split('/')[5]);
      
      const empleado = await db.prepare(
        'SELECT * FROM empleados WHERE id = ?'
      ).bind(empleadoId).first();
      
      if (!empleado) {
        return jsonResponse({ error: 'Empleado no encontrado' }, 404);
      }
      
      if (!empleado.email) {
        return jsonResponse({ error: 'El empleado no tiene email registrado' }, 400);
      }
      
      // Buscar en FUDO
      const resultado = await buscarUsuarioFudoPorEmail(env, empleado.email);
      
      if (resultado.found) {
        // Guardar en BD
        await db.prepare(
          'UPDATE empleados SET fudo_user_id = ?, fudo_synced_at = ? WHERE id = ?'
        ).bind(resultado.fudoUserId, formatDateTime(nowColombia()), empleadoId).run();
        
        return jsonResponse({
          success: true,
          mensaje: 'Usuario FUDO mapeado exitosamente',
          fudo_user_id: resultado.fudoUserId,
          fudo_data: resultado,
        });
      } else {
        return jsonResponse({
          success: false,
          error: 'No se encontró usuario FUDO con ese email',
          email_buscado: empleado.email,
        }, 404);
      }
    }
    
    // Vincular customer FUDO manualmente
    if (path.match(/^\/api\/nomina\/fudo\/vincular-customer\/\d+$/) && method === 'POST') {
      const empleadoId = parseInt(path.split('/')[5]);
      
      const empleado = await db.prepare(
        'SELECT * FROM empleados WHERE id = ?'
      ).bind(empleadoId).first();
      
      if (!empleado) {
        return jsonResponse({ error: 'Empleado no encontrado' }, 404);
      }
      
      // Buscar en FUDO por nombre
      const resultado = await buscarCustomerFudoPorNombre(env, empleado.nombre);
      
      if (resultado.found) {
        // Guardar en BD
        await db.prepare(
          'UPDATE empleados SET fudo_customer_id = ?, fudo_customer_synced_at = ?, nombre_fudo_customer = ? WHERE id = ?'
        ).bind(
          resultado.fudoCustomerId,
          formatDateTime(nowColombia()),
          resultado.name,
          empleadoId
        ).run();
        
        return jsonResponse({
          success: true,
          mensaje: 'Customer FUDO vinculado exitosamente',
          fudo_customer_id: resultado.fudoCustomerId,
          fudo_data: resultado,
        });
      } else {
        return jsonResponse({
          success: false,
          error: 'No se encontró customer FUDO con ese nombre',
          nombre_buscado: `${empleado.nombre} - Enruanados Gourmet`,
        }, 404);
      }
    }
    
    // Verificar sincronización de un empleado
    if (path.match(/^\/api\/nomina\/fudo\/verificar-sync\/\d+$/) && method === 'GET') {
      const empleadoId = parseInt(path.split('/')[5]);
      
      const empleado = await db.prepare(
        'SELECT id, nombre, rol, email, estado, fudo_user_id, fudo_customer_id, fudo_synced_at, fudo_customer_synced_at FROM empleados WHERE id = ?'
      ).bind(empleadoId).first();
      
      if (!empleado) {
        return jsonResponse({ error: 'Empleado no encontrado' }, 404);
      }
      
      const esMesero = empleado.rol === 'mesero' || empleado.rol === 'Mesero';
      
      return jsonResponse({
        empleado: {
          id: empleado.id,
          nombre: empleado.nombre,
          rol: empleado.rol,
          email: empleado.email,
          estado: empleado.estado,
        },
        sincronizacion: {
          necesita_user: esMesero,
          tiene_user: !!empleado.fudo_user_id,
          user_id: empleado.fudo_user_id,
          user_synced_at: empleado.fudo_synced_at,
          
          necesita_customer: true,
          tiene_customer: !!empleado.fudo_customer_id,
          customer_id: empleado.fudo_customer_id,
          customer_synced_at: empleado.fudo_customer_synced_at,
        },
        completo: esMesero 
          ? (!!empleado.fudo_user_id && !!empleado.fudo_customer_id)
          : !!empleado.fudo_customer_id,
      });
    }
    
    // ==================== CONTINUARÁ CON MÁS ENDPOINTS... ====================
    
    // Ruta no encontrada
    return jsonResponse({ error: 'Endpoint no encontrado' }, 404);
    
  } catch (error) {
    console.error('Error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },
};
