import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Truck,
  Tags,
  ShoppingCart,
  UtensilsCrossed,
  Receipt,
  LogOut,
  ChefHat,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { to: '/insumos', label: 'Insumos', icon: Package },
  { to: '/proveedores', label: 'Proveedores', icon: Truck },
  { to: '/categorias-gasto', label: 'Categorías de gasto', icon: Tags },
  { to: '/compras', label: 'Compras', icon: ShoppingCart },
  { to: '/productos', label: 'Productos', icon: UtensilsCrossed },
  { to: '/ventas', label: 'Ventas', icon: Receipt },
];

function DashboardLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-papel flex">
      <aside className="w-64 bg-pizarra-950 text-papel flex flex-col shrink-0 relative overflow-hidden">
        {/* Textura sutil de fondo */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="px-6 py-6 border-b border-papel/10 flex items-center gap-3 relative">
          <div className="w-9 h-9 rounded-xl bg-mostaza-500 flex items-center justify-center shrink-0">
            <ChefHat size={20} className="text-pizarra-950" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-lg font-bold leading-tight">
            Gestión<br />Restaurante
          </h1>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 relative">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-mostaza-500 text-pizarra-950 shadow-sm'
                      : 'text-papel/65 hover:bg-papel/10 hover:text-papel'
                  }`
                }
              >
                <Icon size={18} strokeWidth={2} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-papel/10 relative">
          <div className="flex items-center gap-2.5 px-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-papel/10 flex items-center justify-center text-sm font-semibold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <p className="text-sm text-papel/80 truncate font-medium">{user?.name}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium text-terracota-500 hover:bg-terracota-500/10 hover:text-terracota-400 transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;