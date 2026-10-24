"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  MoreHorizontal,
  PackageOpen,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { useDatos } from "@/src/lib/DatosContext";
import { darDeBaja, mensajeError, reactivar } from "@/src/lib/datos";
import { exportarActivos } from "@/src/lib/excel";
import { Activo, DIAS, ESTADO_RETIRADO } from "@/src/lib/tipos";
import { ActivoForm } from "@/src/components/ActivoForm";
import { AsignarModal } from "@/src/components/AsignarModal";
import { Encabezado } from "@/src/components/Encabezado";
import {
  Alerta,
  Boton,
  Buscador,
  Cargando,
  claseInput,
  Etiqueta,
  Modal,
  Semaforo,
  Tarjeta,
  useAvisos,
  Vacio,
} from "@/src/components/ui";

const POR_PAGINA = 50;
const SIN_ASIGNAR = "__sin_asignar__";

type FiltroEstado = "activos" | "retirados" | "todos";
type FiltroUbicacion = "" | "con" | "sin";

const ESTADOS: { valor: FiltroEstado; texto: string }[] = [
  { valor: "activos", texto: "En uso" },
  { valor: "retirados", texto: "Dados de baja" },
  { valor: "todos", texto: "Todos" },
];

export default function ActivosPage() {
  return (
    <Suspense fallback={<Cargando />}>
      <Activos />
    </Suspense>
  );
}

