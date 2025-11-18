import React, { useState, useEffect } from 'react';
import { Gift, Plus, X } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://gestor-nomina-backend.onrender.com/api';

export default function Propinas() {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tipoRegistro, setTipoRegistro] = useState('propina'); // 'propina', 'bono', 'descuento'
  const [mostrarForm, setMostrarForm] = useState(false);
  
  const [formData, setFormData] = useState({
    tipo: 'individual',
    empleados_ids: [],
    monto: '',
    descripcion: '',
    es_division: false
  });

  useEffect(() => {
    cargarEmpleados();
  }, []);

  const cargarEmpleados = async () => {
    try {
      const response = await axios.get(`${API_URL}/nomina/empleados`);
      setEmpleados(response.data.filter(e => e.estado === 'activo'));
    } catch (error) {
      console.error('Error cargando empleados:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEmpleado = (id) => {
    setFormData(prev => ({
      ...prev,
      empleados_ids: prev.empleados_ids.includes(id)
        ? prev.empleados_ids.filter(empId => empId !== id)
        : [...prev.empleados_ids, id]
    }));
  };

  const seleccionarTodos = () => {
    setFormData(prev => ({
      ...prev,
      empleados_ids: empleados.map(emp => emp.id)
    }));
  };

  const limpiarSeleccion = () => {
    setFormData(prev => ({ ...prev, empleados_ids: [] }));
  };

  const registrar = async (e) => {
    e.preventDefault();

    if (formData.empleados_ids.length === 0 || !formData.monto) {
      alert('Complete todos los campos requeridos');
      return;
    }

    try {
      const endpoint = tipoRegistro === 'propina' 
        ? 'propinas' 
        : tipoRegistro === 'bono' 
          ? 'bonos' 
          : 'descuentos';

      await axios.post(`${API_URL}/nomina/${endpoint}`, formData);
      
      alert(`✅ ${tipoRegistro.charAt(0).toUpperCase() + tipoRegistro.slice(1)} registrada correctamente`);
      
      setMostrarForm(false);
      setFormData({
        tipo: 'individual',
        empleados_ids: [],
        monto: '',
        descripcion: '',
        es_division: false
      });
    } catch (error) {
      console.error(`Error registrando ${tipoRegistro}:`, error);
      alert(`Error al registrar ${tipoRegistro}`);
    }
  };

  const resetForm = () => {
    setFormData({
      tipo: 'individual',
      empleados_ids: [],
      monto: '',
      descripcion: '',
      es_division: false
    });
    setTipoRegistro('propina');
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Propinas, Bonos y Descuentos</h1>
          <p className="text-gray-500 mt-1">Gestión de ajustes a nómina</p>
        </div>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={20} />
          Registrar Ajuste
        </button>
      </div>

      {/* Cards informativos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <span className="text-2xl">💵</span>
          </div>
          <h3 className="font-bold text-gray-900 mb-2">Propinas</h3>
          <p className="text-sm text-gray-600">
            Dinero extra que se suma al pago del empleado (individual o colectiva)
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <span className="text-2xl">🎁</span>
          </div>
          <h3 className="font-bold text-gray-900 mb-2">Bonos</h3>
          <p className="text-sm text-gray-600">
            Reconocimientos por buen desempeño que se suman al pago
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="font-bold text-gray-900 mb-2">Descuentos</h3>
          <p className="text-sm text-gray-600">
            Deducciones que se restan del pago del empleado
          </p>
        </div>
      </div>

      {/* Formulario */}
      {mostrarForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Registrar Ajuste</h2>
            <button
              onClick={() => { setMostrarForm(false); resetForm(); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>
          
          <form onSubmit={registrar} className="space-y-6">
            {/* Tipo de registro */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Tipo de Ajuste *</label>
              <div className="grid grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setTipoRegistro('propina')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    tipoRegistro === 'propina'
                      ? 'bg-green-50 border-green-500 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2">💵</div>
                  <div className={`font-bold ${tipoRegistro === 'propina' ? 'text-green-700' : 'text-gray-700'}`}>
                    Propina
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTipoRegistro('bono')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    tipoRegistro === 'bono'
                      ? 'bg-blue-50 border-blue-500 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2">🎁</div>
                  <div className={`font-bold ${tipoRegistro === 'bono' ? 'text-blue-700' : 'text-gray-700'}`}>
                    Bono
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTipoRegistro('descuento')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    tipoRegistro === 'descuento'
                      ? 'bg-red-50 border-red-500 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2">⚠️</div>
                  <div className={`font-bold ${tipoRegistro === 'descuento' ? 'text-red-700' : 'text-gray-700'}`}>
                    Descuento
                  </div>
                </button>
              </div>
            </div>

            {/* Individual o Colectiva */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Aplicación *</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: 'individual' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.tipo === 'individual'
                      ? 'bg-purple-50 border-purple-500 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`font-bold ${formData.tipo === 'individual' ? 'text-purple-700' : 'text-gray-700'}`}>
                    Individual
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Monto por empleado</p>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: 'colectiva' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.tipo === 'colectiva'
                      ? 'bg-purple-50 border-purple-500 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`font-bold ${formData.tipo === 'colectiva' ? 'text-purple-700' : 'text-gray-700'}`}>
                    Colectiva
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Entre varios empleados</p>
                </button>
              </div>
            </div>

            {/* Si es colectiva, preguntar si dividir */}
            {formData.tipo === 'colectiva' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.es_division}
                    onChange={(e) => setFormData({ ...formData, es_division: e.target.checked })}
                    className="w-5 h-5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Dividir el monto entre los empleados seleccionados</span>
                    <p className="text-sm text-gray-600 mt-1">
                      {formData.es_division 
                        ? '✓ El monto se dividirá equitativamente entre todos' 
                        : '✗ Cada empleado recibirá el monto completo'}
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Selección de empleados */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-gray-700">
                  Empleados * 
                  <span className="text-blue-600 ml-2">({formData.empleados_ids.length} seleccionados)</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={seleccionarTodos}
                    className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded font-medium transition-colors"
                  >
                    Seleccionar Todos
                  </button>
                  <button
                    type="button"
                    onClick={limpiarSeleccion}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded font-medium transition-colors"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto bg-gray-50 p-4 rounded-lg border border-gray-200">
                {empleados.map((emp) => (
                  <label
                    key={emp.id}
                    className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
                      formData.empleados_ids.includes(emp.id)
                        ? 'bg-blue-100 border-2 border-blue-500 shadow-sm'
                        : 'bg-white border border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.empleados_ids.includes(emp.id)}
                      onChange={() => toggleEmpleado(emp.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className={`text-sm font-medium ${
                      formData.empleados_ids.includes(emp.id) ? 'text-blue-900' : 'text-gray-700'
                    }`}>
                      {emp.nombre}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Monto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Monto *</label>
              <input
                type="number"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="40000"
                required
              />
              {formData.es_division && formData.empleados_ids.length > 0 && formData.monto > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  Cada empleado recibirá: <strong>${(formData.monto / formData.empleados_ids.length).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</strong>
                </p>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Motivo del ajuste (opcional)"
                rows="3"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Registrar {tipoRegistro.charAt(0).toUpperCase() + tipoRegistro.slice(1)}
              </button>
              <button
                type="button"
                onClick={() => { setMostrarForm(false); resetForm(); }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Información adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Gift className="text-blue-600 flex-shrink-0 mt-1" size={24} />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Información Importante</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Las propinas, bonos y descuentos se aplicarán automáticamente en el próximo cálculo de nómina</li>
              <li>• Los ajustes individuales aplican el monto completo a cada empleado seleccionado</li>
              <li>• Los ajustes colectivos con división reparten el monto entre todos los seleccionados</li>
              <li>• Una vez aplicados en una nómina, no se pueden modificar</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
