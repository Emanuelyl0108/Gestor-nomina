import React, { useState, useEffect } from 'react';
import { apiRequest } from '../config/api';
import { DollarSign, Plus, Edit, Trash2, Filter, ExternalLink, Info } from 'lucide-react';

function Movimientos() {
  const [empleados, setEmpleados] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [filtroEmpleado, setFiltroEmpleado] = useState('');
  const [filtroPendientes, setFiltroPendientes] = useState(true);
  const [movimientoEditando, setMovimientoEditando] = useState(null);
  const [movimientoDetalle, setMovimientoDetalle] = useState(null);

  // Formulario
  const [nuevoMovimiento, setNuevoMovimiento] = useState({
    empleado_id: '',
    tipo: 'adelanto',
    monto: '',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    cargarEmpleados();
    cargarMovimientos();
  }, [filtroEmpleado, filtroPendientes]);

  const cargarEmpleados = async () => {
    try {
      const data = await apiRequest('/api/admin/empleados/todos?estado=ACTIVO');
      setEmpleados(data);
    } catch (error) {
      console.error('Error cargando empleados:', error);
    }
  };

  const cargarMovimientos = async () => {
    setLoading(true);
    try {
      let endpoint = '/api/nomina/movimientos?';
      
      if (filtroEmpleado) {
        endpoint += `empleado_id=${filtroEmpleado}&`;
      }
      if (filtroPendientes) {
        endpoint += 'pendientes=true';
      }

      const data = await apiRequest(endpoint);
      setMovimientos(data);
    } catch (error) {
      console.error('Error cargando movimientos:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirFormularioNuevo = () => {
    setMovimientoEditando(null);
    setNuevoMovimiento({
      empleado_id: '',
      tipo: 'adelanto',
      monto: '',
      descripcion: '',
      fecha: new Date().toISOString().split('T')[0],
    });
    setMostrarFormulario(true);
  };

  const abrirFormularioEditar = (movimiento) => {
    // No permitir editar movimientos de FUDO
    if (esFudo(movimiento.descripcion)) {
      alert('⚠️ Los movimientos sincronizados desde FUDO no pueden editarse manualmente.');
      return;
    }

    setMovimientoEditando(movimiento);
    setNuevoMovimiento({
      empleado_id: movimiento.empleado_id,
      tipo: movimiento.tipo,
      monto: movimiento.monto,
      descripcion: movimiento.descripcion || '',
      fecha: movimiento.fecha,
    });
    setMostrarFormulario(true);
  };

  const verDetalle = (movimiento) => {
    setMovimientoDetalle(movimiento);
  };

  const cerrarDetalle = () => {
    setMovimientoDetalle(null);
  };

  const registrarMovimiento = async (e) => {
    e.preventDefault();

    if (!nuevoMovimiento.empleado_id || !nuevoMovimiento.monto) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      if (movimientoEditando) {
        await apiRequest(`/api/nomina/movimientos/${movimientoEditando.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            tipo: nuevoMovimiento.tipo,
            monto: parseFloat(nuevoMovimiento.monto),
            descripcion: nuevoMovimiento.descripcion,
            fecha: nuevoMovimiento.fecha,
          }),
        });
        alert('✅ Movimiento actualizado exitosamente');
      } else {
        await apiRequest('/api/nomina/movimientos', {
          method: 'POST',
          body: JSON.stringify({
            empleado_id: parseInt(nuevoMovimiento.empleado_id),
            tipo: nuevoMovimiento.tipo,
            monto: parseFloat(nuevoMovimiento.monto),
            descripcion: nuevoMovimiento.descripcion,
            fecha: nuevoMovimiento.fecha,
          }),
        });
        alert('✅ Movimiento registrado exitosamente');
      }

      setMostrarFormulario(false);
      setMovimientoEditando(null);
      setNuevoMovimiento({
        empleado_id: '',
        tipo: 'adelanto',
        monto: '',
        descripcion: '',
        fecha: new Date().toISOString().split('T')[0],
      });
      await cargarMovimientos();
    } catch (error) {
      alert('Error guardando movimiento: ' + error.message);
    }
  };

  const eliminarMovimiento = async (movimientoId, descripcion) => {
    // No permitir eliminar movimientos de FUDO
    if (esFudo(descripcion)) {
      alert('⚠️ Los movimientos sincronizados desde FUDO no pueden eliminarse manualmente. Se descontarán automáticamente al procesar la nómina.');
      return;
    }

    if (!window.confirm(`¿Estás seguro de eliminar este movimiento?\n"${descripcion}"`)) {
      return;
    }

    try {
      await apiRequest(`/api/nomina/movimientos/${movimientoId}`, {
        method: 'DELETE',
      });
      alert('✅ Movimiento eliminado exitosamente');
      await cargarMovimientos();
    } catch (error) {
      alert('Error eliminando movimiento: ' + error.message);
    }
  };

  // 🔥 NUEVAS FUNCIONES DE EXCEPCIONES
  const postergarMovimiento = async (movimientoId, empleadoNombre) => {
    const motivo = prompt(
      `¿Por qué postergar este movimiento de ${empleadoNombre}?`,
      'Acordado con el empleado'
    );
    
    if (!motivo) return;
    
    if (!window.confirm(`¿Postergar este movimiento para la siguiente quincena?\n\nEmpleado: ${empleadoNombre}\nMotivo: ${motivo}`)) {
      return;
    }
    
    try {
      await apiRequest(`/api/nomina/movimientos/${movimientoId}/postergar`, {
        method: 'POST',
        body: JSON.stringify({ motivo }),
      });
      
      alert('✅ Movimiento postergado para siguiente periodo');
      await cargarMovimientos();
    } catch (error) {
      alert('Error postergando movimiento: ' + error.message);
    }
  };

  const reactivarMovimiento = async (movimientoId, empleadoNombre) => {
    if (!window.confirm(`¿Reactivar este movimiento de ${empleadoNombre} para descontar en este periodo?`)) {
      return;
    }
    
    try {
      await apiRequest(`/api/nomina/movimientos/${movimientoId}/reactivar`, {
        method: 'POST',
      });
      
      alert('✅ Movimiento reactivado para periodo actual');
      await cargarMovimientos();
    } catch (error) {
      alert('Error reactivando movimiento: ' + error.message);
    }
  };

  const esFudo = (descripcion) => {
    return descripcion && (
      descripcion.includes('FUDO') || 
      descripcion.includes('Consumo FUDO') ||
      descripcion.includes('Cuenta Corriente')
    );
  };

  const getTipoColor = (tipo) => {
    return tipo === 'adelanto' 
      ? 'bg-orange-100 text-orange-800' 
      : 'bg-purple-100 text-purple-800';
  };

  const getTipoIcon = (tipo) => {
    return tipo === 'adelanto' ? '💵' : '🍽️';
  };

  const totalPendiente = movimientos
    .filter(m => !m.descontado && !m.descontar_siguiente_periodo)
    .reduce((sum, m) => sum + m.monto, 0);

  const totalFudo = movimientos
    .filter(m => !m.descontado && esFudo(m.descripcion))
    .reduce((sum, m) => sum + m.monto, 0);

  const totalPostergado = movimientos
    .filter(m => m.descontar_siguiente_periodo && !m.descontado)
    .reduce((sum, m) => sum + m.monto, 0);

  return (
    <div className="p-8 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <DollarSign className="mr-3" size={36} />
          Movimientos (Adelantos y Consumos)
        </h1>
        
        <button
          onClick={abrirFormularioNuevo}
          className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center"
        >
          <Plus size={20} className="mr-2" />
          Nuevo Movimiento
        </button>
      </div>

      {/* Formulario de Movimiento */}
      {mostrarFormulario && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {movimientoEditando ? 'Editar Movimiento' : 'Registrar Movimiento Manual'}
          </h2>
          
          <form onSubmit={registrarMovimiento}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Empleado *
                </label>
                <select
                  value={nuevoMovimiento.empleado_id}
                  onChange={(e) => setNuevoMovimiento({ ...nuevoMovimiento, empleado_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={movimientoEditando}
                >
                  <option value="">Selecciona un empleado</option>
                  {empleados.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nombre} - {emp.rol}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo *
                </label>
                <select
                  value={nuevoMovimiento.tipo}
                  onChange={(e) => setNuevoMovimiento({ ...nuevoMovimiento, tipo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="adelanto">💵 Adelanto</option>
                  <option value="consumo">🍽️ Consumo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto *
                </label>
                <input
                  type="number"
                  step="1000"
                  value={nuevoMovimiento.monto}
                  onChange={(e) => setNuevoMovimiento({ ...nuevoMovimiento, monto: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="50000"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha
                </label>
                <input
                  type="date"
                  value={nuevoMovimiento.fecha}
                  onChange={(e) => setNuevoMovimiento({ ...nuevoMovimiento, fecha: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción
              </label>
              <textarea
                value={nuevoMovimiento.descripcion}
                onChange={(e) => setNuevoMovimiento({ ...nuevoMovimiento, descripcion: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows="2"
                placeholder="Motivo del movimiento..."
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                {movimientoEditando ? '💾 Actualizar' : '💾 Registrar'} Movimiento
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarFormulario(false);
                  setMovimientoEditando(null);
                }}
                className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros y Resumen */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter size={16} className="inline mr-2" />
              Filtrar por Empleado
            </label>
            <select
              value={filtroEmpleado}
              onChange={(e) => setFiltroEmpleado(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los empleados</option>
              {empleados.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={filtroPendientes}
                onChange={(e) => setFiltroPendientes(e.target.checked)}
                className="mr-2 h-5 w-5"
              />
              <span className="text-sm font-medium text-gray-700">
                Solo pendientes
              </span>
            </label>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Pendiente</p>
            <p className="text-2xl font-bold text-blue-600">
              ${totalPendiente.toLocaleString('es-CO')}
            </p>
          </div>

          {totalFudo > 0 && (
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">🍴 Consumos FUDO</p>
              <p className="text-2xl font-bold text-purple-600">
                ${totalFudo.toLocaleString('es-CO')}
              </p>
            </div>
          )}

          {/* 🔥 NUEVA TARJETA: MOVIMIENTOS POSTERGADOS */}
          {totalPostergado > 0 && (
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">⏭️ Postergados (Sig. Periodo)</p>
              <p className="text-2xl font-bold text-orange-600">
                ${totalPostergado.toLocaleString('es-CO')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabla de Movimientos */}
      {loading ? (
        <div className="text-center py-8">Cargando movimientos...</div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Empleado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Origen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                      No hay movimientos para mostrar
                    </td>
                  </tr>
                ) : (
                  movimientos.map((mov) => (
                    <tr key={mov.id} className={mov.descontado ? 'bg-gray-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {mov.empleado_nombre}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {mov.fecha}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTipoColor(mov.tipo)}`}>
                          {getTipoIcon(mov.tipo)} {mov.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                        -${mov.monto.toLocaleString('es-CO')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {esFudo(mov.descripcion) ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            🍴 FUDO
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                            ✏️ Manual
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {mov.descontado ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            ✓ Descontado
                          </span>
                        ) : mov.descontar_siguiente_periodo ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                            ⏭️ Siguiente Periodo
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            ⏳ Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {!mov.descontado && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => verDetalle(mov)}
                              className="text-purple-600 hover:text-purple-900"
                              title="Ver detalle"
                            >
                              <Info size={18} />
                            </button>
                            
                            {!esFudo(mov.descripcion) && (
                              <>
                                <button
                                  onClick={() => abrirFormularioEditar(mov)}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Editar"
                                >
                                  <Edit size={18} />
                                </button>
                                <button
                                  onClick={() => eliminarMovimiento(mov.id, mov.descripcion)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Eliminar"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </>
                            )}
                            
                            {/* 🔥 BOTONES DE POSTERGAR/REACTIVAR */}
                            {!mov.descontar_siguiente_periodo ? (
                              <button
                                onClick={() => postergarMovimiento(mov.id, mov.empleado_nombre)}
                                className="text-orange-600 hover:text-orange-900 text-lg"
                                title="Postergar a siguiente periodo"
                              >
                                ⏭️
                              </button>
                            ) : (
                              <button
                                onClick={() => reactivarMovimiento(mov.id, mov.empleado_nombre)}
                                className="text-green-600 hover:text-green-900 text-lg"
                                title="Reactivar para este periodo"
                              >
                                ↩️
                              </button>
                            )}
                            
                            {esFudo(mov.descripcion) && (
                              <span className="text-xs text-gray-400 italic">Auto-FUDO</span>
                            )}
                          </div>
                        )}
                        {mov.descontado && (
                          <span className="text-xs text-gray-400">Ya descontado</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Detalle */}
      {movimientoDetalle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">📝 Detalle del Movimiento</h3>
              <button
                onClick={cerrarDetalle}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Empleado</p>
                  <p className="font-semibold">{movimientoDetalle.empleado_nombre}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fecha</p>
                  <p className="font-semibold">{movimientoDetalle.fecha}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tipo</p>
                  <p className="font-semibold">
                    {getTipoIcon(movimientoDetalle.tipo)} {movimientoDetalle.tipo}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Monto</p>
                  <p className="font-semibold text-red-600 text-xl">
                    -${movimientoDetalle.monto.toLocaleString('es-CO')}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Origen</p>
                  <p className="font-semibold">
                    {esFudo(movimientoDetalle.descripcion) ? '🍴 FUDO (Sincronizado)' : '✏️ Manual'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Estado</p>
                  <p className="font-semibold">
                    {movimientoDetalle.descontado 
                      ? '✓ Descontado' 
                      : movimientoDetalle.descontar_siguiente_periodo 
                      ? '⏭️ Postergado para siguiente periodo' 
                      : '⏳ Pendiente de descuento'}
                  </p>
                </div>
              </div>
              
              {movimientoDetalle.descripcion && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">Descripción</p>
                  <p className="text-sm">{movimientoDetalle.descripcion}</p>
                </div>
              )}

              {movimientoDetalle.motivo_postergacion && (
                <div className="bg-orange-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">Motivo de Postergación</p>
                  <p className="text-sm">{movimientoDetalle.motivo_postergacion}</p>
                </div>
              )}

              {esFudo(movimientoDetalle.descripcion) && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-700">
                        <strong>Consumo FUDO:</strong> Este movimiento fue sincronizado automáticamente desde la cuenta corriente del empleado en el sistema FUDO. No puede editarse manualmente.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={cerrarDetalle}
                className="w-full bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>🍴 Consumos FUDO:</strong> Los movimientos sincronizados desde FUDO se descontarán automáticamente al procesar la nómina. No pueden editarse ni eliminarse manualmente. Los movimientos manuales sí pueden editarse antes de ser descontados.
              <br /><br />
              <strong>⏭️ Movimientos Postergados:</strong> Los movimientos postergados NO se descontarán en el periodo actual, sino en el siguiente. Puedes reactivarlos con el botón ↩️.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Movimientos;
