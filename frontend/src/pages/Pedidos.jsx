import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Plus, Minus, Send, MessageSquare, Check, X, PlusCircle, Pencil } from 'lucide-react';
import {
  crearPedido,
  agregarItems,
  getPedidos,
  cambiarEstado,
  quitarItem,
  editarItem,
  cambiarMesa,
} from '../services/pedidoService';
import { getMenuHoy } from '../services/menuService';
import { useDialogos } from '../components/dialogosContexto';

const ESTADOS = {
  pendiente: { texto: 'En cocina', clase: 'bg-pizarra-900/10 text-pizarra-900' },
  en_preparacion: { texto: 'En cocina', clase: 'bg-mostaza-500/30 text-pizarra-950' },
  listo: { texto: 'Entregado · por cobrar', clase: 'bg-green-600 text-white' },
};

// Descuento fijo por no llevar sopa (el mismo que aplica el servidor)
const DESCUENTO_SIN_SOPA = 1000;

// Orden en que el mesero ve los tipos de producto
const ORDEN_TIPOS = ['ejecutivo', 'especial', 'bebida', 'rapida', 'sopa'];
const TITULOS = {
  ejecutivo: 'Ejecutivos',
  especial: 'Especiales',
  bebida: 'Bebidas',
  rapida: 'Rápidas',
  sopa: 'Sopas',
};
const posicion = (t) => (ORDEN_TIPOS.includes(t) ? ORDEN_TIPOS.indexOf(t) : ORDEN_TIPOS.length);

const cop = (n) => `${n < 0 ? '−' : ''}$${Math.abs(Number(n)).toLocaleString('es-CO')}`;

// Texto de un producto de un pedido ya enviado, sin la cantidad
const textoLinea = (it) =>
  `${it.producto_nombre}` +
  (it.sopa_nombre ? ` (${it.sopa_nombre})` : it.sin_sopa ? ' (sin sopa)' : '') +
  (it.principio_nombre ? ` + ${it.principio_nombre}` : it.sin_principio ? ' (sin principio)' : '');

