"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useDatos } from "@/src/lib/DatosContext";
import { mensajeError } from "@/src/lib/datos";
import {
  aISO,
  descargarPlantillaVentas,
  FilaVenta,
  importarVentas,
  leerExcelVentas,
  ModoExistente,
  ultimaFechaCargada,
} from "@/src/lib/ventas";
import { Encabezado } from "@/src/components/Encabezado";
import {
  Alerta,
  Boton,
  claseInput,
  Etiqueta,
  Tarjeta,
  TituloTarjeta,
  useAvisos,
} from "@/src/components/ui";

const dinero = (v: number) => `$${Math.round(v).toLocaleString("es-CO")}`;

const ayerISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return aISO(d);
};

const MODOS: [ModoExistente, string][] = [
  ["reemplazar", "Reemplazar"],
  ["sumar", "Sumar"],
  ["omitir", "Omitir"],
];

type Resultado = {
  ok: number;
  total: number;
  errores: { serial: string; fecha: string; error: string }[];
};

export default function CargarVentasPage() {
  const { activos } = useDatos();
  const avisar = useAvisos();
  const input = useRef<HTMLInputElement>(null);

  const [fecha, setFecha] = useState(ayerISO());
  const [ultima, setUltima] = useState<string | null>(null);
  const [archivo, setArchivo] = useState("");
  const [filas, setFilas] = useState<FilaVenta[]>([]);
  const [tieneFecha, setTieneFecha] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [modo, setModo] = useState<ModoExistente>("reemplazar");
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    ultimaFechaCargada().then(setUltima).catch(console.error);
  }, []);

  const nuevas = filas.filter((f) => f.estado === "nueva");
  const existen = filas.filter((f) => f.estado === "existe");
  const conError = filas.filter((f) => f.estado === "error");
  const aGuardar = nuevas.length + (modo === "omitir" ? 0 : existen.length);
  const totalVenta = [...nuevas, ...existen].reduce((s, f) => s + f.venta, 0);
  const fechasArchivo = [...new Set([...nuevas, ...existen].map((f) => f.fecha))].sort();

  const procesar = async (f: File | undefined) => {
    if (!f) return;
    setResultado(null);
    setLeyendo(true);
    try {
      const r = await leerExcelVentas(f, fecha, activos);
      setArchivo(f.name);
      setFilas(r.filas);
      setTieneFecha(r.tieneColumnaFecha);
    } catch (e) {
      console.error(e);
      setArchivo("");
      avisar(`No se pudo leer el archivo: ${mensajeError(e)}`, "error");
    } finally {
      setLeyendo(false);
    }
  };

  const importar = async () => {
    setImportando(true);
    setProgreso(0);
    const errores = await importarVentas(filas, modo, setProgreso);
    setResultado({ ok: aGuardar - errores.length, total: aGuardar, errores });
    setImportando(false);
    setFilas([]);
    setArchivo("");
    ultimaFechaCargada().then(setUltima).catch(console.error);
    if (!errores.length) avisar("Ventas guardadas");
  };

  const fechaLarga = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  return (
    <>
      <Link
        href="/dashboard/ventas"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Ventas
      </Link>
      <Encabezado
        titulo="Cargar ventas diarias"
        subtitulo="Sube la venta de cada activo (por serial) para un día"
        acciones={
          <Boton variante="secundario" icono={Download} onClick={descargarPlantillaVentas}>
            Plantilla de ventas
          </Boton>
        }
      />

      {/* ---------------- FECHA ---------------- */}
      {filas.length === 0 && (
        <Tarjeta className="mb-4 flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Día de la venta
            </span>
            <input
              type="date"
              className={`${claseInput} w-48`}
              value={fecha}
              max={aISO(new Date())}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
          <p className="flex-1 text-sm text-slate-500">
            Se usa para las filas que no traen fecha. Si tu Excel tiene una
            columna <b>fecha</b>, se respeta la de cada fila.
          </p>
          {ultima && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
              <CalendarDays className="h-3.5 w-3.5" />
              Última carga: {fechaLarga(ultima)}
            </span>
          )}
        </Tarjeta>
      )}

      {/* ---------------- ARCHIVO ---------------- */}
      {filas.length === 0 && (
        <button
          onClick={() => input.current?.click()}
          disabled={leyendo}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            procesar(e.dataTransfer.files?.[0]);
          }}
          className={`mb-6 flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
            arrastrando
              ? "border-marca bg-marca/[0.04]"
              : "border-slate-300 bg-white hover:border-slate-400"
          }`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-marca/10 text-marca">
            <UploadCloud className="h-6 w-6" />
          </span>
          <span className="text-sm font-medium text-slate-900">
            {leyendo ? (
              "Leyendo archivo…"
            ) : (
              <>
                Arrastra el Excel de ventas aquí o{" "}
                <span className="text-marca">haz clic para elegirlo</span>
              </>
            )}
          </span>
          <span className="max-w-md text-xs text-slate-500">
            Columnas: <b>serial</b> (o código activo), <b>venta</b> y,
            opcional, <b>fecha</b>. Si un serial se repite el mismo día, las
            ventas se suman.
          </span>
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          procesar(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {/* ---------------- RESULTADO ---------------- */}
      {resultado && (
        <Tarjeta className="mb-6">
          <div className="flex items-center gap-3">
            {resultado.errores.length ? (
              <XCircle className="h-6 w-6 text-amarillo" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-verde" />
            )}
            <div className="font-semibold text-slate-900">
              {resultado.ok} de {resultado.total} ventas guardadas
            </div>
          </div>
          {resultado.errores.length > 0 && (
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm text-rojo">
              {resultado.errores.map((e, i) => (
                <li key={i}>
                  <b className="tabular-nums">{e.serial}</b> ({e.fecha}): {e.error}
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/dashboard/ventas"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-marca hover:underline"
          >
            Ver el seguimiento de ventas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Tarjeta>
      )}

      {/* ---------------- VISTA PREVIA ---------------- */}
      {filas.length > 0 && (
        <Tarjeta className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4">
            <FileSpreadsheet className="h-5 w-5 text-verde" />
            <div className="min-w-0 flex-1">
              <TituloTarjeta>{archivo}</TituloTarjeta>
              <div className="-mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Etiqueta color="verde">{nuevas.length} nuevas</Etiqueta>
                {existen.length > 0 && (
                  <Etiqueta color="azul">{existen.length} ya cargadas</Etiqueta>
                )}
                {conError.length > 0 && (
                  <Etiqueta color="rojo">{conError.length} con errores (se omiten)</Etiqueta>
                )}
                <span>
                  · {dinero(totalVenta)} ·{" "}
                  {fechasArchivo.length === 1
                    ? fechaLarga(fechasArchivo[0])
                    : `${fechasArchivo.length} días`}
                </span>
              </div>
            </div>
            <Boton
              variante="secundario"
              disabled={importando}
              onClick={() => {
                setFilas([]);
                setArchivo("");
              }}
            >
              Cancelar
            </Boton>
            <Boton onClick={importar} cargando={importando} disabled={aGuardar === 0}>
              {importando
                ? `Guardando ${progreso} de ${aGuardar}`
                : aGuardar
                  ? `Guardar ${aGuardar} ventas`
                  : "Nada para guardar"}
            </Boton>
          </div>

          {!tieneFecha && (
            <div className="flex items-center gap-2 border-b border-slate-200 bg-blue-50/60 px-5 py-2.5 text-sm text-blue-800">
              <Info className="h-4 w-4 shrink-0" />
              El archivo no trae columna de fecha: todas las ventas quedan para el{" "}
              <b>{fechaLarga(fecha)}</b>.
            </div>
          )}

          {existen.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm">
              <span className="text-slate-600">
                <b>{existen.length}</b> ya tienen venta cargada ese día:
              </span>
              <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5">
                {MODOS.map(([v, t]) => (
                  <button
                    key={v}
                    onClick={() => setModo(v)}
                    disabled={importando}
                    className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                      modo === v
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500">
                {modo === "reemplazar"
                  ? "Se cambia por el valor del archivo (para corregir una carga)."
                  : modo === "sumar"
                    ? "Se suma al valor que ya estaba."
                    : "Se dejan como están."}
              </span>
            </div>
          )}

          {importando && (
            <div className="h-1 bg-slate-100">
              <div
                className="h-full bg-marca transition-all"
                style={{ width: `${(progreso / Math.max(1, aGuardar)) * 100}%` }}
              />
            </div>
          )}

          {conError.length > 0 && (
            <div className="border-b border-slate-200 px-5 py-3">
              <Alerta tipo="error" icono={XCircle}>
                {conError.length} fila(s) con error no se guardarán. Revisa las
                marcadas en rojo abajo.
              </Alerta>
            </div>
          )}

          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Fila</th>
                  <th className="px-4 py-2.5">Resultado</th>
                  <th className="px-4 py-2.5">Serial</th>
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-4 py-2.5 text-right">Venta</th>
                  <th className="px-4 py-2.5 text-right">Ya cargado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map((f) => (
                  <tr
                    key={`${f.filas[0]}-${f.serial}`}
                    className={f.estado === "error" ? "bg-red-50/60" : ""}
                  >
                    <td className="px-4 py-2.5 tabular-nums text-slate-400">
                      {f.filas.join(", ")}
                    </td>
                    <td className="px-4 py-2.5">
                      {f.estado === "error" ? (
                        <span className="text-xs font-medium text-rojo">
                          {f.errores.join(" · ")}
                        </span>
                      ) : f.estado === "nueva" ? (
                        <Etiqueta color="verde">
                          Nueva{f.filas.length > 1 ? ` (${f.filas.length} filas sumadas)` : ""}
                        </Etiqueta>
                      ) : (
                        <Etiqueta color={modo === "omitir" ? "gris" : "azul"}>
                          {modo === "omitir" ? "Ya cargada · se omite" : `Ya cargada · ${modo}`}
                        </Etiqueta>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium tabular-nums text-slate-900">
                      {f.serial || "—"}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-2.5 text-slate-700">
                      {f.activo?.razon_social || "—"}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-700">{f.fecha || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">
                      {f.estado === "error" && !f.venta ? "—" : dinero(f.venta)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                      {f.existente ? dinero(f.existente.venta) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
    </>
  );
}
