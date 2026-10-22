import { useEffect, useMemo, useState, useCallback } from 'react';
import { getMenuAdmin, updateMenuItem, reiniciarMenu } from '../services/menuService';

const TITULOS = {
  ejecutivo: 'Ejecutivos',
  especial: 'Especiales',
  rapida: 'Comidas rápidas',
  bebida: 'Bebidas',
};
const ORDEN = ['ejecutivo', 'especial', 'rapida', 'bebida'];

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

function Ajustes({ item, guardar }) {
  const [descuento, setDescuento] = useState(String(Number(item.descuento_sin_sopa)));

  return (
    <div className="border-t border-pizarra-900/10 px-4 py-3 bg-pizarra-900/[0.03] space-y-2 text-sm">
      <label className="flex items-center gap-3 min-h-[44px]">
        <input
          type="checkbox"
          className="w-5 h-5"
          checked={item.incluye_sopa}
          disabled={item.es_sopa}
          onChange={(e) => guardar({ incluye_sopa: e.target.checked })}
        />
        Este plato incluye sopa (el mesero la escoge)
      </label>
      <label className="flex items-center gap-3 min-h-[44px]">
        <input
          type="checkbox"
          className="w-5 h-5"
          checked={item.es_sopa}
          disabled={item.incluye_sopa}
          onChange={(e) => guardar({ es_sopa: e.target.checked })}
        />
        Este producto es una sopa (se ofrece dentro de los platos que incluyen sopa)
      </label>
      {item.incluye_sopa && (
        <div className="flex items-center gap-2 flex-wrap">
          <span>Descuento si no lleva sopa: $</span>
          <input
            type="number"
            min="0"
            step="100"
            value={descuento}
            onChange={(e) => setDescuento(e.target.value)}
            className="w-28 px-3 py-2 rounded-lg border border-pizarra-900/20 bg-white"
          />
          <button
            type="button"
            onClick={() => guardar({ descuento_sin_sopa: Number(descuento) || 0 })}
            className="min-h-[44px] px-4 rounded-lg border border-pizarra-900/25 font-medium"
          >
            Guardar
          </button>
        </div>
      )}
    </div>
  );
}

export default function MenuDia() {
  const [items, setItems] = useState([]);
  const [abierto, setAbierto] = useState(null);
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
    const sopas = items.filter((i) => i.es_sopa);
    const resto = items.filter((i) => !i.es_sopa);
    const tipos = [...new Set(resto.map((i) => i.tipo))].sort((a, b) => {
      const ia = ORDEN.indexOf(a) === -1 ? 99 : ORDEN.indexOf(a);
      const ib = ORDEN.indexOf(b) === -1 ? 99 : ORDEN.indexOf(b);
      return ia - ib;
    });
    const lista = tipos.map((t) => ({ clave: t, titulo: titulo(t), items: resto.filter((i) => i.tipo === t) }));
    if (sopas.length > 0) {
      const pos = lista.findIndex((s) => s.clave === 'ejecutivo') + 1;
      lista.splice(pos, 0, { clave: 'sopas', titulo: 'Sopas del día', items: sopas });
    }
    return lista;
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
                {sec.titulo} · {sec.items.filter((i) => i.disponible_hoy).length} de {sec.items.length} activos
              </h2>
              {sec.items.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-2xl border overflow-hidden ${
                    item.disponible_hoy
                      ? 'bg-papel-card border-pizarra-900/15'
                      : 'bg-pizarra-900/[0.06] border-pizarra-900/10'
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{item.nombre}</p>
                      <p className="text-sm text-pizarra-900/70">
                        {cop(item.precio)}
                        {item.incluye_sopa && ' · incluye sopa'}
                        {item.es_sopa && ' · también se vende sola'}
                      </p>
                    </div>
                    <button
                      onClick={() => setAbierto(abierto === item.id ? null : item.id)}
                      aria-expanded={abierto === item.id}
                      className="min-h-[44px] px-2 text-sm underline"
                    >
                      Ajustes
                    </button>
                    <Interruptor
                      activo={item.disponible_hoy}
                      etiqueta={item.nombre}
                      onChange={() => guardar(item, { disponible_hoy: !item.disponible_hoy })}
                    />
                  </div>
                  {abierto === item.id && (
                    <Ajustes key={item.id} item={item} guardar={(c) => guardar(item, c)} />
                  )}
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
          <p className="text-xs text-papel/70 pt-1">
            Al pedir un ejecutivo, el mesero escoge entre las sopas activas, o marca “sin sopa”.
          </p>
        </aside>
      </div>
    </div>
  );
}