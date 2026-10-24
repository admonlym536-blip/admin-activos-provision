"use client";

import { useEffect, useState } from "react";
import { guardarActivo, mensajeError } from "@/src/lib/datos";
import { useDatos } from "@/src/lib/DatosContext";
import { Activo, ActivoEditable, DIAS } from "@/src/lib/tipos";
import { Boton, Campo, claseInput, Modal, useAvisos } from "@/src/components/ui";

const VACIO: ActivoEditable = {
  serial: "",
  tipo: "",
  descripcion: "",
  empresa: "PROVISION LYM",
  presupuesto: null,
  codigo_cliente: "",
  razon_social: "",
  zona: "",
  dia_visita: "",
};

/** Crear (activo = null) o editar un activo y su asignación. */
export function ActivoForm({
  abierto,
  activo,
  inicial,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean;
  activo: Activo | null;
  /** Valores precargados al crear (ej: desde una alerta) */
  inicial?: Partial<ActivoEditable>;
  onCerrar: () => void;
  onGuardado?: () => void | Promise<void>;
}) {
  const { zonas, activos, email, recargar } = useDatos();
  const avisar = useAvisos();
  const esNuevo = !activo;

  const [d, setD] = useState<ActivoEditable>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierto) return;
    setError("");
    setD(
      activo
        ? {
            serial: activo.serial,
            tipo: activo.tipo,
            descripcion: activo.descripcion,
            empresa: activo.empresa,
            presupuesto: activo.presupuesto,
            codigo_cliente: activo.codigo_cliente,
            razon_social: activo.razon_social,
            zona: activo.zona,
            dia_visita: activo.dia_visita,
          }
        : { ...VACIO, ...inicial }
    );
    // `inicial` solo se lee al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, activo]);

  // Tipos ya usados, para sugerir
  const tipos = [...new Set(activos.map((a) => a.tipo).filter(Boolean))].sort();

  const set = <K extends keyof ActivoEditable>(k: K, v: ActivoEditable[K]) =>
    setD((x) => ({ ...x, [k]: v }));

  const guardar = async () => {
    setError("");
    if (!d.serial.trim()) return setError("El serial es obligatorio.");
    if (d.zona && !d.dia_visita)
      return setError("Elige el día de visita para el asesor.");
    if (esNuevo && activos.some((a) => a.serial === d.serial.trim()))
      return setError(`Ya existe un activo con el serial ${d.serial}.`);

    setGuardando(true);
    try {
      await guardarActivo({ ...d, serial: d.serial.trim() }, esNuevo, email);
      avisar(esNuevo ? "Activo creado" : "Cambios guardados");
      await onGuardado?.();
      await recargar();
      onCerrar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      titulo={esNuevo ? "Nuevo activo" : `Editar activo ${activo?.serial}`}
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={guardar} cargando={guardando}>
            {esNuevo ? "Crear activo" : "Guardar cambios"}
          </Boton>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            1. Datos del equipo
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Serial *">
              <input
                className={claseInput}
                value={d.serial}
                disabled={!esNuevo}
                autoFocus={esNuevo}
                onChange={(e) => set("serial", e.target.value)}
                placeholder="Ej: 249605"
              />
            </Campo>
            <Campo etiqueta="Tipo">
              <input
                className={claseInput}
                list="tipos-activo"
                value={d.tipo}
                onChange={(e) => set("tipo", e.target.value)}
                placeholder="Ej: Nevera"
              />
              <datalist id="tipos-activo">
                {tipos.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Campo>
            <div className="sm:col-span-2">
              <Campo etiqueta="Descripción">
                <input
                  className={claseInput}
                  value={d.descripcion}
                  onChange={(e) => set("descripcion", e.target.value)}
                />
              </Campo>
            </div>
            <Campo etiqueta="Empresa">
              <input
                className={claseInput}
                value={d.empresa}
                onChange={(e) => set("empresa", e.target.value)}
              />
            </Campo>
            <Campo etiqueta="Presupuesto mensual">
              <input
                className={claseInput}
                type="number"
                min={0}
                value={d.presupuesto ?? ""}
                onChange={(e) =>
                  set(
                    "presupuesto",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
              />
            </Campo>
          </div>
        </section>

        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            2. Cliente
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Código cliente">
              <input
                className={claseInput}
                value={d.codigo_cliente}
                onChange={(e) => set("codigo_cliente", e.target.value)}
              />
            </Campo>
            <Campo etiqueta="Razón social">
              <input
                className={claseInput}
                value={d.razon_social}
                onChange={(e) => set("razon_social", e.target.value)}
              />
            </Campo>
          </div>
        </section>

        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            3. Asignación
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Asesor / Zona"
              ayuda="El asesor lo verá en su agenda el día elegido"
            >
              <select
                className={claseInput}
                value={d.zona}
                onChange={(e) => set("zona", e.target.value)}
              >
                <option value="">— Sin asignar —</option>
                {zonas.map((z) => (
                  <option key={z.codigo_zona} value={z.nombre_zona}>
                    {z.nombre_zona} ({z.codigo_zona})
                    {z.activa ? "" : " · inactiva"}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Día de visita">
              <select
                className={claseInput}
                value={d.dia_visita}
                onChange={(e) => set("dia_visita", e.target.value)}
              >
                <option value="">— Elegir —</option>
                {DIAS.map((dia) => (
                  <option key={dia}>{dia}</option>
                ))}
              </select>
            </Campo>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
