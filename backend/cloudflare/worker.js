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
 
/**
 * Parsear comentario de movimiento de caja para extraer empleado
 * Formato: "id:19 Kevin detalle opcional"
 * Tolerante a mayúsculas/minúsculas, espacios extra, comas y puntos
 */
function parsearComentarioMovimientoCaja(comentario) {
  if (!comentario || typeof comentario !== 'string') {
    return { success: false, error: 'Comentario vacío o inválido' };
  }
  
  const comentarioTrim = comentario.trim();
  
  // FORMATO NUEVO (preferido): "id:19 Kevin detalle"
  // Más flexible: acepta ID/Id/id, espacios, mayúsculas/minúsculas
  // Regex: id (case insensitive) : número whitespace nombre (palabra) resto opcional
  const matchNuevoFormato = comentarioTrim.match(/^id\s*:\s*(\d+)\s+(\w+)/i);
  
  if (matchNuevoFormato) {
    const empleadoId = parseInt(matchNuevoFormato[1]);
    const primerNombre = matchNuevoFormato[2];
    
    // Extraer el detalle (todo después del nombre)
    // Quitar el "id:XX NombreEmpleado" del inicio
    const patron = new RegExp(`^id\\s*:\\s*${empleadoId}\\s+${primerNombre}[,.]?\\s*`, 'i');
    const detalle = comentarioTrim.replace(patron, '').trim() || null;
    
    return {
      success: true,
      empleado_id: empleadoId,
      primer_nombre: primerNombre,
      detalle: detalle,
      comentario_original: comentario,
      formato: 'nuevo'
    };
  }
  
  // FORMATO ANTIGUO (legacy): "19 Kevin detalle"
  // SOLO si el ID está al INICIO y es menor a 1000 (para evitar falsos positivos)
  const matchAntiguoFormato = comentarioTrim.match(/^(\d{1,3})\s+(\w+)/);
  
  if (matchAntiguoFormato) {
    const empleadoId = parseInt(matchAntiguoFormato[1]);
    
    // Validar que el ID sea razonable (1-999)
    if (empleadoId < 1 || empleadoId > 999) {
      return { 
        success: false, 
        error: 'ID numérico fuera de rango válido (1-999)' 
      };
    }
    
    const primerNombre = matchAntiguoFormato[2];
    
    // Evitar palabras que claramente NO son nombres
    const palabrasInvalidas = ['cuotas', 'cajas', 'libras', 'latas', 'bolsas', 'unidades', 'kilos', 'pago', 'nomina', 'domicilio'];
    if (palabrasInvalidas.includes(primerNombre.toLowerCase())) {
      return {
        success: false,
        error: `"${primerNombre}" no es un nombre válido. Use formato: id:${empleadoId} NombreEmpleado`
      };
    }
    
    // Extraer detalle
    const patron = new RegExp(`^${empleadoId}\\s+${primerNombre}[,.]?\\s*`, 'i');
    const detalle = comentarioTrim.replace(patron, '').trim() || null;
    
    return {
      success: true,
      empleado_id: empleadoId,
      primer_nombre: primerNombre,
      detalle: detalle,
      comentario_original: comentario,
      formato: 'antiguo',
      advertencia: 'Se recomienda usar formato nuevo: id:' + empleadoId + ' ' + primerNombre
    };
  }
  
  return { 
    success: false, 
    error: 'Formato inválido. Use: id:19 Kevin detalle (o formato antiguo: 19 Kevin detalle)' 
  };
}

/**
 * Validar que el empleado existe y que el nombre coincide (case-insensitive)
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
  
  // Comparación case-insensitive
  const nombreCoincide = primerNombreBD === primerNombreComentario;
  
  return {
    valido: true,
    empleado_id: empleado.id,
    nombre_completo: nombreCompleto,
    nombre_coincide: nombreCoincide,
    advertencia: nombreCoincide ? null : `Advertencia: Nombre en comentario "${primerNombre}" no coincide exactamente con "${nombreCompleto}"`,
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
 * Los abonos son transacciones positivas (income) que reducen la deuda
 */
