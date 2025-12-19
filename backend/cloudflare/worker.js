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
 * Obtener ventas de cuenta corriente de un customer en FUDO
 */
async function obtenerVentasCuentaCorriente(env, fudoCustomerId, fechaDesde = null) {
  try {
    console.log('🔍 Buscando ventas de cuenta corriente para customer:', fudoCustomerId);
    
    // Construir endpoint - incluir customer, payments y paymentMethod
    // Ordenar por fecha descendente (-createdAt) para obtener las más recientes primero
    let endpoint = `/sales?include=customer,payments,payments.paymentMethod&page[size]=500&sort=-createdAt`;
    
    if (fechaDesde) {
      endpoint += `&filter[createdAt]=${fechaDesde}`;
    }
    
    const response = await fudoApiRequest(env, endpoint);
    
    if (!response.data || response.data.length === 0) {
      console.log('ℹ️ No se encontraron ventas');
      return [];
    }
    
    console.log(`📊 Total ventas obtenidas: ${response.data.length}`);
    
    // Filtrar solo las que tienen pagos con cuenta corriente del customer específico
    const ventasCuentaCorriente = [];
    
    for (const sale of response.data) {
      // Verificar si la venta pertenece al customer
      const saleCustomerId = sale.relationships?.customer?.data?.id;
      
      if (saleCustomerId !== fudoCustomerId) {
        continue; // Saltar si no es del customer que buscamos
      }
      
      // Buscar payments incluidos
      if (response.included) {
        const payments = response.included.filter(
          item => item.type === 'Payment' && 
          item.relationships?.sale?.data?.id === sale.id
        );
        
        for (const payment of payments) {
          // Buscar el payment method
          const paymentMethodId = payment.relationships?.paymentMethod?.data?.id;
          const paymentMethod = response.included.find(
            item => item.type === 'PaymentMethod' && item.id === paymentMethodId
          );
          
          // Filtrar solo pagos con cuenta corriente (code: house-account)
          if (paymentMethod && paymentMethod.attributes.code === 'house-account') {
            
            ventasCuentaCorriente.push({
              sale_id: sale.id,
              fecha: sale.attributes.createdAt,
              monto: payment.attributes.amount,
              payment_id: payment.id,
              payment_method: paymentMethod.attributes.name,
              descripcion: sale.attributes.comment || 'Consumo en restaurante',
            });
          }
        }
      }
    }
    
    console.log(`✅ Encontradas ${ventasCuentaCorriente.length} ventas de cuenta corriente para customer ${fudoCustomerId}`);
    return ventasCuentaCorriente;
    
  } catch (error) {
    console.error('❌ Error obteniendo ventas de cuenta corriente:', error);
    throw error;
  }
}

/**
 * Parsear comentario de movimiento de caja para extraer empleado
 * Formato esperado: "[ID] [PrimerNombre] [detalle opcional]"
 * Ejemplo: "19 Kevin adelanto emergencia"
 */
function parsearComentarioMovimientoCaja(comentario) {
  if (!comentario || typeof comentario !== 'string') {
    return { success: false, error: 'Comentario vacío o inválido' };
  }
  
  // Extraer primer número (ID del empleado)
  const matchId = comentario.match(/\d+/);
  if (!matchId) {
    return { success: false, error: 'No se encontró ID numérico en el comentario' };
  }
  
  const empleadoId = parseInt(matchId[0]);
  
  // Extraer primera palabra después del número (nombre)
  const textoRestante = comentario.substring(comentario.indexOf(matchId[0]) + matchId[0].length).trim();
  const palabras = textoRestante.split(/\s+/);
  const primerNombre = palabras[0] || '';
  
  // El resto es detalle adicional (opcional)
  const detalle = palabras.slice(1).join(' ');
  
  return {
    success: true,
    empleado_id: empleadoId,
    primer_nombre: primerNombre,
    detalle: detalle || null,
    comentario_original: comentario,
  };
}

/**
 * Validar que el empleado existe y que el nombre coincide
 */
async function validarEmpleadoMovimiento(db, empleadoId, primerNombre) {
  const empleado = await db.prepare(
    'SELECT id, nombre FROM empleados WHERE id = ?'
  ).bind(empleadoId).first();
  
  if (!empleado) {
    return {
      valido: false,
      error: `Empleado con ID ${empleadoId} no encontrado`,
      empleado: null,
    };
  }
  
  // Extraer primer nombre del empleado en BD
  const nombreCompleto = empleado.nombre;
  const primerNombreBD = nombreCompleto.split(' ')[0].toLowerCase();
  const primerNombreComentario = primerNombre.toLowerCase();
  
  const nombreCoincide = primerNombreBD === primerNombreComentario;
  
  return {
    valido: true,
    empleado_id: empleado.id,
    nombre_completo: nombreCompleto,
    nombre_coincide: nombreCoincide,
    advertencia: nombreCoincide ? null : `Advertencia: Nombre en comentario "${primerNombre}" no coincide con "${nombreCompleto}"`,
  };
}

