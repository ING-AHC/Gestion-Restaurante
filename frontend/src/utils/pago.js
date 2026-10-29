// Texto corto de cómo se pagó algo: "Efectivo", "Transferencia" o "Mixto · efectivo $20.000 + transferencia $25.000"
const pesos = (n) => `$${Math.round(Number(n)).toLocaleString('es-CO')}`;

export const etiquetaPago = (metodo, montoEfectivo, total) => {
  if (metodo === 'transferencia') return 'Transferencia';
  if (metodo === 'mixto') {
    const efectivo = Number(montoEfectivo) || 0;
    const resto = Math.max(0, Number(total) - efectivo);
    return `Mixto · efectivo ${pesos(efectivo)} + transferencia ${pesos(resto)}`;
  }
  return 'Efectivo';
};

// En un pago mixto, el efectivo debe ser mayor que 0 y menor que el total
export const pagoValido = (metodo, montoEfectivo, total) =>
  metodo !== 'mixto' || (Number(montoEfectivo) > 0 && Number(montoEfectivo) < Number(total));