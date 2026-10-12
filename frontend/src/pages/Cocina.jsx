import { useEffect, useState, useCallback } from 'react';
import { ChefHat, Check, Flame } from 'lucide-react';
import { getPedidos, cambiarEstado } from '../services/pedidoService';

const hace = (iso) => {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 60000));
  return min < 1 ? 'ahora' : `hace ${min} min`;
};

export default function Cocina() {
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState('');
  const [, setTick] = useState(0);

  const cargar = useCallback(async () => {
    try {
      setPedidos(await getPedidos('pendiente,en_preparacion'));
      setError('');
    } catch {
      setError('Sin conexión, reintentando…');
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(() => { cargar(); setTick(t => t + 1); }, 3000);
    return () => clearInterval(id);
  }, [cargar]);

  const mover = async (id, estado) => {
    try {
      await cambiarEstado(id, estado);
      cargar();
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo cambiar el estado');
      cargar();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ChefHat className="text-mostaza-600" />
        <h1 className="font-display text-2xl text-pizarra-950">Cocina</h1>
        <span className="text-sm text-pizarra-900/60">({pedidos.length})</span>
      </div>
      {error && <p className="text-terracota-600 text-sm">{error}</p>}

      {pedidos.length === 0 && (
        <p className="text-pizarra-900/60">No hay pedidos pendientes.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pedidos.map(p => (
          <div
            key={p.id}
            className={`bg-papel-card rounded-2xl shadow-sm border p-5 space-y-3 ${
              p.estado === 'en_preparacion' ? 'border-mostaza-500' : 'border-pizarra-900/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-xl">Mesa {p.mesa}</p>
              <span className="text-xs text-pizarra-900/60">{hace(p.creado_en)}</span>
            </div>

            <ul className="space-y-1">
              {p.items.map((it, i) => (
                <li key={i}>
                  <span className="font-semibold">{it.cantidad}×</span> {it.producto_nombre}
                  {it.nota && <span className="block text-sm text-terracota-600">↳ {it.nota}</span>}
                </li>
              ))}
            </ul>

            {p.notas && <p className="text-sm italic text-pizarra-900/70">“{p.notas}”</p>}

            <div className="flex gap-2 pt-1">
              {p.estado === 'pendiente' && (
                <button
                  onClick={() => mover(p.id, 'en_preparacion')}
                  className="flex-1 flex items-center justify-center gap-2 border border-mostaza-500 rounded-xl py-3 font-medium"
                >
                  <Flame size={18} /> Preparar
                </button>
              )}
              <button
                onClick={() => mover(p.id, 'listo')}
                className="flex-1 flex items-center justify-center gap-2 bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950 rounded-xl py-3 font-semibold"
              >
                <Check size={18} /> Listo
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}