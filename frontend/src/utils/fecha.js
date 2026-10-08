// Devuelve la fecha de HOY en tu zona horaria local, como "YYYY-MM-DD"
// (evita el bug de toISOString(), que convierte a UTC y adelanta el día por la noche)
export function fechaHoyLocal() {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, '0');
  const day = String(hoy.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}