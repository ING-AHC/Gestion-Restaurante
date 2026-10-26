import { useEffect, useMemo, useState, useCallback } from 'react';
import { getMenuAdmin, updateMenuItem, reiniciarMenu } from '../services/menuService';

const TITULOS = {
  ejecutivo: 'Ejecutivos',
  sopa: 'Sopas',
  principio: 'Principios',
  especial: 'Especiales',
  rapida: 'Comidas rápidas',
  bebida: 'Bebidas',
};
const ORDEN = ['ejecutivo', 'sopa', 'principio', 'especial', 'rapida', 'bebida'];

const titulo = (tipo) => TITULOS[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1);
const cop = (n) => `$${Number(n).toLocaleString('es-CO')}`;

function Interruptor({ activo, onChange, etiqueta }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={`Disponible hoy: ${etiqueta}`}
      onClick={onChange}
      className={`shrink-0 w-14 h-8 rounded-full p-[3px] flex items-center transition-colors ${
        activo ? 'bg-mostaza-500 justify-end' : 'bg-pizarra-900/30 justify-start'
      }`}
    >
      <span className="block w-[26px] h-[26px] rounded-full bg-white" />
    </button>
  );
}

export default function MenuDia() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      setItems(await getMenuAdmin());
    } catch {
      setError('No se pudo cargar el menú');
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async (item, cambios) => {
    setError('');
    // Se muestra el cambio al instante y se corrige si el servidor lo rechaza
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, ...cambios } : x)));
    try {
      const actualizado = await updateMenuItem(item.id, cambios);
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, ...actualizado } : x)));
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo guardar el cambio');
      cargar();
    }
  };

  const activarTodo = async (valor) => {
    setError('');
    try {
      await reiniciarMenu(valor);
      cargar();
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo actualizar el menú');
    }
  };

  const secciones = useMemo(() => {
    const tipos = [...new Set(items.map((i) => i.tipo))].sort((a, b) => {
      const ia = ORDEN.indexOf(a) === -1 ? 99 : ORDEN.indexOf(a);
      const ib = ORDEN.indexOf(b) === -1 ? 99 : ORDEN.indexOf(b);
      return ia - ib;
    });
    return tipos.map((t) => ({
      clave: t,
      titulo: titulo(t),
      items: items.filter((i) => i.tipo === t),
    }));
  }, [items]);

  const totalOn = items.filter((i) => i.disponible_hoy).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-pizarra-950">Menú del día</h1>
          <p className="text-sm text-pizarra-900/70">
            Activa lo que hay hoy. El mesero solo ve lo activo.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => activarTodo(true)}
            className="min-h-[44px] px-4 rounded-lg border border-pizarra-900/25 bg-papel-card text-sm font-medium"
          >
            Activar todo
          </button>
          <button
            onClick={() => activarTodo(false)}
            className="min-h-[44px] px-4 rounded-lg border border-pizarra-900/25 bg-papel-card text-sm font-medium"
          >
            Apagar todo
          </button>
        </div>
      </div>

      {/* Regla general de la sopa en los ejecutivos */}
      <div className="bg-papel-card rounded-2xl border border-pizarra-900/10 p-4 space-y-1">
        <p className="font-semibold">Sopa en los ejecutivos</p>
        <p className="text-sm text-pizarra-900/70">
          Todos los ejecutivos incluyen sopa y principio. El mesero escoge entre las sopas y
          principios activos hoy. Si el cliente no lleva sopa, se descuentan $1.000.
        </p>
      </div>

      {error && <p className="text-terracota-600 text-sm">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] items-start">
        <div className="space-y-5 min-w-0">
          {items.length === 0 && (
            <p className="text-pizarra-900/60">
              Todavía no hay productos. Créalos primero en la sección Productos.
            </p>
          )}
          {secciones.map((sec) => (
            <section key={sec.clave} className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-pizarra-900/70">
                {sec.titulo} · {sec.items.filter((i) => i.disponible_hoy).length} de{' '}
                {sec.items.length} activos
              </h2>
              {sec.items.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-2xl border flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${
                    item.disponible_hoy
                      ? 'bg-papel-card border-pizarra-900/15'
                      : 'bg-pizarra-900/[0.06] border-pizarra-900/10'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{item.nombre}</p>
                    <p className="text-sm text-pizarra-900/70">
                      {cop(item.precio)}
                      {item.incluye_sopa && ' · incluye sopa y principio'}
                    </p>
                  </div>
                  <Interruptor
                    activo={item.disponible_hoy}
                    etiqueta={item.nombre}
                    onChange={() => guardar(item, { disponible_hoy: !item.disponible_hoy })}
                  />
                </div>
              ))}
            </section>
          ))}
        </div>

        <aside className="bg-pizarra-950 text-papel rounded-2xl p-5 space-y-3 lg:sticky lg:top-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-papel/70">Vista del mesero</p>
            <p className="font-display text-xl mt-1">
              Hoy hay {totalOn} de {items.length}
            </p>
          </div>
          {secciones.map((sec) => {
            const activos = sec.items.filter((i) => i.disponible_hoy);
            return (
              <div key={sec.clave}>
                <p className="text-xs font-semibold text-mostaza-500 mb-1">{sec.titulo}</p>
                {activos.length === 0 ? (
                  <p className="text-sm text-papel/70">Nada activo</p>
                ) : (
                  <ul className="list-disc pl-5 text-sm leading-relaxed">
                    {activos.map((i) => (
                      <li key={i.id}>{i.nombre}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </aside>
      </div>
    </div>
  );
}