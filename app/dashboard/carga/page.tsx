"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Download,
  GitCompareArrows,
  FileSpreadsheet,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useDatos } from "@/src/lib/DatosContext";
import { importarActivos } from "@/src/lib/datos";
import {
  descargarActivosSistema,
  descargarCruce,
  descargarPlantilla,
  FilaImportada,
  leerExcel,
} from "@/src/lib/excel";
import { ESTADO_RETIRADO } from "@/src/lib/tipos";
import { Encabezado } from "@/src/components/Encabezado";
import {
  Boton,
  Etiqueta,
  Tarjeta,
  TituloTarjeta,
  useAvisos,
} from "@/src/components/ui";

type Resultado = { ok: number; errores: { serial: string; error: string }[] };

type SiExiste = "omitir" | "actualizar";

function Paso({
  n,
  titulo,
  activo,
  hecho,
}: {
  n: number;
  titulo: string;
  activo: boolean;
  hecho: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          hecho
            ? "bg-verde text-white"
            : activo
              ? "bg-marca text-white"
              : "bg-slate-100 text-slate-400"
        }`}
      >
        {hecho ? <CheckCircle2 className="h-4 w-4" /> : n}
      </span>
      <span
        className={`text-sm font-medium ${
          activo || hecho ? "text-slate-900" : "text-slate-400"
        }`}
      >
        {titulo}
      </span>
    </div>
  );
}

export default function CargaPage() {
  const { activos, zonas, email, recargar } = useDatos();
  const avisar = useAvisos();
  const input = useRef<HTMLInputElement>(null);

  const [archivo, setArchivo] = useState("");
  const [filas, setFilas] = useState<FilaImportada[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  // Por defecto NO se tocan los activos que ya existen (evita repetir)
  const [siExiste, setSiExiste] = useState<SiExiste>("omitir");

  const existentes = useMemo(
    () => new Set(activos.map((a) => a.serial)),
    [activos]
  );
  const actuales = useMemo(
    () => new Map(activos.map((a) => [a.serial, a])),
    [activos]
  );

  const validas = filas.filter((f) => f.errores.length === 0);
  const nuevas = validas.filter((f) => f.esNuevo).length;
  const yaExisten = validas.length - nuevas;
  const conError = filas.length - validas.length;
  const aImportar = validas.filter(
    (f) => f.esNuevo || siExiste === "actualizar"
  );

  const procesar = async (f: File | undefined) => {
    if (!f) return;
    setResultado(null);
    try {
      setArchivo(f.name);
      setFilas(await leerExcel(f, zonas, existentes));
    } catch (err) {
      console.error(err);
      setArchivo("");
      avisar("No se pudo leer el archivo. ¿Es un Excel válido?", "error");
    }
  };

  const importar = async () => {
    setImportando(true);
    setProgreso(0);
    const errores = await importarActivos(
      aImportar.map((f) => f.datos),
      actuales,
      email,
      setProgreso
    );
    setResultado({ ok: aImportar.length - errores.length, errores });
    setImportando(false);
    setFilas([]);
    setArchivo("");
    await recargar();
    if (errores.length === 0) avisar("Importación completa");
  };

  const pasoActual = resultado ? 4 : filas.length ? 3 : 2;

  return (
    <>
      <Encabezado
        titulo="Carga masiva"
        subtitulo="Crea activos nuevos o actualiza los existentes desde un Excel"
        acciones={
          <>
            <Boton
              variante="secundario"
              icono={Database}
              onClick={() => descargarActivosSistema(activos)}
              title="Todos los activos registrados, con las columnas de la plantilla"
            >
              Activos del sistema ({activos.length})
            </Boton>
            <Boton variante="secundario" icono={Download} onClick={descargarPlantilla}>
              Plantilla vacía
            </Boton>
          </>
        }
      />

      {/* ---------------- PASOS ---------------- */}
      <Tarjeta className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Paso n={1} titulo="Prepara el Excel" activo hecho />
        <div className="hidden h-px w-10 bg-slate-200 sm:block" />
        <Paso n={2} titulo="Sube el archivo" activo={pasoActual === 2} hecho={pasoActual > 2} />
        <div className="hidden h-px w-10 bg-slate-200 sm:block" />
        <Paso n={3} titulo="Revisa e importa" activo={pasoActual === 3} hecho={pasoActual > 3} />
      </Tarjeta>

      {/* ---------------- ZONA DE ARCHIVO ---------------- */}
      {filas.length === 0 && (
        <button
          onClick={() => input.current?.click()}
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
            Arrastra tu Excel aquí o <span className="text-marca">haz clic para elegirlo</span>
          </span>
          <span className="max-w-md text-xs text-slate-500">
            Columnas: serial, tipo, descripción, empresa, presupuesto, código
            cliente, razón social, zona (asesor) y día de visita. Si el serial
            ya existe se actualiza; si no, se crea. Nada se guarda hasta que
            confirmes.
          </span>
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => {
          procesar(e.target.files?.[0]);
          e.target.value = "";
        }}
        className="hidden"
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
              {resultado.ok} activos guardados
              {resultado.errores.length > 0 &&
                ` · ${resultado.errores.length} con error`}
            </div>
          </div>
          {resultado.errores.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-rojo">
              {resultado.errores.map((e) => (
                <li key={e.serial}>
                  <b className="tabular-nums">{e.serial}</b>: {e.error}
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/dashboard/activos"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-marca hover:underline"
          >
            Ir a la lista de activos <ArrowRight className="h-3.5 w-3.5" />
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
              <div className="-mt-3 flex flex-wrap gap-2">
                <Etiqueta color="verde">{nuevas} nuevos</Etiqueta>
                <Etiqueta color={siExiste === "omitir" ? "gris" : "azul"}>
                  {yaExisten} ya existen
                  {siExiste === "omitir" ? " (se omiten)" : " (se actualizan)"}
                </Etiqueta>
                {conError > 0 && (
                  <Etiqueta color="rojo">{conError} con errores (se omiten)</Etiqueta>
                )}
              </div>
            </div>
            <Boton
              variante="secundario"
              icono={GitCompareArrows}
              onClick={() => descargarCruce(filas, actuales, archivo)}
              title="Excel con el resultado de cada fila contra el sistema"
            >
              Descargar cruce
            </Boton>
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
            <Boton
              onClick={importar}
              cargando={importando}
              disabled={aImportar.length === 0}
            >
              {importando
                ? `Importando ${progreso} de ${aImportar.length}`
                : aImportar.length
                  ? `Importar ${aImportar.length} activos`
                  : "Nada nuevo para importar"}
            </Boton>
          </div>

          {yaExisten > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm">
              <span className="text-slate-600">
                Si el serial <b>ya existe</b> en el sistema:
              </span>
              <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5">
                {(
                  [
                    ["omitir", "No repetir (omitir)"],
                    ["actualizar", "Actualizar sus datos"],
                  ] as [SiExiste, string][]
                ).map(([v, t]) => (
                  <button
                    key={v}
                    onClick={() => setSiExiste(v)}
                    disabled={importando}
                    className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                      siExiste === v
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {importando && (
            <div className="h-1 bg-slate-100">
              <div
                className="h-full bg-marca transition-all"
                style={{
                  width: `${(progreso / Math.max(1, aImportar.length)) * 100}%`,
                }}
              />
            </div>
          )}

          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Fila</th>
                  <th className="px-4 py-2.5">Resultado</th>
                  <th className="px-4 py-2.5">Serial</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-4 py-2.5">Asesor</th>
                  <th className="px-4 py-2.5">Día</th>
                  <th className="px-4 py-2.5">Hoy en el sistema</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map((f) => {
                  const s = actuales.get(f.datos.serial);
                  return (
                  <tr key={f.fila} className={f.errores.length ? "bg-red-50/60" : ""}>
                    <td className="px-4 py-2.5 tabular-nums text-slate-400">{f.fila}</td>
                    <td className="px-4 py-2.5">
                      {f.errores.length ? (
                        <span className="text-xs font-medium text-rojo">
                          {f.errores.join(" · ")}
                        </span>
                      ) : f.esNuevo ? (
                        <Etiqueta color="verde">Nuevo</Etiqueta>
                      ) : siExiste === "actualizar" ? (
                        <Etiqueta color="azul">Ya existe · actualizar</Etiqueta>
                      ) : (
                        <Etiqueta color="gris">Ya existe · se omite</Etiqueta>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium tabular-nums text-slate-900">
                      {f.datos.serial || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{f.datos.tipo}</td>
                    <td className="px-4 py-2.5">
                      <div className="text-slate-900">{f.datos.razon_social}</div>
                      <div className="text-xs tabular-nums text-slate-500">
                        {f.datos.codigo_cliente}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{f.datos.zona || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-700">{f.datos.dia_visita || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {s ? (
                        <>
                          <div className="text-slate-700">
                            {s.razon_social || "Sin cliente"}
                          </div>
                          <div>
                            {s.zona || "Sin asignar"}
                            {s.dia_visita ? ` · ${s.dia_visita}` : ""}
                            {s.estado === ESTADO_RETIRADO ? " · dado de baja" : ""}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
    </>
  );
}