export default function Pedidos() {
  const [menu, setMenu] = useState([]);
  const [carrito, setCarrito] = useState({}); // productos normales: { id: { producto, cantidad, nota } }
  const [platos, setPlatos] = useState([]); // platos con sopa: una línea por plato
  const [mesa, setMesa] = useState('');
  const [notas, setNotas] = useState('');
  const [tipoActivo, setTipoActivo] = useState('');
  const [activos, setActivos] = useState([]);
  const [agregandoA, setAgregandoA] = useState(null); // pedido abierto al que se le suman productos
  const [enviando, setEnviando] = useState(false);
  const [editandoMesa, setEditandoMesa] = useState(null); // { id, valor }: cambiando la mesa de un pedido enviado
  const [editandoNota, setEditandoNota] = useState(null); // { id, valor }: cambiando la nota de un producto enviado
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const { confirmar } = useDialogos();
  const keyRef = useRef(1);
  const inicioRef = useRef(null);

  const cargarMenu = useCallback((avisar) => {
    getMenuHoy()
      .then(setMenu)
      .catch(() => {
        if (avisar) setError('No se pudo cargar el menú de hoy');
      });
  }, []);

  useEffect(() => {
    cargarMenu(true);
    const id = setInterval(() => cargarMenu(false), 15000); // las existencias cambian durante el servicio
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

  // Si escribe una mesa que ya tiene un pedido abierto, se le ofrece sumarle los productos
  const pedidoDeLaMesa = useMemo(() => {
    const m = mesa.trim().toLowerCase();
    if (agregandoA || !m) return null;
    return activos.find((p) => p.mesa.trim().toLowerCase() === m) || null;
  }, [activos, mesa, agregandoA]);

  // Los principios no se venden solos: se escogen dentro del ejecutivo
  const tipos = useMemo(
    () =>
      [...new Set(menu.filter((p) => p.tipo !== 'principio').map((p) => p.tipo))].sort(
        (a, b) => posicion(a) - posicion(b)
      ),
    [menu]
  );
  useEffect(() => {
    if (tipos.length && !tipos.includes(tipoActivo)) setTipoActivo(tipos[0]);
  }, [tipos, tipoActivo]);

  // Existencias: "disponibles" es null cuando no se sabe cuántas quedan (producto sin receta)
  const llevaExistencias = (p) => p.disponibles !== null && p.disponibles !== undefined;
  const enElPedido = (p) =>
    p.incluye_sopa ? platos.filter((l) => l.producto.id === p.id).length : carrito[p.id]?.cantidad || 0;
  const sinExistencias = (p) => llevaExistencias(p) && enElPedido(p) >= p.disponibles;
  const usosSopa = (id) => platos.filter((l) => l.sopa === id).length;
  const usosPrincipio = (id) => platos.filter((l) => l.principio === id).length;

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
        s + Number(l.producto.precio) - (l.sopa === 'sin' ? DESCUENTO_SIN_SOPA : 0),
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

  const empezarAgregar = (p) => {
    setError('');
    setOk('');
    setAgregandoA({ id: p.id, mesa: p.mesa });
    setMesa(p.mesa);
    setNotas('');
    inicioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const dejarDeAgregar = () => {
    setAgregandoA(null);
    setMesa('');
  };

  const enviar = async () => {
    setError('');
    setOk('');
    if (!agregandoA && !mesa.trim()) return setError('Escribe la mesa');
    if (totalItems === 0) return setError('Agrega al menos un producto');
    if (faltaSopa) return setError('Escoge la sopa de cada plato, o marca “sin sopa”');
    if (faltaPrincipio) return setError('Escoge el principio de cada plato, o marca “sin principio”');

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
        ...(l.principio === 'sin'
          ? { sin_principio: true }
          : l.principio
            ? { principio_id: l.principio }
            : {}),
      })),
    ];

    setEnviando(true);
    try {
      if (agregandoA) {
        await agregarItems(agregandoA.id, items);
        setOk(`Productos agregados a la mesa ${agregandoA.mesa} y enviados a cocina`);
        setAgregandoA(null);
      } else {
        await crearPedido({ mesa: mesa.trim(), notas: notas.trim() || null, items });
        setOk('Pedido enviado a cocina');
      }
      setCarrito({});
      setPlatos([]);
      setMesa('');
      setNotas('');
      cargarActivos();
    } catch (e) {
      setError(e.response?.data?.message || e.response?.data?.error || 'No se pudo enviar el pedido');
      if (agregandoA && e.response?.status === 409) setAgregandoA(null); // ya no admite más productos
      cargarMenu(false); // por si el menú de hoy cambió
      cargarActivos();
    } finally {
      setEnviando(false);
    }
  };

  const marcarEntregado = async (p) => {
    const seguro = await confirmar({
      titulo: 'Entregar pedido',
      mensaje: `¿Ya entregaste el pedido de la mesa ${p.mesa}? Pasa a caja para cobrarlo.`,
      textoConfirmar: 'Sí, entregado',
      textoCancelar: 'Todavía no',
    });
    if (!seguro) return;
    setError('');
    try {
      await cambiarEstado(p.id, 'listo');
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo actualizar el pedido');
    }
    cargarActivos();
  };

  const cancelar = async (p) => {
    const seguro = await confirmar({
      titulo: 'Cancelar pedido',
      mensaje: `¿Cancelar el pedido de la mesa ${p.mesa}? Cocina dejará de verlo.`,
      textoConfirmar: 'Sí, cancelar',
      textoCancelar: 'No, volver',
      peligro: true,
    });
    if (!seguro) return;
    setError('');
    try {
      await cambiarEstado(p.id, 'cancelado');
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo cancelar el pedido');
    }
    cargarActivos();
  };

  // --- Corregir un pedido ya enviado (mientras no se cobre) ---
  const corregir = async (accion, mensajeError) => {
    setError('');
    setOk('');
    try {
      await accion();
    } catch (e) {
      setError(e.response?.data?.error || mensajeError);
    }
    cargarActivos();
  };

  const quitarLinea = async (p, it) => {
    const seguro = await confirmar({
      titulo: 'Quitar producto',
      mensaje: `¿Quitar "${it.producto_nombre}" del pedido de la mesa ${p.mesa}? Si cocina ya lo preparó, se gastó.`,
      textoConfirmar: 'Sí, quitar',
      textoCancelar: 'No, volver',
      peligro: true,
    });
    if (!seguro) return;
    corregir(() => quitarItem(p.id, it.detalle_id), 'No se pudo quitar el producto');
  };

  const cambiarCantidadLinea = (p, it, delta) => {
    const nueva = it.cantidad + delta;
    if (nueva < 1 || nueva > 100) return;
    corregir(() => editarItem(p.id, it.detalle_id, { cantidad: nueva }), 'No se pudo cambiar la cantidad');
  };

  const guardarNota = () => {
    const { p, it, valor } = editandoNota;
    setEditandoNota(null);
    corregir(() => editarItem(p.id, it.detalle_id, { nota: valor.trim() }), 'No se pudo guardar la nota');
  };

  const guardarMesa = () => {
    const { p, valor } = editandoMesa;
    setEditandoMesa(null);
    if (!valor.trim() || valor.trim() === p.mesa) return;
    corregir(() => cambiarMesa(p.id, valor.trim()), 'No se pudo cambiar la mesa');
  };

  const textoBoton = enviando
    ? 'Enviando…'
    : totalItems === 0
      ? 'Agrega productos al pedido'
      : faltaSopa
        ? 'Falta escoger la sopa'
        : faltaPrincipio
          ? 'Falta escoger el principio'
          : agregandoA
            ? `Agregar al pedido de la mesa ${agregandoA.mesa} (${totalItems})`
            : `Enviar a cocina (${totalItems})`;
  const bloqueado = enviando || totalItems === 0 || faltaSopa || faltaPrincipio;

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-44 md:pb-0">
      <h1 ref={inicioRef} className="font-display text-2xl text-pizarra-950">
        {agregandoA ? `Agregar a la mesa ${agregandoA.mesa}` : 'Nuevo pedido'}
      </h1>

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
                  {editandoMesa?.p.id === p.id ? (
                    <form
                      className="flex items-center gap-2 flex-1"
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        guardarMesa();
                      }}
                    >
                      <input
                        value={editandoMesa.valor}
                        onChange={(ev) => setEditandoMesa({ p, valor: ev.target.value })}
                        maxLength={30}
                        autoFocus
                        aria-label="Nueva mesa"
                        className="flex-1 min-w-0 rounded-lg border border-pizarra-900/20 bg-white px-3 py-2 text-sm"
                      />
                      <button type="submit" aria-label="Guardar mesa" className="w-10 h-10 rounded-full bg-mostaza-500 flex items-center justify-center">
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditandoMesa(null)}
                        aria-label="Cancelar cambio de mesa"
                        className="w-10 h-10 rounded-full border border-pizarra-900/20 flex items-center justify-center"
                      >
                        <X size={16} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="font-semibold flex items-center gap-1">
                        Mesa {p.mesa}
                        <button
                          onClick={() => setEditandoMesa({ p, valor: p.mesa })}
                          title="Cambiar de mesa"
                          aria-label={`Cambiar la mesa ${p.mesa}`}
                          className="w-8 h-8 flex items-center justify-center text-pizarra-900/50"
                        >
                          <Pencil size={14} />
                        </button>
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${e.clase}`}>{e.texto}</span>
                    </>
                  )}
                </div>

                {/* Productos del pedido: se pueden corregir mientras no se cobre */}
                <ul className="space-y-2">
                  {p.items.map((it) => {
                    const cantidadFija = it.tipo === 'ejecutivo';
                    const editNota = editandoNota?.it.detalle_id === it.detalle_id;
                    return (
                      <li key={it.detalle_id} className="text-sm">
                        <div className="flex items-start gap-2">
                          {cantidadFija ? (
                            <span className="font-semibold w-7 shrink-0 pt-1.5">{it.cantidad}×</span>
                          ) : (
                            <span className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => cambiarCantidadLinea(p, it, -1)}
                                disabled={it.cantidad <= 1}
                                aria-label={`Quitar uno de ${it.producto_nombre}`}
                                className="w-8 h-8 rounded-full border border-pizarra-900/20 flex items-center justify-center disabled:opacity-30"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-5 text-center font-semibold">{it.cantidad}</span>
                              <button
                                onClick={() => cambiarCantidadLinea(p, it, 1)}
                                aria-label={`Agregar uno de ${it.producto_nombre}`}
                                className="w-8 h-8 rounded-full border border-pizarra-900/20 flex items-center justify-center"
                              >
                                <Plus size={14} />
                              </button>
                            </span>
                          )}
                          <div className="flex-1 min-w-0 pt-1.5 text-pizarra-900/80">
                            <p>{textoLinea(it)}</p>
                            {it.nota && !editNota && <p className="text-xs text-pizarra-900/70">↳ {it.nota}</p>}
                          </div>
                          <button
                            onClick={() => setEditandoNota({ p, it, valor: it.nota || '' })}
                            title="Nota del producto"
                            aria-label={`Nota de ${it.producto_nombre}`}
                            className="w-8 h-8 flex items-center justify-center text-pizarra-900/50 shrink-0"
                          >
                            <MessageSquare size={14} />
                          </button>
                          {p.items.length > 1 && (
                            <button
                              onClick={() => quitarLinea(p, it)}
                              title="Quitar este producto"
                              aria-label={`Quitar ${it.producto_nombre} del pedido`}
                              className="w-8 h-8 flex items-center justify-center text-terracota-600 shrink-0"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                        {editNota && (
                          <form
                            className="flex items-center gap-2 mt-1"
                            onSubmit={(ev) => {
                              ev.preventDefault();
                              guardarNota();
                            }}
                          >
                            <input
                              value={editandoNota.valor}
                              onChange={(ev) => setEditandoNota({ ...editandoNota, valor: ev.target.value })}
                              maxLength={255}
                              autoFocus
                              aria-label={`Nota para ${it.producto_nombre}`}
                              placeholder="Nota (sin cebolla, bien asado…)"
                              className="flex-1 min-w-0 text-sm rounded-lg border border-pizarra-900/20 bg-white px-3 py-2"
                            />
                            <button type="submit" aria-label="Guardar nota" className="w-9 h-9 rounded-full bg-mostaza-500 flex items-center justify-center">
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditandoNota(null)}
                              aria-label="Cancelar nota"
                              className="w-9 h-9 rounded-full border border-pizarra-900/20 flex items-center justify-center"
                            >
                              <X size={16} />
                            </button>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <button
                  onClick={() => empezarAgregar(p)}
                  className="w-full flex items-center justify-center gap-2 border border-pizarra-900/25 rounded-xl py-3 text-sm font-medium"
                >
                  <PlusCircle size={18} /> Agregar productos a esta mesa
                </button>
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
      {agregandoA ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-mostaza-500/25 border border-mostaza-500 px-4 py-3">
          <p className="text-sm">
            Estás sumando productos al pedido abierto de la <strong>mesa {agregandoA.mesa}</strong>. Lo nuevo
            vuelve a cocina.
          </p>
          <button
            onClick={dejarDeAgregar}
            className="shrink-0 text-sm underline text-pizarra-900/80 min-h-[44px] px-2"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <>
          <input
            value={mesa}
            onChange={(e) => setMesa(e.target.value)}
            maxLength={30}
            aria-label="Mesa"
            placeholder="Mesa (ej: 4, Barra, Domicilio)"
            className="w-full rounded-xl border border-pizarra-900/20 bg-white px-4 py-3 text-lg"
          />
          {pedidoDeLaMesa && (
            <div className="rounded-xl bg-mostaza-500/25 border border-mostaza-500 px-4 py-3 space-y-2">
              <p className="text-sm">
                La mesa {pedidoDeLaMesa.mesa} ya tiene un pedido abierto. ¿Quieres sumarle estos productos en vez de
                crear otro?
              </p>
              <button
                onClick={() => empezarAgregar(pedidoDeLaMesa)}
                className="w-full bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950 font-semibold rounded-xl py-3 text-sm"
              >
                Agregar al pedido de la mesa {pedidoDeLaMesa.mesa}
              </button>
            </div>
          )}
        </>
      )}

      {/* Resumen de lo que llevas escogido, para revisarlo y corregirlo antes de enviar */}
      {totalItems > 0 && (
        <div className="bg-papel-card rounded-2xl shadow-sm border border-mostaza-500/50 p-4 space-y-2">
          <p className="text-sm font-semibold text-pizarra-900">
            {agregandoA ? 'Lo que vas a agregar' : 'Llevas en este pedido'} ({totalItems})
          </p>
          <ul className="space-y-1.5">
            {normales.map((i) => (
              <li key={i.producto.id} className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => cambiar(i.producto, -1)}
                    aria-label={`Quitar uno de ${i.producto.nombre}`}
                    className="w-8 h-8 rounded-full border border-pizarra-900/20 flex items-center justify-center"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-5 text-center font-semibold">{i.cantidad}</span>
                  <button
                    onClick={() => cambiar(i.producto, 1)}
                    disabled={sinExistencias(i.producto)}
                    aria-label={`Agregar uno de ${i.producto.nombre}`}
                    className="w-8 h-8 rounded-full border border-pizarra-900/20 flex items-center justify-center disabled:opacity-30"
                  >
                    <Plus size={14} />
                  </button>
                </span>
                <span className="flex-1 min-w-0 truncate">
                  {i.producto.nombre}
                  {i.nota ? <span className="text-pizarra-900/60"> · {i.nota}</span> : null}
                </span>
                <span className="font-medium shrink-0">{cop(i.cantidad * Number(i.producto.precio))}</span>
                <button
                  onClick={() => cambiar(i.producto, -i.cantidad)}
                  aria-label={`Quitar ${i.producto.nombre} del pedido`}
                  className="w-8 h-8 flex items-center justify-center text-terracota-600 shrink-0"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
            {platos.map((l) => {
              const sopa = l.sopa === 'sin' ? 'sin sopa' : sopas.find((s) => s.id === l.sopa)?.nombre;
              const principio =
                l.principio === 'sin' ? 'sin principio' : principios.find((pr) => pr.id === l.principio)?.nombre;
              const falta = !l.sopa || (principios.length > 0 && !l.principio);
              return (
                <li key={l.key} className="flex items-center gap-2 text-sm">
                  <span className="font-semibold w-7 shrink-0 text-center">1×</span>
                  <span className="flex-1 min-w-0">
                    {l.producto.nombre}
                    <span className={falta ? 'text-terracota-600' : 'text-pizarra-900/60'}>
                      {' · '}
                      {[sopa || 'falta la sopa', principios.length > 0 ? principio || 'falta el principio' : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="font-medium shrink-0">
                    {cop(Number(l.producto.precio) - (l.sopa === 'sin' ? DESCUENTO_SIN_SOPA : 0))}
                  </span>
                  <button
                    onClick={() => quitarPlato(l.key)}
                    aria-label={`Quitar ${l.producto.nombre} del pedido`}
                    className="w-8 h-8 flex items-center justify-center text-terracota-600 shrink-0"
                  >
                    <X size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
            className={`min-h-[44px] px-4 rounded-full whitespace-nowrap text-sm ${
              t === tipoActivo
                ? 'bg-mostaza-500 text-pizarra-950 font-medium'
                : 'bg-papel-card border border-pizarra-900/10'
            }`}
          >
            {TITULOS[t] || t}
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
                  {llevaExistencias(p) && (
                    <p
                      className={`text-xs font-semibold ${
                        p.disponibles - enElPedido(p) <= 0
                          ? 'text-terracota-600'
                          : p.disponibles - enElPedido(p) <= 3
                            ? 'text-mostaza-600'
                            : 'text-pizarra-900/70'
                      }`}
                    >
                      {p.disponibles === 0
                        ? 'Agotado'
                        : p.disponibles - enElPedido(p) <= 0
                          ? 'No quedan más'
                          : `Quedan ${p.disponibles - enElPedido(p)}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {p.incluye_sopa ? (
                    <>
                      {cuantos > 0 && <span className="font-semibold">×{cuantos}</span>}
                      <button
                        onClick={() => agregarPlato(p)}
                        disabled={sinExistencias(p)}
                        aria-label={`Agregar ${p.nombre}`}
                        className="w-11 h-11 rounded-full bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
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
                        disabled={sinExistencias(p)}
                        aria-label={`Agregar ${p.nombre}`}
                        className="w-11 h-11 rounded-full bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
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
            const precio = Number(l.producto.precio) - (sin ? DESCUENTO_SIN_SOPA : 0);
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
                    {sopas.map((s) => {
                      const quedan = llevaExistencias(s) ? s.disponibles - usosSopa(s.id) : null;
                      const agotada = quedan !== null && quedan <= 0 && l.sopa !== s.id;
                      return (
                        <button
                          key={s.id}
                          aria-pressed={l.sopa === s.id}
                          disabled={agotada}
                          onClick={() => cambiarPlato(l.key, { sopa: s.id })}
                          className={`min-h-[44px] px-4 rounded-full text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                            l.sopa === s.id
                              ? 'bg-mostaza-500 text-pizarra-950 font-semibold'
                              : 'bg-white border border-pizarra-900/20'
                          }`}
                        >
                          {s.nombre}
                          {quedan !== null && (agotada ? ' · agotada' : ` · quedan ${quedan}`)}
                        </button>
                      );
                    })}
                    <button
                      aria-pressed={sin}
                      onClick={() => cambiarPlato(l.key, { sopa: 'sin' })}
                      className={`min-h-[44px] px-4 rounded-full text-sm ${
                        sin ? 'bg-pizarra-900 text-white font-semibold' : 'bg-white border border-pizarra-900/20'
                      }`}
                    >
                      Sin sopa ({cop(-DESCUENTO_SIN_SOPA)})
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
                      {!l.principio ? 'Escoge el principio de este plato' : l.principio === 'sin' ? 'Sin principio' : 'Principio'}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {principios.map((pr) => {
                        const quedan = llevaExistencias(pr) ? pr.disponibles - usosPrincipio(pr.id) : null;
                        const agotado = quedan !== null && quedan <= 0 && l.principio !== pr.id;
                        return (
                          <button
                            key={pr.id}
                            aria-pressed={l.principio === pr.id}
                            disabled={agotado}
                            onClick={() => cambiarPlato(l.key, { principio: pr.id })}
                            className={`min-h-[44px] px-4 rounded-full text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                              l.principio === pr.id
                                ? 'bg-mostaza-500 text-pizarra-950 font-semibold'
                                : 'bg-white border border-pizarra-900/20'
                            }`}
                          >
                            {pr.nombre}
                            {quedan !== null && (agotado ? ' · agotado' : ` · quedan ${quedan}`)}
                          </button>
                        );
                      })}
                      <button
                        aria-pressed={l.principio === 'sin'}
                        onClick={() => cambiarPlato(l.key, { principio: 'sin' })}
                        className={`min-h-[44px] px-4 rounded-full text-sm ${
                          l.principio === 'sin'
                            ? 'bg-pizarra-900 text-white font-semibold'
                            : 'bg-white border border-pizarra-900/20'
                        }`}
                      >
                        Sin principio
                      </button>
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

      {!agregandoA && (
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          aria-label="Nota general del pedido"
          placeholder="Nota general del pedido (opcional)"
          className="w-full rounded-xl border border-pizarra-900/20 bg-white px-4 py-3 text-sm"
        />
      )}

      {error && <p className="text-terracota-600 text-sm">{error}</p>}
      {ok && <p className="text-green-700 text-sm">{ok}</p>}

      {/* Barra fija abajo */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-papel-card/95 backdrop-blur border-t border-pizarra-900/10 md:static md:p-0 md:border-0 md:bg-transparent">
        <div className="max-w-xl mx-auto space-y-2">
          <div className="flex justify-between text-sm">
            <span>{agregandoA ? 'Total de lo que agregas' : 'Total del pedido'}</span>
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