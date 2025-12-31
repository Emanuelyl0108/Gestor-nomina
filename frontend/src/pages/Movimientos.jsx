import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Edit, Trash2, Filter, RefreshCw, Info, X, Percent } from 'lucide-react';
import { apiRequest } from '../config/api';
import API_CONFIG from '../config/api';

export default function Movimientos() {
  const [empleados, setEmpleados] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [filtroEmpleado, setFiltroEmpleado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [movimientoEditando, setMovimientoEditando] = useState(null);
  const [movimientoDetalle, setMovimientoDetalle] = useState(null);
  const [mostrarDescuento, setMostrarDescuento] = useState(false);
  const [movimientoDescuento, setMovimientoDescuento] = useState(null);

  // Formulario
  const [nuevoMovimiento, setNuevoMovimiento] = useState({
    empleado_id: '',
    tipo: 'adelanto',
    monto: '',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
  });

  // Formulario de descuento personalizado
  const [formDescuento, setFormDescuento] = useState({
    nuevo_monto: '',
    motivo: ''
  });

  useEffect(() => {
    cargarEmpleados();
    cargarMovimientos();
  }, [filtroEmpleado]);

  const cargarEmpleados = async () => {
    try {
      const data = await apiRequest(API_CONFIG.ENDPOINTS.EMPLEADOS_TODOS + '?estado=ACTIVO');
      setEmpleados(data);
    } catch (error) {
      console.error('Error cargando empleados:', error);
    }
  };

  const cargarMovimientos = async () => {
    setLoading(true);
    try {
      let endpoint = API_CONFIG.ENDPOINTS.MOVIMIENTOS;
      
      if (filtroEmpleado) {
        endpoint += `?empleado_id=${filtroEmpleado}`;
      }

      const data = await apiRequest(endpoint);
      setMovimientos(data);
    } catch (error) {
      console.error('Error cargando movimientos:', error);
    } finally {
      setLoading(false);
    }
  };

  const sincronizarTodosConsumos = async () => {
    if (!window.confirm('¿Sincronizar consumos de todos los empleados desde FUDO?')) return;

    setLoading(true);
    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.FUDO_SINCRONIZAR_TODOS_CONSUMOS, {
        method: 'POST'
      });
      
      alert(`✅ Sincronización completada:\n${response.total_empleados_procesados} empleados procesados\n${response.total_movimientos_nuevos} movimientos nuevos`);
      await cargarMovimientos();
    } catch (error) {
      alert('Error sincronizando: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const sincronizarMovimientosCaja = async () => {
    if (!window.confirm('¿Sincronizar adelantos de caja desde FUDO (últimos 7 días)?')) return;

    setLoading(true);
    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.FUDO_SINCRONIZAR_MOVIMIENTOS_CAJA, {
        method: 'POST'
      });
      
      alert(`✅ Sincronización de adelantos completada:\n${response.resumen.nuevos_movimientos} nuevos\n${response.resumen.duplicados} duplicados`);
      await cargarMovimientos();
    } catch (error) {
      alert('Error sincronizando adelantos: ' + error.message);
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
    if (esFudo(movimiento)) {
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

  const abrirDescuento = (movimiento) => {
    if (esFudo(movimiento)) {
      setMovimientoDescuento(movimiento);
      setFormDescuento({
        nuevo_monto: '',
        motivo: ''
      });
      setMostrarDescuento(true);
    } else {
      alert('Solo los movimientos de FUDO pueden tener descuentos aplicados');
    }
  };

  const aplicarDescuentoPersonalizado = async (e) => {
    e.preventDefault();
    
    try {
      const response = await apiRequest(
        API_CONFIG.ENDPOINTS.MOVIMIENTO_EDITAR_MONTO(movimientoDescuento.id),
        {
          method: 'PUT',
          body: JSON.stringify({
            nuevo_monto: parseFloat(formDescuento.nuevo_monto),
            motivo: formDescuento.motivo
          })
        }
      );

      alert(`✅ Descuento aplicado:\nMonto original: $${response.monto_original_fudo.toLocaleString('es-CO')}\nMonto nuevo: $${response.monto_nuevo.toLocaleString('es-CO')}\nDescuento: $${response.descuento_aplicado.toLocaleString('es-CO')} (${response.porcentaje_descuento}%)`);
      
      setMostrarDescuento(false);
      await cargarMovimientos();
    } catch (error) {
      alert('Error aplicando descuento: ' + error.message);
    }
  };

  const aplicarDescuento15 = async (movimiento) => {
    if (!esFudo(movimiento)) {
      alert('Solo los consumos de FUDO pueden tener descuento del 15%');
      return;
    }

    if (!window.confirm(`¿Aplicar descuento del 15% a este consumo?\nMonto actual: $${movimiento.monto.toLocaleString('es-CO')}`)) {
      return;
    }

    try {
      const response = await apiRequest(
        API_CONFIG.ENDPOINTS.MOVIMIENTO_APLICAR_DESCUENTO_15(movimiento.id),
        { method: 'POST' }
      );

      alert(`✅ Descuento del 15% aplicado:\nMonto original: $${response.monto_original_fudo.toLocaleString('es-CO')}\nMonto con descuento: $${response.monto_con_descuento.toLocaleString('es-CO')}\nDescuento: $${response.descuento_aplicado.toLocaleString('es-CO')}`);
      
      await cargarMovimientos();
    } catch (error) {
      alert('Error aplicando descuento: ' + error.message);
    }
  };

  const registrarMovimiento = async (e) => {
    e.preventDefault();

    if (!nuevoMovimiento.empleado_id || !nuevoMovimiento.monto) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      if (movimientoEditando) {
        await apiRequest(API_CONFIG.ENDPOINTS.MOVIMIENTO(movimientoEditando.id), {
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
        await apiRequest(API_CONFIG.ENDPOINTS.MOVIMIENTOS, {
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

  const eliminarMovimiento = async (movimientoId, movimiento) => {
    if (esFudo(movimiento)) {
      alert('⚠️ Los movimientos sincronizados desde FUDO no pueden eliminarse manualmente.');
      return;
    }

    if (!window.confirm(`¿Estás seguro de eliminar este movimiento?\n"${movimiento.descripcion}"`)) {
      return;
    }

    try {
      await apiRequest(API_CONFIG.ENDPOINTS.MOVIMIENTO(movimientoId), {
        method: 'DELETE',
      });
      alert('✅ Movimiento eliminado exitosamente');
      await cargarMovimientos();
    } catch (error) {
      alert('Error eliminando movimiento: ' + error.message);
    }
  };

  const esFudo = (movimiento) => {
    return movimiento.fudo_sale_id || movimiento.fudo_payment_id || movimiento.fudo_transaction_id;
  };

  const getTipoColor = (tipo) => {
    return tipo === 'adelanto' 
      ? 'bg-orange-100 text-orange-800' 
      : tipo === 'consumo'
      ? 'bg-purple-100 text-purple-800'
      : 'bg-green-100 text-green-800';
  };

  const getTipoIcon = (tipo) => {
    return tipo === 'adelanto' ? '💵' : tipo === 'consumo' ? '🍽️' : '💰';
  };

  const movimientosFiltrados = movimientos.filter(m => {
    if (filtroTipo === 'pendientes') return !m.descontado;
    if (filtroTipo === 'descontados') return m.descontado;
    if (filtroTipo === 'fudo') return esFudo(m);
    if (filtroTipo === 'manual') return !esFudo(m);
    return true;
  });

  const totalPendiente = movimientosFiltrados
    .filter(m => !m.descontado)
    .reduce((sum, m) => sum + m.monto, 0);

  const totalFudo = movimientosFiltrados
    .filter(m => !m.descontado && esFudo(m))
    .reduce((sum, m) => sum + m.monto, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Movimientos</h1>
          <p className="text-gray-500 mt-1">Adelantos, consumos y gestión de cuenta corriente</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={sincronizarMovimientosCaja}
            disabled={loading}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <RefreshCw size={20} />
            Sync Adelantos
          </button>
          <button
            onClick={sincronizarTodosConsumos}
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <RefreshCw size={20} />
            Sync Consumos
          </button>
          <button
            onClick={abrirFormularioNuevo}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <Plus size={20} />
            Nuevo Movimiento
          </button>
        </div>
      </div>

      {/* Filtros y Resumen */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter size={16} className="inline mr-2" />
              Empleado
            </label>
            <select
              value={filtroEmpleado}
              onChange={(e) => setFiltroEmpleado(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {empleados.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtro</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos</option>
              <option value="pendientes">Pendientes</option>
              <option value="descontados">Descontados</option>
              <option value="fudo">Solo FUDO</option>
              <option value="manual">Solo Manuales</option>
            </select>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Pendiente</p>
            <p className="text-2xl font-bold text-blue-600">
              ${totalPendiente.toLocaleString('es-CO')}
            </p>
          </div>

          {totalFudo > 0 && (
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">🍴 FUDO Pendiente</p>
              <p className="text-2xl font-bold text-purple-600">
                ${totalFudo.toLocaleString('es-CO')}
              </p>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Movimientos</p>
            <p className="text-2xl font-bold text-gray-900">
              {movimientosFiltrados.length}
            </p>
          </div>
        </div>
      </div>

      {/* Formulario de Movimiento */}
      {mostrarFormulario && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">
            {movimientoEditando ? 'Editar Movimiento' : 'Registrar Movimiento Manual'}
          </h2>
          
          <form onSubmit={registrarMovimiento}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
                  <option value="abono">💰 Abono</option>
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

      {/* Tabla de Movimientos */}
      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="animate-spin mx-auto mb-4" size={48} />
          <p>Cargando movimientos...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Empleado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Origen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {movimientosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                      No hay movimientos para mostrar
                    </td>
                  </tr>
                ) : (
                  movimientosFiltrados.map((mov) => (
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-red-600">
                          {mov.tipo === 'abono' ? '+' : '-'}${mov.monto.toLocaleString('es-CO')}
                        </div>
                        {mov.monto_original_fudo && mov.monto !== mov.monto_original_fudo && (
                          <div className="text-xs text-gray-500 line-through">
                            ${mov.monto_original_fudo.toLocaleString('es-CO')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {esFudo(mov) ? (
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
                            
                            {!esFudo(mov) && (
                              <>
                                <button
                                  onClick={() => abrirFormularioEditar(mov)}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Editar"
                                >
                                  <Edit size={18} />
                                </button>
                                <button
                                  onClick={() => eliminarMovimiento(mov.id, mov)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Eliminar"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </>
                            )}

                            {esFudo(mov) && mov.tipo === 'consumo' && (
                              <>
                                <button
                                  onClick={() => abrirDescuento(mov)}
                                  className="text-orange-600 hover:text-orange-900"
                                  title="Aplicar descuento personalizado"
                                >
                                  <Percent size={18} />
                                </button>
                                <button
                                  onClick={() => aplicarDescuento15(mov)}
                                  className="text-green-600 hover:text-green-900 text-xs font-semibold"
                                  title="Aplicar descuento del 15%"
                                >
                                  -15%
                                </button>
                              </>
                            )}
                          </div>
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
                onClick={() => setMovimientoDetalle(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                <X size={24} />
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
                  {movimientoDetalle.monto_original_fudo && movimientoDetalle.monto !== movimientoDetalle.monto_original_fudo && (
                    <p className="text-sm text-gray-500">
                      Original: ${movimientoDetalle.monto_original_fudo.toLocaleString('es-CO')}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Origen</p>
                  <p className="font-semibold">
                    {esFudo(movimientoDetalle) ? '🍴 FUDO (Sincronizado)' : '✏️ Manual'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Estado</p>
                  <p className="font-semibold">
                    {movimientoDetalle.descontado ? '✓ Descontado' : '⏳ Pendiente de descuento'}
                  </p>
                </div>
              </div>
              
              {movimientoDetalle.descripcion && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">Descripción</p>
                  <p className="text-sm">{movimientoDetalle.descripcion}</p>
                </div>
              )}

              {esFudo(movimientoDetalle) && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-blue-700">
                        <strong>Sincronizado desde FUDO:</strong> Este movimiento fue importado automáticamente desde el sistema FUDO.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={() => setMovimientoDetalle(null)}
                className="w-full bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Descuento Personalizado */}
      {mostrarDescuento && movimientoDescuento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Aplicar Descuento Personalizado</h3>
              <button
                onClick={() => setMostrarDescuento(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-4 bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Monto Original FUDO</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(movimientoDescuento.monto_original_fudo || movimientoDescuento.monto).toLocaleString('es-CO')}
              </p>
            </div>

            <form onSubmit={aplicarDescuentoPersonalizado} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nuevo Monto (después del descuento) *
                </label>
                <input
                  type="number"
                  value={formDescuento.nuevo_monto}
                  onChange={(e) => setFormDescuento({ ...formDescuento, nuevo_monto: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="45000"
                  required
                  max={movimientoDescuento.monto_original_fudo || movimientoDescuento.monto}
                />
                {formDescuento.nuevo_monto && (
                  <p className="text-sm text-gray-600 mt-1">
                    Descuento: ${((movimientoDescuento.monto_original_fudo || movimientoDescuento.monto) - parseFloat(formDescuento.nuevo_monto || 0)).toLocaleString('es-CO')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo del Descuento *
                </label>
                <textarea
                  value={formDescuento.motivo}
                  onChange={(e) => setFormDescuento({ ...formDescuento, motivo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Ej: Descuento por calidad de producto"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Aplicar Descuento
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarDescuento(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <Info className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Sincronización Automática:</strong> Los consumos y adelantos se sincronizan automáticamente desde FUDO. 
              Puedes aplicar descuentos del 15% o personalizados a los consumos de FUDO.
              Los movimientos manuales pueden editarse libremente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
