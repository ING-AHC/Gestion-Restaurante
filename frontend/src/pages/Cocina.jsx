import { useEffect, useRef, useState, useCallback } from 'react';
import { ChefHat, Volume2, VolumeX } from 'lucide-react';
import { getPedidos } from '../services/pedidoService';

const minutosDesde = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso)) / 60000));

const colorBorde = (min) =>
  min >= 20 ? 'border-terracota-600' : min >= 10 ? 'border-mostaza-500' : 'border-green-600';

export default function Cocina() {
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState('');
  const [sonido, setSonido] = useState(false);
  const [, setTick] = useState(0);
  const audioRef = useRef(null);
  const vistosRef = useRef(null); // null = todavía no cargó la primera vez
  const sonidoRef = useRef(false);

  sonidoRef.current = sonido;

  const pitar = () => {
    try {
      const ctx = audioRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.2;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      /* sin sonido */
    }
  };

  const cargar = useCallback(async () => {
    try {
      const lista = await getPedidos('pendiente,en_preparacion');
      const ids = new Set(lista.map((p) => p.id));
      if (vistosRef.current) {
        const hayNuevo = lista.some((p) => !vistosRef.current.has(p.id));
        if (hayNuevo && sonidoRef.current) pitar();
      }
      vistosRef.current = ids;
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

  const alternarSonido = () => {
    if (!sonido) {
      // El navegador solo permite audio después de un clic: se crea aquí
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && !audioRef.current) audioRef.current = new Ctx();
      audioRef.current?.resume();
      setSonido(true);
      pitar();
    } else {
      setSonido(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ChefHat className="text-mostaza-600" size={32} />
          <h1 className="font-display text-3xl text-pizarra-950">Cocina</h1>
          <span className="text-lg text-pizarra-900/60">({pedidos.length})</span>
        </div>
        <button
          onClick={alternarSonido}
          className="flex items-center gap-2 border border-pizarra-900/20 rounded-xl px-4 py-2 text-sm"
        >
          {sonido ? <Volume2 size={18} /> : <VolumeX size={18} />}
          {sonido ? 'Sonido activado' : 'Activar sonido'}
        </button>
      </div>

      {error && <p className="text-terracota-600">{error}</p>}
      {pedidos.length === 0 && (
        <p className="text-xl text-pizarra-900/60 pt-8 text-center">Sin pedidos pendientes</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {pedidos.map((p) => {
          const min = minutosDesde(p.creado_en);
          const nuevo = Date.now() - new Date(p.creado_en) < 30000;
          return (
            <div
              key={p.id}
              className={`bg-papel-card rounded-2xl shadow-sm border-4 p-6 space-y-4 ${colorBorde(min)}`}
            >
              <div className="flex items-center justify-between">
                <p className="font-display text-3xl">Mesa {p.mesa}</p>
                <div className="text-right">
                  {nuevo && (
                    <span className="block text-xs font-bold bg-mostaza-500 text-pizarra-950 rounded-full px-2 py-0.5 mb-1">
                      NUEVO
                    </span>
                  )}
                  <span className="text-lg font-semibold">{min < 1 ? 'ahora' : `${min} min`}</span>
                </div>
              </div>

              <ul className="space-y-2 text-2xl">
                {p.items.map((it, i) => (
                  <li key={i}>
                    <span className="font-bold">{it.cantidad}×</span> {it.producto_nombre}
                    {it.nota && (
                      <span className="block text-lg text-terracota-600">↳ {it.nota}</span>
                    )}
                  </li>
                ))}
              </ul>

              {p.notas && <p className="text-lg italic text-pizarra-900/70">“{p.notas}”</p>}
              {p.mesero && <p className="text-sm text-pizarra-900/50">Mesero: {p.mesero}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}