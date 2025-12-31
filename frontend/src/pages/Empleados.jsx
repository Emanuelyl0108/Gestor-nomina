import React, { useState, useEffect } from 'react';
import { User, Edit2, Trash2, UserX, UserCheck, Plus, Search, X, Save, Link as LinkIcon, RefreshCw, DollarSign, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { apiRequest } from '../config/api';
import API_CONFIG from '../config/api';

export default function Empleados() {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('ACTIVO');
  
  // Modales
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalFudo, setModalFudo] = useState(false);
  const [modalSaldo, setModalSaldo] = useState(false);
  const [empleadoEditando, setEmpleadoEditando] = useState(null);
  const [empleadoFudo, setEmpleadoFudo] = useState(null);
  const [saldoEmpleado, setSaldoEmpleado] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  
  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    cedula: '',
    email: '',
    telefono: '',
    rol: '',
    sueldo_mensual: '',
    tipo_pago: 'quincenal'
  });

  useEffect(() => {
    cargarEmpleados();
  }, [filtroEstado]);

  const cargarEmpleados = async () => {
    try {
      let endpoint = API_CONFIG.ENDPOINTS.EMPLEADOS_TODOS;
      if (filtroEstado !== 'todos') {
        endpoint += `?estado=${filtroEstado}`;
      }
      const data = await apiRequest(endpoint);
      setEmpleados(data || []);
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
      await apiRequest(API_CONFIG.ENDPOINTS.EMPLEADOS, {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      alert('✅ Empleado creado correctamente');
      setModalCrear(false);
      resetForm();
      cargarEmpleados();
    } catch (error) {
      console.error('Error creando empleado:', error);
      alert('Error al crear empleado: ' + error.message);
    }
  };

  const iniciarEdicion = (empleado) => {
    setEmpleadoEditando(empleado);
    setFormData({
      nombre: empleado.nombre,
      cedula: empleado.cedula || '',
      email: empleado.email || '',
      telefono: empleado.telefono || '',
      rol: empleado.rol,
      sueldo_mensual: empleado.sueldo_mensual,
      tipo_pago: empleado.tipo_pago
    });
    setModalEditar(true);
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(API_CONFIG.ENDPOINTS.EMPLEADO(empleadoEditando.id), {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      alert('✅ Empleado actualizado correctamente');
      setModalEditar(false);
      setEmpleadoEditando(null);
      resetForm();
      cargarEmpleados();
    } catch (error) {
      console.error('Error actualizando empleado:', error);
      alert('Error al actualizar empleado: ' + error.message);
    }
  };

  const toggleEstado = async (empleado) => {
    const nuevoEstado = empleado.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    const confirmar = window.confirm(
      `¿Está seguro de ${nuevoEstado === 'INACTIVO' ? 'DESACTIVAR' : 'ACTIVAR'} a ${empleado.nombre}?`
    );
    
    if (confirmar) {
      try {
        const response = await apiRequest(API_CONFIG.ENDPOINTS.EMPLEADO_ESTADO(empleado.id), {
          method: 'PUT',
          body: JSON.stringify({ estado: nuevoEstado }),
        });
        
        if (response.bloqueado) {
          alert(`❌ ${response.error}`);
          return;
        }
        
        alert(`✅ Empleado ${nuevoEstado === 'INACTIVO' ? 'desactivado' : 'activado'} correctamente`);
        cargarEmpleados();
      } catch (error) {
        console.error('Error cambiando estado:', error);
        alert('Error al cambiar estado del empleado: ' + error.message);
      }
    }
  };

  const abrirGestionFudo = async (empleado) => {
    setEmpleadoFudo(empleado);
    setModalFudo(true);
  };

  const mapearUsuarioFudo = async () => {
    if (!empleadoFudo) return;
    
    setSincronizando(true);
    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.FUDO_MAPEAR_USUARIO(empleadoFudo.id), {
        method: 'POST',
      });
      
      if (response.success) {
        alert('✅ Usuario FUDO mapeado exitosamente');
        cargarEmpleados();
        setModalFudo(false);
      } else {
        alert(`❌ ${response.error}`);
      }
    } catch (error) {
      alert('Error mapeando usuario FUDO: ' + error.message);
    } finally {
      setSincronizando(false);
    }
  };

  const vincularCustomerFudo = async () => {
    if (!empleadoFudo) return;
    
    setSincronizando(true);
    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.FUDO_VINCULAR_CUSTOMER(empleadoFudo.id), {
        method: 'POST',
      });
      
      if (response.success) {
        alert('✅ Customer FUDO vinculado exitosamente');
        cargarEmpleados();
        setModalFudo(false);
      } else {
        alert(`❌ ${response.error}`);
      }
    } catch (error) {
      alert('Error vinculando customer FUDO: ' + error.message);
    } finally {
      setSincronizando(false);
    }
  };

  const sincronizarConsumos = async (empleadoId) => {
    setSincronizando(true);
    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.FUDO_SINCRONIZAR_CONSUMOS(empleadoId), {
        method: 'POST',
      });
      
      alert(`✅ Sincronización completada:\n${response.nuevos_consumos} consumos nuevos\n${response.nuevos_abonos} abonos nuevos\nSaldo: ${response.saldo_formateado}`);
    } catch (error) {
      alert('Error sincronizando consumos: ' + error.message);
    } finally {
      setSincronizando(false);
    }
  };

  const verSaldo = async (empleado) => {
    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.MOVIMIENTO_EMPLEADO(empleado.id));
      setSaldoEmpleado(response);
      setModalSaldo(true);
    } catch (error) {
      alert('Error obteniendo saldo: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      cedula: '',
      email: '',
      telefono: '',
      rol: '',
      sueldo_mensual: '',
      tipo_pago: 'quincenal'
    });
  };

  const empleadosFiltrados = empleados.filter(emp => {
    const coincideBusqueda = emp.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                            emp.cedula?.includes(busqueda);
    return coincideBusqueda;
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
          <p className="text-gray-500 mt-1">Gestión completa de empleados con integración FUDO</p>
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
              onClick={() => setFiltroEstado('ACTIVO')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                filtroEstado === 'ACTIVO'
                  ? 'bg-green-100 text-green-700 border-2 border-green-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Activos ({empleados.filter(e => e.estado === 'ACTIVO').length})
            </button>
            <button
              onClick={() => setFiltroEstado('INACTIVO')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                filtroEstado === 'INACTIVO'
                  ? 'bg-red-100 text-red-700 border-2 border-red-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Inactivos ({empleados.filter(e => e.estado === 'INACTIVO').length})
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
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Contacto</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Rol</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Sueldo</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">FUDO</th>
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
                          emp.estado === 'ACTIVO' ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <User size={20} className={emp.estado === 'ACTIVO' ? 'text-blue-600' : 'text-gray-400'} />
                        </div>
                        <div>
                          <span className={`font-medium block ${emp.estado === 'ACTIVO' ? 'text-gray-900' : 'text-gray-400'}`}>
                            {emp.nombre}
                          </span>
                          <span className="text-xs text-gray-500">{emp.cedula || 'Sin cédula'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <div className="text-gray-900">{emp.email || '-'}</div>
                      <div className="text-gray-500">{emp.telefono || '-'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                        {emp.rol}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-gray-900">
                      ${emp.sueldo_mensual?.toLocaleString('es-CO') || '0'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {emp.fudo_customer_id ? (
                          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                            <CheckCircle size={14} />
                            Vinculado
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                            <AlertCircle size={14} />
                            No vinculado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        emp.estado === 'ACTIVO'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {emp.estado === 'ACTIVO' ? '✓ Activo' : '✗ Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => verSaldo(emp)}
                          className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors"
                          title="Ver saldo"
                        >
                          <DollarSign size={16} />
                        </button>
                        <button
                          onClick={() => abrirGestionFudo(emp)}
                          className="p-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg transition-colors"
                          title="Gestionar FUDO"
                        >
                          <LinkIcon size={16} />
                        </button>
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
                            emp.estado === 'ACTIVO'
                              ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                              : 'bg-green-100 hover:bg-green-200 text-green-700'
                          }`}
                          title={emp.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                        >
                          {emp.estado === 'ACTIVO' ? <UserX size={16} /> : <UserCheck size={16} />}
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">Nuevo Empleado</h2>
              <button onClick={() => { setModalCrear(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={crearEmpleado} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre Completo *</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="empleado@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono</label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="3001234567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rol *</label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccionar rol</option>
                  <option value="Mesero">Mesero</option>
                  <option value="Cocinero">Cocinero</option>
                  <option value="Cajero">Cajero</option>
                  <option value="Administrador">Administrador</option>
                  <option value="Otro">Otro</option>
                </select>
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">Editar Empleado</h2>
              <button onClick={() => { setModalEditar(false); setEmpleadoEditando(null); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={guardarEdicion} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre Completo *</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono</label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rol *</label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccionar rol</option>
                  <option value="Mesero">Mesero</option>
                  <option value="Cocinero">Cocinero</option>
                  <option value="Cajero">Cajero</option>
                  <option value="Administrador">Administrador</option>
                  <option value="Otro">Otro</option>
                </select>
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

      {/* Modal FUDO */}
      {modalFudo && empleadoFudo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Gestión FUDO - {empleadoFudo.nombre}</h2>
              <button onClick={() => setModalFudo(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Estado de Integración</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Usuario FUDO:</span>
                    {empleadoFudo.fudo_user_id ? (
                      <span className="flex items-center gap-1 text-green-700 font-semibold">
                        <CheckCircle size={16} />
                        Mapeado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-500">
                        <AlertCircle size={16} />
                        No mapeado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Customer FUDO:</span>
                    {empleadoFudo.fudo_customer_id ? (
                      <span className="flex items-center gap-1 text-green-700 font-semibold">
                        <CheckCircle size={16} />
                        Vinculado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-500">
                        <AlertCircle size={16} />
                        No vinculado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {!empleadoFudo.fudo_user_id && empleadoFudo.email && (
                  <button
                    onClick={mapearUsuarioFudo}
                    disabled={sincronizando}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                  >
                    <LinkIcon size={18} />
                    {sincronizando ? 'Mapeando...' : 'Mapear Usuario FUDO'}
                  </button>
                )}

                {!empleadoFudo.fudo_customer_id && (
                  <button
                    onClick={vincularCustomerFudo}
                    disabled={sincronizando}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                  >
                    <LinkIcon size={18} />
                    {sincronizando ? 'Vinculando...' : 'Vincular Customer FUDO'}
                  </button>
                )}

                {empleadoFudo.fudo_customer_id && (
                  <button
                    onClick={() => sincronizarConsumos(empleadoFudo.id)}
                    disabled={sincronizando}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                  >
                    <RefreshCw size={18} />
                    {sincronizando ? 'Sincronizando...' : 'Sincronizar Consumos'}
                  </button>
                )}
              </div>

              {!empleadoFudo.email && !empleadoFudo.fudo_user_id && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Este empleado no tiene email registrado. El email es necesario para mapear el usuario FUDO.
                  </p>
                </div>
              )}

              <button
                onClick={() => setModalFudo(false)}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Saldo */}
      {modalSaldo && saldoEmpleado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">
                Saldo - {saldoEmpleado.empleado.nombre}
              </h2>
              <button onClick={() => setModalSaldo(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Resumen de Saldos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <p className="text-sm text-purple-600 font-medium mb-1">Cuenta Corriente</p>
                  <p className="text-2xl font-bold text-purple-900">
                    ${Math.abs(saldoEmpleado.resumen.cuenta_corriente.saldo).toLocaleString('es-CO')}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    {saldoEmpleado.resumen.cuenta_corriente.estado === 'debe' ? 'Debe' : 
                     saldoEmpleado.resumen.cuenta_corriente.estado === 'a_favor' ? 'A favor' : 'Sin deuda'}
                  </p>
                </div>

                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <p className="text-sm text-orange-600 font-medium mb-1">Adelantos</p>
                  <p className="text-2xl font-bold text-orange-900">
                    ${saldoEmpleado.resumen.adelantos.pendientes.toLocaleString('es-CO')}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    {saldoEmpleado.resumen.adelantos.estado === 'debe' ? 'Debe' : 'Sin deuda'}
                  </p>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-blue-600 font-medium mb-1">Saldo Total</p>
                  <p className="text-2xl font-bold text-blue-900">
                    ${Math.abs(saldoEmpleado.resumen.saldo_total.monto).toLocaleString('es-CO')}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    {saldoEmpleado.resumen.saldo_total.estado === 'debe' ? 'Debe' : 
                     saldoEmpleado.resumen.saldo_total.estado === 'a_favor' ? 'A favor' : 'Sin deuda'}
                  </p>
                </div>
              </div>

              {/* Histórico */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Histórico Completo</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-600 mb-1">Total Consumos</p>
                    <p className="text-lg font-bold text-gray-900">
                      ${saldoEmpleado.resumen.historico.total_consumos.toLocaleString('es-CO')}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-600 mb-1">Total Adelantos</p>
                    <p className="text-lg font-bold text-gray-900">
                      ${saldoEmpleado.resumen.historico.total_adelantos.toLocaleString('es-CO')}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-600 mb-1">Total Abonos</p>
                    <p className="text-lg font-bold text-green-600">
                      ${saldoEmpleado.resumen.historico.total_abonos.toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Últimos Movimientos */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">
                  Últimos 10 Movimientos
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {saldoEmpleado.movimientos.slice(0, 10).map((mov) => (
                    <div key={mov.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          mov.tipo === 'consumo' ? 'bg-purple-100' :
                          mov.tipo === 'adelanto' ? 'bg-orange-100' : 'bg-green-100'
                        }`}>
                          <span className="text-lg">
                            {mov.tipo === 'consumo' ? '🍽️' : mov.tipo === 'adelanto' ? '💵' : '💰'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 capitalize">{mov.tipo}</p>
                          <p className="text-xs text-gray-500">{mov.fecha}</p>
                          {mov.descripcion && (
                            <p className="text-xs text-gray-400 mt-1">{mov.descripcion}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${
                          mov.tipo === 'abono' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {mov.tipo === 'abono' ? '+' : '-'}${mov.monto.toLocaleString('es-CO')}
                        </p>
                        {mov.descontado && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            Descontado
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setModalSaldo(false)}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
