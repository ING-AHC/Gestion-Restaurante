import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import RutaRol from './components/RutaRol';
import DashboardLayout from './layouts/DashboardLayout';
import Insumos from './pages/Insumos';
import Proveedores from './pages/Proveedores';

import Compras from './pages/Compras';
import Productos from './pages/Productos';
import Ventas from './pages/Ventas';
import Rendimientos from './pages/Rendimientos';
import Pedidos from './pages/Pedidos';
import Cocina from './pages/Cocina';
import Caja from './pages/Caja';
import Personal from './pages/Personal';
import MenuDia from './pages/MenuDia';
const SoloAdmin = ({ children }) => <RutaRol roles={['admin']}>{children}</RutaRol>;

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
          <Route path="/dashboard" element={<SoloAdmin><Dashboard /></SoloAdmin>} />
          <Route path="/insumos" element={<SoloAdmin><Insumos /></SoloAdmin>} />
          <Route path="/proveedores" element={<SoloAdmin><Proveedores /></SoloAdmin>} />
          <Route path="/compras" element={<SoloAdmin><Compras /></SoloAdmin>} />
          <Route path="/productos" element={<SoloAdmin><Productos /></SoloAdmin>} />
          <Route path="/ventas" element={<SoloAdmin><Ventas /></SoloAdmin>} />
          <Route path="/rendimientos" element={<SoloAdmin><Rendimientos /></SoloAdmin>} />
          <Route path="/personal" element={<SoloAdmin><Personal /></SoloAdmin>} />
                    <Route path="/menu-del-dia" element={<SoloAdmin><MenuDia /></SoloAdmin>} />
          <Route
            path="/pedidos"
            element={<RutaRol roles={['admin', 'mesero', 'caja']}><Pedidos /></RutaRol>}
          />
          <Route
            path="/cocina"
            element={<RutaRol roles={['admin', 'cocina']}><Cocina /></RutaRol>}
          />
          <Route
            path="/caja"
            element={<RutaRol roles={['admin', 'caja']}><Caja /></RutaRol>}
          />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;