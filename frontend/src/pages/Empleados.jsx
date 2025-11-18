import React, { useState, useEffect } from 'react';
import { User, Edit2, Trash2, UserX, UserCheck, Plus, Search, X, Save } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://gestor-nomina-backend.onrender.com/api';

export default function Empleados() {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('activo'); // 'activo', 'inactivo', 'todos'
  
  // Modales
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [empleadoEditando, setEmpleadoEditando] = useState(null);
  
  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    cedula: '',
    rol: '',
    sueldo_mensual: '',
    tipo_pago: 'quincenal'
  });

  useEffect(() => {
    cargarEmpleados();
  }, []);

  const cargarEmpleados = async () => {
    try {
      const response = await axios.get(`${API_URL}/nomina/empleados`);
      setEmpleados(response.data);
    } catch (error) {
      console.error('Error cargando empleados:', error);
      alert('Error al cargar empleados');
    } finally {
      setLoading(false);
    }
  };

  const crearEmpleado = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/nomina/empleados`, formData);
      alert('✅ Empleado creado correctamente');
      setModalCrear(false);
      resetForm();
      cargarEmpleados();
    } catch (error) {
      console.error('Error creando empleado:', error);
      alert('Error al crear empleado');
    }
  };

  const iniciarEdicion = (empleado) => {
    setEmpleadoEditando(empleado);
    setFormData({
      nombre: empleado.nombre,
      cedula: empleado.cedula,
      rol: empleado.rol,
      sueldo_mensual: empleado.sueldo_mensual,
      tipo_pago: empleado.tipo_pago
    });
    setModalEditar(true);
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/nomina/empleados/${empleadoEditando.id}`, formData);
      alert('✅ Empleado actualizado correctamente');
      setModalEditar(false);
      setEmpleadoEditando(null);
      resetForm();
      cargarEmpleados();
    } catch (error) {
      console.error('Error actualizando empleado:', error);
      alert('Error al actualizar empleado');
    }
  };

  const toggleEstado = async (empleado) => {
    const nuevoEstado = empleado.estado === 'activo' ? 'inactivo' : 'activo';
    const confirmar = window.confirm(
      `¿Está seguro de ${nuevoEstado === 'inactivo' ? 'INACTIVAR' : 'ACTIVAR'} a ${empleado.nombre}?`
    );
    
    if (confirmar) {
      try {
        await axios.put(`${API_URL}/nomina/empleados/${empleado.id}`, { estado: nuevoEstado });
        alert(`✅ Empleado ${nuevoEstado === 'inactivo' ? 'inactivado' : 'activado'} correctamente`);
        cargarEmpleados();
      } catch (error) {
        console.error('Error cambiando estado:', error);
        alert('Error al cambiar estado del empleado');
      }
    }
  };

  const eliminarEmpleado = async (empleado) => {
    const confirmar = window.confirm(
      `⚠️ ¿ELIMINAR PERMANENTEMENTE a ${empleado.nombre}?\n\nEsta acción NO se puede deshacer.`
    );
    
    if (confirmar) {
      try {
        await axios.delete(`${API_URL}/nomina/empleados/${empleado.id}`);
        alert('✅ Empleado eliminado correctamente');
        cargarEmpleados();
      } catch (error) {
        console.error('Error eliminando empleado:', error);
        alert('Error al eliminar empleado. Puede tener registros asociados.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      cedula: '',
      rol: '',
      sueldo_mensual: '',
      tipo_pago: 'quincenal'
    });
  };

  const empleadosFiltrados = empleados.filter(emp => {
    const coincideBusqueda = emp.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                            emp.cedula?.includes(busqueda);
    const coincideEstado = filtroEstado === 'todos' || emp.estado === filtroEstado;
    return coincideBusqueda && coincideEstado;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600 text-xl">Cargando empleados...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Empleados</h1>
          <p className="text-gray-500 mt-1">Gestión completa de empleados</p>
        </div>
        <button
          onClick={() => setModalCrear(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={20} />
          Nuevo Empleado
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre o cédula..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFiltroEstado('activo')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                filtroEstado === 'activo'
                  ? 'bg-green-100 text-green-700 border-2 border-green-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Activos ({empleados.filter(e => e.estado === 'activo').length})
            </button>
            <button
              onClick={() => setFiltroEstado('inactivo')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                filtroEstado === 'inactivo'
                  ? 'bg-red-100 text-red-700 border-2 border-red-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Inactivos ({empleados.filter(e => e.estado === 'inactivo').length})
            </button>
            <button
              onClick={() => setFiltroEstado('todos')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                filtroEstado === 'todos'
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos ({empleados.length})
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de empleados */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Empleado</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Cédula</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Rol</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Sueldo</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Tipo Pago</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Estado</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empleadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
                    No se encontraron empleados
                  </td>
                </tr>
              ) : (
                empleadosFiltrados.map((emp) => (
                  <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          emp.estado === 'activo' ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <User size={20} className={emp.estado === 'activo' ? 'text-blue-600' : 'text-gray-400'} />
                        </div>
                        <span className={`font-medium ${emp.estado === 'activo' ? 'text-gray-900' : 'text-gray-400'}`}>
                          {emp.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{emp.cedula || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                        {emp.rol}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-gray-900">
                      ${emp.sueldo_mensual?.toLocaleString('es-CO') || '0'}
                    </td>
                    <td className="py-3 px-4 text-gray-600 capitalize">{emp.tipo_pago}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        emp.estado === 'activo'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {emp.estado === 'activo' ? '✓ Activo' : '✗ Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => iniciarEdicion(emp)}
                          className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => toggleEstado(emp)}
                          className={`p-2 rounded-lg transition-colors ${
                            emp.estado === 'activo'
                              ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                              : 'bg-green-100 hover:bg-green-200 text-green-700'
                          }`}
                          title={emp.estado === 'activo' ? 'Inactivar' : 'Activar'}
                        >
                          {emp.estado === 'activo' ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                        <button
                          onClick={() => eliminarEmpleado(emp)}
                          className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear */}
      {modalCrear && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Nuevo Empleado</h2>
              <button onClick={() => { setModalCrear(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={crearEmpleado} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cédula</label>
                <input
                  type="text"
                  value={formData.cedula}
                  onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rol *</label>
                <input
                  type="text"
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Mesero, Cocinero, Cajero"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sueldo Mensual *</label>
                <input
                  type="number"
                  value={formData.sueldo_mensual}
                  onChange={(e) => setFormData({ ...formData, sueldo_mensual: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="1300000"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Pago *</label>
                <select
                  value={formData.tipo_pago}
                  onChange={(e) => setFormData({ ...formData, tipo_pago: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="quincenal">Quincenal</option>
                  <option value="semanal">Semanal</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Crear Empleado
                </button>
                <button
                  type="button"
                  onClick={() => { setModalCrear(false); resetForm(); }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {modalEditar && empleadoEditando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Editar Empleado</h2>
              <button onClick={() => { setModalEditar(false); setEmpleadoEditando(null); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={guardarEdicion} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cédula</label>
                <input
                  type="text"
                  value={formData.cedula}
                  onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rol *</label>
                <input
                  type="text"
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sueldo Mensual *</label>
                <input
                  type="number"
                  value={formData.sueldo_mensual}
                  onChange={(e) => setFormData({ ...formData, sueldo_mensual: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Pago *</label>
                <select
                  value={formData.tipo_pago}
                  onChange={(e) => setFormData({ ...formData, tipo_pago: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="quincenal">Quincenal</option>
                  <option value="semanal">Semanal</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Guardar Cambios
                </button>
                <button
                  type="button"
                  onClick={() => { setModalEditar(false); setEmpleadoEditando(null); resetForm(); }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
