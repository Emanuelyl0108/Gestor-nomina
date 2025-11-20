/**
 * Cloudflare Worker - Gestor de Nómina API
 * Enruanados Gourmet
 */

// Helper: Respuestas CORS
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
			...corsHeaders,
		},
	});
}

// Helper: Fecha actual en Colombia
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

// Helper: Calcular días trabajados desde marcajes
async function calcularDiasTrabajadosDesdeMaracjes(db, empleado_id, fecha_inicio, fecha_fin) {
	const result = await db
		.prepare(
			`SELECT COUNT(DISTINCT fecha) as dias
			FROM marcajes
			WHERE empleado_id = ? AND fecha BETWEEN ? AND ? AND tipo = 'entrada'`
		)
		.bind(empleado_id, fecha_inicio, fecha_fin)
		.first();
	
	return result?.dias || 0;
}

// Función principal: Calcular nómina
async function calcularNomina(db, empleado_id, tipo_nomina, periodo_inicio, periodo_fin, dias_completos, medios_sustitutos, medios_adicionales) {
	// Obtener empleado
	const empleado = await db.prepare('SELECT * FROM empleados WHERE id = ?').bind(empleado_id).first();
	
	if (!empleado) {
		return { error: 'Empleado no encontrado' };
	}
	
	const sueldo_mensual = empleado.sueldo_mensual;
	
	// Cálculo según tipo de nómina
	let sueldo_base, dias_periodo, dias_minimos, valor_dia;
	
	if (tipo_nomina === 'quincenal') {
		sueldo_base = sueldo_mensual / 2;
		dias_periodo = 15;
		dias_minimos = 13; // 15 - 2 descansos
		valor_dia = sueldo_base / 15;
	} else if (tipo_nomina === 'semanal') {
		sueldo_base = sueldo_mensual / 4;
		dias_periodo = 7;
		dias_minimos = 6; // 1 descanso opcional
		valor_dia = sueldo_base / 7;
	} else {
		return { error: 'Tipo de nómina inválido' };
	}
	
	// Calcular días efectivos
	if (dias_completos === null || dias_completos === undefined) {
		dias_completos = await calcularDiasTrabajadosDesdeMaracjes(db, empleado_id, periodo_inicio, periodo_fin);
	}
	
	const dias_efectivos = dias_completos + medios_sustitutos + medios_adicionales;
	
	// Calcular monto base
	let dias_a_pagar;
	if (dias_efectivos >= dias_minimos) {
		dias_a_pagar = dias_periodo;
		if (dias_efectivos > dias_minimos) {
			const dias_extras = dias_efectivos - dias_minimos;
			dias_a_pagar += dias_extras;
		}
	} else {
		const dias_faltantes = dias_minimos - dias_efectivos;
		dias_a_pagar = dias_periodo - dias_faltantes;
	}
	
	const monto_base = dias_a_pagar * valor_dia;
	
	// Obtener ajustes pendientes
	const propinas = await db.prepare('SELECT COALESCE(SUM(monto), 0) as total FROM propinas WHERE empleado_id = ? AND aplicada = 0').bind(empleado_id).first();
	const bonos = await db.prepare('SELECT COALESCE(SUM(monto), 0) as total FROM bonos WHERE empleado_id = ? AND aplicada = 0').bind(empleado_id).first();
	const descuentos = await db.prepare('SELECT COALESCE(SUM(monto), 0) as total FROM descuentos WHERE empleado_id = ? AND aplicada = 0').bind(empleado_id).first();
	const movimientos = await db.prepare('SELECT COALESCE(SUM(monto), 0) as total FROM movimientos WHERE empleado_id = ? AND descontado = 0').bind(empleado_id).first();
	
	const total_propinas = propinas?.total || 0;
	const total_bonos = bonos?.total || 0;
	const total_descuentos = descuentos?.total || 0;
	const total_movimientos = movimientos?.total || 0;
	
	const total_pagar = monto_base + total_propinas + total_bonos - total_descuentos - total_movimientos;
	
	return {
		empleado_id,
		empleado_nombre: empleado.nombre,
		tipo_nomina,
		periodo_inicio,
		periodo_fin,
		dias_completos,
		medios_sustitutos,
		medios_adicionales,
		dias_efectivos,
		dias_a_pagar,
		sueldo_mensual,
		sueldo_base,
		valor_dia,
		monto_base,
		total_propinas,
		total_bonos,
		total_descuentos,
		total_movimientos,
		total_pagar
	};
}

