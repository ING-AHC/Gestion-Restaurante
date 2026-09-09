import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import DashboardLayout from './layouts/DashboardLayout';
import Insumos from './pages/Insumos';
import Proveedores from './pages/Proveedores';
import CategoriasGasto from './pages/CategoriasGasto';
import Compras from './pages/Compras';
import Platos from './pages/Platos';
import Ventas from './pages/Ventas';
import Rendimientos from './pages/Rendimientos';
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/insumos" element={<Insumos />} />
          <Route path="/proveedores" element={<Proveedores />} />
<Route path="/categorias-gasto" element={<CategoriasGasto />} />
<Route path="/compras" element={<Compras />} />
<Route path="/platos" element={<Platos />} />
<Route path="/ventas" element={<Ventas />} />
<Route path="/rendimientos" element={<Rendimientos />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;