/**
 * Crear transacción de pago en cuenta corriente de FUDO
 * Se ejecuta cuando se paga nómina y se descuentan consumos
 */
async function crearPagoFudo(env, fudoCustomerId, monto, comentario) {
  try {
    console.log('💰 Creando pago en FUDO para customer:', fudoCustomerId);
    
    // Payload según la estructura de FUDO
    const payload = {
      data: {
        type: 'HouseAccountTransaction',
        attributes: {
          amount: monto, // Monto positivo = abono/pago
          comment: comentario,
        },
        relationships: {
          paymentMethod: {
            data: {
              type: 'PaymentMethod',
              id: '1', // Efectivo (según tu captura)
            },
          },
          cashRegister: {
            data: {
              type: 'CashRegister',
              id: '2', // Administrativa (según tu captura)
            },
          },
          customer: {
            data: {
              type: 'Customer',
              id: fudoCustomerId,
            },
          },
        },
      },
    };
    
    const response = await fudoApiRequest(env, '/house-account-transactions?include=customer', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    
    console.log('✅ Pago registrado en FUDO:', response.data.id);
    
    return {
      success: true,
      transaction_id: response.data.id,
      amount: response.data.attributes.amount,
    };
    
  } catch (error) {
    console.error('❌ Error creando pago en FUDO:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Obtener abonos/pagos a cuenta corriente de un customer en FUDO
 * Los abonos son payments que no están asociados a una venta (son pagos directos a la cuenta)
 */
async function obtenerAbonosCuentaCorriente(env, fudoCustomerId) {
  try {
    console.log('🔍 Buscando abonos de cuenta corriente para customer:', fudoCustomerId);
    
    // En FUDO, necesitamos obtener el customer con sus transacciones
    // Según la API, esto puede venir en el endpoint del customer o en un endpoint de transacciones
    // Por ahora, buscamos en la información del customer
    
    const endpoint = `/customers/${fudoCustomerId}`;
    const response = await fudoApiRequest(env, endpoint);
    
    // Extraer el balance actual - si es positivo, hubo abonos
    const balance = response.data.attributes.houseAccountBalance || 0;
    
    console.log(`💰 Balance actual en FUDO: ${balance}`);
    
    // NOTA: La API de FUDO no expone directamente el historial de transacciones de cuenta corriente
    // Solo podemos ver el balance actual. Para obtener el historial completo de abonos,
    // necesitaríamos que FUDO tenga un endpoint específico como /customers/:id/transactions
    
    // Por ahora, retornamos array vacío
    // TODO: Consultar con FUDO si tienen endpoint de transacciones de cuenta corriente
    
    return [];
    
  } catch (error) {
    console.error('❌ Error obteniendo abonos de cuenta corriente:', error);
    return [];
  }
}

/**
 * Sincronizar consumos Y abonos de FUDO a movimientos en BD
 */
async function sincronizarConsumosFudo(env, db, empleadoId) {
  try {
    // Obtener empleado
    const empleado = await db.prepare(
      'SELECT * FROM empleados WHERE id = ?'
    ).bind(empleadoId).first();
    
    if (!empleado) {
      return { success: false, error: 'Empleado no encontrado' };
    }
    
    if (!empleado.fudo_customer_id) {
      return { success: false, error: 'Empleado no tiene customer FUDO vinculado' };
    }
    
    console.log(`🔄 Sincronizando TODO el historial de consumos y abonos desde FUDO`);
    
    // Obtener ventas de FUDO (SIN filtro de fecha para traer TODO)
    const ventas = await obtenerVentasCuentaCorriente(env, empleado.fudo_customer_id, null);
    
    let nuevosConsumos = 0;
    let duplicados = 0;
    
    // Importar CONSUMOS (ventas)
    for (const venta of ventas) {
      // Verificar si ya existe
      const existe = await db.prepare(
        'SELECT id FROM movimientos WHERE fudo_sale_id = ?'
      ).bind(venta.sale_id).first();
      
      if (existe) {
        duplicados++;
        continue;
      }
      
      // Crear movimiento tipo consumo
      await db.prepare(
        `INSERT INTO movimientos (
          empleado_id, fecha, tipo, monto, descripcion, 
          descontado, fudo_sale_id, fudo_payment_id, fudo_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        empleadoId,
        venta.fecha.split('T')[0], // Solo fecha, sin hora
        'consumo',
        venta.monto,
        venta.descripcion,
        0,
        venta.sale_id,
        venta.payment_id,
        formatDateTime(nowColombia())
      ).run();
      
      nuevosConsumos++;
    }
    
    // Ahora importar ABONOS (pagos a cuenta corriente)
    const abonos = await obtenerAbonosCuentaCorriente(env, empleado.fudo_customer_id);
    let nuevosAbonos = 0;
    
    for (const abono of abonos) {
      // Verificar si ya existe
      const existe = await db.prepare(
        'SELECT id FROM movimientos WHERE fudo_payment_id = ? AND tipo = ?'
      ).bind(abono.payment_id, 'abono').first();
      
      if (existe) {
        duplicados++;
        continue;
      }
      
      // Crear movimiento tipo abono
      await db.prepare(
        `INSERT INTO movimientos (
          empleado_id, fecha, tipo, monto, descripcion, 
          descontado, fudo_payment_id, fudo_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        empleadoId,
        abono.fecha.split('T')[0],
        'abono',
        abono.monto, // Monto positivo
        abono.descripcion,
        1, // Los abonos ya están "aplicados"
        abono.payment_id,
        formatDateTime(nowColombia())
      ).run();
      
      nuevosAbonos++;
    }
    
    // Calcular saldo actual
    const saldoResult = await db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'consumo' THEN monto ELSE 0 END), 0) as total_consumos,
        COALESCE(SUM(CASE WHEN tipo = 'abono' THEN monto ELSE 0 END), 0) as total_abonos
      FROM movimientos 
      WHERE empleado_id = ?
    `).bind(empleadoId).first();
    
    const saldo = saldoResult.total_consumos - saldoResult.total_abonos;
    
    return {
      success: true,
      empleado: empleado.nombre,
      nuevos_consumos: nuevosConsumos,
      nuevos_abonos: nuevosAbonos,
      duplicados_omitidos: duplicados,
      total_encontrados: ventas.length + abonos.length,
      saldo_actual: saldo,
      saldo_formateado: saldo < 0 ? `A favor: $${Math.abs(saldo).toLocaleString('es-CO')}` : `Debe: $${saldo.toLocaleString('es-CO')}`,
    };
    
  } catch (error) {
    console.error('❌ Error sincronizando consumos:', error);
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
    
    // ==================== SINCRONIZACIÓN DE CONSUMOS FUDO ====================
    
    // Sincronizar consumos de un empleado
    if (path.match(/^\/api\/nomina\/fudo\/sincronizar-consumos\/\d+$/) && method === 'POST') {
      const empleadoId = parseInt(path.split('/')[5]);
      
      console.log(`🔄 Iniciando sincronización de consumos para empleado ${empleadoId}`);
      
      const resultado = await sincronizarConsumosFudo(env, db, empleadoId);
      
      return jsonResponse(resultado);
    }
    
    // Sincronizar consumos de todos los empleados activos
    if (path === '/api/nomina/fudo/sincronizar-todos-consumos' && method === 'POST') {
      const empleados = await db.prepare(
        "SELECT id, nombre, fudo_customer_id FROM empleados WHERE estado = 'ACTIVO' AND fudo_customer_id IS NOT NULL"
      ).all();
      
      console.log(`🔄 Sincronizando consumos de ${empleados.results.length} empleados`);
      
      const resultados = [];
      let totalNuevos = 0;
      let totalErrores = 0;
      
      for (const empleado of empleados.results) {
        const resultado = await sincronizarConsumosFudo(env, db, empleado.id);
        
        if (resultado.success) {
          totalNuevos += resultado.nuevos_movimientos;
        } else {
          totalErrores++;
        }
        
        resultados.push({
          empleado_id: empleado.id,
          empleado_nombre: empleado.nombre,
          ...resultado,
        });
      }
      
      return jsonResponse({
        success: true,
        total_empleados_procesados: empleados.results.length,
        total_movimientos_nuevos: totalNuevos,
        total_errores: totalErrores,
        detalles: resultados,
      });
    }
    
    // ==================== MOVIMIENTOS ====================
    
    // Listar movimientos
    if (path === '/api/nomina/movimientos' && method === 'GET') {
      const empleadoId = url.searchParams.get('empleado_id');
      
      let query = `
        SELECT m.*, e.nombre as empleado_nombre
        FROM movimientos m
        JOIN empleados e ON m.empleado_id = e.id
        WHERE 1=1
      `;
      const params = [];
      
      if (empleadoId) {
        query += ' AND m.empleado_id = ?';
        params.push(empleadoId);
      }
      
      query += ' ORDER BY m.fecha DESC, m.created_at DESC LIMIT 200';
      
      const movimientos = await db.prepare(query).bind(...params).all();
      return jsonResponse(movimientos.results || []);
    }
    
    // Listar movimientos pendientes
    if (path === '/api/nomina/movimientos/pendientes' && method === 'GET') {
      const empleadoId = url.searchParams.get('empleado_id');
      
      let query = `
        SELECT m.*, e.nombre as empleado_nombre
        FROM movimientos m
        JOIN empleados e ON m.empleado_id = e.id
        WHERE m.descontado = 0
      `;
      const params = [];
      
      if (empleadoId) {
        query += ' AND m.empleado_id = ?';
        params.push(empleadoId);
      }
      
      query += ' ORDER BY m.fecha DESC';
      
      const movimientos = await db.prepare(query).bind(...params).all();
      return jsonResponse(movimientos.results || []);
    }
    
    // Crear movimiento manual
    if (path === '/api/nomina/movimientos' && method === 'POST') {
      const data = await request.json();
      const fecha = data.fecha || formatDate(nowColombia());
      
      await db.prepare(
        `INSERT INTO movimientos (empleado_id, fecha, tipo, monto, descripcion, descontado)
         VALUES (?, ?, ?, ?, ?, 0)`
      ).bind(
        data.empleado_id,
        fecha,
        data.tipo,
        data.monto,
        data.descripcion || null
      ).run();
      
      return jsonResponse({ success: true, mensaje: 'Movimiento registrado' });
    }
    
    // Actualizar movimiento
    if (path.match(/^\/api\/nomina\/movimientos\/\d+$/) && method === 'PUT') {
      const movimientoId = parseInt(path.split('/')[4]);
      const data = await request.json();
      
      // Verificar que no esté descontado
      const movimiento = await db.prepare(
        'SELECT descontado FROM movimientos WHERE id = ?'
      ).bind(movimientoId).first();
      
      if (movimiento && movimiento.descontado) {
        return jsonResponse({ error: 'No se puede editar un movimiento ya descontado' }, 400);
      }
      
      await db.prepare(`
        UPDATE movimientos 
        SET tipo = ?, monto = ?, descripcion = ?, fecha = ?
        WHERE id = ? AND descontado = 0
      `).bind(
        data.tipo,
        data.monto,
        data.descripcion,
        data.fecha,
        movimientoId
      ).run();
      
      return jsonResponse({ success: true, mensaje: 'Movimiento actualizado' });
    }
    
    // Eliminar movimiento
    if (path.match(/^\/api\/nomina\/movimientos\/\d+$/) && method === 'DELETE') {
      const movimientoId = parseInt(path.split('/')[4]);
      
      // Verificar que no esté descontado
      const movimiento = await db.prepare(
        'SELECT descontado FROM movimientos WHERE id = ?'
      ).bind(movimientoId).first();
      
      if (movimiento && movimiento.descontado) {
        return jsonResponse({ error: 'No se puede eliminar un movimiento ya descontado' }, 400);
      }
      
      await db.prepare('DELETE FROM movimientos WHERE id = ? AND descontado = 0').bind(movimientoId).run();
      
      return jsonResponse({ success: true, mensaje: 'Movimiento eliminado' });
    }
    
    // ==================== DEBUG: Ver ventas FUDO de un customer ====================
    
    if (path.match(/^\/api\/nomina\/fudo\/debug-ventas\/\d+$/) && method === 'GET') {
      const empleadoId = parseInt(path.split('/')[5]);
      
      const empleado = await db.prepare(
        'SELECT * FROM empleados WHERE id = ?'
      ).bind(empleadoId).first();
      
      if (!empleado || !empleado.fudo_customer_id) {
        return jsonResponse({ error: 'Empleado no encontrado o sin customer FUDO' }, 404);
      }
      
      try {
        // Obtener ventas sin filtro de fecha para ver todo
        const endpoint = `/sales?include=customer,payments,payments.paymentMethod&page[size]=100`;
        const response = await fudoApiRequest(env, endpoint);
        
        // Filtrar las del customer
        const ventasDelCustomer = response.data.filter(
          sale => sale.relationships?.customer?.data?.id === empleado.fudo_customer_id
        );
        
        return jsonResponse({
          customer_id: empleado.fudo_customer_id,
          total_ventas_sistema: response.data.length,
          ventas_del_empleado: ventasDelCustomer.length,
          ventas: ventasDelCustomer,
          included: response.included,
        });
      } catch (error) {
        return jsonResponse({ error: error.message }, 500);
      }
    }
    
    // ==================== DEBUG: Ver métodos de pago FUDO ====================
    
    if (path === '/api/nomina/fudo/payment-methods' && method === 'GET') {
      try {
        const response = await fudoApiRequest(env, '/payment-methods');
        return jsonResponse(response);
      } catch (error) {
        return jsonResponse({ error: error.message }, 500);
      }
    }
    
    // ==================== ENDPOINTS DE NÓMINAS ====================
    
    // Crear nómina
    if (path === '/api/nomina/nominas' && method === 'POST') {
      const body = await request.json();
      
      try {
        const result = await db.prepare(
          `INSERT INTO nominas (
            empleado_id, tipo_nomina, periodo_inicio, periodo_fin, 
            dias_trabajados, sueldo_base, monto_base, total_propinas,
            total_bonos, total_descuentos, total_movimientos, total_pagar,
            pagada, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          body.empleado_id,
          body.tipo_nomina || 'quincenal',
          body.periodo_inicio,
          body.periodo_fin,
          body.dias_trabajados || 0,
          body.sueldo_base || 0,
          body.monto_base || body.total_pagar || 0,
          body.total_propinas || 0,
          body.total_bonos || 0,
          body.total_descuentos || 0,
          body.total_movimientos || 0,
          body.total_pagar,
          0, // No pagada
          formatDateTime(nowColombia())
        ).run();
        
        return jsonResponse({
          success: true,
          nomina_id: result.meta.last_row_id,
        }, 201);
        
      } catch (error) {
        console.error('Error creando nómina:', error);
        return jsonResponse({ error: error.message }, 500);
      }
    }
    
    // Pagar nómina con descuento automático de cuenta corriente
    if (path.match(/^\/api\/nomina\/nominas\/\d+\/pagar$/) && method === 'POST') {
      const nominaId = parseInt(path.split('/')[4]);
      
      // Body es opcional
      let body = {};
      try {
        const text = await request.text();
        if (text) {
          body = JSON.parse(text);
        }
      } catch (e) {
        // Body vacío o inválido, continuar sin body
      }
      
      try {
        // Obtener la nómina
        const nomina = await db.prepare(
          'SELECT * FROM nominas WHERE id = ?'
        ).bind(nominaId).first();
        
        if (!nomina) {
          return jsonResponse({ error: 'Nómina no encontrada' }, 404);
        }
        
        if (nomina.pagada) {
          return jsonResponse({ error: 'Esta nómina ya fue pagada' }, 400);
        }
        
        // Obtener empleado
        const empleado = await db.prepare(
          'SELECT * FROM empleados WHERE id = ?'
        ).bind(nomina.empleado_id).first();
        
        // Obtener abono pendiente anterior (si existe)
        const abonoPendienteAnterior = empleado.abono_pendiente || 0;
        
        // Obtener movimientos pendientes de cuenta corriente (más antiguos primero)
        const movimientos = await db.prepare(
          `SELECT * FROM movimientos 
           WHERE empleado_id = ? 
           AND tipo = 'consumo' 
           AND descontado = 0
           ORDER BY fecha ASC, id ASC`
        ).bind(nomina.empleado_id).all();
        
        let totalDescontado = 0;
        const movimientosDescontados = [];
        const movimientosParciales = [];
        
        // Calcular monto disponible para descontar
        // Primero usar el abono pendiente anterior, luego la nómina actual
        let montoDisponible = abonoPendienteAnterior + nomina.total_pagar;
        let montoUsadoDeAbonoPendiente = 0;
        let montoUsadoDeNomina = 0;
        
        console.log(`💰 Monto disponible: $${montoDisponible} (abono anterior: $${abonoPendienteAnterior} + nómina: $${nomina.total_pagar})`);
        
        // Descontar SOLO consumos COMPLETOS (FIFO: más antiguos primero)
        for (const mov of movimientos.results) {
          if (montoDisponible >= mov.monto) {
            // Se puede pagar completo
            montoDisponible -= mov.monto;
            totalDescontado += mov.monto;
            movimientosDescontados.push(mov);
            
            // Marcar como descontado
            await db.prepare(
              'UPDATE movimientos SET descontado = 1, nomina_id = ? WHERE id = ?'
            ).bind(nominaId, mov.id).run();
            
            console.log(`✅ Consumo #${mov.id} pagado completo: $${mov.monto}`);
          } else {
            // No alcanza para pagar este consumo completo
            movimientosParciales.push({
              id: mov.id,
              monto: mov.monto,
              faltante: mov.monto - montoDisponible,
            });
            console.log(`⏳ Consumo #${mov.id} pendiente: $${mov.monto} (falta: $${mov.monto - montoDisponible})`);
          }
        }
        
        // Calcular de dónde salió el dinero
        if (totalDescontado > 0) {
          if (totalDescontado <= abonoPendienteAnterior) {
            // Todo salió del abono pendiente anterior
            montoUsadoDeAbonoPendiente = totalDescontado;
            montoUsadoDeNomina = 0;
          } else {
            // Se usó todo el abono pendiente y parte de la nómina
            montoUsadoDeAbonoPendiente = abonoPendienteAnterior;
            montoUsadoDeNomina = totalDescontado - abonoPendienteAnterior;
          }
        }
        
        // El sobrante se guarda como "abono pendiente" para la próxima nómina
        // Esto solo pasa si el empleado no tiene más consumos pendientes
        const nuevoAbonoPendiente = montoDisponible;
        
        // Actualizar abono pendiente del empleado
        await db.prepare(
          'UPDATE empleados SET abono_pendiente = ? WHERE id = ?'
        ).bind(nuevoAbonoPendiente, nomina.empleado_id).run();
        
        // Registrar pago en FUDO solo si se usó dinero de la nómina actual
        let fudoTransactionId = null;
        
        if (montoUsadoDeNomina > 0 && empleado.fudo_customer_id) {
          const comentario = `Pago nómina #${nominaId} - Periodo ${nomina.fecha_inicio} a ${nomina.fecha_fin}. Consumos pagados: ${movimientosDescontados.map(m => `#${m.id}($${m.monto.toLocaleString('es-CO')})`).join(', ')}. Total descontado: $${totalDescontado.toLocaleString('es-CO')}${montoUsadoDeAbonoPendiente > 0 ? ` (incluye abono anterior: $${montoUsadoDeAbonoPendiente.toLocaleString('es-CO')})` : ''}${nuevoAbonoPendiente > 0 ? `. Abono pendiente: $${nuevoAbonoPendiente.toLocaleString('es-CO')}` : ''}`;
          
          const resultadoFudo = await crearPagoFudo(
            env,
            empleado.fudo_customer_id,
            montoUsadoDeNomina, // Solo registrar el monto REAL usado de esta nómina
            comentario
          );
          
          if (resultadoFudo.success) {
            fudoTransactionId = resultadoFudo.transaction_id;
          } else {
            console.warn('⚠️ No se pudo registrar pago en FUDO:', resultadoFudo.error);
          }
        }
        
        // Calcular monto final a pagar al empleado
        const montoPagarEmpleado = nomina.total_pagar - montoUsadoDeNomina;
        
        // Actualizar nómina
        await db.prepare(
          `UPDATE nominas 
           SET pagada = 1, 
               fecha_pago = ?,
               descuento_cuenta_corriente = ?,
               fudo_transaction_id = ?,
               fudo_payment_synced_at = ?
           WHERE id = ?`
        ).bind(
          formatDateTime(nowColombia()),
          montoUsadoDeNomina, // Solo registrar lo descontado de ESTA nómina
          fudoTransactionId,
          fudoTransactionId ? formatDateTime(nowColombia()) : null,
          nominaId
        ).run();
        
        return jsonResponse({
          success: true,
          nomina_id: nominaId,
          empleado: empleado.nombre,
          total_nomina: nomina.total_pagar,
          abono_pendiente_anterior: abonoPendienteAnterior,
          total_disponible_para_descontar: abonoPendienteAnterior + nomina.total_pagar,
          total_descontado: totalDescontado,
          usado_de_abono_anterior: montoUsadoDeAbonoPendiente,
          usado_de_nomina_actual: montoUsadoDeNomina,
          nuevo_abono_pendiente: nuevoAbonoPendiente,
          monto_a_pagar_empleado: montoPagarEmpleado,
          movimientos_pagados_completos: movimientosDescontados.length,
          movimientos_aun_pendientes: movimientosParciales.length,
          detalle_pagados: movimientosDescontados.map(m => ({
            id: m.id,
            fecha: m.fecha,
            monto: m.monto,
            descripcion: m.descripcion,
          })),
          detalle_pendientes: movimientosParciales,
          fudo_transaction_id: fudoTransactionId,
          fudo_sincronizado: !!fudoTransactionId,
          monto_registrado_fudo: montoUsadoDeNomina,
        });
        
      } catch (error) {
        console.error('Error pagando nómina:', error);
        return jsonResponse({ error: error.message }, 500);
      }
    }
    
    // Ver saldo de cuenta corriente de un empleado
    if (path.match(/^\/api\/nomina\/movimientos\/saldo\/\d+$/) && method === 'GET') {
      const empleadoId = parseInt(path.split('/')[5]);
      
      const empleado = await db.prepare(
        'SELECT nombre FROM empleados WHERE id = ?'
      ).bind(empleadoId).first();
      
      if (!empleado) {
        return jsonResponse({ error: 'Empleado no encontrado' }, 404);
      }
      
      const resultado = await db.prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN tipo = 'consumo' THEN monto ELSE 0 END), 0) as total_consumos,
          COALESCE(SUM(CASE WHEN tipo = 'abono' THEN monto ELSE 0 END), 0) as total_abonos,
          COUNT(CASE WHEN tipo = 'consumo' AND descontado = 0 THEN 1 END) as consumos_pendientes
        FROM movimientos 
        WHERE empleado_id = ?
      `).bind(empleadoId).first();
      
      const saldo = resultado.total_consumos - resultado.total_abonos;
      
      return jsonResponse({
        empleado_id: empleadoId,
        empleado_nombre: empleado.nombre,
        total_consumos: resultado.total_consumos,
        total_abonos: resultado.total_abonos,
        saldo: saldo,
        estado: saldo > 0 ? 'debe' : (saldo < 0 ? 'a_favor' : 'sin_deuda'),
        saldo_formateado: saldo < 0 
          ? `A favor: $${Math.abs(saldo).toLocaleString('es-CO')}` 
          : `Debe: $${saldo.toLocaleString('es-CO')}`,
        consumos_pendientes: resultado.consumos_pendientes,
      });
    }
    
    // Crear adelanto/préstamo manual con referencia a movimiento de FUDO
    if (path === '/api/nomina/movimientos/adelanto' && method === 'POST') {
      const body = await request.json();
      
      try {
        // Validar campos requeridos
        if (!body.empleado_id || !body.monto) {
          return jsonResponse({ 
            error: 'Campos requeridos: empleado_id, monto' 
          }, 400);
        }
        
        // Si viene con comentario FUDO, parsear para extraer info
        let empleadoIdFinal = body.empleado_id;
        let descripcionFinal = body.descripcion || 'Adelanto';
        
        if (body.comentario_fudo) {
          const parseResult = parsearComentarioMovimientoCaja(body.comentario_fudo);
          
          if (parseResult.success) {
            // Validar que coincida con el empleado_id enviado
            if (parseResult.empleado_id !== body.empleado_id) {
              return jsonResponse({
                error: `El ID en el comentario (${parseResult.empleado_id}) no coincide con el empleado_id (${body.empleado_id})`
              }, 400);
            }
            
            // Validar nombre
            const validacion = await validarEmpleadoMovimiento(
              db,
              parseResult.empleado_id,
              parseResult.primer_nombre
            );
            
            if (!validacion.valido) {
              return jsonResponse({ error: validacion.error }, 404);
            }
            
            if (validacion.advertencia) {
              console.warn('⚠️', validacion.advertencia);
            }
            
            if (parseResult.detalle) {
              descripcionFinal += ': ' + parseResult.detalle;
            }
          }
        }
        
        // Verificar que el empleado existe
        const empleado = await db.prepare(
          'SELECT id, nombre FROM empleados WHERE id = ?'
        ).bind(empleadoIdFinal).first();
        
        if (!empleado) {
          return jsonResponse({ error: 'Empleado no encontrado' }, 404);
        }
        
        // Crear movimiento
        const result = await db.prepare(
          `INSERT INTO movimientos (
            empleado_id, fecha, tipo, monto, descripcion,
            descontado, fudo_payment_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          empleadoIdFinal,
          body.fecha || formatDate(nowColombia()),
          body.tipo || 'adelanto',
          body.monto,
          descripcionFinal,
          0, // No descontado
          body.fudo_payment_id || null,
          formatDateTime(nowColombia())
        ).run();
        
        return jsonResponse({
          success: true,
          movimiento_id: result.meta.last_row_id,
          empleado: empleado.nombre,
          monto: body.monto,
          tipo: body.tipo || 'adelanto',
        }, 201);
        
      } catch (error) {
        console.error('Error creando adelanto:', error);
        return jsonResponse({ error: error.message }, 500);
      }
    }
    
    // Sincronizar movimientos de caja (adelantos/préstamos) desde FUDO
    if (path === '/api/nomina/fudo/sincronizar-movimientos-caja' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const fechaDesde = body.fecha_desde || null;
      
      try {
        // Construir filtro de fechas
        // FUDO usa formato específico: 2025-12-18T05:00:00.000Z (hora fija)
        let t1, t2;
        
        if (fechaDesde) {
          const fecha = new Date(fechaDesde);
          t1 = fecha.toISOString().split('.')[0] + '.000Z';
          const hoy = new Date();
          t2 = hoy.toISOString().split('.')[0] + '.000Z';
        } else {
          // Por defecto, últimos 7 días con hora 00:00:00
          const hace7dias = new Date();
          hace7dias.setDate(hace7dias.getDate() - 7);
          hace7dias.setHours(0, 0, 0, 0);
          
          const hoy = new Date();
          hoy.setHours(23, 59, 59, 0);
          
          t1 = hace7dias.toISOString().split('.')[0] + '.000Z';
          t2 = hoy.toISOString().split('.')[0] + '.000Z';
        }
        
        const endpoint = `/cash_movements?t1=${t1}&t2=${t2}`;
        
        console.log('🔍 Endpoint:', endpoint);
        
        // cash_movements usa URL base diferente (sin /v1alpha1)
        const token = await getFudoToken(env);
        const url = `https://api.fu.do${endpoint}`;
        
        console.log('📡 URL completa:', url);
        
        const fetchResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!fetchResponse.ok) {
          const errorText = await fetchResponse.text();
          throw new Error(`Error ${fetchResponse.status}: ${errorText}`);
        }
        
        const response = await fetchResponse.json();
        
        // La respuesta es un array directo de movimientos
        if (!response || !Array.isArray(response) || response.length === 0) {
          return jsonResponse({
            success: true,
            mensaje: 'No se encontraron movimientos de caja',
            nuevos_movimientos: 0,
          });
        }
        
        let nuevos = 0;
        let errores = 0;
        let sinAsociar = 0;
        const detalles = [];
        
        for (const movimiento of response) {
          // Solo procesar egresos (adelantos/préstamos)
          if (movimiento.type !== 'outcome') {
            continue;
          }
          
          // Parsear comentario para extraer empleado
          const parseResult = parsearComentarioMovimientoCaja(movimiento.comment);
          
          if (!parseResult.success) {
            sinAsociar++;
            detalles.push({
              movimiento_id: movimiento.id,
              monto: movimiento.amount,
              comentario: movimiento.comment,
              error: parseResult.error,
            });
            continue;
          }
          
          // Validar que el empleado existe
          const validacion = await validarEmpleadoMovimiento(
            db,
            parseResult.empleado_id,
            parseResult.primer_nombre
          );
          
          if (!validacion.valido) {
            errores++;
            detalles.push({
              movimiento_id: movimiento.id,
              monto: movimiento.amount,
              comentario: movimiento.comment,
              error: validacion.error,
            });
            continue;
          }
          
          // Verificar si ya existe el movimiento
          const existe = await db.prepare(
            'SELECT id FROM movimientos WHERE fudo_payment_id = ? AND tipo = ?'
          ).bind(movimiento.id.toString(), 'adelanto').first();
          
          if (existe) {
            continue; // Ya existe, saltar
          }
          
          // Crear movimiento en BD
          await db.prepare(
            `INSERT INTO movimientos (
              empleado_id, fecha, tipo, monto, descripcion,
              descontado, fudo_payment_id, fudo_synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            validacion.empleado_id,
            movimiento.createdAt?.split('T')[0] || formatDate(nowColombia()),
            'adelanto',
            movimiento.amount,
            `Adelanto de caja${parseResult.detalle ? ': ' + parseResult.detalle : ''}`,
            0, // No descontado
            movimiento.id.toString(),
            formatDateTime(nowColombia())
          ).run();
          
          nuevos++;
          
          detalles.push({
            movimiento_id: movimiento.id,
            empleado_id: validacion.empleado_id,
            empleado_nombre: validacion.nombre_completo,
            monto: movimiento.amount,
            advertencia: validacion.advertencia,
          });
        }
        
        return jsonResponse({
          success: true,
          nuevos_movimientos: nuevos,
          sin_asociar: sinAsociar,
          errores: errores,
          total_procesados: response.length,
          detalles: detalles,
        });
        
      } catch (error) {
        console.error('Error sincronizando movimientos de caja:', error);
        return jsonResponse({ error: error.message }, 500);
      }
    }
    
    // ==================== CONTINUARÁ... ====================
    
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
