"use client";

import { useEffect, useState } from "react";
import { asignarActivos, mensajeError } from "@/src/lib/datos";
import { useDatos } from "@/src/lib/DatosContext";
import { Activo, DIAS } from "@/src/lib/tipos";
import { Boton, Campo, claseInput, Modal, useAvisos } from "@/src/components/ui";

/** Asignar varios activos a un asesor y/o día de una sola vez. */
export function AsignarModal({
  activos,
  onCerrar,
  onListo,
}: {
  activos: Activo[];
  onCerrar: () => void;
  onListo: () => void;
}) {
  const { zonas, recargar } = useDatos();
  const avisar = useAvisos();
  const abierto = activos.length > 0;

  const [zona, setZona] = useState("");
  const [dia, setDia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierto) return;
    setZona("");
    setDia("");
    setError("");
  }, [abierto]);

  const sinAsignar = activos.filter((a) => !a.asignado).length;

  const guardar = async () => {
    setError("");
    if (!zona && !dia) return setError("Elige un asesor o un día.");
    if (sinAsignar && (!zona || !dia))
      return setError(
        `${sinAsignar} activo(s) no tienen asesor: elige asesor y día.`
      );

    setGuardando(true);
    try {
      await asignarActivos(activos, { zona, dia_visita: dia });
      avisar(`${activos.length} activo(s) asignados`);
      await recargar();
      onListo();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      titulo={`Asignar ${activos.length} activo(s)`}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={guardar} cargando={guardando}>
            Asignar
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Deja un campo en <b>“Mantener actual”</b> si no quieres cambiarlo.
        </p>
        <Campo etiqueta="Asesor / Zona">
          <select
            className={claseInput}
            value={zona}
            onChange={(e) => setZona(e.target.value)}
          >
            <option value="">— Mantener actual —</option>
            {zonas.map((z) => (
              <option key={z.codigo_zona} value={z.nombre_zona}>
                {z.nombre_zona} ({z.codigo_zona})
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Día de visita">
          <select
            className={claseInput}
            value={dia}
            onChange={(e) => setDia(e.target.value)}
          >
            <option value="">— Mantener actual —</option>
            {DIAS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Campo>
        <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          {activos.map((a) => (
            <div key={a.serial}>
              <b>{a.serial}</b> · {a.razon_social || "Sin cliente"}
              {a.zona ? ` · ${a.zona} (${a.dia_visita})` : " · sin asignar"}
            </div>
          ))}
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
