import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Minus, Send, MessageSquare } from 'lucide-react';
import { getProductos, crearPedido, getPedidos } from '../services/pedidoService';

const ESTADOS = {
  pendiente: { texto: 'Pendiente', clase: 'bg-pizarra-900/10 text-pizarra-900' },
  en_preparacion: { texto: 'En preparación', clase: 'bg-mostaza-500/30 text-pizarra-950' },
  listo: { texto: '¡Listo para servir!', clase: 'bg-green-600 text-white' },
};

export default function Pedidos() {
  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState({}); // { productoId: { cantidad, nota } }
  const [mesa, setMesa] = useState('');
  const [notas, setNotas] = useState('');
  const [tipoActivo, setTipoActivo] = useState('');
  const [activos, setActivos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    getProductos().then(setProductos).catch(() => setError('No se pudieron cargar los productos'));
  }, []);

  const cargarActivos = useCallback(() => {
    getPedidos().then(setActivos).catch(() => {});
  }, []);

  // Polling cada 4 s para ver cuándo queda listo un pedido
  useEffect(() => {
    cargarActivos();
    const id = setInterval(cargarActivos, 4000);
    return () => clearInterval(id);
  }, [cargarActivos]);

  const tipos = useMemo(() => [...new Set(productos.map(p => p.tipo))], [productos]);
  useEffect(() => {
    if (!tipoActivo && tipos.length) setTipoActivo(tipos[0]);
  }, [tipos, tipoActivo]);

  const visibles = productos.filter(p => p.tipo === tipoActivo);
  const totalItems = Object.values(carrito).reduce((s, i) => s + i.cantidad, 0);

  const cambiar = (id, delta) =>
    setCarrito(prev => {
      const actual = prev[id] || { cantidad: 0, nota: '' };
      const cantidad = Math.max(0, Math.min(100, actual.cantidad + delta));
      const sig = { ...prev };
      if (cantidad === 0) delete sig[id];
      else sig[id] = { ...actual, cantidad };
      return sig;
    });

  const ponerNota = (id, nota) =>
    setCarrito(prev => ({ ...prev, [id]: { ...prev[id], nota } }));

  const enviar = async () => {
    setError(''); setOk('');
    if (!mesa.trim()) return setError('Escribe la mesa');
    if (totalItems === 0) return setError('Agrega al menos un producto');
    setEnviando(true);
    try {
      await crearPedido({
        mesa: mesa.trim(),
        notas: notas.trim() || null,
        items: Object.entries(carrito).map(([id, i]) => ({
          producto_id: Number(id),
          cantidad: i.cantidad,
          nota: i.nota?.trim() || null,
        })),
      });
      setCarrito({}); setMesa(''); setNotas('');
      setOk('Pedido enviado a cocina');
      cargarActivos();
    } catch (e) {
      setError(e.response?.data?.message || e.response?.data?.error || 'No se pudo enviar el pedido');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-28">
      <h1 className="font-display text-2xl text-pizarra-950">Nuevo pedido</h1>

      {/* Pedidos en curso */}
      {activos.length > 0 && (
        <div className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-4 space-y-2">
          <p className="text-sm font-medium text-pizarra-900/70">Pedidos en curso</p>
          {activos.map(p => {
            const e = ESTADOS[p.estado];
            if (!e) return null;
            return (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span className="font-medium">Mesa {p.mesa}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${e.clase}`}>{e.texto}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Mesa */}
      <input
        value={mesa}
        onChange={e => setMesa(e.target.value)}
        maxLength={30}
        placeholder="Mesa (ej: 4, Barra, Domicilio)"
        className="w-full rounded-xl border border-pizarra-900/20 bg-white px-4 py-3 text-lg"
      />

      {/* Tipos */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tipos.map(t => (
          <button
            key={t}
            onClick={() => setTipoActivo(t)}
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm capitalize ${
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
        {visibles.map(p => {
          const item = carrito[p.id];
          return (
            <div key={p.id} className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.nombre}</p>
                  <p className="text-sm text-pizarra-900/60">
                    ${Number(p.precio).toLocaleString('es-CO')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {item && (
                    <>
                      <button onClick={() => cambiar(p.id, -1)} className="w-10 h-10 rounded-full border border-pizarra-900/20 flex items-center justify-center">
                        <Minus size={18} />
                      </button>
                      <span className="w-6 text-center font-semibold">{item.cantidad}</span>
                    </>
                  )}
                  <button onClick={() => cambiar(p.id, 1)} className="w-10 h-10 rounded-full bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950 flex items-center justify-center">
                    <Plus size={18} />
                  </button>
                </div>
              </div>
              {item && (
                <div className="mt-3 flex items-center gap-2">
                  <MessageSquare size={16} className="text-pizarra-900/50 shrink-0" />
                  <input
                    value={item.nota || ''}
                    onChange={e => ponerNota(p.id, e.target.value)}
                    placeholder="Nota (sin cebolla, bien asado…)"
                    className="w-full text-sm rounded-lg border border-pizarra-900/15 bg-white px-3 py-2"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <textarea
        value={notas}
        onChange={e => setNotas(e.target.value)}
        rows={2}
        placeholder="Nota general del pedido (opcional)"
        className="w-full rounded-xl border border-pizarra-900/20 bg-white px-4 py-3 text-sm"
      />

      {error && <p className="text-terracota-600 text-sm">{error}</p>}
      {ok && <p className="text-green-700 text-sm">{ok}</p>}

      {/* Botón fijo abajo */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-papel-card/95 backdrop-blur border-t border-pizarra-900/10 md:static md:p-0 md:border-0 md:bg-transparent">
        <button
          onClick={enviar}
          disabled={enviando}
          className="w-full max-w-xl mx-auto flex items-center justify-center gap-2 bg-mostaza-500 hover:bg-mostaza-600 disabled:opacity-60 text-pizarra-950 font-semibold rounded-xl py-4"
        >
          <Send size={18} />
          {enviando ? 'Enviando…' : `Enviar a cocina (${totalItems})`}
        </button>
      </div>
    </div>
  );
}
