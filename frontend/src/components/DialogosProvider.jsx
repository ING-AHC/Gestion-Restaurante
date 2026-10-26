import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { DialogosContext } from './dialogosContexto';

const normalizar = (opciones) => (typeof opciones === 'string' ? { mensaje: opciones } : opciones || {});

export default function DialogosProvider({ children }) {
  const [dialogo, setDialogo] = useState(null);
  const resolverRef = useRef(null);
  const botonRef = useRef(null);
  const previoRef = useRef(null);

  const abrir = useCallback(
    (config) =>
      new Promise((resolve) => {
        resolverRef.current?.(false); // si ya había una abierta, se descarta
        resolverRef.current = resolve;
        previoRef.current = document.activeElement;
        setDialogo(config);
      }),
    []
  );

  const cerrar = useCallback((valor) => {
    resolverRef.current?.(valor);
    resolverRef.current = null;
    setDialogo(null);
    previoRef.current?.focus?.();
  }, []);

  const confirmar = useCallback((opciones) => abrir({ tipo: 'confirmar', ...normalizar(opciones) }), [abrir]);
  const avisar = useCallback(
    (opciones) => abrir({ tipo: 'aviso', ...normalizar(opciones) }).then(() => undefined),
    [abrir]
  );

  // Con la ventana abierta: el foco va al botón principal y Escape la cierra
  useEffect(() => {
    if (!dialogo) return undefined;
    botonRef.current?.focus();
    const alTeclear = (e) => {
      if (e.key === 'Escape') cerrar(false);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [dialogo, cerrar]);

  const valor = useMemo(() => ({ confirmar, avisar }), [confirmar, avisar]);
  const esConfirmacion = dialogo?.tipo === 'confirmar';
  const peligro = Boolean(dialogo?.peligro);

  return (
    <DialogosContext.Provider value={valor}>
      {children}
      {dialogo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-pizarra-950/50 p-4"
          onClick={() => cerrar(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialogo-titulo"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-papel-card border border-pizarra-900/10 shadow-xl p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <span
                className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  peligro ? 'bg-terracota-500/15 text-terracota-600' : 'bg-mostaza-500/20 text-mostaza-600'
                }`}
              >
                {peligro ? <AlertTriangle size={20} /> : <Info size={20} />}
              </span>
              <div className="min-w-0">
                <h2 id="dialogo-titulo" className="font-display text-lg text-pizarra-950">
                  {dialogo.titulo || (esConfirmacion ? 'Confirmar' : 'Aviso')}
                </h2>
                {dialogo.mensaje && <p className="mt-1 text-sm text-pizarra-900/80">{dialogo.mensaje}</p>}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              {esConfirmacion && (
                <button
                  type="button"
                  onClick={() => cerrar(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-pizarra-900/25 text-sm font-medium"
                >
                  {dialogo.textoCancelar || 'Cancelar'}
                </button>
              )}
              <button
                type="button"
                ref={botonRef}
                onClick={() => cerrar(true)}
                className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold ${
                  peligro
                    ? 'bg-terracota-600 hover:bg-terracota-500 text-white'
                    : 'bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950'
                }`}
              >
                {dialogo.textoConfirmar || (esConfirmacion ? 'Aceptar' : 'Entendido')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogosContext.Provider>
  );
}