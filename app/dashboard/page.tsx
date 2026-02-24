"use client";

import { useEffect, useState, CSSProperties } from "react";
import { supabase } from "@/src/lib/supabase";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function Dashboard() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [activos, setActivos] = useState<any[]>([]);
  const [activosFiltrados, setActivosFiltrados] = useState<any[]>([]);
  const [zonas, setZonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [activoSeleccionado, setActivoSeleccionado] = useState<any>(null);

  const [codigoNuevo, setCodigoNuevo] = useState("");
  const [razonNueva, setRazonNueva] = useState("");
  const [zonaNueva, setZonaNueva] = useState("");
  const [diaNuevo, setDiaNuevo] = useState("");

  /* ================= PROTEGER RUTA ================= */

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/");
        return;
      }
      setUserEmail(data.session.user.email || null);
    };
    checkSession();
  }, [router]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  /* ================= CARGAR DATOS ================= */

  const cargarActivos = async () => {
    const { data } = await supabase
      .from("activos_agenda")
      .select("*")
      .order("serial");

    if (data) {
      setActivos(data);
      setActivosFiltrados(data);
    }
    setLoading(false);
  };

  const cargarZonas = async () => {
    const { data } = await supabase
      .from("zonas")
      .select("codigo_zona, nombre_zona")
      .eq("activa", true);
    if (data) setZonas(data);
  };

  useEffect(() => {
    cargarActivos();
    cargarZonas();
  }, []);

  /* ================= FILTRO ================= */

  useEffect(() => {
    const resultado = activos.filter(
      (a) =>
        a.serial?.toString().toLowerCase().includes(filtro.toLowerCase()) ||
        a.codigo_cliente?.toString().toLowerCase().includes(filtro.toLowerCase())
    );
    setActivosFiltrados(resultado);
  }, [filtro, activos]);

  /* ================= MÉTRICA POR ZONA ================= */

  const activosPorZona = activos.reduce<Record<string, number>>(
    (acc, activo) => {
      acc[activo.zona] = (acc[activo.zona] || 0) + 1;
      return acc;
    },
    {}
  );

  /* ================= EDITAR ================= */

  const abrirModal = (activo: any) => {
    setActivoSeleccionado(activo);
    setCodigoNuevo(activo.codigo_cliente);
    setRazonNueva(activo.razon_social);
    setZonaNueva(activo.zona);
    setDiaNuevo(activo.dia_visita);
    setModalOpen(true);
  };

  const guardarCambios = async () => {
    if (!activoSeleccionado) return;

    const { error } = await supabase
      .from("activos_agenda")
      .update({
        codigo_cliente: codigoNuevo,
        razon_social: razonNueva,
        zona: zonaNueva,
        dia_visita: diaNuevo,
      })
      .eq("serial", activoSeleccionado.serial);

    if (error) {
      alert("Error al actualizar el activo");
      return;
    }

    setModalOpen(false);
    cargarActivos();
  };

  /* ================= ELIMINAR ================= */

  const eliminarActivo = async (serial: string) => {
    const confirmacion = confirm(
      `¿Seguro que deseas eliminar el activo ${serial}?`
    );
    if (!confirmacion) return;

    await supabase.from("activos_agenda").delete().eq("serial", serial);
    cargarActivos();
  };

  /* ================= EXPORTAR ================= */

  const descargarExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(activos);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Activos");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer]);
    saveAs(blob, "activos.xlsx");
  };

  /* ================= CARGA MASIVA ================= */

  const handleExcelUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);

    await supabase.from("activos_agenda").insert(json);
    cargarActivos();
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0 }}>Provision L&M</h2>
          <small>Sistema de Gestión de Activos</small>
        </div>

        <div style={{ textAlign: "right" }}>
          <small>{userEmail}</small>
          <br />
          <button onClick={logout} style={buttonRed}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={contentWrapper}>
        <h2>👋 Bienvenido Administrador</h2>

        <div style={metricCard}>
          Activos Totales: {activos.length}
        </div>

        <div style={zonaWrapper}>
          {Object.entries(activosPorZona).map(([zona, total]) => (
            <div key={zona} style={zonaCard}>
              {zona}: {total}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <input
            type="text"
            placeholder="Buscar..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={inputStyle}
          />

          <button onClick={descargarExcel} style={buttonBlue}>
            Descargar Excel
          </button>

          <label style={buttonGreen}>
            Examinar Excel
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleExcelUpload}
              style={{ display: "none" }}
            />
          </label>
        </div>

        <div style={tableCard}>
          {loading ? (
            <p>Cargando...</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={tableHeader}>
                <tr>
                  <th style={thStyle}>Serial</th>
                  <th style={thStyle}>Código</th>
                  <th style={thStyle}>Razón Social</th>
                  <th style={thStyle}>Zona</th>
                  <th style={thStyle}>Día</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {activosFiltrados.map((a) => (
                  <tr key={a.serial}>
                    <td style={tdStyle}>{a.serial}</td>
                    <td style={tdStyle}>{a.codigo_cliente}</td>
                    <td style={tdStyle}>{a.razon_social}</td>
                    <td style={tdStyle}>{a.zona}</td>
                    <td style={tdStyle}>{a.dia_visita}</td>
                    <td style={tdStyle}>
                      <button onClick={() => abrirModal(a)} style={buttonGreen}>
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarActivo(a.serial)}
                        style={buttonRed}
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

      {/* ================= MODAL ================= */}

      {modalOpen && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3>Editar Activo</h3>

            <input
              value={codigoNuevo}
              onChange={(e) => setCodigoNuevo(e.target.value)}
              style={inputStyle}
            />

            <input
              value={razonNueva}
              onChange={(e) => setRazonNueva(e.target.value)}
              style={inputStyle}
            />

            <select
              value={zonaNueva}
              onChange={(e) => setZonaNueva(e.target.value)}
              style={inputStyle}
            >
              {zonas.map((z) => (
                <option key={z.codigo_zona} value={z.nombre_zona}>
                  {z.nombre_zona}
                </option>
              ))}
            </select>

            <select
              value={diaNuevo}
              onChange={(e) => setDiaNuevo(e.target.value)}
              style={inputStyle}
            >
              <option>Lunes</option>
              <option>Martes</option>
              <option>Miércoles</option>
              <option>Jueves</option>
              <option>Viernes</option>
              <option>Sábado</option>
            </select>

            <div style={{ marginTop: 15 }}>
              <button onClick={guardarCambios} style={buttonGreen}>
                Guardar
              </button>

              <button
                onClick={() => setModalOpen(false)}
                style={buttonRed}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= ESTILOS ================= */

const overlayStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modalStyle: CSSProperties = {
  backgroundColor: "white",
  padding: 25,
  borderRadius: 8,
  width: 400,
};

const pageStyle: CSSProperties = {
  backgroundColor: "#E5E7EB",
  minHeight: "100vh",
};

const headerStyle: CSSProperties = {
  backgroundColor: "#1E3A8A",
  color: "white",
  padding: "15px 30px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const contentWrapper: CSSProperties = { padding: 30 };

const metricCard: CSSProperties = {
  backgroundColor: "#DBEAFE",
  padding: 15,
  borderRadius: 8,
  fontWeight: "bold",
  marginTop: 10,
};

const zonaWrapper: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 10,
};

const zonaCard: CSSProperties = {
  backgroundColor: "#BFDBFE",
  padding: "8px 12px",
  borderRadius: 6,
  fontSize: 14,
};

const tableCard: CSSProperties = {
  backgroundColor: "white",
  marginTop: 20,
  padding: 20,
  borderRadius: 10,
};

const tableHeader: CSSProperties = {
  backgroundColor: "#1F3B73",
  color: "white",
};

const thStyle: CSSProperties = { padding: 10, textAlign: "left" };
const tdStyle: CSSProperties = {
  padding: 10,
  borderBottom: "1px solid #ddd",
};

const inputStyle: CSSProperties = {
  padding: 8,
  borderRadius: 6,
  border: "1px solid #ccc",
  marginRight: 10,
};

const buttonGreen: CSSProperties = {
  backgroundColor: "#059669",
  color: "white",
  padding: "6px 12px",
  borderRadius: 6,
  cursor: "pointer",
  border: "none",
  marginRight: 5,
};

const buttonBlue: CSSProperties = {
  backgroundColor: "#2563EB",
  color: "white",
  padding: "6px 12px",
  borderRadius: 6,
  cursor: "pointer",
  border: "none",
  marginRight: 5,
};

const buttonRed: CSSProperties = {
  backgroundColor: "#EF4444",
  color: "white",
  padding: "6px 12px",
  borderRadius: 6,
  cursor: "pointer",
  border: "none",
  marginLeft: 5,
};