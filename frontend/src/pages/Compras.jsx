import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, CalendarDays } from 'lucide-react';
import { getCompras, createCompra, marcarComoPagada } from '../services/compraService';
import { getProveedores } from '../services/proveedorService';
import { getInsumos } from '../services/insumoService';
import { getCategoriasGasto, createCategoriaGasto } from '../services/categoriaGastoService';
import InputMoneda from '../components/InputMoneda';
import SelectorCategoria from '../components/SelectorCategoria';

// Fecha de hoy en la zona horaria del equipo (toISOString usa UTC y de noche daría el día siguiente)
const hoy = () => {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
};

// Pestañas: cada tipo de gasto pide solo los datos que le sirven.
// "categoria" fija = se guarda siempre en esa categoría (se crea sola la primera vez).
const PESTANAS = [
  { id: 'general', texto: 'Gasto general', proveedor: true },
  { id: 'insumos', texto: 'Insumos', proveedor: true },
  { id: 'nomina', texto: 'Nómina', categoria: 'Nómina', proveedor: false },
  { id: 'servicios', texto: 'Servicios', categoria: 'Servicios', proveedor: false },
  { id: 'casa', texto: 'casa', categoria: 'casa', proveedor: false },
];

const filaVacia = (tab) => {
  switch (tab) {
    case 'insumos':
      return { insumo_id: '', cantidad: '', valor: '' };
    case 'nomina':
      return { empleado: '', valor: '' };
    case 'general':
      return { descripcion: '', categoria_id: '', valor: '' };
    default:
      return { descripcion: '', valor: '' };
  }
};

const FILAS_INICIALES = Object.fromEntries(PESTANAS.map((p) => [p.id, [filaVacia(p.id)]]));

const campo =
  'px-2 py-1.5 rounded-lg border border-pizarra-900/15 text-sm focus:outline-none focus:ring-2 focus:ring-mostaza-500';

