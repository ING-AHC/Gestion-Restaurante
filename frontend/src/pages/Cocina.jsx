import { useEffect, useRef, useState, useCallback } from 'react';
import { ChefHat, Volume2, VolumeX, LogOut } from 'lucide-react';
import { getPedidos } from '../services/pedidoService';
import { useAuth } from '../context/AuthContext';

const minutosDesde = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso)) / 60000));

const colorBorde = (min) =>
  min >= 20 ? 'border-terracota-600' : min >= 10 ? 'border-mostaza-500' : 'border-green-600';

// La letra de cada tarjeta se ajusta a cuánto lleva el pedido:
// pocos productos → letra enorme; muchos → más pequeña y en dos columnas.
// (Las clases van completas para que Tailwind las detecte.)
const NIVELES = [
  { // 1: pedido corto
    mesa: 'text-6xl', tiempo: 'text-4xl', cant: 'text-6xl', nombre: 'text-6xl',
    detalle: 'text-4xl', nota: 'text-4xl', etiqueta: 'text-3xl', general: 'text-3xl',
    espacio: 'space-y-4', columnas: '',
  },
  { // 2: pedido mediano
    mesa: 'text-5xl', tiempo: 'text-3xl', cant: 'text-5xl', nombre: 'text-5xl',
    detalle: 'text-3xl', nota: 'text-3xl', etiqueta: 'text-2xl', general: 'text-2xl',
    espacio: 'space-y-3', columnas: '',
  },
  { // 3: pedido largo
    mesa: 'text-4xl', tiempo: 'text-2xl', cant: 'text-4xl', nombre: 'text-4xl',
    detalle: 'text-2xl', nota: 'text-2xl', etiqueta: 'text-xl', general: 'text-xl',
    espacio: 'space-y-3', columnas: '',
  },
  { // 4: pedido muy largo → dos columnas y la tarjeta ocupa todo el ancho
    mesa: 'text-4xl', tiempo: 'text-2xl', cant: 'text-3xl', nombre: 'text-3xl',
    detalle: 'text-xl', nota: 'text-xl', etiqueta: 'text-lg', general: 'text-xl',
    espacio: 'space-y-3', columnas: 'md:columns-2 md:gap-8',
  },
];

// "Peso" del pedido: cada producto cuenta una línea, más una por cada sopa, principio o nota.
const pesoPedido = (p) =>
  p.items.reduce(
    (t, it) => t + 1 + (it.sopa_nombre ? 1 : 0) + (it.principio_nombre ? 1 : 0) + (it.nota ? 1 : 0),
    0
  );
const nivelDe = (p) => {
  const peso = pesoPedido(p);
  return peso <= 4 ? 0 : peso <= 8 ? 1 : peso <= 14 ? 2 : 3;
};

export default function Cocina() {
  const { user, logout } = useAuth();
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ChefHat className="text-mostaza-600" size={40} />
          <h1 className="font-display text-4xl text-pizarra-950">Cocina</h1>
          <span className="text-3xl text-pizarra-900/60">({pedidos.length})</span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-2 rounded-xl px-3 py-1 text-lg ${
              sonidoActivo ? 'text-green-700' : 'text-pizarra-900/50'
            }`}
          >
            {sonidoActivo ? <Volume2 size={24} /> : <VolumeX size={24} />}
            {sonidoActivo ? 'Sonido activado' : 'Sonido en espera'}
          </span>
          {user?.rol === 'cocina' && (
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-xl border border-pizarra-900/25 px-3 py-2 text-base font-medium text-pizarra-900/70"
            >
              <LogOut size={18} />
              Salir
            </button>
          )}
        </div>
      </div>

      {!sonidoActivo && (
        <p className="rounded-xl bg-mostaza-500/25 border border-mostaza-500 px-5 py-4 text-2xl">
          Toca cualquier parte de la pantalla una vez para activar el sonido de los pedidos nuevos.
        </p>
      )}

      {error && <p className="text-terracota-600 text-3xl">{error}</p>}
      {pedidos.length === 0 && (
        <p className="text-4xl text-pizarra-900/60 pt-10 text-center">Sin pedidos pendientes</p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {pedidos.map((p) => {
          const min = minutosDesde(p.creado_en);
          const nuevo = Date.now() - new Date(p.creado_en) < 30000;
          const nivel = nivelDe(p);
          const t = NIVELES[nivel];
          return (
            <div
              key={p.id}
              className={`bg-papel-card rounded-2xl shadow-sm border-8 p-5 ${t.espacio} ${colorBorde(min)} ${
                nivel === 3 ? 'xl:col-span-2' : ''
              }`}
            >
              {/* Encabezado: mesa a la izquierda, tiempo a la derecha */}
              <div className="flex items-start justify-between gap-4 border-b-4 border-pizarra-900/15 pb-3">
                <p className={`font-display leading-none ${t.mesa}`}>Mesa {p.mesa}</p>
                <div className="text-right shrink-0">
                  {nuevo && (
                    <span className="inline-block text-2xl font-bold bg-mostaza-500 text-pizarra-950 rounded-full px-4 py-1 mb-2">
                      NUEVO
                    </span>
                  )}
                  <p className={`font-bold leading-none ${t.tiempo}`}>{min < 1 ? 'ahora' : `${min} min`}</p>
                </div>
              </div>

              {/* Productos: cantidad en una columna y el detalle alineado a su derecha */}
              <ul className={`${t.espacio} ${t.columnas}`}>
                {p.items.map((it, i) => (
                  <li
                    key={i}
                    className={`grid grid-cols-[auto_1fr] gap-x-5 items-start border-b-2 border-pizarra-900/10 pb-4 mb-4 break-inside-avoid ${
                      nivel === 3 ? '' : 'last:border-0 last:pb-0 last:mb-0'
                    }`}
                  >
                    <span className={`font-extrabold leading-none text-pizarra-950 ${t.cant}`}>{it.cantidad}×</span>
                    <div className="space-y-2 min-w-0">
                      <p className={`font-bold leading-tight break-words ${t.nombre}`}>{it.producto_nombre}</p>
                      {it.agregado && (
                        <span className={`inline-block font-bold bg-mostaza-500 text-pizarra-950 rounded-full px-5 py-1 ${t.etiqueta}`}>
                          AGREGADO
                        </span>
                      )}
                      {it.sopa_nombre && (
                        <p className={`text-pizarra-900/90 leading-tight ${t.detalle}`}>Sopa: {it.sopa_nombre}</p>
                      )}
                      {it.sin_sopa && (
                        <span className={`inline-block font-bold bg-pizarra-900 text-white rounded-xl px-5 py-1 ${t.etiqueta}`}>
                          SIN SOPA
                        </span>
                      )}
                      {it.principio_nombre && (
                        <p className={`text-pizarra-900/90 leading-tight ${t.detalle}`}>
                          Principio: {it.principio_nombre}
                        </p>
                      )}
                      {it.nota && (
                        <p className={`font-bold leading-tight text-terracota-600 bg-terracota-500/10 border-l-8 border-terracota-600 rounded-r-xl px-4 py-2 break-words ${t.nota}`}>
                          {it.nota}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {p.notas && (
                <p className={`italic leading-tight text-pizarra-900/80 border-t-4 border-pizarra-900/15 pt-3 break-words ${t.general}`}>
                  “{p.notas}”
                </p>
              )}
              {p.mesero && <p className="text-2xl text-pizarra-900/50">Mesero: {p.mesero}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}