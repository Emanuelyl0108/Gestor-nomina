import React, { useState, useEffect } from 'react';
import { Calculator, FileText } from 'lucide-react';
import { apiRequest } from '../config/api';
import API_CONFIG from '../config/api';

export default function CalcularNomina() {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [resultado, setResultado] = useState(null);
  
  const [formData, setFormData] = useState({
    empleado_id: '',
    tipo_nomina: 'quincenal',
    periodo_inicio: '',
    periodo_fin: '',
    dias_completos: '',
    medios_sustitutos: '0',
    medios_adicionales: '0'
  });

  useEffect(() => {
    cargarEmpleados();
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

  const calcularNomina = async (e) => {
    e.preventDefault();
    setCalculando(true);
    setResultado(null);

    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.NOMINA_CALCULAR, {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          dias_completos: formData.dias_completos ? parseInt(formData.dias_completos) : null,
          medios_sustitutos: parseFloat(formData.medios_sustitutos),
          medios_adicionales: parseFloat(formData.medios_adicionales)
        }),
      });
      
      setResultado(response);
    } catch (error) {
      console.error('Error calculando nómina:', error);
      alert('Error al calcular nómina');
    } finally {
      setCalculando(false);
    }
  };

  const pagarNomina = async () => {
    if (!resultado) return;

    const confirmar = window.confirm(
      `¿Confirmar pago de $${resultado.total_pagar.toLocaleString('es-CO')} a ${resultado.empleado_nombre}?`
    );

    if (!confirmar) return;

    try {
      // Guardar nómina
      const guardarRes = await apiRequest(API_CONFIG.ENDPOINTS.NOMINA_GUARDAR, {
        method: 'POST',
        body: JSON.stringify({
          empleado_id: resultado.empleado_id,
          tipo_nomina: resultado.tipo_nomina,
          periodo_inicio: resultado.periodo_inicio,
          periodo_fin: resultado.periodo_fin,
          dias_trabajados: resultado.dias_efectivos,
          sueldo_base: resultado.sueldo_base,
          monto_base: resultado.monto_base,
          total_propinas: resultado.total_propinas,
          total_bonos: resultado.total_bonos,
          total_descuentos: resultado.total_descuentos,
          total_movimientos: resultado.total_movimientos,
          total_pagar: resultado.total_pagar
        }),
      });

      const nominaId = guardarRes.nomina_id;

      // Procesar pago
      await apiRequest(API_CONFIG.ENDPOINTS.NOMINA_PAGAR, {
        method: 'POST',
        body: JSON.stringify({
          nomina_id: nominaId,
          metodo_pago: 'Efectivo'
        }),
      });

      alert('✅ Pago procesado exitosamente');
      setResultado(null);
      setFormData({
        empleado_id: '',
        tipo_nomina: 'quincenal',
        periodo_inicio: '',
        periodo_fin: '',
        dias_completos: '',
        medios_sustitutos: '0',
        medios_adicionales: '0'
      });
    } catch (error) {
      console.error('Error procesando pago:', error);
      alert('Error al procesar el pago');
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
        <p className="text-gray-500 mt-1">Calcular y procesar pagos de nómina</p>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={calcularNomina} className="space-y-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Nómina *</label>
              <select
                value={formData.tipo_nomina}
                onChange={(e) => setFormData({ ...formData, tipo_nomina: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="quincenal">Quincenal (15 días)</option>
                <option value="semanal">Semanal (7 días)</option>
              </select>
            </div>

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Días Completos
                <span className="text-xs text-gray-500 ml-2">(vacío = automático)</span>
              </label>
              <input
                type="number"
                value={formData.dias_completos}
                onChange={(e) => setFormData({ ...formData, dias_completos: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Auto desde marcajes"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Medios Sustitutos</label>
              <input
                type="number"
                step="0.5"
                value={formData.medios_sustitutos}
                onChange={(e) => setFormData({ ...formData, medios_sustitutos: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Medios Adicionales</label>
              <input
                type="number"
                step="0.5"
                value={formData.medios_adicionales}
                onChange={(e) => setFormData({ ...formData, medios_adicionales: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={calculando}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <Calculator size={20} />
            {calculando ? 'Calculando...' : 'Calcular Nómina'}
          </button>
        </form>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Resumen de Nómina</h2>
          </div>

          <div className="space-y-4">
            <div className="pb-4 border-b border-gray-200">
              <h3 className="font-semibold text-lg text-gray-900">{resultado.empleado_nombre}</h3>
              <p className="text-sm text-gray-500">
                {resultado.periodo_inicio} → {resultado.periodo_fin}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Días Trabajados</p>
                <p className="text-2xl font-bold text-gray-900">{resultado.dias_efectivos}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Días a Pagar</p>
                <p className="text-2xl font-bold text-gray-900">{resultado.dias_a_pagar}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Valor Día</p>
                <p className="text-lg font-bold text-gray-900">
                  ${resultado.valor_dia?.toLocaleString('es-CO')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Monto Base:</span>
                <span className="font-mono font-semibold text-gray-900">
                  ${resultado.monto_base?.toLocaleString('es-CO')}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-green-600">+ Propinas:</span>
                <span className="font-mono font-semibold text-green-600">
                  ${resultado.total_propinas?.toLocaleString('es-CO')}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-green-600">+ Bonos:</span>
                <span className="font-mono font-semibold text-green-600">
                  ${resultado.total_bonos?.toLocaleString('es-CO')}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-red-600">- Descuentos:</span>
                <span className="font-mono font-semibold text-red-600">
                  ${resultado.total_descuentos?.toLocaleString('es-CO')}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-red-600">- Movimientos:</span>
                <span className="font-mono font-semibold text-red-600">
                  ${resultado.total_movimientos?.toLocaleString('es-CO')}
                </span>
              </div>
              <div className="border-t-2 border-gray-300 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">TOTAL A PAGAR:</span>
                  <span className="text-2xl font-bold text-green-600">
                    ${resultado.total_pagar?.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={pagarNomina}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                💰 Procesar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
