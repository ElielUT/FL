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
        if (data.Inicio === 1) {
            // Guardar usuario en sesión si lo deseas
            req.session.usuario = data.Inicio;

            // Redirigir según el rol o al inicio
            res.send("¡Inicio de sesión exitoso! (Tutor)");
        } else if (data.Inicio === 2) {
            req.session.usuario = data.Inicio;
            res.send("¡Inicio de sesión exitoso! (Alumno)");
        } else if (data.Inicio === 3) {
            req.session.usuario = data.Inicio;
            res.redirect("/gestionUsuarios");
        } else {
            // Caso de error en credenciales
            res.render("index", { error: "Correo o contraseña incorrectos" });
        }

    } catch (error) {
        console.error("Error conectando con el backend API:", error);
        res.render("index", { error: "Error de conexión con el servidor" });
    }
});

router.get("/gestionUsuarios", async (req, res) => {
    const respuesta = await fetch("http://127.0.0.1:8000/usuarios/mostraUsuarios", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })
    const data = await respuesta.json();
    const usuarios = data.items;
    if (/*req.session.usuario === 3*/ true) {
        res.render("gestionUsuarios", { usuarios: usuarios });
    } else {
        res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }
});

router.post("/gestionUsuarios", async (req, res) => {
    const { nombre, apellidos, correo, rol, carrera, cuatrimestre, contraseña } = req.body;

    const respuesta = await fetch("http://127.0.0.1:8000/usuarios/crearUsuario", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
            correo, 
            nombres: nombre, 
            apellidos, 
            contraseña, 
            categoria: rol, 
            cuatrimestre: parseInt(cuatrimestre), 
            plantel: "SJR"
        })
    });

    if (!respuesta.ok) {
        console.error("Error al crear usuario:", await respuesta.text());
        return res.render("gestionUsuarios", { usuarios: [], error: "Error al crear usuario. Verifica los datos." });
    }
    const res2 = await fetch("http://127.0.0.1:8000/usuarios/buscarUsuarios/" + correo, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })
    if (!res2.ok) {
        console.error("Error al buscar usuario:", await res2.text());
        return res.render("gestionUsuarios", { usuarios: [], error: "Error al buscar usuario creado." });
    }
    const data2 = await res2.json();
    const id_user = data2.item.id_usuario;
    const data = await respuesta.json();
    var user;
    if (rol === "asesorado") {
        const subirAsesorado = await fetch("http://127.0.0.1:8000/alumnos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ id_usuario1: id_user, carrera })
        })
        user = await subirAsesorado.json();
    }
    else if (rol === "asesor") {
        var disponible = true, categoriaAS = "alumno", contacto = "0000000000";
        const subirAsesor = await fetch("http://127.0.0.1:8000/asesores/crearAsesor", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ id_usuario2: id_user, carrera, disponible, categoria: categoriaAS, contacto })
        })
        user = await subirAsesor.json();
    }
    const respuesta3 = await fetch("http://127.0.0.1:8000/usuarios/mostraUsuarios", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })
    const data3 = await respuesta3.json();
    const usuarios = data3.items;
    if (/*req.session.usuario === 3*/ true) {
        res.render("gestionUsuarios", { usuarios: usuarios });
    } else {
        res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }
});

const express = require('express');
router.get('/perfil-asesorado', (req, res) => {
    res.render('perfilasesorado'); 
});

// En rutas.js
router.get('/editar-perfil', (req, res) => {
    res.render('editarperfil');
});

router.post('/guardar-perfil', (req, res) => {
    const { nombre, carrera, cuatrimestre } = req.body;
    
    // Aquí iría tu consulta SQL o de MongoDB para actualizar
    console.log(`Actualizando a: ${nombre}, ${carrera}, ${cuatrimestre}`);
    
    // Al terminar, rediriges al perfil normal
    res.redirect('/perfil-asesorado');
});
module.exports = router;
export default router;

