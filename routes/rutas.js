import { Router } from "express";
import 'dotenv/config';

const router = Router();

router.get("/", (req, res) => {
    res.render("index");
});

router.post("/", async (req, res) => {
    const { correo, contraseña } = req.body;

    try {
        const response = await fetch("http://localhost:8000/usuarios/inicio", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ correo, contraseña })
        });

        const data = await response.json();

        // El backend responde {"Inicio": 1} para tutor, 2 alumno, 3 admin. False si falla.
        if (data.Inicio === 1 || data.Inicio === 2 || data.Inicio === 3) {
            // Guardar usuario en sesión si lo deseas
            req.session.usuario = { correo, rol: data.Inicio };

            // Redirigir según el rol o al inicio
            res.send("¡Inicio de sesión exitoso! (Aquí iría el redirect a tu dashboard)");
        } else {
            // Caso de error en credenciales
            res.render("index", { error: "Correo o contraseña incorrectos" });
        }

    } catch (error) {
        console.error("Error conectando con el backend API:", error);
        res.render("index", { error: "Error de conexión con el servidor" });
    }
});

export default router;