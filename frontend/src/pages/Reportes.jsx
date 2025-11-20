import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, TrendingUp, DollarSign } from 'lucide-react';
import { apiRequest } from '../config/api';
import API_CONFIG from '../config/api';

export default function Reportes() {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    empleado: ''
  });

  useEffect(() => {
    cargarPagos();
  }, []);

  const cargarPagos = async () => {
    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.PAGOS);
      setPagos(response);
    } catch (error) {
      console.error('Error cargando pagos:', error);
    } finally {
      setLoading(false);
    }
  };

  const pagosFiltrados = pagos.filter(pago => {
    let cumpleFiltros = true;

    if (filtros.fecha_inicio && pago.fecha_pago < filtros.fecha_inicio) {
      cumpleFiltros = false;
    }
    if (filtros.fecha_fin && pago.fecha_pago > filtros.fecha_fin) {
      cumpleFiltros = false;
    }
    if (filtros.empleado && !pago.empleado_nombre?.toLowerCase().includes(filtros.empleado.toLowerCase())) {
      cumpleFiltros = false;
    }

    return cumpleFiltros;
  });

  const totalPagado = pagosFiltrados.reduce((sum, p) => sum + (p.total_pagado || 0), 0);
  const totalPropinas = pagosFiltrados.reduce((sum, p) => sum + (p.propinas || 0), 0);
  const totalBonos = pagosFiltrados.reduce((sum, p) => sum + (p.bonos || 0), 0);

  const exportarExcel = () => {
    // Crear CSV
    const headers = ['Fecha', 'Empleado', 'Tipo', 'Periodo', 'Monto Base', 'Propinas', 'Bonos', 'Total'];
    const rows = pagosFiltrados.map(p => [
      p.fecha_pago,
      p.empleado_nombre,
      p.tipo_nomina || 'N/A',
      p.periodo,
      p.monto_base || 0,
      p.propinas || 0,
      p.bonos || 0,
      p.total_pagado || 0
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
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
          disabled={pagosFiltrados.length === 0}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar Empleado</label>
            <input
              type="text"
              value={filtros.empleado}
              onChange={(e) => setFiltros({ ...filtros, empleado: e.target.value })}
              placeholder="Nombre del empleado"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-blue-600" size={24} />
            </div>
            <span className="text-3xl font-bold text-gray-900">{pagosFiltrados.length}</span>
          </div>
          <p className="text-sm text-gray-600 font-medium">Total de Pagos</p>
          <p className="text-xs text-blue-600 mt-1 font-semibold">
            ${totalPagado.toLocaleString('es-CO')}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-green-600" size={24} />
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
              <Calendar className="text-purple-600" size={24} />
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
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Fecha</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Empleado</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Tipo</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Periodo</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Monto Base</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Propinas</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Bonos</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {pagosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-500">
                    No se encontraron pagos
                  </td>
                </tr>
              ) : (
                pagosFiltrados.map((pago, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">{pago.fecha_pago?.split('T')[0]}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{pago.empleado_nombre}</td>
                    <td className="py-3 px-4">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium capitalize">
                        {pago.tipo_nomina || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{pago.periodo}</td>
                    <td className="py-3 px-4 font-mono text-gray-900">
                      ${(pago.monto_base || 0).toLocaleString('es-CO')}
                    </td>
                    <td className="py-3 px-4 font-mono text-green-600">
                      ${(pago.propinas || 0).toLocaleString('es-CO')}
                    </td>
                    <td className="py-3 px-4 font-mono text-purple-600">
                      ${(pago.bonos || 0).toLocaleString('es-CO')}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-gray-900">
                      ${(pago.total_pagado || 0).toLocaleString('es-CO')}
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
