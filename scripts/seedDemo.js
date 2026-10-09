// Carga una cuenta demo con datos inventados usando la API real.
// Uso (PowerShell, desde la raíz del proyecto):
//   $env:API_URL = "https://restaurante-backend-production-9f5c.up.railway.app/api"
//   $env:DEMO_PASSWORD = "una-clave-que-no-uses-en-otro-sitio"
//   node scripts/seedDemo.js

const API_URL = process.env.API_URL;
const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@restaurante-demo.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

if (!API_URL || !DEMO_PASSWORD) {
  console.error('Faltan las variables API_URL y DEMO_PASSWORD');
  process.exit(1);
}

let token = null;

const api = async (metodo, ruta, cuerpo) => {
  const res = await fetch(`${API_URL}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${metodo} ${ruta} -> ${res.status} ${data.error || ''}`);
  }
  return data;
};

// Fecha local en formato YYYY-MM-DD (sin el bug de la zona horaria)
const fechaHace = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

// Números pseudoaleatorios repetibles
let semilla = 20261008;
const azar = () => {
  semilla = (semilla * 16807) % 2147483647;
  return semilla / 2147483647;
};
const entre = (min, max) => Math.floor(azar() * (max - min + 1)) + min;

const autenticar = async () => {
  try {
    const r = await api('POST', '/auth/login', { email: DEMO_EMAIL, password: DEMO_PASSWORD });
    token = r.token;
    console.log('Sesión iniciada con la cuenta demo existente');
  } catch {
    const r = await api('POST', '/auth/register', {
      name: 'Restaurante Demo',
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    token = r.token;
    console.log('Cuenta demo creada');
  }
};

const main = async () => {
  await autenticar();

  const existentes = await api('GET', '/insumos');
  if (existentes.length > 0) {
    console.log('La cuenta demo ya tiene datos. No se carga nada para no duplicar.');
    return;
  }

  // Categorías
  const categorias = {};
  for (const nombre of ['Carnes', 'Verduras', 'Abarrotes', 'Bebidas', 'Aseo', 'Servicios']) {
    const c = await api('POST', '/categorias-gasto', { nombre });
    categorias[nombre] = c.id;
  }

  // Proveedores (nombres y teléfonos inventados)
  const proveedores = {};
  for (const [nombre, telefono] of [
    ['Carnes Don Mario', '3000000001'],
    ['Verduras del Campo', '3000000002'],
    ['Distribuidora La Sabana', '3000000003'],
    ['Bebidas Andina', '3000000004'],
  ]) {
    const p = await api('POST', '/proveedores', { nombre, telefono });
    proveedores[nombre] = p.id;
  }

  // Insumos (empiezan en 0; el stock llega con las compras)
  const insumos = {};
  for (const [nombre, unidad, categoria] of [
    ['Pollo', 'libras', 'Carnes'],
    ['Carne de res', 'libras', 'Carnes'],
    ['Arroz', 'libras', 'Abarrotes'],
    ['Papa', 'libras', 'Verduras'],
    ['Plátano maduro', 'unidad', 'Verduras'],
    ['Huevos', 'unidad', 'Abarrotes'],
    ['Aceite', 'litros', 'Abarrotes'],
    ['Pan de hamburguesa', 'unidad', 'Abarrotes'],
    ['Gaseosa 400ml', 'unidad', 'Bebidas'],
    ['Cerveza', 'unidad', 'Bebidas'],
  ]) {
    const i = await api('POST', '/insumos', {
      nombre,
      unidad_medida: unidad,
      cantidad_actual: 0,
      categoria_id: categorias[categoria],
    });
    insumos[nombre] = i.id;
  }

  // Compras. En la app, "valor" es el valor total de la línea.
  const compras = [
    { dias: 14, proveedor: 'Carnes Don Mario', estado: 'pagado', items: [
      { insumo: 'Pollo', cantidad: 90, valor: 765000 },
      { insumo: 'Carne de res', cantidad: 50, valor: 900000 },
    ] },
    { dias: 14, proveedor: 'Verduras del Campo', estado: 'pagado', items: [
      { insumo: 'Papa', cantidad: 100, valor: 150000 },
      { insumo: 'Plátano maduro', cantidad: 150, valor: 150000 },
    ] },
    { dias: 13, proveedor: 'Distribuidora La Sabana', estado: 'pagado', items: [
      { insumo: 'Arroz', cantidad: 60, valor: 168000 },
      { insumo: 'Aceite', cantidad: 10, valor: 110000 },
      { insumo: 'Huevos', cantidad: 90, valor: 45000 },
      { insumo: 'Pan de hamburguesa', cantidad: 80, valor: 72000 },
    ] },
    { dias: 12, proveedor: 'Bebidas Andina', estado: 'pagado', items: [
      { insumo: 'Gaseosa 400ml', cantidad: 120, valor: 264000 },
      { insumo: 'Cerveza', cantidad: 70, valor: 210000 },
    ] },
    { dias: 10, proveedor: 'Distribuidora La Sabana', estado: 'pagado', items: [
      { descripcion: 'Detergente y desinfectante', categoria: 'Aseo', valor: 85000 },
    ] },
    { dias: 8, proveedor: null, estado: 'pagado', items: [
      { descripcion: 'Gas propano', categoria: 'Servicios', valor: 72000 },
    ] },
    { dias: 7, proveedor: 'Carnes Don Mario', estado: 'pendiente', items: [
      { insumo: 'Pollo', cantidad: 60, valor: 510000 },
      { insumo: 'Carne de res', cantidad: 30, valor: 540000 },
    ] },
    { dias: 7, proveedor: 'Verduras del Campo', estado: 'pagado', items: [
      { insumo: 'Papa', cantidad: 80, valor: 120000 },
      { insumo: 'Plátano maduro', cantidad: 120, valor: 120000 },
    ] },
    { dias: 6, proveedor: 'Bebidas Andina', estado: 'pendiente', items: [
      { insumo: 'Gaseosa 400ml', cantidad: 80, valor: 176000 },
      { insumo: 'Cerveza', cantidad: 40, valor: 120000 },
    ] },
    { dias: 4, proveedor: null, estado: 'pagado', items: [
      { descripcion: 'Energía eléctrica', categoria: 'Servicios', valor: 210000 },
    ] },
    { dias: 3, proveedor: 'Distribuidora La Sabana', estado: 'pagado', items: [
      { insumo: 'Arroz', cantidad: 40, valor: 112000 },
      { insumo: 'Huevos', cantidad: 60, valor: 30000 },
      { insumo: 'Pan de hamburguesa', cantidad: 50, valor: 45000 },
    ] },
  ];

  for (const c of compras) {
    const items = c.items.map((it) =>
      it.insumo
        ? { insumo_id: insumos[it.insumo], cantidad: it.cantidad, valor_unitario: it.valor }
        : { descripcion: it.descripcion, categoria_id: categorias[it.categoria], valor_unitario: it.valor }
    );
    await api('POST', '/compras', {
      proveedor_id: c.proveedor ? proveedores[c.proveedor] : null,
      estado_pago: c.estado,
      fecha: fechaHace(c.dias),
      items,
    });
  }

  // Menú y recetas
  const menu = [
    { nombre: 'Almuerzo ejecutivo', tipo: 'ejecutivo', precio: 14000, peso: 12,
      receta: [['Pollo', 0.4], ['Arroz', 0.25], ['Papa', 0.3], ['Plátano maduro', 1]] },
    { nombre: 'Churrasco', tipo: 'especial', precio: 28000, peso: 3,
      receta: [['Carne de res', 0.8], ['Papa', 0.5], ['Arroz', 0.25], ['Aceite', 0.02]] },
    { nombre: 'Pechuga a la plancha', tipo: 'especial', precio: 22000, peso: 4,
      receta: [['Pollo', 0.7], ['Arroz', 0.25], ['Papa', 0.3]] },
    { nombre: 'Hamburguesa', tipo: 'rapida', precio: 16000, peso: 4,
      receta: [['Carne de res', 0.4], ['Pan de hamburguesa', 1], ['Papa', 0.3], ['Huevos', 1]] },
    { nombre: 'Gaseosa 400ml', tipo: 'bebida', precio: 3500, peso: 8, insumo: 'Gaseosa 400ml' },
    { nombre: 'Cerveza', tipo: 'bebida', precio: 5000, peso: 4, insumo: 'Cerveza' },
  ];

  const porId = new Map();
  for (const p of menu) {
    const creado = await api('POST', '/productos', {
      nombre: p.nombre,
      tipo: p.tipo,
      precio: p.precio,
      insumo_id: p.insumo ? insumos[p.insumo] : undefined,
    });
    p.id = creado.id;
    porId.set(p.id, p);
    if (p.receta) {
      await api('POST', `/productos/${p.id}/insumos`, {
        insumos: p.receta.map(([nombre, cantidad]) => ({
          insumo_id: insumos[nombre],
          cantidad_usada: cantidad,
        })),
      });
    }
  }

  // Ventas de los últimos 15 días
  const pesoTotal = menu.reduce((suma, p) => suma + p.peso, 0);
  const elegirProducto = () => {
    let r = azar() * pesoTotal;
    for (const p of menu) {
      r -= p.peso;
      if (r <= 0) return p;
    }
    return menu[0];
  };

  let totalVentas = 0;
  for (let dias = 14; dias >= 0; dias--) {
    const pedidos = entre(6, 10);
    for (let n = 0; n < pedidos; n++) {
      const lineas = new Map();
      const cuantos = entre(1, 3);
      for (let k = 0; k < cuantos; k++) {
        const p = elegirProducto();
        lineas.set(p.id, (lineas.get(p.id) || 0) + entre(1, 2));
      }

      const items = [...lineas].map(([producto_id, cantidad]) => {
        const item = { producto_id, cantidad };
        if (porId.get(producto_id).tipo !== 'bebida') {
          const r = azar();
          if (r < 0.08) {
            item.adicion_descripcion = 'Huevo adicional';
            item.adicion_valor = 2000;
          } else if (r < 0.12) {
            item.adicion_descripcion = 'Descuento cliente frecuente';
            item.adicion_valor = -2000;
          }
        }
        return item;
      });

      await api('POST', '/ventas', {
        tipo: azar() < 0.05 ? 'consumo_interno' : 'venta',
        fecha: fechaHace(dias),
        items,
      });
      totalVentas++;
    }
  }

  // Ajuste de inventario: dos insumos con stock bajo para mostrar las alertas
  await api('PUT', `/insumos/${insumos['Huevos']}`, { cantidad_actual: 4 });
  await api('PUT', `/insumos/${insumos['Pan de hamburguesa']}`, { cantidad_actual: 3 });

  console.log('Listo. Datos demo cargados:');
  console.log(`  ${Object.keys(categorias).length} categorías, ${Object.keys(proveedores).length} proveedores, ${Object.keys(insumos).length} insumos`);
  console.log(`  ${menu.length} productos, ${compras.length} compras, ${totalVentas} ventas`);
  console.log(`  Correo de la cuenta demo: ${DEMO_EMAIL}`);
};

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});