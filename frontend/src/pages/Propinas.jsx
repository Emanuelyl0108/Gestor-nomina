import React from 'react';
import { Gift, AlertCircle } from 'lucide-react';

export default function Propinas() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Propinas y Bonos</h1>
        <p className="text-gray-500 mt-1">Gestión de ajustes a nómina</p>
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

      {/* Información adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-blue-600 flex-shrink-0 mt-1" size={24} />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Cómo registrar ajustes</h3>
            <div className="text-sm text-blue-700 space-y-2">
              <p>
                <strong>Al Crear Nómina:</strong> Los campos de propinas, bonos y descuentos se pueden ingresar directamente al crear cada nómina en la sección "Calcular Nómina".
              </p>
              <p>
                <strong>Editar Nómina Existente:</strong> Si ya creaste una nómina, puedes actualizar los ajustes usando el botón de edición en la lista de nóminas pendientes.
              </p>
              <p className="mt-3 font-semibold">
                ✨ Próximamente: Sistema de registro masivo de propinas y bonos colectivos.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Instrucciones de Uso</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>Ve a la sección "Calcular Nómina"</li>
          <li>Al crear una nueva nómina, ingresa los valores de propinas, bonos o descuentos</li>
          <li>El sistema calculará automáticamente el total a pagar incluyendo estos ajustes</li>
          <li>Si necesitas modificar los ajustes de una nómina ya creada, usa el botón de edición (✏️) en la lista de nóminas</li>
        </ol>
      </div>
    </div>
  );
}
