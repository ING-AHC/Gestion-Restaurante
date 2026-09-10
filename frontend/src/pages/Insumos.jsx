import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getInsumos, createInsumo, deleteInsumo } from '../services/insumoService';
import { getCategoriasGasto } from '../services/categoriaGastoService';

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

      setInsumos((prev) =>
        [...prev, insumoConCategoria].sort((a, b) => a.nombre.localeCompare(b.nombre))
      );

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

  const insumosFiltrados = insumos.filter((insumo) => {
    const coincideBusqueda = insumo.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = !filtroCategoria || insumo.categoria_id === parseInt(filtroCategoria);
    return coincideBusqueda && coincideCategoria;
  });

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-pizarra-900 mb-6">
        Insumos
      </h2>

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
            className="w-full bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950 font-semibold py-2 rounded-lg transition-colors text-sm"
          >
            Agregar insumo
          </button>
        </motion.form>

        <div className="lg:col-span-2 bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 overflow-hidden">
          <div className="p-4 border-b border-pizarra-900/10 flex gap-3">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar insumo..."
              className="flex-1 px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
            />
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
            <p className="p-6 text-pizarra-700 text-sm">
              {insumos.length === 0 ? 'Todavía no hay insumos registrados.' : 'No hay insumos que coincidan con el filtro.'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pizarra-900/10 text-left">
                  <th className="px-5 py-3 font-semibold text-pizarra-700">Nombre</th>
                  <th className="px-5 py-3 font-semibold text-pizarra-700">Categoría</th>
                  <th className="px-5 py-3 font-semibold text-pizarra-700">Unidad</th>
                  <th className="px-5 py-3 font-semibold text-pizarra-700 text-right">
                    Cantidad actual
                  </th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {insumosFiltrados.map((insumo) => (
                  <tr key={insumo.id} className="border-b border-pizarra-900/5 last:border-0">
                    <td className="px-5 py-3 text-pizarra-900 font-medium">
                      {insumo.nombre}
                    </td>
                    <td className="px-5 py-3 text-pizarra-700">
                      {insumo.categoria_nombre || '-'}
                    </td>
                    <td className="px-5 py-3 text-pizarra-700">{insumo.unidad_medida}</td>
                    <td className="px-5 py-3 text-right text-pizarra-900 font-semibold">
                      {parseFloat(insumo.cantidad_actual).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDelete(insumo.id)}
                        className="text-terracota-500 hover:text-terracota-600 text-xs font-semibold"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Insumos;