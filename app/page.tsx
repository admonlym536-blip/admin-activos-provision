"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje("");
    setCargando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setCargando(false);

    if (error) {
      setMensaje("❌ Credenciales incorrectas");
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "linear-gradient(135deg, #0C3B75 40%, #0A2E5A 100%)",
        fontFamily: "Segoe UI, Roboto, sans-serif",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "2.5rem",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "450px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
        }}
      >
        {/* LOGO + TITULO EN HORIZONTAL */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1.8rem",
          }}
        >
          <Image
            src="/Logo_Provision.jpg"
            alt="Provision Logo"
            width={85}
            height={85}
            style={{ objectFit: "contain" }}
          />

          <div>
            <h2
              style={{
                color: "#0C3B75",
                margin: 0,
                fontWeight: 700,
              }}
            >
              Sistema Gestión de Activos
            </h2>

            <p
              style={{
                color: "#555",
                fontSize: "0.9rem",
                marginTop: 4,
              }}
            >
              Inicia sesión con tu usuario administrador
            </p>
          </div>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "0.9rem",
              borderRadius: "10px",
              border: "1px solid #ccc",
              fontSize: "0.95rem",
            }}
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: "0.9rem",
              borderRadius: "10px",
              border: "1px solid #ccc",
              fontSize: "0.95rem",
            }}
          />

          <button
            type="submit"
            disabled={cargando}
            style={{
              background: cargando ? "#ccc" : "#0C3B75",
              color: "white",
              border: "none",
              padding: "0.9rem",
              borderRadius: "10px",
              fontWeight: 600,
              cursor: cargando ? "not-allowed" : "pointer",
              transition: "0.3s",
            }}
          >
            {cargando ? "Verificando..." : "Iniciar sesión"}
          </button>
        </form>

        {mensaje && (
          <p
            style={{
              marginTop: "1rem",
              color: "red",
              fontWeight: 500,
            }}
          >
            {mensaje}
          </p>
        )}

        <footer
          style={{
            marginTop: "2rem",
            fontSize: "0.75rem",
            color: "#777",
            textAlign: "center",
          }}
        >
          © {new Date().getFullYear()} Provisión L&M S.A.S.
        </footer>
      </div>
    </div>
  );
}