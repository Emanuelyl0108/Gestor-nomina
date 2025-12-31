import React, { useState, useEffect } from 'react';
import { Users, DollarSign, Clock, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { apiRequest } from '../config/api';
import API_CONFIG from '../config/api';

export default function Dashboard() {
  const [empleados, setEmpleados] = useState([]);
  const [movimientosPendientes, setMovimientosPendientes] = useState([]);
  const [nominasPendientes, setNominasPendientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setError(null);
      
      const [empleadosData, movimientosData, nominasData] = await Promise.all([
        apiRequest(API_CONFIG.ENDPOINTS.EMPLEADOS),
        apiRequest(API_CONFIG.ENDPOINTS.MOVIMIENTOS_PENDIENTES),
        apiRequest(API_CONFIG.ENDPOINTS.NOMINAS_LISTAR + '?pagada=false&limit=10'),
      ]);

      setEmpleados(empleadosData || []);
      setMovimientosPendientes(movimientosData || []);
      setNominasPendientes(nominasData?.nominas || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setError('Error al cargar los datos. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const sincronizarAhora = async () => {
    if (!window.confirm('¿Ejecutar sincronización completa con FUDO ahora?')) return;

    setSincronizando(true);
    try {
      const response = await apiRequest(API_CONFIG.ENDPOINTS.FUDO_SINCRONIZAR_AHORA, {
        method: 'POST'
      });

      alert(`✅ Sincronización completada\n\nEmpleados procesados: ${response.empleados_procesados}\nConsumos nuevos: ${response.consumos_nuevos}\nAdelantos nuevos: ${response.adelantos_nuevos}`);
      
      await cargarDatos();
    } catch (error) {
      alert('Error en sincronización: ' + error.message);
    } finally {
      setSincronizando(false);
    }
  };

  const empleadosActivos = empleados.filter(e => e.estado === 'ACTIVO').length;
  const totalMovimientosPendientes = movimientosPendientes.reduce((sum, m) => sum + (m.monto || 0), 0);
  const totalNominasPendientes = nominasPendientes.reduce((sum, n) => sum + (n.montos?.total_pagar || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600 text-xl">Cargando datos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <div className="text-red-600 text-xl mb-2">{error}</div>
          <button
            onClick={cargarDatos}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Resumen general del sistema de nómina</p>
        </div>
        <button
          onClick={sincronizarAhora}
          disabled={sincronizando}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          <RefreshCw size={20} className={sincronizando ? 'animate-spin' : ''} />
          {sincronizando ? 'Sincronizando...' : 'Sincronizar FUDO'}
        </button>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Empleados Activos */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="text-blue-600" size={24} />
            </div>
            <span className="text-3xl font-bold text-gray-900">{empleadosActivos}</span>
          </div>
          <p className="text-sm text-gray-600 font-medium">Empleados Activos</p>
          <p className="text-xs text-gray-400 mt-1">De {empleados.length} totales</p>
        </div>

        {/* Movimientos Pendientes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="text-orange-600" size={24} />
            </div>
            <span className="text-3xl font-bold text-gray-900">{movimientosPendientes.length}</span>
          </div>
          <p className="text-sm text-gray-600 font-medium">Movimientos Pendientes</p>
          <p className="text-xs text-orange-600 mt-1 font-semibold">
            ${totalMovimientosPendientes.toLocaleString('es-CO')}
          </p>
        </div>

        {/* Nóminas Pendientes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Clock className="text-purple-600" size={24} />
            </div>
            <span className="text-3xl font-bold text-gray-900">{nominasPendientes.length}</span>
          </div>
          <p className="text-sm text-gray-600 font-medium">Nóminas Pendientes</p>
          <p className="text-xs text-gray-400 mt-1">Por procesar</p>
        </div>

        {/* Total a Pagar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <span className="text-3xl font-bold text-gray-900">
              ${(totalNominasPendientes / 1000000).toFixed(1)}M
            </span>
          </div>
          <p className="text-sm text-gray-600 font-medium">Total a Pagar</p>
          <p className="text-xs text-green-600 mt-1 font-semibold">
            ${totalNominasPendientes.toLocaleString('es-CO')}
          </p>
        </div>
      </div>

      {/* Movimientos Recientes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Movimientos Pendientes Recientes</h2>
          {movimientosPendientes.length > 0 && (
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
              {movimientosPendientes.length} pendientes
            </span>
          )}
        </div>
        
        {movimientosPendientes.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
            <p className="text-gray-500">No hay movimientos pendientes</p>
            <p className="text-sm text-gray-400 mt-1">Todos los movimientos están al día</p>
          </div>
        ) : (
          <div className="space-y-3">
            {movimientosPendientes.slice(0, 10).map((mov) => (
              <div
                key={mov.id}
                className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    mov.tipo === 'adelanto' ? 'bg-yellow-100' : mov.tipo === 'consumo' ? 'bg-blue-100' : 'bg-green-100'
                  }`}>
                    <span className="text-2xl">
                      {mov.tipo === 'adelanto' ? '💰' : mov.tipo === 'consumo' ? '🍽️' : '💵'}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{mov.empleado_nombre}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        mov.tipo === 'adelanto' 
                          ? 'bg-yellow-100 text-yellow-700' 
                          : mov.tipo === 'consumo'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {mov.tipo}
                      </span>
                      <span className="text-sm text-gray-500">{mov.fecha}</span>
                    </div>
                    {mov.descripcion && (
                      <p className="text-xs text-gray-500 mt-1">{mov.descripcion}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-red-600">
                    {mov.tipo === 'abono' ? '+' : '-'}${mov.monto.toLocaleString('es-CO')}
                  </p>
                  <span className="text-xs text-gray-500">Por descontar</span>
                </div>
              </div>
            ))}
            {movimientosPendientes.length > 10 && (
              <p className="text-center text-sm text-gray-500 pt-2">
                Y {movimientosPendientes.length - 10} movimientos más...
              </p>
            )}
          </div>
        )}
      </div>

      {/* Nóminas Pendientes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Nóminas por Pagar</h2>
          {nominasPendientes.length > 0 && (
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
              {nominasPendientes.length} pendientes
            </span>
          )}
        </div>
        
        {nominasPendientes.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
            <p className="text-gray-500">No hay nóminas pendientes</p>
            <p className="text-sm text-gray-400 mt-1">Todas las nóminas están pagadas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {nominasPendientes.map((nomina) => (
              <div
                key={nomina.id}
                className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-all"
              >
                <div>
                  <p className="font-semibold text-gray-900">{nomina.empleado.nombre}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {nomina.periodo.inicio} → {nomina.periodo.fin} ({nomina.dias_trabajados} días)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-green-600">
                    ${nomina.montos.total_pagar.toLocaleString('es-CO')}
                  </p>
                  <span className="text-xs text-gray-500">Total a pagar</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alertas y Recordatorios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Alerta de Movimientos */}
        {movimientosPendientes.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-orange-600 flex-shrink-0 mt-1" size={24} />
              <div>
                <h3 className="font-semibold text-orange-900 mb-2">Movimientos por descontar</h3>
                <p className="text-sm text-orange-700">
                  Hay <strong>{movimientosPendientes.length} movimientos</strong> pendientes por un total de{' '}
                  <strong>${totalMovimientosPendientes.toLocaleString('es-CO')}</strong> que se descontarán en la próxima nómina.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info de Nóminas */}
        {nominasPendientes.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Clock className="text-blue-600 flex-shrink-0 mt-1" size={24} />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Nóminas pendientes</h3>
                <p className="text-sm text-blue-700">
                  Tienes <strong>{nominasPendientes.length} nóminas</strong> calculadas y listas para pagar por un total de{' '}
                  <strong>${totalNominasPendientes.toLocaleString('es-CO')}</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Todo al día */}
        {movimientosPendientes.length === 0 && nominasPendientes.length === 0 && (
          <div className="md:col-span-2 bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-3 justify-center">
              <CheckCircle className="text-green-600" size={32} />
              <div>
                <h3 className="font-semibold text-green-900">¡Todo al día!</h3>
                <p className="text-sm text-green-700 mt-1">
                  No hay movimientos ni nóminas pendientes. El sistema está actualizado.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