async function obtenerAbonosCuentaCorriente(env, fudoCustomerId) {
  try {
    console.log('🔍 Buscando abonos de cuenta corriente para customer:', fudoCustomerId);
    
    // Endpoint de transacciones de cuenta corriente
    // Incluimos customer para filtrar
    const endpoint = `/house-account-transactions?include=customer&page[size]=200&sort=-createdAt`;
    
    const response = await fudoApiRequest(env, endpoint);
    
    if (!response.data || response.data.length === 0) {
      console.log('ℹ️ No se encontraron transacciones de cuenta corriente');
      return [];
    }
    
    console.log(`📊 Total transacciones obtenidas: ${response.data.length}`);
    
    // Filtrar solo las transacciones del customer específico que son ABONOS (amount positivo)
    const abonosCustomer = [];
    
    for (const transaction of response.data) {
      // Verificar si la transacción pertenece al customer
      const transactionCustomerId = transaction.relationships?.customer?.data?.id;
      
      if (transactionCustomerId !== fudoCustomerId) {
        continue; // Saltar si no es del customer que buscamos
      }
      
      // Solo queremos abonos (amount positivo = reduce la deuda)
      if (transaction.attributes.amount <= 0) {
        continue; // Saltar si es negativo (sería un cargo, no un abono)
      }
      
      abonosCustomer.push({
        transaction_id: transaction.id,
        fecha: transaction.attributes.createdAt,
        monto: transaction.attributes.amount,
        comentario: transaction.attributes.comment || 'Abono a cuenta corriente',
      });
    }
    
    console.log(`✅ Encontrados ${abonosCustomer.length} abonos para customer ${fudoCustomerId}`);
    return abonosCustomer;
    
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
        descontado, fudo_sale_id, fudo_payment_id, fudo_synced_at, monto_original_fudo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      empleadoId,
      venta.fecha.split('T')[0],
      'consumo',
      venta.monto, // Monto sincronizado (puede ser editado después)
      venta.descripcion,
      0,
      venta.sale_id,
      venta.payment_id,
      formatDateTime(nowColombia()),
      venta.monto // ⬅️ Guardar el monto original de FUDO
    ).run();
      nuevosConsumos++;
    }
    
    // Ahora importar ABONOS (pagos a cuenta corriente)
    const abonos = await obtenerAbonosCuentaCorriente(env, empleado.fudo_customer_id);
    let nuevosAbonos = 0;
    
    for (const abono of abonos) {
      // Verificar si ya existe usando fudo_transaction_id
      const existe = await db.prepare(
        'SELECT id FROM movimientos WHERE fudo_transaction_id = ?'
      ).bind(abono.transaction_id.toString()).first();
      
      if (existe) {
        duplicados++;
        continue;
      }
      
      // Crear movimiento tipo abono
      await db.prepare(
        `INSERT INTO movimientos (
          empleado_id, fecha, tipo, monto, descripcion,
          descontado, fudo_transaction_id, fudo_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        empleadoId,
        abono.fecha.split('T')[0],
        'abono',
        abono.monto,
        abono.comentario, // ⚠️ Cambiado de 'descripcion' a 'comentario'
        0, // Los abonos ya están "aplicados"
        abono.transaction_id.toString(), // ⚠️ Convertir a string
        formatDateTime(nowColombia())
      ).run();
      
      nuevosAbonos++;
    }
    
    const saldoResult = await db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo IN ('consumo', 'adelanto') THEN monto ELSE 0 END), 0) as total_deudas,
        COALESCE(SUM(CASE WHEN tipo = 'abono' THEN monto ELSE 0 END), 0) as total_abonos
      FROM movimientos 
      WHERE empleado_id = ?
    `).bind(empleadoId).first();

    const saldo = saldoResult.total_deudas - saldoResult.total_abonos;
    
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

    // Editar monto de un movimiento (aplicar descuento)
    if (path.match(/^\/api\/nomina\/movimientos\/\d+\/editar-monto$/) && method === 'PUT') {
      const movimientoId = parseInt(path.split('/')[4]);
      const body = await request.json();
      
      try {
        // Obtener el movimiento
        const movimiento = await db.prepare(
          'SELECT * FROM movimientos WHERE id = ?'
        ).bind(movimientoId).first();
        
        if (!movimiento) {
          return jsonResponse({ error: 'Movimiento no encontrado' }, 404);
        }
        
        if (movimiento.descontado === 1) {
          return jsonResponse({ error: 'No se puede editar un movimiento ya descontado' }, 400);
        }
        
        // Validar que venga el nuevo monto
        if (!body.nuevo_monto || body.nuevo_monto <= 0) {
          return jsonResponse({ error: 'Debe proporcionar un nuevo_monto válido' }, 400);
        }
        
        const montoOriginal = movimiento.monto_original_fudo || movimiento.monto;
        const nuevoMonto = body.nuevo_monto;
        const diferencia = montoOriginal - nuevoMonto;
        const porcentajeDescuento = (diferencia / montoOriginal) * 100;
        
        // Actualizar el monto
        await db.prepare(
          `UPDATE movimientos 
           SET monto = ?, 
               descripcion = ?
           WHERE id = ?`
        ).bind(
          nuevoMonto,
          body.motivo || movimiento.descripcion,
          movimientoId
        ).run();
        
        return jsonResponse({
          success: true,
          movimiento_id: movimientoId,
          monto_original_fudo: montoOriginal,
          monto_anterior: movimiento.monto,
          monto_nuevo: nuevoMonto,
          descuento_aplicado: diferencia,
          porcentaje_descuento: Math.round(porcentajeDescuento * 100) / 100,
          motivo: body.motivo || movimiento.descripcion,
        });
        
      } catch (error) {
        console.error('Error editando monto:', error);
        return jsonResponse({ error: error.message }, 500);
      }
    }

    // Aplicar descuento del 15% a un movimiento
    if (path.match(/^\/api\/nomina\/movimientos\/\d+\/aplicar-descuento-15$/) && method === 'POST') {
      const movimientoId = parseInt(path.split('/')[4]);
      
      try {
        const movimiento = await db.prepare(
          'SELECT * FROM movimientos WHERE id = ?'
        ).bind(movimientoId).first();
        
        if (!movimiento) {
          return jsonResponse({ error: 'Movimiento no encontrado' }, 404);
        }
        
        if (movimiento.descontado === 1) {
          return jsonResponse({ error: 'No se puede editar un movimiento ya descontado' }, 400);
        }
        
        const montoOriginal = movimiento.monto_original_fudo || movimiento.monto;
        const nuevoMonto = Math.round(montoOriginal * 0.85); // 15% de descuento
        const descuento = montoOriginal - nuevoMonto;
        
        await db.prepare(
          `UPDATE movimientos 
           SET monto = ?, 
               descripcion = ?
           WHERE id = ?`
        ).bind(
          nuevoMonto,
          `${movimiento.descripcion} (Descuento 15% empleado: -$${descuento.toLocaleString('es-CO')})`,
          movimientoId
        ).run();
        
        return jsonResponse({
          success: true,
          movimiento_id: movimientoId,
          monto_original_fudo: montoOriginal,
          monto_con_descuento: nuevoMonto,
          descuento_aplicado: descuento,
          porcentaje: 15,
        });
        
      } catch (error) {
        console.error('Error aplicando descuento:', error);
        return jsonResponse({ error: error.message }, 500);
      }
    }
    // ==================== DEBUG: Ver ventas FUDO de un customer ====================

    // DEBUG: Ver información completa de cuenta corriente en FUDO
    if (path.match(/^\/api\/nomina\/fudo\/debug-cuenta-corriente\/\d+$/) && method === 'GET') {
      const empleadoId = parseInt(path.split('/')[5]);
      
      try {
        const empleado = await db.prepare(
          'SELECT * FROM empleados WHERE id = ?'
        ).bind(empleadoId).first();
        
        if (!empleado || !empleado.fudo_customer_id) {
          return jsonResponse({ error: 'Empleado no encontrado o sin customer FUDO' }, 404);
        }
        
        // 1. Obtener información del customer
        const customer = await fudoApiRequest(env, `/customers/${empleado.fudo_customer_id}`);
        
        // 2. Obtener transacciones de cuenta corriente
        const transactions = await fudoApiRequest(env, `/house-account-transactions?include=customer&page[size]=200&sort=-createdAt`);
        
        // Filtrar solo las del customer
        const customerTransactions = transactions.data.filter(
          t => t.relationships?.customer?.data?.id === empleado.fudo_customer_id
        );
        
        // Separar por tipo
        const abonos = customerTransactions.filter(t => t.attributes.amount > 0);
        const cargos = customerTransactions.filter(t => t.attributes.amount < 0);
        
        const totalAbonos = abonos.reduce((sum, t) => sum + t.attributes.amount, 0);
        const totalCargos = cargos.reduce((sum, t) => sum + Math.abs(t.attributes.amount), 0);
        
        // 3. Obtener ventas con cuenta corriente
        const ventas = await obtenerVentasCuentaCorriente(env, empleado.fudo_customer_id, null);
        const totalVentas = ventas.reduce((sum, v) => sum + v.monto, 0);
        
        return jsonResponse({
          empleado: {
            id: empleado.id,
            nombre: empleado.nombre,
            fudo_customer_id: empleado.fudo_customer_id,
          },
          customer_fudo: {
            name: customer.data.attributes.name,
            houseAccountEnabled: customer.data.attributes.houseAccountEnabled,
            houseAccountBalance: customer.data.attributes.houseAccountBalance,
            active: customer.data.attributes.active,
          },
          transacciones_cuenta_corriente: {
            total: customerTransactions.length,
            abonos: {
              cantidad: abonos.length,
              total: totalAbonos,
              detalle: abonos.map(t => ({
                id: t.id,
                fecha: t.attributes.createdAt,
                monto: t.attributes.amount,
                comentario: t.attributes.comment,
              })),
            },
            cargos: {
              cantidad: cargos.length,
              total: totalCargos,
              detalle: cargos.map(t => ({
                id: t.id,
                fecha: t.attributes.createdAt,
                monto: t.attributes.amount,
                comentario: t.attributes.comment,
              })),
            },
          },
          ventas_cuenta_corriente: {
            total: ventas.length,
            total_monto: totalVentas,
            detalle: ventas.slice(0, 10).map(v => ({ // Solo primeras 10
              sale_id: v.sale_id,
              fecha: v.fecha,
              monto: v.monto,
              descripcion: v.descripcion,
            })),
          },
          calculos: {
            segun_balance_fudo: customer.data.attributes.houseAccountBalance,
            segun_transacciones: totalAbonos - totalCargos,
            segun_ventas: totalVentas - totalAbonos,
          },
        });
        
      } catch (error) {
        console.error('Error obteniendo debug de cuenta corriente:', error);
        return jsonResponse({ error: error.message }, 500);
      }
    }

    
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
    // Ver movimientos sincronizados de un empleado específico
    if (path.match(/^\/api\/nomina\/movimientos\/empleado\/\d+$/) && method === 'GET') {
      const empleadoId = parseInt(path.split('/')[5]);
      
      try {
        // Obtener info del empleado
        const empleado = await db.prepare(
          'SELECT id, nombre, fudo_customer_id FROM empleados WHERE id = ?'
        ).bind(empleadoId).first();
        
        if (!empleado) {
          return jsonResponse({ error: 'Empleado no encontrado' }, 404);
        }
        
        // Obtener todos los movimientos del empleado
        const movimientos = await db.prepare(`
          SELECT 
            id,
            fecha,
            tipo,
            monto,
            descripcion,
            descontado,
            fudo_sale_id,
            fudo_payment_id,
            fudo_transaction_id,
            fudo_synced_at,
            nomina_id,
            created_at
          FROM movimientos 
          WHERE empleado_id = ?
          ORDER BY fecha DESC, created_at DESC
        `).bind(empleadoId).all();
        
        // Calcular totales HISTÓRICOS por tipo
        const totalesHistorico = await db.prepare(`
          SELECT 
            COUNT(*) as total_movimientos,
            COALESCE(SUM(CASE WHEN tipo = 'consumo' THEN monto ELSE 0 END), 0) as total_consumos,
            COALESCE(SUM(CASE WHEN tipo = 'adelanto' THEN monto ELSE 0 END), 0) as total_adelantos,
            COALESCE(SUM(CASE WHEN tipo = 'abono' THEN monto ELSE 0 END), 0) as total_abonos
          FROM movimientos
          WHERE empleado_id = ?
        `).bind(empleadoId).first();
        
        // Calcular saldos ACTUALES separados (solo movimientos NO descontados)
        const saldosActuales = await db.prepare(`
          SELECT 
            COALESCE(SUM(CASE WHEN tipo = 'consumo' AND descontado = 0 THEN monto ELSE 0 END), 0) as consumos_pendientes,
            COALESCE(SUM(CASE WHEN tipo = 'adelanto' AND descontado = 0 THEN monto ELSE 0 END), 0) as adelantos_pendientes,
            COALESCE(SUM(CASE WHEN tipo = 'abono' THEN monto ELSE 0 END), 0) as total_abonos,
            COUNT(CASE WHEN tipo IN ('consumo', 'adelanto') AND descontado = 0 THEN 1 END) as pendientes_count
          FROM movimientos
          WHERE empleado_id = ?
        `).bind(empleadoId).first();
        
        // SALDOS SEPARADOS
        const saldoCuentaCorriente = saldosActuales.consumos_pendientes - saldosActuales.total_abonos;
        const saldoAdelantos = saldosActuales.adelantos_pendientes;
        const saldoTotal = saldoCuentaCorriente + saldoAdelantos;
        
        return jsonResponse({
          empleado: {
            id: empleado.id,
            nombre: empleado.nombre,
            tiene_customer_fudo: !!empleado.fudo_customer_id,
          },
          resumen: {
            total_movimientos: totalesHistorico.total_movimientos,
            
            // Histórico completo
            historico: {
              total_consumos: totalesHistorico.total_consumos,
              total_adelantos: totalesHistorico.total_adelantos,
              total_abonos: totalesHistorico.total_abonos,
            },
            
            // Saldos actuales SEPARADOS
            cuenta_corriente: {
              consumos_pendientes: saldosActuales.consumos_pendientes,
              abonos_aplicados: saldosActuales.total_abonos,
              saldo: saldoCuentaCorriente,
              estado: saldoCuentaCorriente > 0 ? 'debe' : (saldoCuentaCorriente < 0 ? 'a_favor' : 'sin_deuda'),
              saldo_formateado: saldoCuentaCorriente < 0 
                ? `A favor: $${Math.abs(saldoCuentaCorriente).toLocaleString('es-CO')}` 
                : `Debe: $${saldoCuentaCorriente.toLocaleString('es-CO')}`,
            },
            
            adelantos: {
              pendientes: saldoAdelantos,
              estado: saldoAdelantos > 0 ? 'debe' : 'sin_deuda',
              saldo_formateado: `Debe: $${saldoAdelantos.toLocaleString('es-CO')}`,
            },
            
            // Saldo TOTAL combinado
            saldo_total: {
              monto: saldoTotal,
              estado: saldoTotal > 0 ? 'debe' : (saldoTotal < 0 ? 'a_favor' : 'sin_deuda'),
              saldo_formateado: saldoTotal < 0 
                ? `A favor: $${Math.abs(saldoTotal).toLocaleString('es-CO')}` 
                : `Debe: $${saldoTotal.toLocaleString('es-CO')}`,
            },
            
            pendientes_descuento: saldosActuales.pendientes_count,
          },
          movimientos: movimientos.results.map(m => ({
            id: m.id,
            fecha: m.fecha,
            tipo: m.tipo,
            monto: m.monto,
            descripcion: m.descripcion,
            descontado: m.descontado === 1,
            nomina_id: m.nomina_id,
            sincronizado_fudo: !!(m.fudo_sale_id || m.fudo_payment_id || m.fudo_transaction_id),
            fudo_sale_id: m.fudo_sale_id,
            fudo_payment_id: m.fudo_payment_id,
            fudo_transaction_id: m.fudo_transaction_id,
            fecha_sincronizacion: m.fudo_synced_at,
            fecha_registro: m.created_at,
          })),
        });
        
      } catch (error) {
        console.error('Error obteniendo movimientos del empleado:', error);
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
    
    // Crear nómina (con cálculo automático y pre-configuración de movimientos)
    if (path === '/api/nomina/nominas' && method === 'POST') {
      const body = await request.json();
      
      try {
        // Validar campos requeridos
        if (!body.empleado_id || !body.dias_trabajados) {
          return jsonResponse({ 
            error: 'Campos requeridos: empleado_id, dias_trabajados' 
          }, 400);
        }
        
        // Obtener empleado
        const empleado = await db.prepare(
          'SELECT * FROM empleados WHERE id = ?'
        ).bind(body.empleado_id).first();
        
        if (!empleado) {
          return jsonResponse({ error: 'Empleado no encontrado' }, 404);
        }
        
        // Validar que el empleado tenga sueldo definido
        const sueldo_mensual = empleado.sueldo_mensual;
    
        if (!sueldo_mensual || sueldo_mensual <= 0) {
          return jsonResponse({ 
            error: `El empleado ${empleado.nombre} no tiene sueldo mensual definido. Por favor actualice primero el sueldo del empleado.`,
            empleado_id: empleado.id,
            sueldo_actual: sueldo_mensual || null,
          }, 400);
        }
        
        // Periodos (del body o calcular automáticamente)
        const periodo_inicio = body.periodo_inicio || formatDate(nowColombia());
        const periodo_fin = body.periodo_fin || formatDate(nowColombia());
        
        // Obtener movimientos pendientes DENTRO del periodo de la nómina
        const movimientosPeriodo = await db.prepare(`
          SELECT *
          FROM movimientos
          WHERE empleado_id = ?
            AND tipo IN ('consumo', 'adelanto')
            AND descontado = 0
            AND fecha >= ?
            AND fecha <= ?
          ORDER BY fecha ASC, id ASC
        `).bind(body.empleado_id, periodo_inicio, periodo_fin).all();
        
        const total_movimientos_periodo = movimientosPeriodo.results.reduce((sum, m) => sum + m.monto, 0);
        
        // Determinar tipo de nómina (del body o del empleado)
        const tipoNomina = body.tipo_nomina || empleado.tipo_pago || 'quincenal';
        
        // Calcular monto base según días trabajados y tipo de nómina
        let monto_base = 0;
        
        if (tipoNomina === 'quincenal') {
          monto_base = (sueldo_mensual / 30) * body.dias_trabajados;
        } else if (tipoNomina === 'mensual') {
          monto_base = (sueldo_mensual / 30) * body.dias_trabajados;
        }
        
        // Redondear a entero
        monto_base = Math.round(monto_base);
        
        // Obtener otros valores del body (opcionales)
        const total_propinas = body.total_propinas || 0;
        const total_bonos = body.total_bonos || 0;
        const total_descuentos = body.total_descuentos || 0;
        
        // Calcular total a pagar
        const total_bruto = monto_base + total_propinas + total_bonos - total_descuentos;
        const total_pagar = total_bruto - total_movimientos_periodo;
        
        // Crear nómina
        const result = await db.prepare(
          `INSERT INTO nominas (
            empleado_id, tipo_nomina, periodo_inicio, periodo_fin, 
            dias_trabajados, sueldo_base, monto_base, total_propinas,
            total_bonos, total_descuentos, total_movimientos, total_pagar,
            pagada, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          body.empleado_id,
          tipoNomina,
          periodo_inicio,
          periodo_fin,
          body.dias_trabajados,
          sueldo_mensual,
          monto_base,
          total_propinas,
          total_bonos,
          total_descuentos,
          total_movimientos_periodo,
          total_pagar,
          0, // No pagada
          formatDateTime(nowColombia())
        ).run();
        
        const nominaId = result.meta.last_row_id;
        
        // PRE-CONFIGURAR movimientos del periodo como "pagar_completo"
        for (const mov of movimientosPeriodo.results) {
          await db.prepare(
            `INSERT INTO nomina_movimientos (nomina_id, movimiento_id, tipo_descuento, monto_a_descontar, created_at)
             VALUES (?, ?, ?, ?, ?)`
          ).bind(
            nominaId,
            mov.id,
            'completo',
            mov.monto,
            formatDateTime(nowColombia())
          ).run();
        }
        
        return jsonResponse({
          success: true,
          nomina_id: nominaId,
          empleado: empleado.nombre,
          periodo: {
            inicio: periodo_inicio,
            fin: periodo_fin,
          },
          calculo: {
            sueldo_mensual: sueldo_mensual,
            dias_trabajados: body.dias_trabajados,
            monto_base: monto_base,
            total_propinas: total_propinas,
            total_bonos: total_bonos,
            total_descuentos: total_descuentos,
            total_bruto: total_bruto,
            movimientos_periodo: {
              cantidad: movimientosPeriodo.results.length,
              monto_total: total_movimientos_periodo,
              detalle: movimientosPeriodo.results.map(m => ({
                id: m.id,
                tipo: m.tipo,
                fecha: m.fecha,
                monto: m.monto,
                descripcion: m.descripcion,
                configurado_como: 'completo',
              })),
            },
            total_a_pagar: total_pagar,
          },
          nota: 'Los movimientos del periodo fueron pre-configurados para pago completo. Use /nominas/{id}/configurar-descuentos para modificar.',
        }, 201);
        
      } catch (error) {
        console.error('Error creando nómina:', error);
        return jsonResponse({ error: error.message }, 500);
      }
    }

    // Ver configuración de descuentos de una nómina (previsualización)
    if (path.match(/^\/api\/nomina\/nominas\/\d+\/ver-descuentos$/) && method === 'GET') {
      const nominaId = parseInt(path.split('/')[4]);
      
      try {
        // Obtener la nómina
        const nomina = await db.prepare(`
          SELECT n.*, e.nombre as empleado_nombre
          FROM nominas n
          JOIN empleados e ON n.empleado_id = e.id
          WHERE n.id = ?
        `).bind(nominaId).first();
        
        if (!nomina) {
          return jsonResponse({ error: 'Nómina no encontrada' }, 404);
        }
        
        // Obtener configuración de movimientos
        const configuracion = await db.prepare(`
          SELECT 
            nm.*,
            m.fecha,
            m.tipo,
            m.monto as monto_original,
            m.descripcion,
            m.descontado
          FROM nomina_movimientos nm
          JOIN movimientos m ON nm.movimiento_id = m.id
          WHERE nm.nomina_id = ?
          ORDER BY m.fecha ASC
        `).bind(nominaId).all();
        
        // Calcular totales
        let totalCompleto = 0;
        let totalParcial = 0;
        let totalDiferido = 0;
        
        const movimientos = configuracion.results.map(c => {
          if (c.tipo_descuento === 'completo') {
            totalCompleto += c.monto_a_descontar;
          } else if (c.tipo_descuento === 'parcial') {
            totalParcial += c.monto_a_descontar;
          }
          
          return {
            movimiento_id: c.movimiento_id,
            fecha: c.fecha,
            tipo: c.tipo,
            monto_original: c.monto_original,
            descripcion: c.descripcion,
            configuracion: {
              tipo_descuento: c.tipo_descuento,
              monto_a_descontar: c.monto_a_descontar,
              saldo_restante: c.tipo_descuento === 'parcial' 
                ? c.monto_original - c.monto_a_descontar 
                : (c.tipo_descuento === 'diferir' ? c.monto_original : 0),
            },
          };
        });
        
        const totalADescontar = totalCompleto + totalParcial;
        const montoFinalAPagar = nomina.total_pagar - totalADescontar;
        
        return jsonResponse({
          success: true,
          nomina: {
            id: nomina.id,
            empleado: nomina.empleado_nombre,
            periodo: {
              inicio: nomina.periodo_inicio,
              fin: nomina.periodo_fin,
            },
            estado: nomina.pagada ? 'pagada' : 'pendiente',
            fecha_pago: nomina.fecha_pago,
          },
          calculo: {
            total_nomina_bruto: nomina.total_pagar,
            total_a_descontar: totalADescontar,
            desglose_descuentos: {
              pagos_completos: totalCompleto,
              pagos_parciales: totalParcial,
              diferidos: totalDiferido,
            },
            monto_final_a_pagar_empleado: montoFinalAPagar,
          },
          movimientos_configurados: {
            total: movimientos.length,
            completos: movimientos.filter(m => m.configuracion.tipo_descuento === 'completo').length,
            parciales: movimientos.filter(m => m.configuracion.tipo_descuento === 'parcial').length,
            diferidos: movimientos.filter(m => m.configuracion.tipo_descuento === 'diferir').length,
            detalle: movimientos,
          },
        });
        
      } catch (error) {
        console.error('Error obteniendo configuración:', error);
        return jsonResponse({ error: error.message }, 500);
      }
    }
    
    // Modificar configuración de descuentos de una nómina
    if (path.match(/^\/api\/nomina\/nominas\/\d+\/modificar-descuentos$/) && method === 'PUT') {
      const nominaId = parseInt(path.split('/')[4]);
      const body = await request.json();
      
      try {
        // Verificar que la nómina existe y NO está pagada
        const nomina = await db.prepare(
          'SELECT * FROM nominas WHERE id = ?'
        ).bind(nominaId).first();
        
        if (!nomina) {
          return jsonResponse({ error: 'Nómina no encontrada' }, 404);
        }
        
        if (nomina.pagada) {
          return jsonResponse({ error: 'No se puede modificar una nómina ya pagada' }, 400);
        }
        
        // Validar formato del body
        if (!body.movimientos || !Array.isArray(body.movimientos)) {
          return jsonResponse({ 
            error: 'Se requiere un array de movimientos',
            ejemplo: {
              movimientos: [
                { id: 19, tipo_descuento: "completo" },
                { id: 21, tipo_descuento: "parcial", monto: 5000 },
                { id: 22, tipo_descuento: "diferir" }
              ]
            }
          }, 400);
        }
        
        const resultados = [];
        
        // Procesar cada modificación
        for (const config of body.movimientos) {
          // Verificar que la configuración existe
          const configExistente = await db.prepare(`
            SELECT nm.*, m.monto as monto_original, m.tipo, m.descripcion
            FROM nomina_movimientos nm
            JOIN movimientos m ON nm.movimiento_id = m.id
            WHERE nm.nomina_id = ? AND nm.movimiento_id = ?
          `).bind(nominaId, config.id).first();
          
          if (!configExistente) {
            resultados.push({
              movimiento_id: config.id,
              error: 'Movimiento no está configurado en esta nómina',
              modificado: false,
            });
            continue;
          }
          
          // Validar tipo_descuento
          if (!['completo', 'parcial', 'diferir'].includes(config.tipo_descuento)) {
            resultados.push({
              movimiento_id: config.id,
              error: 'tipo_descuento inválido. Use: completo, parcial, o diferir',
              modificado: false,
            });
            continue;
          }
          
          // Calcular nuevo monto a descontar
          let nuevoMontoADescontar = null;
          
          if (config.tipo_descuento === 'completo') {
            nuevoMontoADescontar = configExistente.monto_original;
          } else if (config.tipo_descuento === 'parcial') {
            if (!config.monto || config.monto <= 0) {
              resultados.push({
                movimiento_id: config.id,
                error: 'Para pago parcial debe especificar un monto válido',
                modificado: false,
              });
              continue;
            }
            
            if (config.monto >= configExistente.monto_original) {
              resultados.push({
                movimiento_id: config.id,
                error: `El monto parcial ($${config.monto}) debe ser menor al total del movimiento ($${configExistente.monto_original})`,
                modificado: false,
              });
              continue;
            }
            
            nuevoMontoADescontar = config.monto;
          } else if (config.tipo_descuento === 'diferir') {
            nuevoMontoADescontar = 0;
          }
          
          // Actualizar configuración
          await db.prepare(
            `UPDATE nomina_movimientos 
             SET tipo_descuento = ?, monto_a_descontar = ?
             WHERE nomina_id = ? AND movimiento_id = ?`
          ).bind(
            config.tipo_descuento,
            nuevoMontoADescontar,
            nominaId,
            config.id
          ).run();
          
          resultados.push({
            movimiento_id: config.id,
            tipo: configExistente.tipo,
            descripcion: configExistente.descripcion,
            monto_original: configExistente.monto_original,
            configuracion_anterior: {
              tipo: configExistente.tipo_descuento,
              monto: configExistente.monto_a_descontar,
            },
            configuracion_nueva: {
              tipo: config.tipo_descuento,
              monto: nuevoMontoADescontar,
            },
            modificado: true,
          });
        }
        
        // Recalcular totales
        const nuevaConfig = await db.prepare(`
          SELECT 
            SUM(CASE WHEN tipo_descuento != 'diferir' THEN monto_a_descontar ELSE 0 END) as total_a_descontar
          FROM nomina_movimientos
          WHERE nomina_id = ?
        `).bind(nominaId).first();
        
        const nuevoTotalAPagar = nomina.total_pagar - (nuevaConfig.total_a_descontar || 0);
        
        return jsonResponse({
          success: true,
          nomina_id: nominaId,
          modificaciones_aplicadas: resultados.filter(r => r.modificado).length,
          resumen: {
            total_nomina: nomina.total_pagar,
            total_a_descontar: nuevaConfig.total_a_descontar || 0,
            nuevo_total_a_pagar: nuevoTotalAPagar,
          },
          detalles: resultados,
        });
        
      } catch (error) {
        console.error('Error modificando configuración:', error);
        return jsonResponse({ error: error.message }, 500);
      }
    }
    
    // Pagar nómina con descuento automático de cuenta corriente (consumos + adelantos)
    if (path.match(/^\/api\/nomina\/nominas\/\d+\/pagar$/) && method === 'POST') {
      const nominaId = parseInt(path.split('/')[4]);
      
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
        
        // Obtener TODOS los movimientos pendientes (consumos + adelantos, más antiguos primero)
        const movimientos = await db.prepare(
          `SELECT * FROM movimientos 
           WHERE empleado_id = ? 
           AND tipo IN ('consumo', 'adelanto')
           AND descontado = 0
           ORDER BY fecha ASC, id ASC`
        ).bind(nomina.empleado_id).all();
        
        let totalDescontado = 0;
        const movimientosDescontados = [];
        const movimientosPendientes = [];
        
        // Monto disponible para descontar = lo que se va a pagar en esta nómina
        let montoDisponible = nomina.total_pagar;
        
        console.log(`💰 Monto disponible para descontar: $${montoDisponible}`);
        console.log(`📋 Movimientos pendientes: ${movimientos.results.length}`);
        
        // Descontar SOLO movimientos COMPLETOS (FIFO: más antiguos primero)
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
            
            console.log(`✅ ${mov.tipo} #${mov.id} pagado completo: $${mov.monto}`);
          } else {
            // No alcanza para pagar este movimiento completo - queda pendiente
            movimientosPendientes.push({
              id: mov.id,
              tipo: mov.tipo,
              monto: mov.monto,
              faltante: mov.monto - montoDisponible,
            });
            console.log(`⏳ ${mov.tipo} #${mov.id} pendiente: $${mov.monto} (falta: $${mov.monto - montoDisponible})`);
          }
        }
        
        // Calcular monto final a pagar al empleado (lo que sobra después de descontar)
        const montoPagarEmpleado = montoDisponible;
        
        // Registrar pago en FUDO solo para CONSUMOS
        let fudoTransactionId = null;
        
        const consumosDescontados = movimientosDescontados.filter(m => m.tipo === 'consumo');
        const totalConsumosDescontados = consumosDescontados.reduce((sum, m) => sum + m.monto, 0);
        
        if (empleado.fudo_customer_id && totalConsumosDescontados > 0) {
          const adelantosDescontados = movimientosDescontados.filter(m => m.tipo === 'adelanto');
          const totalAdelantosDescontados = adelantosDescontados.reduce((sum, m) => sum + m.monto, 0);
          
          const comentario = `Pago nómina #${nominaId} - Periodo ${nomina.periodo_inicio} a ${nomina.periodo_fin}. Consumos: $${totalConsumosDescontados.toLocaleString('es-CO')}${totalAdelantosDescontados > 0 ? `. Adelantos: $${totalAdelantosDescontados.toLocaleString('es-CO')}` : ''}`;
          
          const resultadoFudo = await crearPagoFudo(
            env,
            empleado.fudo_customer_id,
            totalConsumosDescontados, // Solo registrar consumos en FUDO
            comentario
          );
          
          if (resultadoFudo.success) {
            fudoTransactionId = resultadoFudo.transaction_id;
          } else {
            console.warn('⚠️ No se pudo registrar pago en FUDO:', resultadoFudo.error);
          }
        }
        
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
          totalDescontado,
          fudoTransactionId,
          fudoTransactionId ? formatDateTime(nowColombia()) : null,
          nominaId
        ).run();
        
        // Separar por tipo
        const consumosDesc = movimientosDescontados.filter(m => m.tipo === 'consumo');
        const adelantosDesc = movimientosDescontados.filter(m => m.tipo === 'adelanto');
        
        return jsonResponse({
          success: true,
          nomina_id: nominaId,
          empleado: empleado.nombre,
          resumen_pago: {
            total_nomina: nomina.total_pagar,
            total_descontado: totalDescontado,
            monto_a_pagar_empleado: montoPagarEmpleado,
          },
          desglose_descontado: {
            consumos: consumosDesc.reduce((s, m) => s + m.monto, 0),
            adelantos: adelantosDesc.reduce((s, m) => s + m.monto, 0),
          },
          movimientos_procesados: {
            total_pagados: movimientosDescontados.length,
            consumos_pagados: consumosDesc.length,
            adelantos_pagados: adelantosDesc.length,
            aun_pendientes: movimientosPendientes.length,
          },
          detalle_pagados: movimientosDescontados.map(m => ({
            id: m.id,
            tipo: m.tipo,
            fecha: m.fecha,
            monto: m.monto,
            descripcion: m.descripcion,
          })),
          detalle_pendientes: movimientosPendientes,
          fudo: {
            transaction_id: fudoTransactionId,
            sincronizado: !!fudoTransactionId,
            monto_registrado: totalConsumosDescontados,
          },
        });
        
      } catch (error) {
        console.error('Error pagando nómina:', error);
        return jsonResponse({ error: error.message }, 500);
      }
    }

    // Listar nóminas con filtros
    if (path === '/api/nomina/nominas/listar' && method === 'GET') {
      try {
        const empleadoId = url.searchParams.get('empleado_id');
        const pagada = url.searchParams.get('pagada'); // 'true', 'false', o null (todas)
        const fechaDesde = url.searchParams.get('fecha_desde');
        const fechaHasta = url.searchParams.get('fecha_hasta');
        const limit = parseInt(url.searchParams.get('limit')) || 100;
        const offset = parseInt(url.searchParams.get('offset')) || 0;
        
        // Construir query dinámicamente
        let query = `
          SELECT 
            n.*,
            e.nombre as empleado_nombre,
            e.rol as empleado_rol
          FROM nominas n
          JOIN empleados e ON n.empleado_id = e.id
          WHERE 1=1
        `;
        
        const params = [];
        
        // Filtro por empleado
        if (empleadoId) {
          query += ' AND n.empleado_id = ?';
          params.push(empleadoId);
        }
        
        // Filtro por estado de pago
        if (pagada === 'true') {
          query += ' AND n.pagada = 1';
        } else if (pagada === 'false') {
          query += ' AND n.pagada = 0';
        }
        
        // Filtro por fecha (periodo_inicio)
        if (fechaDesde) {
          query += ' AND n.periodo_inicio >= ?';
          params.push(fechaDesde);
        }
        
        if (fechaHasta) {
          query += ' AND n.periodo_fin <= ?';
          params.push(fechaHasta);
        }
        
        // Ordenar por fecha de creación descendente (más recientes primero)
        query += ' ORDER BY n.created_at DESC';
        
        // Paginación
        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        const nominas = await db.prepare(query).bind(...params).all();
        
        // Contar total de registros (sin paginación)
        let countQuery = `
          SELECT COUNT(*) as total
          FROM nominas n
          WHERE 1=1
        `;
        
        const countParams = [];
        
        if (empleadoId) {
          countQuery += ' AND n.empleado_id = ?';
          countParams.push(empleadoId);
        }
        
        if (pagada === 'true') {
          countQuery += ' AND n.pagada = 1';
        } else if (pagada === 'false') {
          countQuery += ' AND n.pagada = 0';
        }
        
        if (fechaDesde) {
          countQuery += ' AND n.periodo_inicio >= ?';
          countParams.push(fechaDesde);
        }
        
        if (fechaHasta) {
          countQuery += ' AND n.periodo_fin <= ?';
          countParams.push(fechaHasta);
        }
        
        const countResult = await db.prepare(countQuery).bind(...countParams).first();
        
        // Formatear respuesta
        const nominasFormateadas = nominas.results.map(n => ({
          id: n.id,
          empleado: {
            id: n.empleado_id,
            nombre: n.empleado_nombre,
            rol: n.empleado_rol,
          },
          periodo: {
            inicio: n.periodo_inicio,
            fin: n.periodo_fin,
            tipo: n.tipo_nomina,
          },
          dias_trabajados: n.dias_trabajados,
          montos: {
            sueldo_base: n.sueldo_base,
            monto_base: n.monto_base,
            propinas: n.total_propinas,
            bonos: n.total_bonos,
            descuentos: n.total_descuentos,
            movimientos: n.total_movimientos,
            descuento_cuenta_corriente: n.descuento_cuenta_corriente || 0,
            total_pagar: n.total_pagar,
          },
          estado: {
            pagada: n.pagada === 1,
            fecha_pago: n.fecha_pago,
          },
          fudo: {
            transaction_id: n.fudo_transaction_id,
            sincronizado: !!n.fudo_transaction_id,
            fecha_sincronizacion: n.fudo_payment_synced_at,
          },
          fecha_creacion: n.created_at,
        }));
        
        return jsonResponse({
          success: true,
          total: countResult.total,
          limit: limit,
          offset: offset,
          resultados: nominas.results.length,
          nominas: nominasFormateadas,
        });
        
      } catch (error) {
        console.error('Error listando nóminas:', error);
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
        console.log('🔄 Iniciando sincronización de movimientos de caja desde FUDO');
        
        // Construir filtro de fechas
        let t1, t2;
        
        if (fechaDesde) {
          const fecha = new Date(fechaDesde);
          fecha.setHours(5, 0, 0, 0); // 5 AM UTC = Medianoche en Colombia (UTC-5)
          t1 = fecha.toISOString().replace(/\.\d{3}Z$/, '.000Z');
          
          const hoy = new Date();
          hoy.setHours(5, 0, 0, 0);
          hoy.setDate(hoy.getDate() + 1); // Día siguiente
          t2 = hoy.toISOString().replace(/\.\d{3}Z$/, '.000Z');
        } else {
          // Por defecto, últimos 7 días
          const hace7dias = new Date();
          hace7dias.setDate(hace7dias.getDate() - 7);
          hace7dias.setHours(5, 0, 0, 0);
          
          const hoy = new Date();
          hoy.setHours(5, 0, 0, 0);
          hoy.setDate(hoy.getDate() + 1);
          
          t1 = hace7dias.toISOString().replace(/\.\d{3}Z$/, '.000Z');
          t2 = hoy.toISOString().replace(/\.\d{3}Z$/, '.000Z');
        }
        
        console.log(`📅 Buscando movimientos entre ${t1} y ${t2}`);
        
        // Obtener token
        const token = await getFudoToken(env);
        
        // IMPORTANTE: cash_movements NO usa /v1alpha1
        const url = `https://api.fu.do/cash_movements?t1=${t1}&t2=${t2}`;
        
        console.log('📡 URL:', url);
        
        const fetchResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
          },
        });
        
        if (!fetchResponse.ok) {
          const errorText = await fetchResponse.text();
          console.error('❌ Error en petición:', errorText);
          throw new Error(`Error ${fetchResponse.status}: ${errorText}`);
        }
        
        const response = await fetchResponse.json();
        
        // FUDO devuelve un objeto con IDs como keys, no un array
        // Convertir a array
        const movimientosArray = Object.values(response || {});
        
        console.log(`📊 Total movimientos obtenidos: ${movimientosArray.length}`);
        
        // Validar respuesta
        if (movimientosArray.length === 0) {
          return jsonResponse({
            success: true,
            mensaje: 'No se encontraron movimientos de caja en el periodo',
            nuevos_movimientos: 0,
            periodo: { desde: t1, hasta: t2 },
          });
        }
        
        let nuevos = 0;
        let errores = 0;
        let sinAsociar = 0;
        let duplicados = 0;
        const detalles = [];
        
        // Procesar cada movimiento
        for (const movimiento of movimientosArray) {
          // Solo procesar egresos (adelantos/préstamos)
          if (movimiento.type !== 'outcome') {
            continue;
          }
          
          console.log(`\n🔍 Procesando movimiento #${movimiento.id}: "${movimiento.comment}"`);
          
          // Parsear comentario para extraer empleado
          const parseResult = parsearComentarioMovimientoCaja(movimiento.comment);
          
          if (!parseResult.success) {
            sinAsociar++;
            console.warn(`⚠️ No se pudo parsear: ${parseResult.error}`);
            detalles.push({
              movimiento_id: movimiento.id,
              monto: movimiento.amount,
              comentario: movimiento.comment,
              fecha: movimiento.createdAt,
              estado: 'sin_asociar',
              razon: parseResult.error,
            });
            continue;
          }
          
          console.log(`✅ Parseado: Empleado #${parseResult.empleado_id} - ${parseResult.primer_nombre}`);
          
          // Validar que el empleado existe y nombre coincide
          const validacion = await validarEmpleadoMovimiento(
            db,
            parseResult.empleado_id,
            parseResult.primer_nombre
          );
          
          if (!validacion.valido) {
            errores++;
            console.error(`❌ ${validacion.error}`);
            detalles.push({
              movimiento_id: movimiento.id,
              monto: movimiento.amount,
              comentario: movimiento.comment,
              fecha: movimiento.createdAt,
              estado: 'error',
              razon: validacion.error,
            });
            continue;
          }
          
          if (validacion.advertencia) {
            console.warn(`⚠️ ${validacion.advertencia}`);
          }
          
          // Verificar si ya existe el movimiento
          const existe = await db.prepare(
            'SELECT id FROM movimientos WHERE fudo_payment_id = ?'
          ).bind(movimiento.id.toString()).first();
          
          if (existe) {
            duplicados++;
            console.log(`ℹ️ Movimiento ya existe en BD`);
            detalles.push({
              movimiento_id: movimiento.id,
              empleado_id: validacion.empleado_id,
              empleado_nombre: validacion.nombre_completo,
              monto: movimiento.amount,
              fecha: movimiento.createdAt,
              estado: 'duplicado',
            });
            continue;
          }
          
          // Crear movimiento en BD
          const descripcion = `Adelanto de caja${parseResult.detalle ? ': ' + parseResult.detalle : ''}`;
          
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
            descripcion,
            0, // No descontado
            movimiento.id.toString(),
            formatDateTime(nowColombia())
          ).run();
          
          nuevos++;
          console.log(`✅ Movimiento creado exitosamente`);
          
          detalles.push({
            movimiento_id: movimiento.id,
            empleado_id: validacion.empleado_id,
            empleado_nombre: validacion.nombre_completo,
            monto: movimiento.amount,
            fecha: movimiento.createdAt,
            descripcion: descripcion,
            estado: 'creado',
            advertencia: validacion.advertencia || null,
          });
        }
        
        return jsonResponse({
          success: true,
          mensaje: `Sincronización completada`,
          resumen: {
            total_procesados: movimientosArray.length,
            nuevos_movimientos: nuevos,
            duplicados: duplicados,
            sin_asociar: sinAsociar,
            errores: errores,
          },
          periodo: {
            desde: t1,
            hasta: t2,
          },
          detalles: detalles,
        });
        
      } catch (error) {
        console.error('❌ Error sincronizando movimientos de caja:', error);
        return jsonResponse({ 
          success: false,
          error: error.message,
          stack: error.stack,
        }, 500);
      }
    }
     
    // Sincronizar movimientos de caja de TODOS los empleados activos
    if (path === '/api/nomina/fudo/sincronizar-todos-movimientos-caja' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const fechaDesde = body.fecha_desde || null;
      const soloActivos = body.solo_activos !== false; // Por defecto true
      
      try {
        console.log('🔄 Iniciando sincronización masiva de movimientos de caja');
        
        // Construir filtro de fechas
        let t1, t2;
        
        if (fechaDesde) {
          const fecha = new Date(fechaDesde);
          fecha.setHours(5, 0, 0, 0); // 5 AM UTC = Medianoche en Colombia (UTC-5)
          t1 = fecha.toISOString().replace(/\.\d{3}Z$/, '.000Z');
          
          const hoy = new Date();
          hoy.setHours(5, 0, 0, 0);
          hoy.setDate(hoy.getDate() + 1); // Día siguiente
          t2 = hoy.toISOString().replace(/\.\d{3}Z$/, '.000Z');
        } else {
          // Por defecto, últimos 7 días
          const hace7dias = new Date();
          hace7dias.setDate(hace7dias.getDate() - 7);
          hace7dias.setHours(5, 0, 0, 0);
          
          const hoy = new Date();
          hoy.setHours(5, 0, 0, 0);
          hoy.setDate(hoy.getDate() + 1);
          
          t1 = hace7dias.toISOString().replace(/\.\d{3}Z$/, '.000Z');
          t2 = hoy.toISOString().replace(/\.\d{3}Z$/, '.000Z');
        }
        
        console.log(`📅 Buscando movimientos entre ${t1} y ${t2}`);
        
        // Obtener token
        const token = await getFudoToken(env);
        
        // Obtener movimientos de caja de FUDO
        const url = `https://api.fu.do/cash_movements?t1=${t1}&t2=${t2}`;
        
        console.log('📡 URL:', url);
        
        const fetchResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
          },
        });
        
        if (!fetchResponse.ok) {
          const errorText = await fetchResponse.text();
          console.error('❌ Error en petición:', errorText);
          throw new Error(`Error ${fetchResponse.status}: ${errorText}`);
        }
        
        const response = await fetchResponse.json();
        
        // FUDO devuelve un objeto con IDs como keys, no un array
        const movimientosArray = Object.values(response || {});
        
        console.log(`📊 Total movimientos obtenidos: ${movimientosArray.length}`);
        
        if (movimientosArray.length === 0) {
          return jsonResponse({
            success: true,
            mensaje: 'No se encontraron movimientos de caja en el periodo',
            periodo: { desde: t1, hasta: t2 },
            resumen: {
              total_movimientos_fudo: 0,
              nuevos_creados: 0,
              duplicados: 0,
              sin_asociar: 0,
              errores: 0,
            },
          });
        }
        
        // Obtener todos los empleados (activos o todos según parámetro)
        let empleados;
        if (soloActivos) {
          empleados = await db.prepare(
            "SELECT id, nombre FROM empleados WHERE estado = 'ACTIVO'"
          ).all();
        } else {
          empleados = await db.prepare(
            "SELECT id, nombre FROM empleados"
          ).all();
        }
        
        console.log(`👥 Total empleados a verificar: ${empleados.results.length}`);
        
        // Crear un mapa de empleados por ID para búsqueda rápida
        const empleadosMap = {};
        empleados.results.forEach(emp => {
          empleadosMap[emp.id] = emp.nombre;
        });
        
        let nuevos = 0;
        let errores = 0;
        let sinAsociar = 0;
        let duplicados = 0;
        const detallesPorEmpleado = {};
        const movimientosSinAsociar = [];
        
        // Procesar cada movimiento
        for (const movimiento of movimientosArray) {
          // Solo procesar egresos (adelantos/préstamos)
          if (movimiento.type !== 'outcome') {
            continue;
          }
          
          console.log(`\n🔍 Procesando movimiento #${movimiento.id}: "${movimiento.comment}"`);
          
          // Parsear comentario para extraer empleado
          const parseResult = parsearComentarioMovimientoCaja(movimiento.comment);
          
          if (!parseResult.success) {
            sinAsociar++;
            console.warn(`⚠️ No se pudo parsear: ${parseResult.error}`);
            movimientosSinAsociar.push({
              movimiento_id: movimiento.id,
              monto: movimiento.amount,
              comentario: movimiento.comment,
              fecha: movimiento.createdAt,
              razon: parseResult.error,
            });
            continue;
          }
          
          console.log(`✅ Parseado: Empleado #${parseResult.empleado_id} - ${parseResult.primer_nombre}`);
          
          // Validar que el empleado existe y nombre coincide
          const validacion = await validarEmpleadoMovimiento(
            db,
            parseResult.empleado_id,
            parseResult.primer_nombre
          );
          
          if (!validacion.valido) {
            errores++;
            console.error(`❌ ${validacion.error}`);
            movimientosSinAsociar.push({
              movimiento_id: movimiento.id,
              monto: movimiento.amount,
              comentario: movimiento.comment,
              fecha: movimiento.createdAt,
              razon: validacion.error,
            });
            continue;
          }
          
          if (validacion.advertencia) {
            console.warn(`⚠️ ${validacion.advertencia}`);
          }
          
          // Verificar si ya existe el movimiento
          const existe = await db.prepare(
            'SELECT id FROM movimientos WHERE fudo_payment_id = ?'
          ).bind(movimiento.id.toString()).first();
          
          if (existe) {
            duplicados++;
            console.log(`ℹ️ Movimiento ya existe en BD`);
            
            // Registrar en resumen por empleado
            if (!detallesPorEmpleado[validacion.empleado_id]) {
              detallesPorEmpleado[validacion.empleado_id] = {
                empleado_id: validacion.empleado_id,
                empleado_nombre: validacion.nombre_completo,
                nuevos: 0,
                duplicados: 0,
                movimientos: [],
              };
            }
            detallesPorEmpleado[validacion.empleado_id].duplicados++;
            continue;
          }
          
          // Crear movimiento en BD
          const descripcion = `Adelanto de caja${parseResult.detalle ? ': ' + parseResult.detalle : ''}`;
          
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
            descripcion,
            0, // No descontado
            movimiento.id.toString(),
            formatDateTime(nowColombia())
          ).run();
          
          nuevos++;
          console.log(`✅ Movimiento creado exitosamente`);
          
          // Registrar en resumen por empleado
          if (!detallesPorEmpleado[validacion.empleado_id]) {
            detallesPorEmpleado[validacion.empleado_id] = {
              empleado_id: validacion.empleado_id,
              empleado_nombre: validacion.nombre_completo,
              nuevos: 0,
              duplicados: 0,
              movimientos: [],
            };
          }
          
          detallesPorEmpleado[validacion.empleado_id].nuevos++;
          detallesPorEmpleado[validacion.empleado_id].movimientos.push({
            movimiento_id: movimiento.id,
            fecha: movimiento.createdAt,
            monto: movimiento.amount,
            descripcion: descripcion,
          });
        }
        
        // Convertir detalles por empleado a array
        const detallesArray = Object.values(detallesPorEmpleado);
        
        return jsonResponse({
          success: true,
          mensaje: `Sincronización masiva completada`,
          resumen: {
            total_movimientos_fudo: movimientosArray.length,
            total_empleados_procesados: detallesArray.length,
            nuevos_creados: nuevos,
            duplicados: duplicados,
            sin_asociar: sinAsociar,
            errores: errores,
          },
          periodo: {
            desde: t1,
            hasta: t2,
          },
          detalles_por_empleado: detallesArray,
          movimientos_sin_asociar: movimientosSinAsociar,
        });
        
      } catch (error) {
        console.error('❌ Error en sincronización masiva:', error);
        return jsonResponse({ 
          success: false,
          error: error.message,
          stack: error.stack,
        }, 500);
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
