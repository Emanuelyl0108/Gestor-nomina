import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Empleados from './pages/Empleados';
import Movimientos from './pages/Movimientos';
import CalcularNomina from './pages/CalcularNomina';
import Propinas from './pages/Propinas';
import Reportes from './pages/Reportes';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/empleados" element={<Empleados />} />
            <Route path="/movimientos" element={<Movimientos />} />
            <Route path="/calcular-nomina" element={<CalcularNomina />} />
            <Route path="/propinas" element={<Propinas />} />
            <Route path="/reportes" element={<Reportes />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
