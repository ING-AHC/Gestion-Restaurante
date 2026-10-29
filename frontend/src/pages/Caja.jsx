import { useEffect, useState, useCallback } from 'react';
import { Receipt, X } from 'lucide-react';
import { getPedidos, cambiarEstado, confirmarPedido, quitarItem } from '../services/pedidoService';
import { useDialogos } from '../components/dialogosContexto';
import SelectorPago from '../components/SelectorPago';
import { pagoValido } from '../utils/pago';

const cop = (n) => `${n < 0 ? '−' : ''}$${Math.abs(Number(n)).toLocaleString('es-CO')}`;
const total = (p) =>
  p.items.reduce((s, it) => s + it.cantidad * Number(it.precio) + Number(it.ajuste || 0), 0);

const PAGO_INICIAL = { metodo: 'efectivo', montoEfectivo: '' };

export default function Caja() {
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(null);
  const [pagos, setPagos] = useState({}); // forma de pago escogida en cada pedido: { id: { metodo, montoEfectivo } }
  const { confirmar } = useDialogos();

  const cargar = useCallback(async () => {
    try {
      setPedidos(await getPedidos('listo'));
    } catch {
      /* se reintenta solo */
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 4000);
    return () => clearInterval(id);
  }, [cargar]);

  const pagoDe = (p) => pagos[p.id] || PAGO_INICIAL;

  const cobrar = async (p, tipo) => {
    setError('');
    const pago = pagoDe(p);
    if (tipo !== 'consumo_interno' && !pagoValido(pago.metodo, pago.montoEfectivo, total(p))) {
      return setError(`Mesa ${p.mesa}: en el pago mixto escribe cuánto fue en efectivo (menos que el total)`);
    }

    setOcupado(p.id);
    try {
      await confirmarPedido(
        p.id,
        tipo === 'consumo_interno'
          ? { tipo }
          : {
              metodo_pago: pago.metodo,
              ...(pago.metodo === 'mixto' ? { monto_efectivo: Number(pago.montoEfectivo) } : {}),
            }
      );
    } catch (e) {
      setError(e.response?.data?.message || e.response?.data?.error || 'No se pudo cobrar');
    } finally {
      setOcupado(null);
      cargar();
    }
  };

  const cancelar = async (p) => {
    const seguro = await confirmar({
      titulo: 'Cancelar pedido',
      mensaje: `¿Cancelar el pedido de la mesa ${p.mesa}? No se podrá cobrar.`,
      textoConfirmar: 'Sí, cancelar',
      textoCancelar: 'No, volver',
      peligro: true,
    });
    if (!seguro) return;
    try {
      await cambiarEstado(p.id, 'cancelado');
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo cancelar');
    }
    cargar();
  };

  // Corregir antes de cobrar: quitar un producto que se metió por error
  const quitar = async (p, it) => {
    const seguro = await confirmar({
      titulo: 'Quitar producto',
      mensaje: `¿Quitar "${it.producto_nombre}" del pedido de la mesa ${p.mesa}? El total se recalcula.`,
      textoConfirmar: 'Sí, quitar',
      textoCancelar: 'No, volver',
      peligro: true,
    });
    if (!seguro) return;
    setError('');
    try {
      await quitarItem(p.id, it.detalle_id);
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo quitar el producto');
    }
    cargar();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="text-mostaza-600" />
        <h1 className="font-display text-2xl text-pizarra-950">Caja</h1>
        <span className="text-sm text-pizarra-900/70">pedidos entregados, por cobrar</span>
      </div>
      {error && <p className="text-terracota-600 text-sm">{error}</p>}
      {pedidos.length === 0 && <p className="text-pizarra-900/70">Nada por cobrar.</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pedidos.map((p) => {
          const pago = pagoDe(p);
          const totalPedido = total(p);
          const pagoOk = pagoValido(pago.metodo, pago.montoEfectivo, totalPedido);
          return (
            <div key={p.id} className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-xl">Mesa {p.mesa}</p>
                  {p.mesero && <p className="text-xs text-pizarra-900/70">Mesero: {p.mesero}</p>}
                </div>
                <button
                  onClick={() => cancelar(p)}
                  title="Cancelar"
                  aria-label="Cancelar pedido"
                  className="text-pizarra-900/50 hover:text-terracota-600"
                >
                  <X size={18} />
                </button>
              </div>
              <ul className="space-y-2 text-sm">
                {p.items.map((it, i) => (
                  <li key={it.detalle_id ?? i}>
                    <div className="flex justify-between gap-2">
                      <span>
                        {it.cantidad}× {it.producto_nombre}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{cop(it.cantidad * Number(it.precio))}</span>
                        {p.items.length > 1 && (
                          <button
                            onClick={() => quitar(p, it)}
                            title="Quitar este producto"
                            aria-label={`Quitar ${it.producto_nombre}`}
                            className="text-pizarra-900/40 hover:text-terracota-600"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </span>
                    </div>
                    {it.sopa_nombre && (
                      <p className="text-xs text-pizarra-900/80">Sopa: {it.sopa_nombre}</p>
                    )}
                    {it.principio_nombre && (
                      <p className="text-xs text-pizarra-900/80">Principio: {it.principio_nombre}</p>
                    )}
                    {it.sin_principio && (
                      <p className="text-xs text-pizarra-900/80">Sin principio</p>
                    )}
                    {it.sin_sopa && (
                      <div className="flex justify-between gap-2 text-xs text-pizarra-900/80">
                        <span>Sin sopa</span>
                        <span className="font-bold text-terracota-600">{cop(it.ajuste)}</span>
                      </div>
                    )}
                    {it.nota && <p className="text-xs text-pizarra-900/80">↳ {it.nota}</p>}
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-pizarra-900/10 pt-3 font-semibold text-lg">
                <span>Total</span>
                <span>{cop(totalPedido)}</span>
              </div>

              <SelectorPago
                metodo={pago.metodo}
                montoEfectivo={pago.montoEfectivo}
                total={totalPedido}
                onCambio={(nuevo) => setPagos((prev) => ({ ...prev, [p.id]: nuevo }))}
              />

              <button
                disabled={ocupado === p.id || !pagoOk}
                onClick={() => cobrar(p)}
                className="w-full bg-mostaza-500 hover:bg-mostaza-600 disabled:opacity-60 text-pizarra-950 font-semibold rounded-xl py-3"
              >
                {ocupado === p.id ? 'Cobrando…' : 'Cobrar'}
              </button>
              <button
                disabled={ocupado === p.id}
                onClick={() => cobrar(p, 'consumo_interno')}
                className="w-full min-h-[44px] text-sm text-pizarra-900/70 underline"
              >
                Registrar como consumo interno
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}