// Router principal
async function handleRequest(request, env) {
	const url = new URL(request.url);
	const path = url.pathname;
	const method = request.method;
	
	// CORS preflight
	if (method === 'OPTIONS') {
		return new Response(null, { headers: corsHeaders });
	}
	
	const db = env.DB; // Cloudflare D1 Database
	
	try {
		// ==================== EMPLEADOS ====================
		
		if (path === '/api/nomina/empleados' && method === 'GET') {
			const empleados = await db.prepare('SELECT * FROM empleados WHERE estado = ? ORDER BY nombre').bind('ACTIVO').all();
			return jsonResponse(empleados.results || []);
		}
		
		if (path === '/api/nomina/empleados' && method === 'POST') {
			const data = await request.json();
			const result = await db.prepare(
				`INSERT INTO empleados (nombre, cedula, email, telefono, rol, sueldo_mensual, tipo_pago, estado)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			).bind(
				data.nombre,
				data.cedula || null,
				data.email || null,
				data.telefono || null,
				data.rol,
				data.sueldo_mensual,
				data.tipo_pago || 'quincenal',
				'ACTIVO'
			).run();
			
			return jsonResponse({ success: true, id: result.meta.last_row_id });
		}
		
		if (path.match(/^\/api\/nomina\/empleados\/\d+$/) && method === 'PUT') {
			const id = path.split('/').pop();
			const data = await request.json();
			
			await db.prepare(
				`UPDATE empleados SET sueldo_mensual = ?, tipo_pago = ?, nombre = ?, cedula = ?, rol = ?
				WHERE id = ?`
			).bind(
				data.sueldo_mensual,
				data.tipo_pago,
				data.nombre,
				data.cedula,
				data.rol,
				id
			).run();
			
			return jsonResponse({ success: true, mensaje: 'Empleado actualizado' });
		}
		
		if (path.match(/^\/api\/nomina\/empleados\/\d+$/) && method === 'DELETE') {
			const id = path.split('/').pop();
			await db.prepare('UPDATE empleados SET estado = ? WHERE id = ?').bind('INACTIVO', id).run();
			return jsonResponse({ success: true, mensaje: 'Empleado desactivado' });
		}
		
		// ==================== MOVIMIENTOS ====================
		
		if (path === '/api/nomina/movimientos' && method === 'GET') {
			const empleado_id = url.searchParams.get('empleado_id');
			
			let query = `
				SELECT m.*, e.nombre as empleado_nombre
				FROM movimientos m
				JOIN empleados e ON m.empleado_id = e.id
			`;
			
			if (empleado_id) {
				query += ` WHERE m.empleado_id = ${empleado_id}`;
			}
			
			query += ` ORDER BY m.fecha DESC LIMIT 100`;
			
			const movimientos = await db.prepare(query).all();
			return jsonResponse(movimientos.results || []);
		}
		
		if (path === '/api/nomina/movimientos/pendientes' && method === 'GET') {
			const empleado_id = url.searchParams.get('empleado_id');
			
			let query = `
				SELECT m.*, e.nombre as empleado_nombre
				FROM movimientos m
				JOIN empleados e ON m.empleado_id = e.id
				WHERE m.descontado = 0
			`;
			
			if (empleado_id) {
				query += ` AND m.empleado_id = ${empleado_id}`;
			}
			
			query += ` ORDER BY m.fecha DESC`;
			
			const movimientos = await db.prepare(query).all();
			return jsonResponse(movimientos.results || []);
		}
		
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
				data.descripcion || ''
			).run();
			
			return jsonResponse({ success: true, mensaje: 'Movimiento registrado' });
		}
		
		// ==================== PROPINAS/BONOS/DESCUENTOS ====================
		
		if (path === '/api/nomina/propinas' && method === 'POST') {
			const data = await request.json();
			const fecha = data.fecha || formatDate(nowColombia());
			const tipo = data.tipo;
			const monto = data.monto;
			const descripcion = data.descripcion || '';
			const empleados_ids = data.empleados_ids || [];
			const es_division = data.es_division ? 1 : 0;
			
			const monto_individual = (tipo === 'colectiva' && es_division) 
				? monto / empleados_ids.length 
				: monto;
			
			for (const empleado_id of empleados_ids) {
				await db.prepare(
					`INSERT INTO propinas (empleado_id, fecha, tipo, monto, descripcion, es_division, aplicada)
					VALUES (?, ?, ?, ?, ?, ?, 0)`
				).bind(empleado_id, fecha, tipo, monto_individual, descripcion, es_division).run();
			}
			
			return jsonResponse({ success: true, mensaje: 'Propina registrada' });
		}
		
		if (path === '/api/nomina/bonos' && method === 'POST') {
			const data = await request.json();
			const fecha = data.fecha || formatDate(nowColombia());
			const tipo = data.tipo;
			const monto = data.monto;
			const descripcion = data.descripcion || '';
			const empleados_ids = data.empleados_ids || [];
			const es_division = data.es_division ? 1 : 0;
			
			const monto_individual = (tipo === 'colectiva' && es_division) 
				? monto / empleados_ids.length 
				: monto;
			
			for (const empleado_id of empleados_ids) {
				await db.prepare(
					`INSERT INTO bonos (empleado_id, fecha, tipo, monto, descripcion, es_division, aplicada)
					VALUES (?, ?, ?, ?, ?, ?, 0)`
				).bind(empleado_id, fecha, tipo, monto_individual, descripcion, es_division).run();
			}
			
			return jsonResponse({ success: true, mensaje: 'Bono registrado' });
		}
		
		if (path === '/api/nomina/descuentos' && method === 'POST') {
			const data = await request.json();
			const fecha = data.fecha || formatDate(nowColombia());
			const tipo = data.tipo;
			const monto = data.monto;
			const descripcion = data.descripcion || '';
			const empleados_ids = data.empleados_ids || [];
			const es_division = data.es_division ? 1 : 0;
			
			const monto_individual = (tipo === 'colectiva' && es_division) 
				? monto / empleados_ids.length 
				: monto;
			
			for (const empleado_id of empleados_ids) {
				await db.prepare(
					`INSERT INTO descuentos (empleado_id, fecha, tipo, monto, descripcion, es_division, aplicada)
					VALUES (?, ?, ?, ?, ?, ?, 0)`
				).bind(empleado_id, fecha, tipo, monto_individual, descripcion, es_division).run();
			}
			
			return jsonResponse({ success: true, mensaje: 'Descuento registrado' });
		}
		
		// ==================== NÓMINAS ====================
		
		if (path === '/api/nomina/calcular' && method === 'POST') {
			const data = await request.json();
			
			const resultado = await calcularNomina(
				db,
				data.empleado_id,
				data.tipo_nomina,
				data.periodo_inicio,
				data.periodo_fin,
				data.dias_completos,
				data.medios_sustitutos || 0,
				data.medios_adicionales || 0
			);
			
			if (resultado.error) {
				return jsonResponse(resultado, 400);
			}
			
			return jsonResponse(resultado);
		}
		
		if (path === '/api/nomina/guardar' && method === 'POST') {
			const data = await request.json();
			
			const result = await db.prepare(
				`INSERT INTO nominas (
					empleado_id, tipo_nomina, periodo_inicio, periodo_fin,
					dias_trabajados, sueldo_base, monto_base,
					total_propinas, total_bonos, total_descuentos, total_movimientos,
					total_pagar, pagada
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
			).bind(
				data.empleado_id,
				data.tipo_nomina,
				data.periodo_inicio,
				data.periodo_fin,
				data.dias_trabajados,
				data.sueldo_base,
				data.monto_base,
				data.total_propinas,
				data.total_bonos,
				data.total_descuentos,
				data.total_movimientos,
				data.total_pagar
			).run();
			
			return jsonResponse({ success: true, nomina_id: result.meta.last_row_id });
		}
		
		if (path === '/api/nomina/pagar' && method === 'POST') {
			const data = await request.json();
			const nomina_id = data.nomina_id;
			const metodo_pago = data.metodo_pago || 'Efectivo';
			const notas = data.notas || '';
			
			// Obtener nómina
			const nomina = await db.prepare('SELECT * FROM nominas WHERE id = ?').bind(nomina_id).first();
			
			if (!nomina) {
				return jsonResponse({ error: 'Nómina no encontrada' }, 404);
			}
			
			if (nomina.pagada) {
				return jsonResponse({ error: 'Nómina ya fue pagada' }, 400);
			}
			
			const fecha_pago = formatDateTime(nowColombia());
			
			// Marcar nómina como pagada
			await db.prepare(
				`UPDATE nominas SET pagada = 1, fecha_pago = ?, metodo_pago = ?, notas = ? WHERE id = ?`
			).bind(fecha_pago, metodo_pago, notas, nomina_id).run();
			
			// Marcar movimientos como descontados
			await db.prepare(
				`UPDATE movimientos SET descontado = 1, nomina_id = ? WHERE empleado_id = ? AND descontado = 0`
			).bind(nomina_id, nomina.empleado_id).run();
			
			// Marcar propinas como aplicadas
			await db.prepare(
				`UPDATE propinas SET aplicada = 1, nomina_id = ? WHERE empleado_id = ? AND aplicada = 0`
			).bind(nomina_id, nomina.empleado_id).run();
			
			// Marcar bonos como aplicados
			await db.prepare(
				`UPDATE bonos SET aplicada = 1, nomina_id = ? WHERE empleado_id = ? AND aplicada = 0`
			).bind(nomina_id, nomina.empleado_id).run();
			
			// Marcar descuentos como aplicados
			await db.prepare(
				`UPDATE descuentos SET aplicada = 1, nomina_id = ? WHERE empleado_id = ? AND aplicada = 0`
			).bind(nomina_id, nomina.empleado_id).run();
			
			// Registrar pago
			await db.prepare(
				`INSERT INTO pagos (
					nomina_id, empleado_id, fecha_pago, periodo,
					monto_base, propinas, bonos, descuentos, movimientos, total_pagado,
					metodo_pago, notas
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).bind(
				nomina_id,
				nomina.empleado_id,
				fecha_pago,
				`${nomina.periodo_inicio} a ${nomina.periodo_fin}`,
				nomina.monto_base,
				nomina.total_propinas,
				nomina.total_bonos,
				nomina.total_descuentos,
				nomina.total_movimientos,
				nomina.total_pagar,
				metodo_pago,
				notas
			).run();
			
			return jsonResponse({ success: true, mensaje: 'Pago procesado exitosamente' });
		}
		
		if (path === '/api/nomina/pendientes' && method === 'GET') {
			const nominas = await db.prepare(`
				SELECT n.*, e.nombre as empleado_nombre
				FROM nominas n
				JOIN empleados e ON n.empleado_id = e.id
				WHERE n.pagada = 0
				ORDER BY n.created_at DESC
			`).all();
			
			return jsonResponse(nominas.results || []);
		}
		
		// ==================== REPORTES ====================
		
		if (path === '/api/nomina/pagos' && method === 'GET') {
			const pagos = await db.prepare(`
				SELECT p.*, e.nombre as empleado_nombre, n.tipo_nomina
				FROM pagos p
				JOIN empleados e ON p.empleado_id = e.id
				LEFT JOIN nominas n ON p.nomina_id = n.id
				ORDER BY p.fecha_pago DESC
				LIMIT 200
			`).all();
			
			return jsonResponse(pagos.results || []);
		}
		
		// ==================== HEALTH CHECK ====================
		
		if (path === '/health' || path === '/') {
			return jsonResponse({
				status: 'healthy',
				service: 'gestor-nomina-api',
				version: '2.0-cloudflare',
				timestamp: formatDateTime(nowColombia())
			});
		}
		
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
