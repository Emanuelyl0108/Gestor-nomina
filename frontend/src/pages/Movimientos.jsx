import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Search } from 'lucide-react';
import { apiRequest } from '../config/api';
import API_CONFIG from '../config/api';

export default function Movimientos() {
  const [empleados, setEmpleados] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  
  const [formData, setFormData] = useState({
    empleado_id: '',
    tipo: 'adelanto',
    monto: '',
    descripcion: ''
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [empRes, movRes] = await Promise.all([
        apiRequest(API_CONFIG.ENDPOINTS.EMPLEADOS),
        apiRequest(API_CONFIG.ENDPOINTS.MOVIMIENTOS)
      ]);
      setEmpleados(empRes.filter(e => e.estado === 'ACTIVO'));
      setMovimientos(movRes);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const registrarMovimiento = async (e) => {
    e.preventDefault();
    
    if (!formData.empleado_id || !formData.monto) {
      alert('Complete todos los campos requeridos');
      return;
    }

    try {
      await apiRequest(API_CONFIG.ENDPOINTS.MOVIMIENTOS, {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      alert('✅ Movimiento registrado correctamente');
      setMostrarForm(false);
      setFormData({ empleado_id: '', tipo: 'adelanto', monto: '', descripcion: '' });
      cargarDatos();
    } catch (error) {
      console.error('Error registrando movimiento:', error);
      alert('Error al registrar movimiento');
    }
  };

  const movimientosFiltrados = movimientos.filter(mov => {
    const coincideBusqueda = mov.empleado_nombre?.toLowerCase().includes(busqueda.toLowerCase());
    const coincideTipo = filtroTipo === 'todos' || mov.tipo === filtroTipo;
    const coincideEstado = filtroEstado === 'todos' || 
                           (filtroEstado === 'pendiente' && !mov.descontado) ||
                           (filtroEstado === 'descontado' && mov.descontado);
    return coincideBusqueda && coincideTipo && coincideEstado;
  });

  const totalPendiente = movimientos.filter(m => !m.descontado).reduce((sum, m) => sum + m.monto, 0);
  const totalDescontado = movimientos.filter(m => m.descontado).reduce((sum, m) => sum + m.monto, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600 text-xl">Cargando movimientos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Movimientos</h1>
          <p className="text-gray-500 mt-1">Adelantos y consumos de empleados</p>
        </div>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={20} />
          Nuevo Movimiento
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-orange-600" size={24} />
            </div>
            <span className="text-3xl font-bold text-gray-900">
              {movimientos.filter(m => !m.descontado).length}
            </span>
          </div>
          <p className="text-sm text-gray-600 font-medium">Pendientes</p>
          <p className="text-xs text-orange-600 mt-1 font-semibold">
            ${totalPendiente.toLocaleString('es-CO')}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <span className="text-3xl font-bold text-gray-900">
              {movimientos.filter(m => m.descontado).length}
            </span>
          </div>
          <p className="text-sm text-gray-600 font-medium">Descontados</p>
          <p className="text-xs text-green-600 mt-1 font-semibold">
            ${totalDescontado.toLocaleString('es-CO')}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-blue-600" size={24} />
            </div>
            <span className="text-3xl font-bold text-gray-900">{movimientos.length}</span>
          </div>
          <p className="text-sm text-gray-600 font-medium">Total Registrados</p>
          <p className="text-xs text-gray-400 mt-1">Histórico completo</p>
        </div>
      </div>

      {/* Formulario */}
      {mostrarForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Registrar Movimiento</h2>
          <form onSubmit={registrarMovimiento} className="space-y-4">
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
                      {emp.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="adelanto">💰 Adelanto</option>
                  <option value="consumo">🍽️ Consumo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Monto *</label>
                <input
                  type="number"
                  value={formData.monto}
                  onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="50000"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
                <input
                  type="text"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Registrar
              </button>
              <button
                type="button"
                onClick={() => setMostrarForm(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar empleado..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFiltroTipo('todos')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtroTipo === 'todos'
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroTipo('adelanto')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtroTipo === 'adelanto'
                  ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              💰 Adelantos
            </button>
            <button
              onClick={() => setFiltroTipo('consumo')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtroTipo === 'consumo'
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🍽️ Consumos
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFiltroEstado('todos')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtroEstado === 'todos'
                  ? 'bg-gray-700 text-white border-2 border-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroEstado('pendiente')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtroEstado === 'pendiente'
                  ? 'bg-orange-100 text-orange-700 border-2 border-orange-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setFiltroEstado('descontado')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtroEstado === 'descontado'
                  ? 'bg-green-100 text-green-700 border-2 border-green-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Descontados
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Fecha</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Empleado</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Tipo</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Monto</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Estado</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {movimientosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    No se encontraron movimientos
                  </td>
                </tr>
              ) : (
                movimientosFiltrados.map((mov) => (
                  <tr key={mov.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">{mov.fecha}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{mov.empleado_nombre}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        mov.tipo === 'adelanto' 
                          ? 'bg-yellow-100 text-yellow-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {mov.tipo === 'adelanto' ? '💰 Adelanto' : '🍽️ Consumo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-red-600">
                      -${mov.monto?.toLocaleString('es-CO')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        mov.descontado 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {mov.descontado ? '✓ Descontado' : '⏳ Pendiente'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {mov.descripcion || '-'}
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
