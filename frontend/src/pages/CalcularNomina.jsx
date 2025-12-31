import React, { useState, useEffect } from 'react';
import { Calculator, FileText, Eye, Edit3, Trash2, DollarSign, CheckCircle, Clock } from 'lucide-react';
import { apiRequest } from '../config/api';
import API_CONFIG from '../config/api';

export default function CalcularNomina() {
  const [empleados, setEmpleados] = useState([]);
  const [nominas, setNominas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creandoNomina, setCreandoNomina] = useState(false);
  const [nominaDetalle, setNominaDetalle] = useState(null);
  const [configurandoDescuentos, setConfigurandoDescuentos] = useState(null);
  
  const [formData, setFormData] = useState({
    empleado_id: '',
    periodo_inicio: '',
    periodo_fin: '',
    total_propinas: 0,
    total_bonos: 0,
    total_descuentos: 0,
  });

  useEffect(() => {
    cargarEmpleados();
    cargarNominas();
  }, []);

  const cargarEmpleados = async () => {
    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.EMPLEADOS);
      setEmpleados(response.filter(e => e.estado === 'ACTIVO'));
    } catch (error) {
      console.error('Error cargando empleados:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarNominas = async () => {
    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.NOMINAS_LISTAR + '?pagada=false&limit=50');
      setNominas(response.nominas || []);
    } catch (error) {
      console.error('Error cargando nóminas:', error);
    }
  };

  const crearNomina = async (e) => {
    e.preventDefault();
    setCreandoNomina(true);

    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.NOMINAS, {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      
      alert(`✅ Nómina creada exitosamente\n\nEmpleado: ${response.empleado}\nDías trabajados: ${response.datos_asistencia.dias_trabajados}\nTotal a pagar: $${response.calculo.total_a_pagar.toLocaleString('es-CO')}`);
      
      setFormData({
        empleado_id: '',
        periodo_inicio: '',
        periodo_fin: '',
        total_propinas: 0,
        total_bonos: 0,
        total_descuentos: 0,
      });
      
      await cargarNominas();
    } catch (error) {
      console.error('Error creando nómina:', error);
      alert('Error al crear nómina: ' + error.message);
    } finally {
      setCreandoNomina(false);
    }
  };

  const verDetalleNomina = async (nominaId) => {
    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.NOMINA_VER_DESCUENTOS(nominaId));
      setNominaDetalle(response);
    } catch (error) {
      alert('Error obteniendo detalle: ' + error.message);
    }
  };

  const pagarNomina = async (nominaId) => {
    if (!window.confirm('¿Confirmar pago de esta nómina?')) return;

    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.NOMINA_PAGAR(nominaId), {
        method: 'POST',
      });

      alert(`✅ Nómina pagada exitosamente\n\nTotal descontado: $${response.total_descontado.toLocaleString('es-CO')}\nMonto pagado al empleado: $${response.resumen_pago.monto_a_pagar_empleado.toLocaleString('es-CO')}`);
      
      await cargarNominas();
      setNominaDetalle(null);
    } catch (error) {
      alert('Error pagando nómina: ' + error.message);
    }
  };

  const eliminarNomina = async (nominaId) => {
    if (!window.confirm('¿Eliminar esta nómina?\n\nEsta acción no se puede deshacer.')) return;

    try {
      await apiRequest(API_CONFIG.ENDPOINTS.NOMINA(nominaId), {
        method: 'DELETE',
      });

      alert('✅ Nómina eliminada');
      await cargarNominas();
    } catch (error) {
      alert('Error eliminando nómina: ' + error.message);
    }
  };

  const actualizarAjustes = async (nominaId) => {
    const propinas = prompt('Propinas:', '0');
    const bonos = prompt('Bonos:', '0');
    const descuentos = prompt('Descuentos:', '0');

    if (propinas === null) return;

    try {
      await apiRequest(API_CONFIG.ENDPOINTS.NOMINA_ACTUALIZAR(nominaId), {
        method: 'PUT',
        body: JSON.stringify({
          total_propinas: parseFloat(propinas || 0),
          total_bonos: parseFloat(bonos || 0),
          total_descuentos: parseFloat(descuentos || 0),
        }),
      });

      alert('✅ Ajustes actualizados');
      await cargarNominas();
    } catch (error) {
      alert('Error actualizando ajustes: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600 text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Calcular Nómina</h1>
        <p className="text-gray-500 mt-1">Crear y gestionar nóminas con integración automática de asistencia</p>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">📝 Crear Nueva Nómina</h2>
        <form onSubmit={crearNomina} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Empleado *</label>
              <select
                value={formData.empleado_id}
                onChange={(e) => setFormData({ ...formData, empleado_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Seleccionar empleado</option>
                {empleados.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombre} - ${emp.sueldo_mensual?.toLocaleString('es-CO')}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Periodo Inicio *</label>
                <input
                  type="date"
                  value={formData.periodo_inicio}
                  onChange={(e) => setFormData({ ...formData, periodo_inicio: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Periodo Fin *</label>
                <input
                  type="date"
                  value={formData.periodo_fin}
                  onChange={(e) => setFormData({ ...formData, periodo_fin: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Propinas (opcional)</label>
              <input
                type="number"
                value={formData.total_propinas}
                onChange={(e) => setFormData({ ...formData, total_propinas: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bonos (opcional)</label>
              <input
                type="number"
                value={formData.total_bonos}
                onChange={(e) => setFormData({ ...formData, total_bonos: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Descuentos (opcional)</label>
              <input
                type="number"
                value={formData.total_descuentos}
                onChange={(e) => setFormData({ ...formData, total_descuentos: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={creandoNomina}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <Calculator size={20} />
            {creandoNomina ? 'Creando Nómina...' : 'Crear Nómina'}
          </button>
        </form>

        <div className="mt-4 bg-blue-50 border-l-4 border-blue-400 p-4">
          <p className="text-sm text-blue-700">
            ℹ️ La nómina se calculará automáticamente usando los datos de asistencia del periodo. 
            Los movimientos (consumos/adelantos) del periodo se configurarán automáticamente para descuento.
          </p>
        </div>
      </div>

      {/* Lista de Nóminas Pendientes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Nóminas Pendientes de Pago</h2>
          {nominas.length > 0 && (
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
              {nominas.length} pendientes
            </span>
          )}
        </div>

        {nominas.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
            <p className="text-gray-500">No hay nóminas pendientes</p>
            <p className="text-sm text-gray-400 mt-1">Todas las nóminas están al día</p>
          </div>
        ) : (
          <div className="space-y-3">
            {nominas.map((nomina) => (
              <div
                key={nomina.id}
                className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{nomina.empleado.nombre}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-gray-500">
                        {nomina.periodo.inicio} → {nomina.periodo.fin}
                      </span>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">
                        {nomina.dias_trabajados} días
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total a Pagar</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${nomina.montos.total_pagar.toLocaleString('es-CO')}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => verDetalleNomina(nomina.id)}
                      className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                      title="Ver detalle"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => actualizarAjustes(nomina.id)}
                      className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors"
                      title="Editar ajustes"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button
                      onClick={() => eliminarNomina(nomina.id)}
                      className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Detalle Nómina */}
      {nominaDetalle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  Detalle de Nómina - {nominaDetalle.nomina.empleado}
                </h2>
                <button
                  onClick={() => setNominaDetalle(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Periodo: {nominaDetalle.nomina.periodo.inicio} → {nominaDetalle.nomina.periodo.fin}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Resumen Financiero */}
              <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-4">💰 Resumen Financiero</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-blue-700">Monto Base</p>
                    <p className="text-xl font-bold text-blue-900">
                      ${nominaDetalle.calculo.monto_base.toLocaleString('es-CO')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">Propinas</p>
                    <p className="text-xl font-bold text-green-600">
                      +${nominaDetalle.calculo.total_propinas.toLocaleString('es-CO')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">Total Bruto</p>
                    <p className="text-xl font-bold text-blue-900">
                      ${nominaDetalle.calculo.total_bruto.toLocaleString('es-CO')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">Descuentos Generales</p>
                    <p className="text-xl font-bold text-red-600">
                      -${nominaDetalle.calculo.total_descuentos_generales.toLocaleString('es-CO')}
                    </p>
                  </div>
                  <div className="col-span-2 bg-white rounded-lg p-4 border-2 border-blue-300">
                    <p className="text-sm text-blue-700 mb-1">Descuentos de Movimientos</p>
                    <p className="text-2xl font-bold text-red-600">
                      -${nominaDetalle.calculo.total_a_descontar_movimientos.toLocaleString('es-CO')}
                    </p>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div>
                        <p className="text-gray-600">Pagos Completos</p>
                        <p className="font-semibold text-gray-900">
                          ${nominaDetalle.calculo.desglose_descuentos.pagos_completos.toLocaleString('es-CO')}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Pagos Parciales</p>
                        <p className="font-semibold text-gray-900">
                          ${nominaDetalle.calculo.desglose_descuentos.pagos_parciales.toLocaleString('es-CO')}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Diferidos</p>
                        <p className="font-semibold text-gray-900">
                          ${nominaDetalle.calculo.desglose_descuentos.diferidos.toLocaleString('es-CO')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 bg-green-50 rounded-lg p-4 border-2 border-green-300">
                    <p className="text-sm text-green-700 mb-1">TOTAL A PAGAR AL EMPLEADO</p>
                    <p className="text-3xl font-bold text-green-600">
                      ${nominaDetalle.calculo.monto_final_a_pagar_empleado.toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Movimientos Configurados */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">
                  📋 Movimientos Configurados ({nominaDetalle.movimientos_configurados.total})
                </h3>
                
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-blue-600">Completos</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {nominaDetalle.movimientos_configurados.completos}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-orange-600">Parciales</p>
                    <p className="text-2xl font-bold text-orange-900">
                      {nominaDetalle.movimientos_configurados.parciales}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-gray-600">Diferidos</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {nominaDetalle.movimientos_configurados.diferidos}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {nominaDetalle.movimientos_configurados.detalle.map((mov) => (
                    <div key={mov.movimiento_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {mov.tipo === 'consumo' ? '🍽️' : '💵'} {mov.tipo} - {mov.fecha}
                        </p>
                        <p className="text-xs text-gray-500">{mov.descripcion}</p>
                        <span className={`mt-1 inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          mov.configuracion.tipo_descuento === 'completo' ? 'bg-blue-100 text-blue-700' :
                          mov.configuracion.tipo_descuento === 'parcial' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {mov.configuracion.tipo_descuento === 'completo' ? 'Pago Completo' :
                           mov.configuracion.tipo_descuento === 'parcial' ? 'Pago Parcial' :
                           'Diferido'}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Original: ${mov.monto_original.toLocaleString('es-CO')}</p>
                        <p className="text-lg font-bold text-red-600">
                          Descontar: ${mov.configuracion.monto_a_descontar.toLocaleString('es-CO')}
                        </p>
                        {mov.configuracion.saldo_restante > 0 && (
                          <p className="text-xs text-orange-600">
                            Saldo restante: ${mov.configuracion.saldo_restante.toLocaleString('es-CO')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => pagarNomina(nominaDetalle.nomina.id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  <DollarSign size={20} />
                  Procesar Pago
                </button>
                <button
                  onClick={() => setNominaDetalle(null)}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
