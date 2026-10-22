import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Plus, Minus, Send, MessageSquare, Check, X } from 'lucide-react';
import { crearPedido, getPedidos, cambiarEstado } from '../services/pedidoService';
import { getMenuHoy } from '../services/menuService';

const ESTADOS = {
  pendiente: { texto: 'En cocina', clase: 'bg-pizarra-900/10 text-pizarra-900' },
  en_preparacion: { texto: 'En cocina', clase: 'bg-mostaza-500/30 text-pizarra-950' },
  listo: { texto: 'Entregado · por cobrar', clase: 'bg-green-600 text-white' },
};

const cop = (n) => `${n < 0 ? '−' : ''}$${Math.abs(Number(n)).toLocaleString('es-CO')}`;

const resumen = (it) =>
  `${it.cantidad}× ${it.producto_nombre}` +
  (it.sopa_nombre ? ` (${it.sopa_nombre})` : it.sin_sopa ? ' (sin sopa)' : '') +
  (it.principio_nombre ? ` + ${it.principio_nombre}` : '');

export default function Pedidos() {
  const [menu, setMenu] = useState([]);
  const [carrito, setCarrito] = useState({}); // productos normales: { id: { producto, cantidad, nota } }
  const [platos, setPlatos] = useState([]); // platos con sopa: una línea por plato
  const [mesa, setMesa] = useState('');
  const [notas, setNotas] = useState('');
  const [tipoActivo, setTipoActivo] = useState('');
  const [activos, setActivos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const keyRef = useRef(1);

  const cargarMenu = useCallback((avisar) => {
    getMenuHoy()
      .then(setMenu)
      .catch(() => {
        if (avisar) setError('No se pudo cargar el menú de hoy');
      });
  }, []);

  useEffect(() => {
    cargarMenu(true);
    const id = setInterval(() => cargarMenu(false), 60000);
    return () => clearInterval(id);
  }, [cargarMenu]);

  const cargarActivos = useCallback(() => {
    getPedidos().then(setActivos).catch(() => {});
  }, []);

  // Polling cada 4 s para mantener al día el estado de mis pedidos
  useEffect(() => {
    cargarActivos();
    const id = setInterval(cargarActivos, 4000);
    return () => clearInterval(id);
  }, [cargarActivos]);

  // Los principios no se venden solos: se escogen dentro del ejecutivo
  const tipos = useMemo(
    () => [...new Set(menu.filter((p) => p.tipo !== 'principio').map((p) => p.tipo))],
    [menu]
  );
  useEffect(() => {
    if (tipos.length && !tipos.includes(tipoActivo)) setTipoActivo(tipos[0]);
  }, [tipos, tipoActivo]);

  const sopas = menu.filter((p) => p.tipo === 'sopa');
  const principios = menu.filter((p) => p.tipo === 'principio');
  const visibles = menu.filter((p) => p.tipo === tipoActivo);

  const normales = Object.values(carrito);
  const totalItems = normales.reduce((s, i) => s + i.cantidad, 0) + platos.length;
  const faltaSopa = platos.some((l) => !l.sopa);
  const faltaPrincipio = principios.length > 0 && platos.some((l) => !l.principio);
  const totalPrecio =
    normales.reduce((s, i) => s + i.cantidad * Number(i.producto.precio), 0) +
    platos.reduce(
      (s, l) =>
        s + Number(l.producto.precio) - (l.sopa === 'sin' ? Number(l.producto.descuento_sin_sopa) : 0),
      0
    );

  const cambiar = (producto, delta) =>
    setCarrito((prev) => {
      const actual = prev[producto.id] || { producto, cantidad: 0, nota: '' };
      const cantidad = Math.max(0, Math.min(100, actual.cantidad + delta));
      const sig = { ...prev };
      if (cantidad === 0) delete sig[producto.id];
      else sig[producto.id] = { ...actual, cantidad };
      return sig;
    });

  const ponerNota = (id, nota) =>
    setCarrito((prev) => ({ ...prev, [id]: { ...prev[id], nota } }));

  const agregarPlato = (producto) =>
    setPlatos((prev) => [...prev, { key: keyRef.current++, producto, sopa: null, principio: null, nota: '' }]);

  const quitarPlato = (key) => setPlatos((prev) => prev.filter((l) => l.key !== key));

  const cambiarPlato = (key, cambios) =>
    setPlatos((prev) => prev.map((l) => (l.key === key ? { ...l, ...cambios } : l)));

  const enviar = async () => {
    setError('');
    setOk('');
    if (!mesa.trim()) return setError('Escribe la mesa');
    if (totalItems === 0) return setError('Agrega al menos un producto');
    if (faltaSopa) return setError('Escoge la sopa de cada plato, o marca “sin sopa”');
    if (faltaPrincipio) return setError('Escoge el principio de cada plato');

    const items = [
      ...normales.map((i) => ({
        producto_id: i.producto.id,
        cantidad: i.cantidad,
        nota: i.nota?.trim() || null,
      })),
      ...platos.map((l) => ({
        producto_id: l.producto.id,
        cantidad: 1,
        nota: l.nota?.trim() || null,
        ...(l.sopa === 'sin' ? { sin_sopa: true } : { sopa_id: l.sopa }),
        ...(l.principio ? { principio_id: l.principio } : {}),
      })),
    ];

    setEnviando(true);
    try {
      await crearPedido({ mesa: mesa.trim(), notas: notas.trim() || null, items });
      setCarrito({});
      setPlatos([]);
      setMesa('');
      setNotas('');
      setOk('Pedido enviado a cocina');
      cargarActivos();
    } catch (e) {
      setError(e.response?.data?.message || e.response?.data?.error || 'No se pudo enviar el pedido');
      cargarMenu(false); // por si el menú de hoy cambió
    } finally {
      setEnviando(false);
    }
  };

  const marcarEntregado = async (p) => {
    if (!window.confirm(`¿Ya entregaste el pedido de la mesa ${p.mesa}?`)) return;
    setError('');
    try {
      await cambiarEstado(p.id, 'listo');
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo actualizar el pedido');
    }
    cargarActivos();
  };

  const cancelar = async (p) => {
    if (!window.confirm(`¿Cancelar el pedido de la mesa ${p.mesa}?`)) return;
    setError('');
    try {
      await cambiarEstado(p.id, 'cancelado');
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo cancelar el pedido');
    }
    cargarActivos();
  };

  const textoBoton = enviando
    ? 'Enviando…'
    : totalItems === 0
      ? 'Agrega productos al pedido'
      : faltaSopa
        ? 'Falta escoger la sopa'
        : faltaPrincipio
          ? 'Falta escoger el principio'
          : `Enviar a cocina (${totalItems})`;
  const bloqueado = enviando || totalItems === 0 || faltaSopa || faltaPrincipio;

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-44 md:pb-0">
      <h1 className="font-display text-2xl text-pizarra-950">Nuevo pedido</h1>

      {/* Mis pedidos en curso */}
      {activos.length > 0 && (
        <div className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-4 space-y-3">
          <p className="text-sm font-medium text-pizarra-900/70">Pedidos en curso</p>
          {activos.map((p) => {
            const e = ESTADOS[p.estado];
            if (!e) return null;
            const enCocina = p.estado === 'pendiente' || p.estado === 'en_preparacion';
            return (
              <div key={p.id} className="border-t border-pizarra-900/10 pt-3 first:border-0 first:pt-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">Mesa {p.mesa}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${e.clase}`}>{e.texto}</span>
                </div>
                <p className="text-sm text-pizarra-900/70">{p.items.map(resumen).join(', ')}</p>
                {enCocina && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => marcarEntregado(p)}
                      className="flex-1 flex items-center justify-center gap-2 bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950 font-semibold rounded-xl py-3"
                    >
                      <Check size={18} /> Entregado
                    </button>
                    {p.estado === 'pendiente' && (
                      <button
                        onClick={() => cancelar(p)}
                        title="Cancelar pedido"
                        aria-label="Cancelar pedido"
                        className="px-4 rounded-xl border border-pizarra-900/20 text-pizarra-900/60"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mesa */}
      <input
        value={mesa}
        onChange={(e) => setMesa(e.target.value)}
        maxLength={30}
        aria-label="Mesa"
        placeholder="Mesa (ej: 4, Barra, Domicilio)"
        className="w-full rounded-xl border border-pizarra-900/20 bg-white px-4 py-3 text-lg"
      />

      {menu.length === 0 && (
        <p className="text-pizarra-900/70 text-sm">
          Hoy no hay productos activos. Pídele al administrador que active el menú del día.
        </p>
      )}

      {/* Tipos */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tipos.map((t) => (
          <button
            key={t}
            onClick={() => setTipoActivo(t)}
            className={`min-h-[44px] px-4 rounded-full whitespace-nowrap text-sm capitalize ${
              t === tipoActivo
                ? 'bg-mostaza-500 text-pizarra-950 font-medium'
                : 'bg-papel-card border border-pizarra-900/10'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Productos */}
      <div className="space-y-2">
        {visibles.map((p) => {
          const item = carrito[p.id];
          const cuantos = platos.filter((l) => l.producto.id === p.id).length;
          return (
            <div key={p.id} className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.nombre}</p>
                  <p className="text-sm text-pizarra-900/70">
                    {cop(p.precio)}
                    {p.incluye_sopa && ' · incluye sopa y principio'}
                    {p.tipo === 'sopa' && ' · sopa sola'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {p.incluye_sopa ? (
                    <>
                      {cuantos > 0 && <span className="font-semibold">×{cuantos}</span>}
                      <button
                        onClick={() => agregarPlato(p)}
                        aria-label={`Agregar ${p.nombre}`}
                        className="w-11 h-11 rounded-full bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950 flex items-center justify-center"
                      >
                        <Plus size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      {item && (
                        <>
                          <button
                            onClick={() => cambiar(p, -1)}
                            aria-label={`Quitar uno de ${p.nombre}`}
                            className="w-11 h-11 rounded-full border border-pizarra-900/20 flex items-center justify-center"
                          >
                            <Minus size={18} />
                          </button>
                          <span className="w-6 text-center font-semibold">{item.cantidad}</span>
                        </>
                      )}
                      <button
                        onClick={() => cambiar(p, 1)}
                        aria-label={`Agregar ${p.nombre}`}
                        className="w-11 h-11 rounded-full bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950 flex items-center justify-center"
                      >
                        <Plus size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {item && (
                <div className="mt-3 flex items-center gap-2">
                  <MessageSquare size={16} className="text-pizarra-900/50 shrink-0" />
                  <input
                    value={item.nota || ''}
                    onChange={(e) => ponerNota(p.id, e.target.value)}
                    aria-label={`Nota para ${p.nombre}`}
                    placeholder="Nota (sin cebolla, bien asado…)"
                    className="w-full text-sm rounded-lg border border-pizarra-900/15 bg-white px-3 py-2"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Platos con sopa: una línea por plato */}
      {platos.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-sm font-medium text-pizarra-900/70">Ejecutivos del pedido</p>
          {platos.map((l) => {
            const sin = l.sopa === 'sin';
            const precio = Number(l.producto.precio) - (sin ? Number(l.producto.descuento_sin_sopa) : 0);
            return (
              <div key={l.key} className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{l.producto.nombre}</p>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{cop(precio)}</span>
                    <button
                      onClick={() => quitarPlato(l.key)}
                      aria-label={`Quitar ${l.producto.nombre}`}
                      className="w-9 h-9 rounded-full border border-pizarra-900/25 flex items-center justify-center"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <p className={`text-xs font-semibold ${l.sopa ? 'text-pizarra-900/70' : 'text-terracota-600'}`}>
                    {!l.sopa ? 'Escoge la sopa de este plato' : sin ? 'Sin sopa' : 'Sopa incluida'}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {sopas.map((s) => (
                      <button
                        key={s.id}
                        aria-pressed={l.sopa === s.id}
                        onClick={() => cambiarPlato(l.key, { sopa: s.id })}
                        className={`min-h-[44px] px-4 rounded-full text-sm ${
                          l.sopa === s.id
                            ? 'bg-mostaza-500 text-pizarra-950 font-semibold'
                            : 'bg-white border border-pizarra-900/20'
                        }`}
                      >
                        {s.nombre}
                      </button>
                    ))}
                    <button
                      aria-pressed={sin}
                      onClick={() => cambiarPlato(l.key, { sopa: 'sin' })}
                      className={`min-h-[44px] px-4 rounded-full text-sm ${
                        sin ? 'bg-pizarra-900 text-white font-semibold' : 'bg-white border border-pizarra-900/20'
                      }`}
                    >
                      Sin sopa ({cop(-Number(l.producto.descuento_sin_sopa))})
                    </button>
                  </div>
                  {sopas.length === 0 && (
                    <p className="text-xs text-pizarra-900/70 mt-2">
                      Hoy no hay sopas activas: solo se puede pedir sin sopa.
                    </p>
                  )}
                </div>

                {principios.length > 0 && (
                  <div>
                    <p className={`text-xs font-semibold ${l.principio ? 'text-pizarra-900/70' : 'text-terracota-600'}`}>
                      {l.principio ? 'Principio' : 'Escoge el principio de este plato'}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {principios.map((pr) => (
                        <button
                          key={pr.id}
                          aria-pressed={l.principio === pr.id}
                          onClick={() => cambiarPlato(l.key, { principio: pr.id })}
                          className={`min-h-[44px] px-4 rounded-full text-sm ${
                            l.principio === pr.id
                              ? 'bg-mostaza-500 text-pizarra-950 font-semibold'
                              : 'bg-white border border-pizarra-900/20'
                          }`}
                        >
                          {pr.nombre}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-pizarra-900/50 shrink-0" />
                  <input
                    value={l.nota}
                    onChange={(e) => cambiarPlato(l.key, { nota: e.target.value })}
                    aria-label={`Nota para ${l.producto.nombre}`}
                    placeholder="Nota (sin cebolla, bien asado…)"
                    className="w-full text-sm rounded-lg border border-pizarra-900/15 bg-white px-3 py-2"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <textarea
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={2}
        aria-label="Nota general del pedido"
        placeholder="Nota general del pedido (opcional)"
        className="w-full rounded-xl border border-pizarra-900/20 bg-white px-4 py-3 text-sm"
      />

      {error && <p className="text-terracota-600 text-sm">{error}</p>}
      {ok && <p className="text-green-700 text-sm">{ok}</p>}

      {/* Barra fija abajo */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-papel-card/95 backdrop-blur border-t border-pizarra-900/10 md:static md:p-0 md:border-0 md:bg-transparent">
        <div className="max-w-xl mx-auto space-y-2">
          <div className="flex justify-between text-sm">
            <span>Total del pedido</span>
            <strong>{cop(totalPrecio)}</strong>
          </div>
          <button
            onClick={enviar}
            disabled={bloqueado}
            className={`w-full flex items-center justify-center gap-2 font-semibold rounded-xl py-4 ${
              bloqueado
                ? 'bg-pizarra-900/15 text-pizarra-900/70 cursor-not-allowed'
                : 'bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950'
            }`}
          >
            <Send size={18} />
            {textoBoton}
          </button>
        </div>
      </div>
    </div>
  );
}