function Activos() {
  const { activos, zonas, cargando, error, recargar } = useDatos();
  const avisar = useAvisos();
  const params = useSearchParams();

  // ---------------- FILTROS ----------------
  const [busqueda, setBusqueda] = useState("");
  const [zona, setZona] = useState(params.get("zona") ?? "");
  const [dia, setDia] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState<FiltroEstado>("activos");
  const [ubicacion, setUbicacion] = useState<FiltroUbicacion>(
    (params.get("ubicacion") as FiltroUbicacion) ?? ""
  );
  const [pagina, setPagina] = useState(0);

  // ---------------- SELECCIÓN / MODALES ----------------
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [formAbierto, setFormAbierto] = useState(params.get("nuevo") === "1");
  const [editando, setEditando] = useState<Activo | null>(null);
  const [asignando, setAsignando] = useState<Activo[]>([]);
  const [retirando, setRetirando] = useState<Activo[]>([]);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => setPagina(0), [busqueda, zona, dia, tipo, estado, ubicacion]);

  const tipos = useMemo(
    () => [...new Set(activos.map((a) => a.tipo).filter(Boolean))].sort(),
    [activos]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return activos.filter((a) => {
      const retirado = a.estado === ESTADO_RETIRADO;
      if (estado === "activos" && retirado) return false;
      if (estado === "retirados" && !retirado) return false;
      if (zona === SIN_ASIGNAR ? a.asignado : zona && a.zona !== zona)
        return false;
      if (dia && a.dia_visita !== dia) return false;
      if (tipo && a.tipo !== tipo) return false;
      if (ubicacion === "con" && a.lat == null) return false;
      if (ubicacion === "sin" && a.lat != null) return false;
      if (!q) return true;
      return [a.serial, a.razon_social, a.codigo_cliente, a.descripcion]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [activos, busqueda, zona, dia, tipo, estado, ubicacion]);

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const visibles = filtrados.slice(
    pagina * POR_PAGINA,
    (pagina + 1) * POR_PAGINA
  );

  const seleccionados = activos.filter((a) => seleccion.has(a.serial));
  const todosVisiblesSel =
    visibles.length > 0 && visibles.every((a) => seleccion.has(a.serial));

  const hayFiltros =
    busqueda || zona || dia || tipo || ubicacion || estado !== "activos";

  const limpiar = () => {
    setBusqueda("");
    setZona("");
    setDia("");
    setTipo("");
    setUbicacion("");
    setEstado("activos");
  };

  const alternar = (serial: string) =>
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(serial)) n.delete(serial);
      else n.add(serial);
      return n;
    });

  const alternarPagina = () =>
    setSeleccion((s) => {
      const n = new Set(s);
      for (const a of visibles) {
        if (todosVisiblesSel) n.delete(a.serial);
        else n.add(a.serial);
      }
      return n;
    });

  const editar = (a: Activo | null) => {
    setEditando(a);
    setFormAbierto(true);
  };

  const confirmarBaja = async () => {
    setProcesando(true);
    try {
      await darDeBaja(retirando.map((a) => a.serial));
      avisar(`${retirando.length} activo(s) dados de baja`);
      setSeleccion(new Set());
      setRetirando([]);
      await recargar();
    } catch (e) {
      avisar(mensajeError(e), "error");
    } finally {
      setProcesando(false);
    }
  };

  const reactivarLista = async (lista: Activo[]) => {
    setProcesando(true);
    try {
      await reactivar(lista.map((a) => a.serial));
      avisar(
        `${lista.length} activo(s) reactivados. Asígnalos a un asesor para que aparezcan en su agenda.`
      );
      setSeleccion(new Set());
      await recargar();
    } catch (e) {
      avisar(mensajeError(e), "error");
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) return <Cargando />;

  const hayRetiradosSel = seleccionados.some(
    (a) => a.estado === ESTADO_RETIRADO
  );

  return (
    <>
      <Encabezado
        titulo="Activos"
        subtitulo={`${filtrados.length} de ${activos.length} activos`}
        acciones={
          <>
            <Boton
              variante="secundario"
              icono={Download}
              onClick={() => exportarActivos(filtrados)}
            >
              Exportar
            </Boton>
            <Link href="/dashboard/carga">
              <Boton variante="secundario" icono={Upload}>
                Cargar Excel
              </Boton>
            </Link>
            <Boton icono={Plus} onClick={() => editar(null)}>
              Nuevo activo
            </Boton>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Alerta tipo="error" icono={AlertTriangle}>
            {error}
          </Alerta>
        </div>
      )}

      <Tarjeta className="overflow-hidden p-0">
        {/* ---------------- FILTROS ---------------- */}
        <div className="space-y-3 border-b border-slate-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-2 inline-flex rounded-lg bg-slate-100 p-0.5">
              {ESTADOS.map((e) => (
                <button
                  key={e.valor}
                  onClick={() => setEstado(e.valor)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    estado === e.valor
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {e.texto}
                </button>
              ))}
            </div>
            {hayFiltros && (
              <button
                onClick={limpiar}
                className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                <X className="h-4 w-4" /> Limpiar filtros
              </button>
            )}
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <Buscador
              className="md:col-span-2"
              placeholder="Buscar serial, cliente o código"
              value={busqueda}
              onChange={setBusqueda}
            />
            <select
              className={claseInput}
              value={zona}
              onChange={(e) => setZona(e.target.value)}
            >
              <option value="">Todos los asesores</option>
              <option value={SIN_ASIGNAR}>Sin asignar</option>
              {zonas.map((z) => (
                <option key={z.codigo_zona} value={z.nombre_zona}>
                  {z.nombre_zona}
                </option>
              ))}
            </select>
            <select
              className={claseInput}
              value={dia}
              onChange={(e) => setDia(e.target.value)}
            >
              <option value="">Todos los días</option>
              {DIAS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select
              className={claseInput}
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              <option value="">Todos los tipos</option>
              {tipos.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              className={claseInput}
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value as FiltroUbicacion)}
            >
              <option value="">Cualquier ubicación</option>
              <option value="con">Con ubicación</option>
              <option value="sin">Sin ubicación</option>
            </select>
          </div>
        </div>

        {/* ---------------- ACCIONES EN LOTE ---------------- */}
        {seleccion.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-marca/10 bg-marca/[0.04] px-4 py-2.5">
            <span className="text-sm font-medium text-slate-900">
              {seleccion.size} seleccionado(s)
            </span>
            <button
              onClick={() => setSeleccion(new Set())}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              Quitar selección
            </button>
            <div className="ml-auto flex flex-wrap gap-2">
              <Boton
                variante="secundario"
                icono={UserPlus}
                onClick={() => setAsignando(seleccionados)}
              >
                Asignar a asesor
              </Boton>
              <Boton
                variante="secundario"
                icono={Download}
                onClick={() => exportarActivos(seleccionados)}
              >
                Exportar
              </Boton>
              {hayRetiradosSel ? (
                <Boton
                  variante="exito"
                  icono={ArchiveRestore}
                  cargando={procesando}
                  onClick={() =>
                    reactivarLista(
                      seleccionados.filter((a) => a.estado === ESTADO_RETIRADO)
                    )
                  }
                >
                  Reactivar
                </Boton>
              ) : (
                <Boton
                  variante="peligro"
                  icono={Trash2}
                  onClick={() => setRetirando(seleccionados)}
                >
                  Dar de baja
                </Boton>
              )}
            </div>
          </div>
        )}

        {/* ---------------- TABLA ---------------- */}
        {filtrados.length === 0 ? (
          <Vacio icono={PackageOpen} texto="No hay activos con estos filtros" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 accent-marca"
                      checked={todosVisiblesSel}
                      onChange={alternarPagina}
                      aria-label="Seleccionar página"
                    />
                  </th>
                  <th className="px-3 py-3">Activo</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Asesor</th>
                  <th className="px-3 py-3">Ubicación</th>
                  <th className="px-3 py-3">Cumplimiento</th>
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibles.map((a) => {
                  const retirado = a.estado === ESTADO_RETIRADO;
                  const sel = seleccion.has(a.serial);
                  return (
                    <tr
                      key={a.serial}
                      className={`transition-colors ${
                        sel ? "bg-marca/[0.04]" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 accent-marca"
                          checked={sel}
                          onChange={() => alternar(a.serial)}
                          aria-label={`Seleccionar ${a.serial}`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => editar(a)}
                          className="text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium tabular-nums text-slate-900 hover:text-marca">
                              {a.serial}
                            </span>
                            {retirado && <Etiqueta color="rojo">Baja</Etiqueta>}
                          </div>
                          <div className="max-w-[240px] truncate text-xs text-slate-500">
                            {a.tipo || "—"}
                            {a.descripcion ? ` · ${a.descripcion}` : ""}
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">
                          {a.razon_social || (
                            <span className="font-normal text-slate-400">
                              Sin cliente
                            </span>
                          )}
                        </div>
                        <div className="text-xs tabular-nums text-slate-500">
                          {a.codigo_cliente}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {a.asignado && a.zona ? (
                          <>
                            <div className="text-slate-900">{a.zona}</div>
                            <div className="text-xs text-slate-500">
                              {a.dia_visita || "Sin día"}
                            </div>
                          </>
                        ) : (
                          <Etiqueta color="amarillo">Sin asignar</Etiqueta>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {a.lat != null ? (
                          <Link
                            href={`/dashboard/mapa?serial=${a.serial}`}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-marca hover:underline"
                          >
                            <MapPin className="h-3.5 w-3.5" /> Ver en mapa
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Sin ubicación
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Semaforo
                          semaforo={a.semaforo}
                          cumplimiento={a.cumplimiento}
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <MenuFila
                          retirado={retirado}
                          onEditar={() => editar(a)}
                          onAsignar={() => setAsignando([a])}
                          onBaja={() => setRetirando([a])}
                          onReactivar={() => reactivarLista([a])}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {paginas > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
            <span className="text-slate-500">
              Mostrando {pagina * POR_PAGINA + 1}–
              {Math.min((pagina + 1) * POR_PAGINA, filtrados.length)} de{" "}
              {filtrados.length}
            </span>
            <div className="flex gap-2">
              <Boton
                variante="secundario"
                icono={ChevronLeft}
                disabled={pagina === 0}
                onClick={() => setPagina((p) => p - 1)}
              >
                Anterior
              </Boton>
              <Boton
                variante="secundario"
                disabled={pagina >= paginas - 1}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Boton>
            </div>
          </div>
        )}
      </Tarjeta>

      {/* ---------------- MODALES ---------------- */}
      <ActivoForm
        abierto={formAbierto}
        activo={editando}
        onCerrar={() => {
          setFormAbierto(false);
          setEditando(null);
        }}
      />

      <AsignarModal
        activos={asignando}
        onCerrar={() => setAsignando([])}
        onListo={() => {
          setAsignando([]);
          setSeleccion(new Set());
        }}
      />

      <Modal
        abierto={retirando.length > 0}
        titulo={`Dar de baja ${retirando.length} activo(s)`}
        descripcion="Saldrán de la agenda de los asesores. Se conserva su historial de visitas y fotos."
        onCerrar={() => setRetirando([])}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setRetirando([])}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              icono={Trash2}
              cargando={procesando}
              onClick={confirmarBaja}
            >
              Dar de baja
            </Boton>
          </>
        }
      >
        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 text-sm">
          {retirando.map((a) => (
            <div
              key={a.serial}
              className="flex justify-between gap-2 border-b border-slate-100 px-3 py-2 last:border-0"
            >
              <span className="font-medium tabular-nums">{a.serial}</span>
              <span className="truncate text-slate-500">
                {a.razon_social || "Sin cliente"}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Puedes reactivarlos después desde la pestaña “Dados de baja”.
        </p>
      </Modal>
    </>
  );
}

// ==========================================================
// MENÚ DE ACCIONES POR FILA
// ==========================================================
function MenuFila({
  retirado,
  onEditar,
  onAsignar,
  onBaja,
  onReactivar,
}: {
  retirado: boolean;
  onEditar: () => void;
  onAsignar: () => void;
  onBaja: () => void;
  onReactivar: () => void;
}) {
  // Posición fija en pantalla: la tabla tiene scroll y recortaría el menú
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const abierto = pos !== null;
  const ref = useRef<HTMLDivElement>(null);

  const alternar = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (abierto) return setPos(null);
    const r = e.currentTarget.getBoundingClientRect();
    const alto = 140;
    const top =
      r.bottom + alto > window.innerHeight ? r.top - alto - 4 : r.bottom + 4;
    setPos({ top, left: r.right - 192 });
  };

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setPos(null);
    };
    const cerrarSiempre = () => setPos(null);
    document.addEventListener("mousedown", cerrar);
    window.addEventListener("scroll", cerrarSiempre, true);
    window.addEventListener("resize", cerrarSiempre);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      window.removeEventListener("scroll", cerrarSiempre, true);
      window.removeEventListener("resize", cerrarSiempre);
    };
  }, [abierto]);

  const setAbierto = (v: boolean) => !v && setPos(null);

  const item = (
    texto: string,
    Icono: typeof Pencil,
    accion: () => void,
    peligro = false
  ) => (
    <button
      onClick={() => {
        setAbierto(false);
        accion();
      }}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${
        peligro
          ? "text-rojo hover:bg-red-50"
          : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Icono className="h-4 w-4" /> {texto}
    </button>
  );

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={alternar}
        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        aria-label="Acciones"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {pos && (
        <div
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[1500] w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg"
        >
          {item("Editar", Pencil, onEditar)}
          {item("Asignar a asesor", UserPlus, onAsignar)}
          <div className="my-1 border-t border-slate-100" />
          {retirado
            ? item("Reactivar", ArchiveRestore, onReactivar)
            : item("Dar de baja", Trash2, onBaja, true)}
        </div>
      )}
    </div>
  );
}
