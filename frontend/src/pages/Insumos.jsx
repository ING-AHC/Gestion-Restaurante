import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Search, Plus, Trash2, AlertTriangle, ArrowUpDown, Pencil } from 'lucide-react';
import { getInsumos, createInsumo, deleteInsumo, updateInsumo } from '../services/insumoService';
import { getCategoriasGasto } from '../services/categoriaGastoService';

const STOCK_BAJO_UMBRAL = 5;

function Insumos() {
  const [insumos, setInsumos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState('');
  const [unidadMedida, setUnidadMedida] = useState('');
  const [cantidadActual, setCantidadActual] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [orden, setOrden] = useState({ campo: 'nombre', direccion: 'asc' });

  const [insumoParaEditar, setInsumoParaEditar] = useState(null);
  const [editCantidad, setEditCantidad] = useState('');
  const [editError, setEditError] = useState('');

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [insumosData, categoriasData] = await Promise.all([
          getInsumos(),
          getCategoriasGasto(),
        ]);
        setInsumos(insumosData);
        setCategorias(categoriasData);
      } catch (err) {
        console.error('Error al cargar datos', err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const nuevo = await createInsumo({
        nombre,
        unidad_medida: unidadMedida,
        cantidad_actual: cantidadActual || 0,
        categoria_id: categoriaId,
      });

      const categoria = categorias.find((c) => c.id === parseInt(categoriaId));
      const insumoConCategoria = {
        ...nuevo,
        categoria_nombre: categoria ? categoria.nombre : null,
      };

      setInsumos((prev) => [...prev, insumoConCategoria]);

      setNombre('');
      setUnidadMedida('');
      setCantidadActual('');
      setCategoriaId('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el insumo');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Seguro que quieres eliminar este insumo?')) return;

    try {
      await deleteInsumo(id);
      setInsumos((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar el insumo');
    }
  };

  const abrirModalEditar = (insumo) => {
    setInsumoParaEditar(insumo);
    setEditCantidad(parseFloat(insumo.cantidad_actual).toString());
    setEditError('');
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    setEditError('');

    try {
      const actualizado = await updateInsumo(insumoParaEditar.id, {
        cantidad_actual: parseFloat(editCantidad),
      });

      setInsumos((prev) =>
        prev.map((i) => (i.id === actualizado.id ? { ...i, ...actualizado } : i))
      );

      setInsumoParaEditar(null);
    } catch (err) {
      setEditError(err.response?.data?.error || 'Error al actualizar el insumo');
    }
  };

  const toggleOrden = (campo) => {
    setOrden((prev) =>
      prev.campo === campo
        ? { campo, direccion: prev.direccion === 'asc' ? 'desc' : 'asc' }
        : { campo, direccion: 'asc' }
    );
  };

  const insumosFiltrados = insumos
    .filter((insumo) => {
      const coincideBusqueda = insumo.nombre.toLowerCase().includes(busqueda.toLowerCase());
      const coincideCategoria = !filtroCategoria || insumo.categoria_id === parseInt(filtroCategoria);
      return coincideBusqueda && coincideCategoria;
    })
    .sort((a, b) => {
      let valorA, valorB;
      if (orden.campo === 'cantidad') {
        valorA = parseFloat(a.cantidad_actual);
        valorB = parseFloat(b.cantidad_actual);
      } else {
        valorA = a.nombre.toLowerCase();
        valorB = b.nombre.toLowerCase();
      }
      if (valorA < valorB) return orden.direccion === 'asc' ? -1 : 1;
      if (valorA > valorB) return orden.direccion === 'asc' ? 1 : -1;
      return 0;
    });

  const totalInsumos = insumos.length;
  const totalCategorias = new Set(insumos.map((i) => i.categoria_id).filter(Boolean)).size;
  const conStockBajo = insumos.filter((i) => parseFloat(i.cantidad_actual) <= STOCK_BAJO_UMBRAL).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-pizarra-900/5 flex items-center justify-center">
          <Package size={20} className="text-pizarra-700" />
        </div>
        <h2 className="font-display text-2xl font-bold text-pizarra-900">
          Insumos
        </h2>
      </div>

      <div className="flex items-center gap-4 mb-6 text-sm text-pizarra-700 pl-1">
        <span>{totalInsumos} insumos</span>
        <span className="w-1 h-1 rounded-full bg-pizarra-700/30" />
        <span>{totalCategorias} categorías</span>
        {conStockBajo > 0 && (
          <>
            <span className="w-1 h-1 rounded-full bg-pizarra-700/30" />
            <span className="flex items-center gap-1 text-terracota-600 font-medium">
              <AlertTriangle size={13} />
              {conStockBajo} con stock bajo
            </span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6 space-y-4 h-fit"
        >
          <h3 className="font-display font-semibold text-pizarra-900">
            Nuevo insumo
          </h3>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
              Categoría
            </label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
            >
              <option value="">Selecciona...</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
              Unidad de medida
            </label>
            <select
              value={unidadMedida}
              onChange={(e) => setUnidadMedida(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
            >
              <option value="">Selecciona...</option>
              <option value="unidad">Unidad</option>
              <option value="libras">Libras</option>
              <option value="kilos">Kilos</option>
              <option value="gramos">Gramos</option>
              <option value="litros">Litros</option>
              <option value="mililitros">Mililitros</option>
              <option value="paquete">Paquete</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
              Cantidad inicial
            </label>
            <input
              type="number"
              step="0.01"
              value={cantidadActual}
              onChange={(e) => setCantidadActual(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
            />
          </div>

          {error && (
            <p className="text-terracota-600 text-sm bg-terracota-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950 font-semibold py-2 rounded-lg transition-colors text-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            Agregar insumo
          </button>
        </motion.form>

        <div className="lg:col-span-2 bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 overflow-hidden">
          <div className="p-4 border-b border-pizarra-900/10 flex gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-pizarra-700/50" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar insumo..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
              />
            </div>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="p-6 text-pizarra-700 text-sm">Cargando...</p>
          ) : insumosFiltrados.length === 0 ? (
            <div className="p-10 text-center">
              <Package size={32} className="text-pizarra-900/15 mx-auto mb-2" />
              <p className="text-pizarra-700 text-sm">
                {insumos.length === 0 ? 'Todavía no hay insumos registrados.' : 'No hay insumos que coincidan con el filtro.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pizarra-900/10 text-left">
                  <th className="px-5 py-3 font-semibold text-pizarra-700">
                    <button
                      onClick={() => toggleOrden('nombre')}
                      className="flex items-center gap-1 hover:text-pizarra-900 transition-colors"
                    >
                      Nombre
                      <ArrowUpDown size={12} className={orden.campo === 'nombre' ? 'text-mostaza-600' : 'text-pizarra-700/30'} />
                    </button>
                  </th>
                  <th className="px-5 py-3 font-semibold text-pizarra-700">Categoría</th>
                  <th className="px-5 py-3 font-semibold text-pizarra-700">Unidad</th>
                  <th className="px-5 py-3 font-semibold text-pizarra-700 text-right">
                    <button
                      onClick={() => toggleOrden('cantidad')}
                      className="flex items-center gap-1 ml-auto hover:text-pizarra-900 transition-colors"
                    >
                      Cantidad actual
                      <ArrowUpDown size={12} className={orden.campo === 'cantidad' ? 'text-mostaza-600' : 'text-pizarra-700/30'} />
                    </button>
                  </th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {insumosFiltrados.map((insumo) => {
                  const stockBajo = parseFloat(insumo.cantidad_actual) <= STOCK_BAJO_UMBRAL;
                  return (
                    <tr
                      key={insumo.id}
                      className="border-b border-pizarra-900/5 last:border-0 hover:bg-pizarra-900/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3 text-pizarra-900 font-medium">
                        <div className="flex items-center gap-1.5">
                          {insumo.nombre}
                          {stockBajo && (
                            <AlertTriangle size={13} className="text-terracota-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {insumo.categoria_nombre ? (
                          <span className="text-xs font-medium bg-pizarra-900/5 text-pizarra-700 px-2 py-0.5 rounded-full">
                            {insumo.categoria_nombre}
                          </span>
                        ) : (
                          <span className="text-pizarra-700/40">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-pizarra-700">{insumo.unidad_medida}</td>
                      <td
                        className={`px-5 py-3 text-right font-semibold ${
                          stockBajo ? 'text-terracota-600' : 'text-pizarra-900'
                        }`}
                      >
                        {parseFloat(insumo.cantidad_actual).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => abrirModalEditar(insumo)}
                            className="text-pizarra-700/40 hover:text-mostaza-600 transition-colors p-1"
                            title="Corregir cantidad"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(insumo.id)}
                            className="text-pizarra-700/40 hover:text-terracota-500 transition-colors p-1"
                            title="Eliminar"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AnimatePresence>
        {insumoParaEditar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-pizarra-950/50 flex items-center justify-center p-4 z-50"
            onClick={() => setInsumoParaEditar(null)}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleGuardarEdicion}
              className="bg-papel-card rounded-2xl shadow-lg p-6 w-full max-w-sm space-y-4"
            >
              <div>
                <h3 className="font-display font-semibold text-pizarra-900">
                  Corregir cantidad
                </h3>
                <p className="text-sm text-pizarra-700 mt-0.5">{insumoParaEditar.nombre}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
                  Cantidad actual ({insumoParaEditar.unidad_medida})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editCantidad}
                  onChange={(e) => setEditCantidad(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
                />
              </div>

              {editError && (
                <p className="text-terracota-600 text-sm bg-terracota-500/10 rounded-lg px-3 py-2">
                  {editError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInsumoParaEditar(null)}
                  className="flex-1 border border-pizarra-900/15 text-pizarra-700 font-semibold py-2 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950 font-semibold py-2 rounded-lg text-sm"
                >
                  Guardar
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Insumos;