function Compras() {
  const [compras, setCompras] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const [tab, setTab] = useState('general'); // siempre arranca en "Gasto general"
  const [filas, setFilas] = useState(FILAS_INICIALES);
  const [proveedorId, setProveedorId] = useState('');
  const [estadoPago, setEstadoPago] = useState('pagado');
  const [fechaCompra, setFechaCompra] = useState(hoy());
  const [fechaFiltro, setFechaFiltro] = useState(hoy());

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [comprasData, proveedoresData, insumosData, categoriasData] = await Promise.all([
          getCompras(),
          getProveedores(),
          getInsumos(),
          getCategoriasGasto(),
        ]);
        setCompras(comprasData);
        setProveedores(proveedoresData);
        setInsumos(insumosData);
        setCategorias(categoriasData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const pestana = PESTANAS.find((p) => p.id === tab);
  const filasTab = filas[tab];

  // Empleados ya registrados en nómina, para sugerirlos al escribir (evita "Juan" / "Juan P.")
  const empleados = useMemo(() => {
    const nombres = new Set();
    compras.forEach((c) =>
      c.items.forEach((it) => {
        if (it.categoria_nombre === 'Nómina' && it.insumo_nombre) nombres.add(it.insumo_nombre);
      })
    );
    return [...nombres].sort((a, b) => a.localeCompare(b));
  }, [compras]);

  const agregarCategoria = (nueva) =>
    setCategorias((prev) =>
      prev.some((c) => c.id === nueva.id)
        ? prev
        : [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre))
    );

  const cambiarFila = (index, campoNombre, valor) =>
    setFilas((prev) => ({
      ...prev,
      [tab]: prev[tab].map((f, i) => (i === index ? { ...f, [campoNombre]: valor } : f)),
    }));

  const agregarFila = () =>
    setFilas((prev) => ({ ...prev, [tab]: [...prev[tab], filaVacia(tab)] }));

  const quitarFila = (index) =>
    setFilas((prev) => ({ ...prev, [tab]: prev[tab].filter((_, i) => i !== index) }));

  const montoTotal = filasTab.reduce((total, f) => total + (parseFloat(f.valor) || 0), 0);

  // Devuelve el id de la categoría fija de la pestaña (Nómina, Servicios, Arriendo); la crea si no existe
  const categoriaFija = async (nombre) => {
    const existente = categorias.find((c) => c.nombre.toLowerCase() === nombre.toLowerCase());
    if (existente) return existente.id;
    try {
      const nueva = await createCategoriaGasto({ nombre });
      agregarCategoria(nueva);
      return nueva.id;
    } catch (err) {
      // Si ya existía (otra pantalla la creó), se vuelve a leer la lista
      const lista = await getCategoriasGasto();
      setCategorias(lista);
      const encontrada = lista.find((c) => c.nombre.toLowerCase() === nombre.toLowerCase());
      if (encontrada) return encontrada.id;
      throw err;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);

    try {
      let items;
      if (tab === 'insumos') {
        items = filasTab.map((f) => ({
          insumo_id: f.insumo_id,
          cantidad: parseFloat(f.cantidad),
          valor_unitario: parseFloat(f.valor),
        }));
      } else if (pestana.categoria) {
        const categoriaId = await categoriaFija(pestana.categoria);
        items = filasTab.map((f) => ({
          descripcion: (tab === 'nomina' ? f.empleado : f.descripcion).trim() || pestana.categoria,
          categoria_id: categoriaId,
          valor_unitario: parseFloat(f.valor),
        }));
      } else {
        items = filasTab.map((f) => ({
          descripcion: f.descripcion.trim(),
          categoria_id: f.categoria_id || null,
          valor_unitario: parseFloat(f.valor),
        }));
      }

      await createCompra({
        proveedor_id: pestana.proveedor ? proveedorId || null : null,
        estado_pago: estadoPago,
        fecha: fechaCompra,
        items,
      });

      setCompras(await getCompras());

      // Se limpia solo la pestaña que se acaba de registrar
      setFilas((prev) => ({ ...prev, [tab]: [filaVacia(tab)] }));
      setProveedorId('');
      setEstadoPago('pagado');
      setFechaCompra(hoy());
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar');
    } finally {
      setEnviando(false);
    }
  };

  const handlePagar = async (id) => {
    try {
      const actualizada = await marcarComoPagada(id);
      setCompras((prev) =>
        prev.map((c) => (c.id === id ? { ...c, estado_pago: actualizada.estado_pago } : c))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const comprasFiltradas = compras.filter((compra) => compra.fecha.split('T')[0] === fechaFiltro);
  const totalDia = comprasFiltradas.reduce((total, c) => total + parseFloat(c.monto_total), 0);

  // Título de cada registro: el proveedor, o la categoría si todos los renglones son de la misma
  const tituloDe = (compra) => {
    if (compra.proveedor_nombre) return compra.proveedor_nombre;
    const cats = [...new Set(compra.items.map((i) => i.categoria_nombre).filter(Boolean))];
    return cats.length === 1 ? cats[0] : 'Sin proveedor';
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-pizarra-900/5 flex items-center justify-center">
          <ShoppingCart size={20} className="text-pizarra-700" />
        </div>
        <h2 className="font-display text-2xl font-bold text-pizarra-900">Compras y gastos</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6 space-y-4 h-fit"
        >
          <h3 className="font-display font-semibold text-pizarra-900">Nuevo registro</h3>

          {/* Pestañas por tipo de gasto */}
          <div className="flex flex-wrap gap-2" role="tablist">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={p.id === tab}
                onClick={() => {
                  setTab(p.id);
                  setError('');
                }}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-colors ${
                  p.id === tab
                    ? 'bg-mostaza-500 text-pizarra-950'
                    : 'bg-pizarra-900/5 text-pizarra-700 hover:bg-pizarra-900/10'
                }`}
              >
                {p.texto}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {pestana.proveedor && (
              <div>
                <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
                  Proveedor <span className="font-normal text-pizarra-700/60">(opcional)</span>
                </label>
                <select
                  value={proveedorId}
                  onChange={(e) => setProveedorId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
                >
                  <option value="">Sin proveedor</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={pestana.proveedor ? '' : 'col-span-2'}>
              <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">Fecha</label>
              <input
                type="date"
                value={fechaCompra}
                onChange={(e) => setFechaCompra(e.target.value)}
                max={hoy()}
                className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
              Estado de pago
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEstadoPago('pendiente')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  estadoPago === 'pendiente'
                    ? 'bg-terracota-500 text-white'
                    : 'bg-pizarra-900/5 text-pizarra-700'
                }`}
              >
                Pendiente
              </button>
              <button
                type="button"
                onClick={() => setEstadoPago('pagado')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  estadoPago === 'pagado'
                    ? 'bg-pizarra-900 text-papel'
                    : 'bg-pizarra-900/5 text-pizarra-700'
                }`}
              >
                Pagado
              </button>
            </div>
          </div>

          <div className="border-t border-pizarra-900/10 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-pizarra-800">
                {tab === 'nomina' ? 'Pagos a empleados' : tab === 'insumos' ? 'Insumos comprados' : 'Gastos'}
              </label>
              <button
                type="button"
                onClick={agregarFila}
                className="text-xs font-semibold text-mostaza-600 hover:text-mostaza-700"
              >
                + Agregar {tab === 'nomina' ? 'empleado' : 'renglón'}
              </button>
            </div>

            {tab === 'nomina' && (
              <datalist id="lista-empleados">
                {empleados.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            )}

            <div className="space-y-3">
              {filasTab.map((fila, index) => (
                <div key={index} className="bg-papel rounded-xl p-3 space-y-2">
                  {filasTab.length > 1 && (
                    <div className="flex justify-end -mb-1">
                      <button
                        type="button"
                        onClick={() => quitarFila(index)}
                        aria-label="Quitar renglón"
                        className="text-terracota-500 hover:text-terracota-600 text-sm px-1"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {tab === 'insumos' && (
                    <div className="flex gap-2">
                      <select
                        value={fila.insumo_id}
                        onChange={(e) => cambiarFila(index, 'insumo_id', e.target.value)}
                        required
                        className={`flex-1 min-w-0 ${campo}`}
                      >
                        <option value="">Insumo...</option>
                        {insumos.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.nombre}
                            {i.categoria_nombre ? ` · ${i.categoria_nombre}` : ''}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Cant."
                        value={fila.cantidad}
                        onChange={(e) => cambiarFila(index, 'cantidad', e.target.value)}
                        required
                        className={`w-20 ${campo}`}
                      />
                    </div>
                  )}

                  {tab === 'nomina' && (
                    <input
                      type="text"
                      list="lista-empleados"
                      placeholder="Nombre del empleado"
                      value={fila.empleado}
                      onChange={(e) => cambiarFila(index, 'empleado', e.target.value)}
                      required
                      maxLength={100}
                      className={`w-full ${campo}`}
                    />
                  )}

                  {(tab === 'general' || tab === 'servicios' || tab === 'casa') && (
                    <input
                      type="text"
                      placeholder={
                        tab === 'servicios'
                          ? 'Qué servicio (agua, luz, gas, internet…)'
                          : tab === 'casa'
                            ? 'Detalle (opcional, ej: gastos de la casa)'
                            : 'Descripción (ej: reparación de la nevera)'
                      }
                      value={fila.descripcion}
                      onChange={(e) => cambiarFila(index, 'descripcion', e.target.value)}
                      required={tab !== 'casa'}
                      maxLength={200}
                      className={`w-full ${campo}`}
                    />
                  )}

                  {tab === 'general' && (
                    <SelectorCategoria
                      value={fila.categoria_id}
                      onChange={(id) => cambiarFila(index, 'categoria_id', id)}
                      categorias={categorias}
                      onCreada={agregarCategoria}
                      textoVacio="Categoría (opcional)"
                    />
                  )}

                  <InputMoneda
                    value={fila.valor}
                    onChange={(val) => cambiarFila(index, 'valor', val)}
                    placeholder={tab === 'nomina' ? 'Valor pagado al empleado' : 'Valor pagado'}
                    required
                    className={`w-full ${campo}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-pizarra-900/10 pt-4">
            <span className="text-sm font-semibold text-pizarra-700">Total</span>
            <span className="font-display text-lg font-bold text-pizarra-900">
              ${montoTotal.toLocaleString()}
            </span>
          </div>

          {error && (
            <p className="text-terracota-600 text-sm bg-terracota-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-mostaza-500 hover:bg-mostaza-600 disabled:opacity-60 text-pizarra-950 font-semibold py-2 rounded-lg transition-colors text-sm"
          >
            {enviando ? 'Registrando…' : `Registrar ${pestana.texto.toLowerCase()}`}
          </button>
        </motion.form>

        <div className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 overflow-hidden h-fit">
          <div className="p-4 border-b border-pizarra-900/10 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays size={15} className="text-pizarra-700/60" />
              <input
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
              />
              <button
                type="button"
                onClick={() => setFechaFiltro(hoy())}
                className="text-xs font-semibold text-mostaza-600 hover:text-mostaza-700"
              >
                Hoy
              </button>
            </div>
            {comprasFiltradas.length > 0 && (
              <span className="text-xs font-semibold text-pizarra-700">
                Total del día: <span className="text-pizarra-900">${totalDia.toLocaleString()}</span>
              </span>
            )}
          </div>

          {loading ? (
            <p className="p-6 text-pizarra-700 text-sm">Cargando...</p>
          ) : comprasFiltradas.length === 0 ? (
            <div className="p-10 text-center">
              <ShoppingCart size={32} className="text-pizarra-900/15 mx-auto mb-2" />
              <p className="text-pizarra-700 text-sm">No hay registros para este día.</p>
            </div>
          ) : (
            <div className="divide-y divide-pizarra-900/5">
              {comprasFiltradas.map((compra) => (
                <div key={compra.id} className="p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <p className="font-medium text-pizarra-900 text-sm">{tituloDe(compra)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-pizarra-900 text-sm">
                        ${parseFloat(compra.monto_total).toLocaleString()}
                      </span>
                      {compra.estado_pago === 'pagado' ? (
                        <span className="text-xs font-semibold bg-pizarra-900/10 text-pizarra-700 px-2.5 py-1 rounded-full">
                          Pagado
                        </span>
                      ) : (
                        <button
                          onClick={() => handlePagar(compra.id)}
                          className="text-xs font-semibold bg-terracota-500/10 text-terracota-600 hover:bg-terracota-500/20 px-2.5 py-1 rounded-full transition-colors"
                        >
                          Pendiente
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-pizarra-700 space-y-0.5 pl-1">
                    {compra.items.map((item, i) => (
                      <p key={i}>
                        {item.insumo_nombre}
                        {item.cantidad ? ` · ${item.cantidad}` : ''} · $
                        {parseFloat(item.valor).toLocaleString()}
                        {item.categoria_nombre && (
                          <span className="text-pizarra-700/50"> · {item.categoria_nombre}</span>
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Compras;