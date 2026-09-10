import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Resumen' },
  { to: '/insumos', label: 'Insumos' },
  { to: '/proveedores', label: 'Proveedores' },
  { to: '/categorias-gasto', label: 'Categorías de gasto' },
  { to: '/compras', label: 'Compras' },
  { to: '/productos', label: 'Productos' },
  { to: '/ventas', label: 'Ventas' },
  { to: '/rendimientos', label: 'Rendimientos' },
];

function DashboardLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-papel flex">
      {/* Sidebar */}
      <aside className="w-60 bg-pizarra-950 text-papel flex flex-col shrink-0">
        <div className="px-6 py-6 border-b border-papel/10">
          <h1 className="font-display text-xl font-bold">Restaurante El Costillo</h1>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-mostaza-500 text-pizarra-950'
                    : 'text-papel/70 hover:bg-papel/10 hover:text-papel'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-papel/10">
          <p className="text-sm text-papel/70 truncate">{user?.name}</p>
          <button
            onClick={logout}
            className="text-sm text-terracota-500 hover:text-terracota-600 font-medium mt-1"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido de la página actual */}
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;