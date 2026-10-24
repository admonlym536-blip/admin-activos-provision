"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Gauge,
  Target,
  TrendingUp,
  Upload,
  SearchX,
} from "lucide-react";
import { useDatos } from "@/src/lib/DatosContext";
import { mensajeError } from "@/src/lib/datos";
import {
  cargarVentasRango,
  exportarVentasMes,
  hoyISO,
  rangoMes,
  ResumenVentaActivo,
  VentaDiaria,
} from "@/src/lib/ventas";
import {
  colorAvance,
  COLORES,
  ESTADO_RETIRADO,
  nombresDeZona,
} from "@/src/lib/tipos";
import { Encabezado } from "@/src/components/Encabezado";
import {
  Alerta,
  Boton,
  Buscador,
  Cargando,
  claseInput,
  Kpi,
  Modal,
  Tarjeta,
  TituloTarjeta,
  Vacio,
} from "@/src/components/ui";

const dinero = (v: number) =>
  `$${Math.round(v).toLocaleString("es-CO")}`;

const dineroCorto = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${Math.round(v)}`;
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const nombreMes = (mes: string) => {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
};

const moverMes = (mes: string, delta: number) => {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

type FiltroCumplimiento = "" | "verde" | "amarillo" | "rojo" | "sin_venta";
type Orden = "cumplimiento_asc" | "cumplimiento_desc" | "venta_desc" | "serial";

export default function VentasPage() {
  const { activos, zonas, cargando: cargandoActivos } = useDatos();

  const [mes, setMes] = useState(hoyISO().slice(0, 7));
  const [ventas, setVentas] = useState<VentaDiaria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [zona, setZona] = useState("");
  const [tipo, setTipo] = useState("");
  const [filtro, setFiltro] = useState<FiltroCumplimiento>("");
  const [orden, setOrden] = useState<Orden>("cumplimiento_asc");
  const [detalle, setDetalle] = useState<ResumenVentaActivo | null>(null);

  const { desde, hasta, dias: diasMes } = rangoMes(mes);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setVentas(await cargarVentasRango(desde, hasta));
      setError(null);
    } catch (e) {
      console.error(e);
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const diasDelMes = useMemo(
    () =>
      Array.from(
        { length: diasMes },
        (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`
      ),
    [mes, diasMes]
  );

  // Último día con ventas cargadas: base para la proyección
  const ultimoDiaCargado = useMemo(
    () => ventas.reduce((m, v) => (v.fecha > m ? v.fecha : m), ""),
    [ventas]
  );
  const diasTranscurridos = ultimoDiaCargado ? Number(ultimoDiaCargado.slice(8)) : 0;

  // ---------------- RESUMEN POR ACTIVO ----------------
  const resumen = useMemo<ResumenVentaActivo[]>(() => {
    const porSerial = new Map<string, VentaDiaria[]>();
    for (const v of ventas) {
      porSerial.set(v.serial, [...(porSerial.get(v.serial) ?? []), v]);
    }

    return activos
      .filter((a) => a.estado !== ESTADO_RETIRADO)
      .map((a) => {
        const suyas = porSerial.get(a.serial) ?? [];
        const porDia = new Map<string, number>();
        for (const v of suyas) porDia.set(v.fecha, (porDia.get(v.fecha) ?? 0) + v.venta);
        const venta = suyas.reduce((s, v) => s + v.venta, 0);
        const presupuesto = a.presupuesto ?? 0;
        return {
          activo: a,
          venta,
          presupuesto,
          cumplimiento: presupuesto > 0 ? (venta / presupuesto) * 100 : null,
          proyeccion:
            diasTranscurridos > 0 ? (venta / diasTranscurridos) * diasMes : 0,
          diasConVenta: [...porDia.values()].filter((x) => x > 0).length,
          ultimaVenta: suyas.length
            ? suyas.reduce((m, v) => (v.fecha > m ? v.fecha : m), "")
            : null,
          porDia,
        };
      });
  }, [activos, ventas, diasTranscurridos, diasMes]);

  const tipos = useMemo(
    () => [...new Set(activos.map((a) => a.tipo).filter(Boolean))].sort(),
    [activos]
  );

  const categoria = (r: ResumenVentaActivo): FiltroCumplimiento => {
    if (r.venta === 0) return "sin_venta";
    const c = r.cumplimiento ?? 0;
    return c >= 100 ? "verde" : c >= 70 ? "amarillo" : "rojo";
  };

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = resumen.filter((r) => {
      const a = r.activo;
      if (zona && a.zona !== zona) return false;
      if (tipo && a.tipo !== tipo) return false;
      if (filtro && categoria(r) !== filtro) return false;
      if (!q) return true;
      return `${a.serial} ${a.razon_social} ${a.codigo_cliente}`
        .toLowerCase()
        .includes(q);
    });
    const c = (r: ResumenVentaActivo) => r.cumplimiento ?? -1;
    return lista.sort((x, y) => {
      switch (orden) {
        case "cumplimiento_asc":
          return c(x) - c(y);
        case "cumplimiento_desc":
          return c(y) - c(x);
        case "venta_desc":
          return y.venta - x.venta;
        default:
          return x.activo.serial.localeCompare(y.activo.serial, "es", { numeric: true });
      }
    });
  }, [resumen, busqueda, zona, tipo, filtro, orden]);

  // ---------------- TOTALES (según filtros de asesor/tipo/búsqueda) ----------------
  const totales = useMemo(() => {
    const venta = filtrados.reduce((s, r) => s + r.venta, 0);
    const presupuesto = filtrados.reduce((s, r) => s + r.presupuesto, 0);
    const proyeccion = filtrados.reduce((s, r) => s + r.proyeccion, 0);
    const porDia = new Map<string, number>();
    for (const r of filtrados)
      for (const [d, v] of r.porDia) porDia.set(d, (porDia.get(d) ?? 0) + v);
    return {
      venta,
      presupuesto,
      proyeccion,
      cumplimiento: presupuesto > 0 ? (venta / presupuesto) * 100 : 0,
      porDia,
    };
  }, [filtrados]);

  const conteo = useMemo(() => {
    const c = { verde: 0, amarillo: 0, rojo: 0, sin_venta: 0 };
    for (const r of resumen) {
      const k = categoria(r);
      if (k) c[k]++;
    }
    return c;
  }, [resumen]);

  if (cargandoActivos) return <Cargando />;

  const mesActual = hoyISO().slice(0, 7);
  const maxDia = Math.max(1, ...totales.porDia.values());

  return (
    <>
      <Encabezado
        titulo="Ventas"
        subtitulo="Venta diaria de cada activo frente a su presupuesto mensual"
        acciones={
          <>
            <Boton
              variante="secundario"
              icono={Download}
              disabled={cargando || ventas.length === 0}
              onClick={() => exportarVentasMes(mes, filtrados, diasDelMes)}
            >
              Exportar mes
            </Boton>
            <Link href="/dashboard/ventas/cargar">
              <Boton icono={Upload}>Cargar ventas</Boton>
            </Link>
          </>
        }
      />

      {/* ---------------- SELECTOR DE MES ---------------- */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white shadow-sm">
          <button
            onClick={() => setMes(moverMes(mes, -1))}
            className="rounded-l-lg p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-36 px-2 text-center text-sm font-medium capitalize text-slate-900">
            {nombreMes(mes)}
          </span>
          <button
            onClick={() => setMes(moverMes(mes, 1))}
            disabled={mes >= mesActual}
            className="rounded-r-lg p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {mes !== mesActual && (
          <button
            onClick={() => setMes(mesActual)}
            className="text-sm font-medium text-marca hover:underline"
          >
            Ir al mes actual
          </button>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-slate-500">
          <CalendarDays className="h-4 w-4" />
          {ultimoDiaCargado
            ? `Ventas cargadas hasta el ${Number(ultimoDiaCargado.slice(8))} de ${MESES[Number(mes.slice(5)) - 1]}`
            : "Sin ventas cargadas este mes"}
        </span>
      </div>

      {error && (
        <div className="mb-4">
          <Alerta tipo="error" icono={AlertTriangle}>
            {error}
          </Alerta>
        </div>
      )}

      {cargando ? (
        <Cargando />
      ) : (
        <>
          {/* ---------------- KPIs ---------------- */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icono={DollarSign}
              titulo="Venta del mes"
              valor={dinero(totales.venta)}
              detalle={`${filtrados.length} activos`}
            />
            <Kpi
              icono={Target}
              titulo="Presupuesto"
              valor={dinero(totales.presupuesto)}
              detalle="Suma del presupuesto de los activos"
            />
            <Kpi
              icono={Gauge}
              titulo="Cumplimiento"
              valor={`${Math.round(totales.cumplimiento)}%`}
              color={colorAvance(totales.cumplimiento)}
              detalle={
                totales.presupuesto > totales.venta
                  ? `Faltan ${dinero(totales.presupuesto - totales.venta)}`
                  : "Presupuesto cumplido"
              }
            />
            <Kpi
              icono={TrendingUp}
              titulo="Proyección al cierre"
              valor={diasTranscurridos ? dinero(totales.proyeccion) : "—"}
              color={
                totales.presupuesto
                  ? colorAvance((totales.proyeccion / totales.presupuesto) * 100)
                  : COLORES.marca
              }
              detalle={
                diasTranscurridos
                  ? `Al ritmo de ${diasTranscurridos} día(s) cargados · ${
                      totales.presupuesto
                        ? Math.round((totales.proyeccion / totales.presupuesto) * 100)
                        : 0
                    }% del presupuesto`
                  : "Carga ventas para proyectar"
              }
            />
          </div>

          {/* ---------------- GRÁFICO DIARIO ---------------- */}
          <Tarjeta className="mb-6">
            <TituloTarjeta>Venta por día</TituloTarjeta>
            {totales.porDia.size === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No hay ventas cargadas para {nombreMes(mes)}.{" "}
                <Link href="/dashboard/ventas/cargar" className="font-medium text-marca hover:underline">
                  Cargar ventas
                </Link>
              </p>
            ) : (
              <div className="flex h-44 items-end gap-[3px]">
                {diasDelMes.map((d) => {
                  const v = totales.porDia.get(d) ?? 0;
                  return (
                    <div
                      key={d}
                      className="group relative flex h-full flex-1 flex-col justify-end"
                    >
                      <div
                        className={`w-full rounded-t-sm transition ${
                          v ? "bg-marca/80 group-hover:bg-marca" : "bg-slate-100"
                        }`}
                        style={{ height: v ? `${Math.max(3, (v / maxDia) * 100)}%` : "3px" }}
                      />
                      <span className="mt-1 text-center text-[10px] tabular-nums text-slate-400">
                        {Number(d.slice(8)) % 5 === 0 || d.endsWith("-01")
                          ? Number(d.slice(8))
                          : ""}
                      </span>
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
                        {Number(d.slice(8))} · {v ? dinero(v) : "sin venta"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Tarjeta>

          {/* ---------------- TABLA POR ACTIVO ---------------- */}
          <Tarjeta className="overflow-hidden p-0">
            <div className="space-y-3 border-b border-slate-200 p-4">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["", "Todos", resumen.length, COLORES.marca],
                    ["verde", "≥ 100%", conteo.verde, COLORES.verde],
                    ["amarillo", "70–99%", conteo.amarillo, COLORES.amarillo],
                    ["rojo", "< 70%", conteo.rojo, COLORES.rojo],
                    ["sin_venta", "Sin venta", conteo.sin_venta, "#94a3b8"],
                  ] as [FiltroCumplimiento, string, number, string][]
                ).map(([v, t, n, c]) => (
                  <button
                    key={v || "todos"}
                    onClick={() => setFiltro(v)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                      filtro === v
                        ? "border-marca bg-marca text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {v && (
                      <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                    )}
                    {t}
                    <span className="tabular-nums opacity-70">{n}</span>
                  </button>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                <Buscador
                  className="md:col-span-2"
                  placeholder="Buscar serial, cliente o código"
                  value={busqueda}
                  onChange={setBusqueda}
                />
                <select className={claseInput} value={zona} onChange={(e) => setZona(e.target.value)}>
                  <option value="">Todos los asesores</option>
                  {nombresDeZona(zonas).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
                <select className={claseInput} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option value="">Todos los tipos</option>
                  {tipos.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <select
                  className={claseInput}
                  value={orden}
                  onChange={(e) => setOrden(e.target.value as Orden)}
                >
                  <option value="cumplimiento_asc">Menor cumplimiento</option>
                  <option value="cumplimiento_desc">Mayor cumplimiento</option>
                  <option value="venta_desc">Mayor venta</option>
                  <option value="serial">Serial</option>
                </select>
              </div>
            </div>

            {filtrados.length === 0 ? (
              <Vacio icono={SearchX} texto="No hay activos con estos filtros" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Activo</th>
                      <th className="px-3 py-3">Cliente</th>
                      <th className="px-3 py-3">Asesor</th>
                      <th className="px-3 py-3 text-right">Presupuesto</th>
                      <th className="px-3 py-3 text-right">Venta mes</th>
                      <th className="px-3 py-3">Cumplimiento</th>
                      <th className="px-3 py-3 text-right">Proyección</th>
                      <th className="px-3 py-3">Últimos días</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtrados.map((r) => {
                      const a = r.activo;
                      const pct = r.cumplimiento;
                      const ultimos = diasDelMes
                        .filter((d) => !ultimoDiaCargado || d <= ultimoDiaCargado)
                        .slice(-10);
                      const maxFila = Math.max(1, ...ultimos.map((d) => r.porDia.get(d) ?? 0));
                      return (
                        <tr
                          key={a.serial}
                          onClick={() => setDetalle(r)}
                          className="cursor-pointer transition-colors hover:bg-slate-50"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium tabular-nums text-slate-900">{a.serial}</div>
                            <div className="max-w-[180px] truncate text-xs text-slate-500">{a.tipo}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="max-w-[200px] truncate text-slate-900">
                              {a.razon_social || <span className="text-slate-400">Sin cliente</span>}
                            </div>
                            <div className="text-xs tabular-nums text-slate-500">{a.codigo_cliente}</div>
                          </td>
                          <td className="px-3 py-3 text-slate-700">{a.zona || "—"}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-500">
                            {r.presupuesto ? dinero(r.presupuesto) : "—"}
                          </td>
                          <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-900">
                            {dinero(r.venta)}
                          </td>
                          <td className="px-3 py-3">
                            {pct == null ? (
                              <span className="text-xs text-slate-400">Sin presupuesto</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(100, pct)}%`,
                                      background: r.venta ? colorAvance(pct) : "#94a3b8",
                                    }}
                                  />
                                </div>
                                <span className="w-10 text-right text-xs font-medium tabular-nums text-slate-700">
                                  {Math.round(pct)}%
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-500">
                            {diasTranscurridos ? dinero(r.proyeccion) : "—"}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex h-6 items-end gap-[2px]" title="Venta de los últimos días cargados">
                              {ultimos.map((d) => {
                                const v = r.porDia.get(d) ?? 0;
                                return (
                                  <div
                                    key={d}
                                    className={`w-1.5 rounded-sm ${v ? "bg-marca/70" : "bg-slate-200"}`}
                                    style={{ height: v ? `${Math.max(15, (v / maxFila) * 100)}%` : "2px" }}
                                  />
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900">
                    <tr>
                      <td className="px-4 py-3" colSpan={3}>
                        Total ({filtrados.length} activos)
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{dinero(totales.presupuesto)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{dinero(totales.venta)}</td>
                      <td className="px-3 py-3 tabular-nums">{Math.round(totales.cumplimiento)}%</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {diasTranscurridos ? dinero(totales.proyeccion) : "—"}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Tarjeta>
        </>
      )}

      {/* ---------------- DETALLE DE UN ACTIVO ---------------- */}
      <Modal
        abierto={!!detalle}
        titulo={detalle ? `Activo ${detalle.activo.serial}` : ""}
        descripcion={
          detalle
            ? [detalle.activo.razon_social || "Sin cliente", detalle.activo.zona, detalle.activo.tipo]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        onCerrar={() => setDetalle(null)}
        ancho="max-w-2xl"
      >
        {detalle && (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-4">
              {[
                ["Venta mes", dinero(detalle.venta)],
                ["Presupuesto", detalle.presupuesto ? dinero(detalle.presupuesto) : "—"],
                [
                  "Cumplimiento",
                  detalle.cumplimiento == null ? "—" : `${Math.round(detalle.cumplimiento)}%`,
                ],
                ["Proyección", diasTranscurridos ? dinero(detalle.proyeccion) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="bg-white px-3 py-2.5">
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>

            {detalle.porDia.size === 0 ? (
              <p className="text-sm text-slate-500">Este activo no tiene ventas en {nombreMes(mes)}.</p>
            ) : (
              <>
                <div className="flex h-28 items-end gap-[3px]">
                  {diasDelMes.map((d) => {
                    const v = detalle.porDia.get(d) ?? 0;
                    const max = Math.max(1, ...detalle.porDia.values());
                    return (
                      <div
                        key={d}
                        title={`${Number(d.slice(8))}: ${v ? dinero(v) : "sin venta"}`}
                        className={`flex-1 rounded-t-sm ${v ? "bg-marca/80" : "bg-slate-100"}`}
                        style={{ height: v ? `${Math.max(4, (v / max) * 100)}%` : "3px" }}
                      />
                    );
                  })}
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2 text-right">Venta</th>
                        <th className="px-3 py-2 text-right">Acumulado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        let acum = 0;
                        return [...detalle.porDia.entries()]
                          .sort(([x], [y]) => x.localeCompare(y))
                          .map(([d, v]) => {
                            acum += v;
                            return (
                              <tr key={d}>
                                <td className="px-3 py-2 tabular-nums text-slate-700">
                                  {new Date(`${d}T12:00:00`).toLocaleDateString("es-CO", {
                                    weekday: "short",
                                    day: "numeric",
                                    month: "short",
                                  })}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-900">{dinero(v)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                                  {dineroCorto(acum)}
                                </td>
                              </tr>
                            );
                          });
                      })()}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
