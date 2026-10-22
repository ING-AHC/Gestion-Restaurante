import { useState } from 'react';
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
  ClipboardList,
  Flame,
  Wallet,
  Users,
  CalendarCheck,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ETIQUETA_ROL } from '../utils/roles';

const navItems = [
  { to: '/dashboard', label: 'Resumen', icon: LayoutDashboard, roles: ['admin'] },
  { to: '/menu-del-dia', label: 'Menú del día', icon: CalendarCheck, roles: ['admin'] },
  { to: '/pedidos', label: 'Pedidos', icon: ClipboardList, roles: ['admin', 'mesero', 'caja'] },
  { to: '/cocina', label: 'Cocina', icon: Flame, roles: ['admin', 'cocina'] },
  { to: '/caja', label: 'Caja', icon: Wallet, roles: ['admin', 'caja'] },
  { to: '/insumos', label: 'Insumos', icon: Package, roles: ['admin'] },
  { to: '/proveedores', label: 'Proveedores', icon: Truck, roles: ['admin'] },
  { to: '/categorias-gasto', label: 'Categorías de gasto', icon: Tags, roles: ['admin'] },
  { to: '/compras', label: 'Compras', icon: ShoppingCart, roles: ['admin'] },
  { to: '/productos', label: 'Productos', icon: UtensilsCrossed, roles: ['admin'] },
  { to: '/ventas', label: 'Ventas', icon: Receipt, roles: ['admin'] },
  { to: '/personal', label: 'Personal', icon: Users, roles: ['admin'] },
];

function DashboardLayout() {
  const { user, logout } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const rol = user?.rol || 'admin';
  const items = navItems.filter((item) => item.roles.includes(rol));

  return (
    <div className="min-h-screen bg-papel md:flex">
      {/* Barra superior (solo celular) */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-pizarra-950 text-papel px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-mostaza-500 flex items-center justify-center">
            <ChefHat size={18} className="text-pizarra-950" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold">Gestión Restaurante</span>
        </div>
        <button onClick={() => setAbierto(true)} aria-label="Abrir menú" className="p-1">
          <Menu size={24} />
        </button>
      </header>

      {abierto && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setAbierto(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-pizarra-950 text-papel flex flex-col shrink-0 overflow-hidden transition-transform duration-200 md:relative md:translate-x-0 md:z-auto ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Textura sutil de fondo */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="px-6 py-6 border-b border-papel/10 flex items-center gap-3 relative">
          <div className="w-9 h-9 rounded-xl bg-mostaza-500 flex items-center justify-center shrink-0">
            <ChefHat size={20} className="text-pizarra-950" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-lg font-bold leading-tight flex-1">
            Gestión<br />Restaurante
          </h1>
          <button
            onClick={() => setAbierto(false)}
            aria-label="Cerrar menú"
            className="md:hidden p-1 text-papel/70"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 relative overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setAbierto(false)}
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
            <div className="min-w-0">
              <p className="text-sm text-papel/80 truncate font-medium">{user?.name}</p>
              <p className="text-xs text-papel/50">{ETIQUETA_ROL[rol]}</p>
            </div>
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

      <main className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;