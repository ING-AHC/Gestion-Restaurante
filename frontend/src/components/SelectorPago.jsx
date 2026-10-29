import InputMoneda from './InputMoneda';

const OPCIONES = [
  { id: 'efectivo', texto: 'Efectivo' },
  { id: 'transferencia', texto: 'Transferencia' },
  { id: 'mixto', texto: 'Mixto' },
];

const pesos = (n) => `$${Math.round(Number(n)).toLocaleString('es-CO')}`;

// Escoge cómo se pagó: efectivo, transferencia o mixto (parte en efectivo y el resto por transferencia).
// - total: valor a pagar, para calcular lo que queda por transferencia en el pago mixto
// - onCambio({ metodo, montoEfectivo }): avisa cada vez que cambia algo
function SelectorPago({ metodo, montoEfectivo, total, onCambio, etiqueta = 'Forma de pago' }) {
  const efectivo = Number(montoEfectivo) || 0;
  const resto = Number(total) - efectivo;
  const mixtoInvalido = metodo === 'mixto' && (efectivo <= 0 || efectivo >= Number(total));

  return (
    <div className="space-y-2">
      {etiqueta && <p className="text-sm font-semibold text-pizarra-800">{etiqueta}</p>}
      <div className="flex gap-2" role="radiogroup" aria-label={etiqueta || 'Forma de pago'}>
        {OPCIONES.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={metodo === o.id}
            onClick={() => onCambio({ metodo: o.id, montoEfectivo: o.id === 'mixto' ? montoEfectivo : '' })}
            className={`flex-1 min-h-[44px] py-2 rounded-lg text-sm font-semibold transition-colors ${
              metodo === o.id ? 'bg-pizarra-900 text-papel' : 'bg-pizarra-900/5 text-pizarra-700'
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>

      {metodo === 'mixto' && (
        <div className="space-y-1">
          <InputMoneda
            value={montoEfectivo}
            onChange={(valor) => onCambio({ metodo, montoEfectivo: valor })}
            placeholder="¿Cuánto pagaron en efectivo?"
            required
            className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 text-sm focus:outline-none focus:ring-2 focus:ring-mostaza-500"
          />
          <p className={`text-xs ${mixtoInvalido && efectivo > 0 ? 'text-terracota-600' : 'text-pizarra-700'}`}>
            {efectivo <= 0
              ? 'Escribe la parte en efectivo; el resto queda como transferencia.'
              : efectivo >= Number(total)
                ? 'El efectivo debe ser menor que el total.'
                : `Transferencia: ${pesos(resto)}`}
          </p>
        </div>
      )}
    </div>
  );
}

export default SelectorPago;