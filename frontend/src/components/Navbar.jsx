import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, DollarSign, Calculator, Gift, FileText } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/empleados', icon: Users, label: 'Empleados' },
    { path: '/movimientos', icon: DollarSign, label: 'Movimientos' },
    { path: '/calcular-nomina', icon: Calculator, label: 'Calcular Nómina' },
    { path: '/propinas', icon: Gift, label: 'Propinas/Bonos' },
    { path: '/reportes', icon: FileText, label: 'Reportes' },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xl font-bold">E</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Enruanados Gourmet</h1>
              <p className="text-xs text-gray-500">Sistema de Nómina</p>
            </div>
          </div>

          <div className="flex space-x-1">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                  isActive(path)
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
