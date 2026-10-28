import { useEffect, useRef, useState, useCallback } from 'react';
import { ChefHat, Volume2, VolumeX } from 'lucide-react';
import { getPedidos } from '../services/pedidoService';

const minutosDesde = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso)) / 60000));

const colorBorde = (min) =>
  min >= 20 ? 'border-terracota-600' : min >= 10 ? 'border-mostaza-500' : 'border-green-600';

export default function Cocina() {
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState('');
  const [sonidoActivo, setSonidoActivo] = useState(false);
  const [, setTick] = useState(0);
  const audioRef = useRef(null);
  const vistosRef = useRef(null); // null = todavía no cargó la primera vez; luego { id de pedido → cantidad de líneas }

  // El sonido siempre está activado. El navegador solo deja sonar el audio después de que
  // alguien toca la pantalla una vez; mientras tanto se muestra un aviso para hacerlo.
  useEffect(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return undefined;

    const ctx = new Ctx();
    audioRef.current = ctx;
    const actualizar = () => setSonidoActivo(ctx.state === 'running');
    const intentar = () => {
      ctx.resume().then(actualizar).catch(() => {});
    };

    ctx.addEventListener('statechange', actualizar);
    const eventos = ['pointerdown', 'keydown', 'touchstart'];
    eventos.forEach((e) => window.addEventListener(e, intentar));
    intentar();

    return () => {
      eventos.forEach((e) => window.removeEventListener(e, intentar));
      ctx.removeEventListener('statechange', actualizar);
      ctx.close().catch(() => {});
      audioRef.current = null;
    };
  }, []);

  // Dos pitidos seguidos, para que se oigan por encima del ruido de la cocina
  const pitar = () => {
    try {
      const ctx = audioRef.current;
      if (!ctx || ctx.state !== 'running') return;
      [0, 0.3].forEach((retraso) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.25;
        osc.start(ctx.currentTime + retraso);
        osc.stop(ctx.currentTime + retraso + 0.2);
      });
    } catch {
      /* sin sonido */
    }
  };

  const cargar = useCallback(async () => {
    try {
      const lista = await getPedidos('pendiente,en_preparacion');
      const vistos = new Map(lista.map((p) => [p.id, p.items.length]));
      if (vistosRef.current) {
        // Suena con un pedido nuevo o cuando a uno existente le agregan productos
        const hayNuevo = lista.some(
          (p) => !vistosRef.current.has(p.id) || p.items.length > vistosRef.current.get(p.id)
        );
        if (hayNuevo) pitar();
      }
      vistosRef.current = vistos;
      setPedidos(lista);
      setError('');
    } catch {
      setError('Sin conexión, reintentando…');
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(() => {
      cargar();
      setTick((t) => t + 1);
    }, 3000);
    return () => clearInterval(id);
  }, [cargar]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <ChefHat className="text-mostaza-600" size={48} />
          <h1 className="font-display text-5xl text-pizarra-950">Cocina</h1>
          <span className="text-3xl text-pizarra-900/60">({pedidos.length})</span>
        </div>
        <span
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-lg ${
            sonidoActivo ? 'text-green-700' : 'text-pizarra-900/50'
          }`}
        >
          {sonidoActivo ? <Volume2 size={26} /> : <VolumeX size={26} />}
          {sonidoActivo ? 'Sonido activado' : 'Sonido en espera'}
        </span>
      </div>

      {!sonidoActivo && (
        <p className="rounded-xl bg-mostaza-500/25 border border-mostaza-500 px-5 py-4 text-xl">
          Toca cualquier parte de la pantalla una vez para activar el sonido de los pedidos nuevos.
        </p>
      )}

      {error && <p className="text-terracota-600 text-2xl">{error}</p>}
      {pedidos.length === 0 && (
        <p className="text-3xl text-pizarra-900/60 pt-10 text-center">Sin pedidos pendientes</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        {pedidos.map((p) => {
          const min = minutosDesde(p.creado_en);
          const nuevo = Date.now() - new Date(p.creado_en) < 30000;
          return (
            <div
              key={p.id}
              className={`bg-papel-card rounded-2xl shadow-sm border-8 p-8 space-y-5 ${colorBorde(min)}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-5xl">Mesa {p.mesa}</p>
                <div className="text-right">
                  {nuevo && (
                    <span className="block text-base font-bold bg-mostaza-500 text-pizarra-950 rounded-full px-3 py-1 mb-1">
                      NUEVO
                    </span>
                  )}
                  <span className="text-3xl font-semibold">{min < 1 ? 'ahora' : `${min} min`}</span>
                </div>
              </div>

              <ul className="space-y-4 text-4xl leading-tight">
                {p.items.map((it, i) => (
                  <li key={i}>
                    {it.agregado && (
                      <span className="inline-block mr-3 align-middle text-lg font-bold bg-mostaza-500 text-pizarra-950 rounded-full px-3 py-1">
                        AGREGADO
                      </span>
                    )}
                    <span className="font-bold">{it.cantidad}×</span> {it.producto_nombre}
                    {it.sopa_nombre && (
                      <span className="block text-3xl text-pizarra-900/80">Sopa: {it.sopa_nombre}</span>
                    )}
                    {it.sin_sopa && (
                      <span className="inline-block mt-1 text-2xl font-bold bg-pizarra-900 text-white rounded-lg px-4 py-1">
                        SIN SOPA
                      </span>
                    )}
                    {it.principio_nombre && (
                      <span className="block text-3xl text-pizarra-900/80">Principio: {it.principio_nombre}</span>
                    )}
                    {it.nota && (
                      <span className="block text-2xl text-terracota-600">↳ {it.nota}</span>
                    )}
                  </li>
                ))}
              </ul>

              {p.notas && <p className="text-2xl italic text-pizarra-900/70">“{p.notas}”</p>}
              {p.mesero && <p className="text-xl text-pizarra-900/50">Mesero: {p.mesero}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}