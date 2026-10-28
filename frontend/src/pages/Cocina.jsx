import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { LogOut, Maximize, Minimize } from 'lucide-react';
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
  { // 4: pedido muy largo
    mesa: 'text-4xl', tiempo: 'text-2xl', cant: 'text-3xl', nombre: 'text-3xl',
    detalle: 'text-xl', nota: 'text-xl', etiqueta: 'text-lg', general: 'text-xl',
    espacio: 'space-y-2', columnas: '',
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
  const [, setTick] = useState(0);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const audioRef = useRef(null);
  const vistosRef = useRef(null); // null = todavía no cargó la primera vez; luego { id de pedido → cantidad de líneas }

  // El sonido siempre está activado, sin botones. Si el navegador lo tiene bloqueado hasta que
  // alguien toque la pantalla, se libera con el primer toque o tecla; y si Chrome se abre con
  // --autoplay-policy=no-user-gesture-required (ver acceso directo de cocina) suena desde el inicio.
  useEffect(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return undefined;

    const ctx = new Ctx();
    audioRef.current = ctx;
    const intentar = () => {
      ctx.resume().catch(() => {});
    };

    const eventos = ['pointerdown', 'keydown', 'touchstart'];
    eventos.forEach((e) => window.addEventListener(e, intentar));
    intentar();

    return () => {
      eventos.forEach((e) => window.removeEventListener(e, intentar));
      ctx.close().catch(() => {});
      audioRef.current = null;
    };
  }, []);

  // Pantalla completa: con el primer toque o tecla (el navegador exige un gesto del usuario)
  // y también con el botón de la esquina.
  const alternarPantallaCompleta = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const alCambiar = () => setPantallaCompleta(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', alCambiar);

    // Solo para el usuario de cocina; el administrador no entra en pantalla completa por sí solo
    let yaIntento = user?.rol !== 'cocina';
    const alPrimerToque = () => {
      if (yaIntento) return;
      yaIntento = true;
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    };
    window.addEventListener('click', alPrimerToque);
    window.addEventListener('keydown', alPrimerToque);
    window.addEventListener('touchend', alPrimerToque);

    return () => {
      document.removeEventListener('fullscreenchange', alCambiar);
      window.removeEventListener('click', alPrimerToque);
      window.removeEventListener('keydown', alPrimerToque);
      window.removeEventListener('touchend', alPrimerToque);
    };
  }, [user?.rol]);

  // Ajuste automático: todo se mide en "rem", así que cambiar el tamaño base de la página
  // agranda o achica la letra y las tarjetas juntas. Se busca el tamaño más grande en el que
  // todos los pedidos caben en la pantalla sin hacer scroll (con muchos pedidos baja la letra
  // y se acomodan más columnas; con pocos, se agranda).
  const contenedorRef = useRef(null);
  const firma = JSON.stringify(pedidos);
  useLayoutEffect(() => {
    // Solo la pantalla de cocina (la TV) se autoajusta; el administrador la ve con el tamaño normal
    if (user?.rol !== 'cocina') return undefined;
    const raiz = document.documentElement;
    const ajustar = () => {
      const el = contenedorRef.current;
      if (!el) return;
      const disponible = window.innerHeight - 16;
      let tamano = 1.4;
      for (; tamano > 0.4; tamano = Math.round((tamano - 0.05) * 100) / 100) {
        raiz.style.fontSize = `${16 * tamano}px`;
        if (el.offsetHeight <= disponible) break;
      }
    };
    ajustar();
    window.addEventListener('resize', ajustar);
     return () => window.removeEventListener('resize', ajustar);
  }, [firma, user?.rol]);
  useEffect(() => () => { document.documentElement.style.fontSize = ''; }, []);

  // Dos pitidos seguidos, para que se oigan por encima del ruido de la cocina
  const pitar = () => {
    try {
      const ctx = audioRef.current;
      if (!ctx) return;
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
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
    <div ref={contenedorRef}>
      {error && <p className="text-terracota-600 text-3xl mb-3">{error}</p>}
      {pedidos.length === 0 && (
        <p className="text-5xl text-pizarra-900/50 pt-24 text-center">Sin pedidos pendientes</p>
      )}

      {/* Las tarjetas se acomodan en columnas, sin huecos, aprovechando todo el ancho */}
      <div className="gap-3" style={{ columnWidth: '30rem' }}>
        {pedidos.map((p) => {
          const min = minutosDesde(p.creado_en);
          const nuevo = Date.now() - new Date(p.creado_en) < 30000;
          const nivel = nivelDe(p);
          const t = NIVELES[nivel];
          return (
            <div
              key={p.id}
              className={`bg-papel-card rounded-2xl shadow-sm border-8 p-4 mb-3 break-inside-avoid ${t.espacio} ${colorBorde(min)}`}
            >
              {/* Encabezado: mesa a la izquierda, tiempo a la derecha */}
              <div className="flex items-start justify-between gap-4 border-b-4 border-pizarra-900/15 pb-2">
                <p className={`font-display leading-none ${t.mesa}`}>Mesa {p.mesa}</p>
                <div className="text-right shrink-0">
                  {nuevo && (
                    <span className="inline-block text-xl font-bold bg-mostaza-500 text-pizarra-950 rounded-full px-3 py-0.5 mb-1">
                      NUEVO
                    </span>
                  )}
                  <p className={`font-bold leading-none ${t.tiempo}`}>{min < 1 ? 'ahora' : `${min} min`}</p>
                </div>
              </div>

              {/* Productos: cantidad en una columna y el detalle alineado a su derecha */}
              <ul className={t.espacio}>
                {p.items.map((it, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[auto_1fr] gap-x-4 items-start border-b-2 border-pizarra-900/10 pb-2 last:border-0 last:pb-0"
                  >
                    <span className={`font-extrabold leading-none text-pizarra-950 ${t.cant}`}>{it.cantidad}×</span>
                    <div className="space-y-1 min-w-0">
                      <p className={`font-bold leading-tight break-words ${t.nombre}`}>{it.producto_nombre}</p>
                      {it.agregado && (
                        <span className={`inline-block font-bold bg-mostaza-500 text-pizarra-950 rounded-full px-4 py-0.5 ${t.etiqueta}`}>
                          AGREGADO
                        </span>
                      )}
                      {it.sopa_nombre && (
                        <p className={`text-pizarra-900/90 leading-tight ${t.detalle}`}>Sopa: {it.sopa_nombre}</p>
                      )}
                      {it.sin_sopa && (
                        <span className={`inline-block font-bold bg-pizarra-900 text-white rounded-xl px-4 py-0.5 ${t.etiqueta}`}>
                          SIN SOPA
                        </span>
                      )}
                      {it.principio_nombre && (
                        <p className={`text-pizarra-900/90 leading-tight ${t.detalle}`}>
                          Principio: {it.principio_nombre}
                        </p>
                      )}
                      {it.nota && (
                        <p className={`font-bold leading-tight text-terracota-600 bg-terracota-500/10 border-l-8 border-terracota-600 rounded-r-xl px-3 py-1 break-words ${t.nota}`}>
                          {it.nota}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {p.notas && (
                <p className={`italic leading-tight text-pizarra-900/80 border-t-4 border-pizarra-900/15 pt-2 break-words ${t.general}`}>
                  “{p.notas}”
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Controles pequeños en la esquina: no le quitan espacio a los pedidos */}
      <div className="fixed bottom-2 right-2 z-20 flex items-center gap-1 rounded-full bg-pizarra-950/70 text-papel px-2 py-1">
        <span className="px-2 text-lg font-bold" title="Pedidos pendientes">{pedidos.length}</span>
        <button
          onClick={alternarPantallaCompleta}
          title={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
          aria-label="Pantalla completa"
          className="p-2"
        >
          {pantallaCompleta ? <Minimize size={22} /> : <Maximize size={22} />}
        </button>
        {user?.rol === 'cocina' && (
          <button onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión" className="p-2">
            <LogOut size={22} />
          </button>
        )}
      </div>
    </div>
  );
}