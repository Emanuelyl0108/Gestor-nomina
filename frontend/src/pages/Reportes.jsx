import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar } from 'lucide-react';
import { apiRequest } from '../config/api';
import API_CONFIG from '../config/api';

export default function Reportes() {
  const [nominasPagadas, setNominasPagadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    empleado_id: ''
  });
  const [empleados, setEmpleados] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [nominasData, empleadosData] = await Promise.all([
        apiRequest(API_CONFIG.ENDPOINTS.NOMINAS_LISTAR + '?pagada=true&limit=100'),
        apiRequest(API_CONFIG.ENDPOINTS.EMPLEADOS_TODOS)
      ]);
      
      setNominasPagadas(nominasData.nominas || []);
      setEmpleados(empleadosData || []);
    } catch (error) {
      console.error('Error cargando reportes:', error);
    } finally {
      setLoading(false);
    }
  };

  const nominasFiltradas = nominasPagadas.filter(nomina => {
    let cumpleFiltros = true;

    if (filtros.fecha_inicio && nomina.periodo.inicio < filtros.fecha_inicio) {
      cumpleFiltros = false;
    }
    if (filtros.fecha_fin && nomina.periodo.fin > filtros.fecha_fin) {
      cumpleFiltros = false;
    }
    if (filtros.empleado_id && nomina.empleado.id !== parseInt(filtros.empleado_id)) {
      cumpleFiltros = false;
    }

    return cumpleFiltros;
  });

  const totalPagado = nominasFiltradas.reduce((sum, n) => sum + (n.montos.total_pagar || 0), 0);
  const totalPropinas = nominasFiltradas.reduce((sum, n) => sum + (n.montos.propinas || 0), 0);
  const totalBonos = nominasFiltradas.reduce((sum, n) => sum + (n.montos.bonos || 0), 0);

  const exportarExcel = () => {
    const headers = ['Fecha Pago', 'Empleado', 'Periodo Inicio', 'Periodo Fin', 'Días', 'Monto Base', 'Propinas', 'Bonos', 'Descuentos', 'Total Pagado'];
    const rows = nominasFiltradas.map(n => [
      n.estado.fecha_pago || '',
      n.empleado.nombre,
      n.periodo.inicio,
      n.periodo.fin,
      n.dias_trabajados,
      n.montos.monto_base || 0,
      n.montos.propinas || 0,
      n.montos.bonos || 0,
      n.montos.descuentos || 0,
      n.montos.total_pagar || 0
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Reporte_Nomina_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600 text-xl">Cargando reportes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-500 mt-1">Historial de pagos y estadísticas</p>
        </div>
        <button
          onClick={exportarExcel}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          disabled={nominasFiltradas.length === 0}
        >
          <Download size={20} />
          Exportar Excel
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Inicio</label>
            <input
              type="date"
              value={filtros.fecha_inicio}
              onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Fin</label>
            <input
              type="date"
              value={filtros.fecha_fin}
              onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Empleado</label>
            <select
              value={filtros.empleado_id}
              onChange={(e) => setFiltros({ ...filtros, empleado_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              {empleados.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="text-blue-600" size={24} />
            </div>
            <span className="text-3xl font-bold text-gray-900">{nominasFiltradas.length}</span>
          </div>
          <p className="text-sm text-gray-600 font-medium">Total de Pagos</p>
          <p className="text-xs text-blue-600 mt-1 font-semibold">
            ${totalPagado.toLocaleString('es-CO')}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="text-green-600" size={24} />
            </div>
            <span className="text-2xl font-bold text-gray-900">
              ${(totalPagado / 1000000).toFixed(1)}M
            </span>
          </div>
          <p className="text-sm text-gray-600 font-medium">Total Pagado</p>
          <p className="text-xs text-gray-400 mt-1">Incluye todo</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🎁</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              ${((totalPropinas + totalBonos) / 1000).toFixed(0)}K
            </span>
          </div>
          <p className="text-sm text-gray-600 font-medium">Propinas + Bonos</p>
          <p className="text-xs text-purple-600 mt-1 font-semibold">
            ${(totalPropinas + totalBonos).toLocaleString('es-CO')}
          </p>
        </div>
      </div>

      {/* Tabla de pagos */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Fecha Pago</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Empleado</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Periodo</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Días</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Monto Base</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Extras</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {nominasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
                    No se encontraron pagos
                  </td>
                </tr>
              ) : (
                nominasFiltradas.map((nomina) => (
                  <tr key={nomina.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">
                      {nomina.estado.fecha_pago?.split('T')[0] || 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{nomina.empleado.nombre}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {nomina.periodo.inicio} → {nomina.periodo.fin}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {nomina.dias_trabajados}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-900">
                      ${(nomina.montos.monto_base || 0).toLocaleString('es-CO')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs space-y-1">
                        {nomina.montos.propinas > 0 && (
                          <div className="text-green-600">+${nomina.montos.propinas.toLocaleString('es-CO')} propinas</div>
                        )}
                        {nomina.montos.bonos > 0 && (
                          <div className="text-purple-600">+${nomina.montos.bonos.toLocaleString('es-CO')} bonos</div>
                        )}
                        {nomina.montos.descuentos > 0 && (
                          <div className="text-red-600">-${nomina.montos.descuentos.toLocaleString('es-CO')} desc.</div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-gray-900">
                      ${(nomina.montos.total_pagar || 0).toLocaleString('es-CO')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Reportes;
