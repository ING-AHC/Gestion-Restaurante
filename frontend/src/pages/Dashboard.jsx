import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Receipt,
  AlertCircle,
  CalendarDays,
} from 'lucide-react';
import {
  getResumenFinanciero,
  getDeudasProveedores,
  getGastosPorCategoria,
  getResumenDiario,
} from '../services/reporteService';

const COLORES_GRAFICA = ['#e0a838', '#3a5f52', '#c1573f', '#2d4c42', '#c8912a'];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function Dashboard() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [verTodo, setVerTodo] = useState(false);

  const [resumen, setResumen] = useState(null);
  const [deudas, setDeudas] = useState([]);
  const [gastosCategoria, setGastosCategoria] = useState([]);
  const [resumenDiario, setResumenDiario] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const mesFiltro = verTodo ? null : mes;
        const anioFiltro = verTodo ? null : anio;

        const [resumenData, deudasData, gastosData, diarioData] = await Promise.all([
          getResumenFinanciero(mesFiltro, anioFiltro),
          getDeudasProveedores(),
          getGastosPorCategoria(mesFiltro, anioFiltro),
          getResumenDiario(mesFiltro, anioFiltro),
        ]);
        setResumen(resumenData);
        setDeudas(deudasData);
        setGastosCategoria(gastosData);
        setResumenDiario(diarioData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [mes, anio, verTodo]);

  const datosGrafica = gastosCategoria.map((g) => ({
    name: g.categoria_nombre,
    value: parseFloat(g.total_gastado),
  }));

  const esPositiva = resumen?.ganancia_real >= 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="font-display text-2xl font-bold text-pizarra-900">
          Resumen del negocio
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setVerTodo(!verTodo)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              verTodo
                ? 'bg-pizarra-900 text-papel'
                : 'bg-pizarra-900/5 text-pizarra-700 hover:bg-pizarra-900/10'
            }`}
          >
            Histórico total
          </button>

          {!verTodo && (
            <>
              <select
                value={mes}
                onChange={(e) => setMes(parseInt(e.target.value))}
                className="text-sm px-3 py-1.5 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500"
              >
                {MESES.map((nombre, index) => (
                  <option key={index} value={index + 1}>{nombre}</option>
                ))}
              </select>

              <select
                value={anio}
                onChange={(e) => setAnio(parseInt(e.target.value))}
                className="text-sm px-3 py-1.5 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500"
              >
                {[hoy.getFullYear() - 1, hoy.getFullYear()].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {loading || !resumen ? (
        <p className="text-pizarra-700 text-sm">Cargando resumen...</p>
      ) : (
        <>
          {/* Ganancia real: tarjeta destacada */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="bg-pizarra-950 rounded-2xl shadow-lg p-7 mb-4 relative overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-[0.06] pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                backgroundSize: '18px 18px',
              }}
            />
            <div className="relative flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-papel/60 font-medium mb-1">Ganancia real</p>
                <p
                  className={`font-display text-4xl sm:text-5xl font-bold ${
                    esPositiva ? 'text-mostaza-500' : 'text-terracota-500'
                  }`}
                >
                  ${resumen.ganancia_real.toLocaleString()}
                </p>
              </div>
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  esPositiva ? 'bg-mostaza-500/15' : 'bg-terracota-500/15'
                }`}
              >
                {esPositiva ? (
                  <TrendingUp size={26} className="text-mostaza-500" />
                ) : (
                  <TrendingDown size={26} className="text-terracota-500" />
                )}
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              <div className="w-11 h-11 rounded-xl bg-pizarra-900/5 flex items-center justify-center shrink-0">
                <ShoppingBag size={20} className="text-pizarra-700" />
              </div>
              <div>
                <p className="text-sm text-pizarra-700 font-medium">Ventas</p>
                <p className="font-display text-2xl font-bold text-pizarra-900">
                  ${resumen.total_ventas.toLocaleString()}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              <div className="w-11 h-11 rounded-xl bg-pizarra-900/5 flex items-center justify-center shrink-0">
                <Receipt size={20} className="text-pizarra-700" />
              </div>
              <div>
                <p className="text-sm text-pizarra-700 font-medium">Gastos</p>
                <p className="font-display text-2xl font-bold text-pizarra-900">
                  ${resumen.total_compras.toLocaleString()}
                </p>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6"
            >
              <h3 className="font-display font-semibold text-pizarra-900 mb-4">
                Gastos por categoría
              </h3>

              {datosGrafica.length === 0 ? (
                <p className="text-pizarra-700 text-sm">Sin gastos en este período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={datosGrafica}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {datosGrafica.map((_, index) => (
                        <Cell key={index} fill={COLORES_GRAFICA[index % COLORES_GRAFICA.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}

              <div className="flex flex-wrap gap-3 mt-2">
                {datosGrafica.map((d, index) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-pizarra-700">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COLORES_GRAFICA[index % COLORES_GRAFICA.length] }}
                    />
                    {d.name}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6"
            >
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={16} className="text-terracota-500" />
                <h3 className="font-display font-semibold text-pizarra-900">
                  Deudas a proveedores
                </h3>
              </div>
              <p className="text-xs text-pizarra-700 mb-4">
                Total pendiente actual, sin importar el período
              </p>

              {deudas.length === 0 ? (
                <p className="text-pizarra-700 text-sm">No hay deudas pendientes 🎉</p>
              ) : (
                <div className="space-y-3">
                  {deudas.map((d) => (
                    <div key={d.proveedor_nombre} className="flex items-center justify-between">
                      <span className="text-sm text-pizarra-900 font-medium">
                        {d.proveedor_nombre}
                      </span>
                      <span className="text-sm font-semibold text-terracota-600">
                        ${parseFloat(d.total_deuda).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6 mt-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays size={16} className="text-pizarra-700" />
              <h3 className="font-display font-semibold text-pizarra-900">
                Resumen por día
              </h3>
            </div>

            {resumenDiario.length === 0 ? (
              <p className="text-pizarra-700 text-sm">Sin movimientos en este período.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pizarra-900/10 text-left">
                    <th className="py-2 font-semibold text-pizarra-700">Fecha</th>
                    <th className="py-2 font-semibold text-pizarra-700 text-right">Ventas</th>
                    <th className="py-2 font-semibold text-pizarra-700 text-right">Compras</th>
                    <th className="py-2 font-semibold text-pizarra-700 text-right">Ganancia</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenDiario.map((dia) => (
                    <tr key={dia.fecha} className="border-b border-pizarra-900/5 last:border-0">
                      <td className="py-2 text-pizarra-900">
                        {new Date(dia.fecha + 'T00:00:00').toLocaleDateString('es-CO', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      <td className="py-2 text-right text-pizarra-900">
                        ${dia.ventas.toLocaleString()}
                      </td>
                      <td className="py-2 text-right text-pizarra-900">
                        ${dia.compras.toLocaleString()}
                      </td>
                      <td
                        className={`py-2 text-right font-semibold ${
                          dia.ganancia >= 0 ? 'text-pizarra-900' : 'text-terracota-600'
                        }`}
                      >
                        ${dia.ganancia.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}

export default Dashboard;