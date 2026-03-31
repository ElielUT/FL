import { Router } from "express";
import 'dotenv/config';
import session from "express-session";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const url_api = process.env.URL_API;

const router = Router();

router.get("/", (req, res) => {
    res.render("index");
});

router.post("/", async (req, res) => {
    const { correo, contraseña } = req.body;

    try {
        if (correo !== "admin") {
            const { data: supaData, error: supaError } = await supabase.auth.signInWithPassword({
                email: correo,
                password: contraseña,
            });

            if (supaError) {
                if (supaError.message.includes("Email not confirmed")) {
                    return res.render("index", { error: "📧 Tu correo no ha sido verificado. Revisa tu bandeja de entrada." });
                } else {
                    return res.render("index", { error: "Credenciales incorrectas" });
                }
            }
        }

        const response = await fetch("http://localhost:8000/usuarios/inicio", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ correo, contraseña })
        });

        const data = await response.json();

        if (data.Inicio === 1) {
            req.session.usuario = data.Inicio;
            req.session.id_usuario = data.id_usuario;
            req.session.id_asesor = data.id_asesor;
            req.session.save(() => {
                res.redirect("/panelAsesor");
            });
        } else if (data.Inicio === 2) {
            req.session.usuario = data.Inicio;
            req.session.id_usuario = data.id_usuario;
            req.session.id_alumno = data.id_alumno;
            req.session.save(() => {
                res.redirect("/panelAsesorado");
            });
        } else if (data.Inicio === 3) {
            req.session.usuario = data.Inicio;
            req.session.id_usuario = data.id_usuario;
            req.session.save(() => {
                res.redirect("/panelAdmin");
            });
        } else {
            res.render("index", { error: "Correo o contraseña incorrectos" });
        }

    } catch (error) {
        console.error("Error conectando con el backend API:", error);
        res.render("index", { error: "Error de conexión con el servidor" });
    }
});

router.get("/gestionUsuarios", async (req, res) => {
    if (req.session.usuario !== 3) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }

    const respuesta = await fetch("http://127.0.0.1:8000/usuarios/mostraUsuarios", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })
    const data = await respuesta.json();
    const usuarios = data.items;
    if (usuarios == null) {
        res.render("index", { error: "Error de conexión" })
    } else {
        res.render("gestionUsuarios", { usuarios: usuarios });
    }
});

router.post("/gestionUsuarios", async (req, res) => {
    if (req.session.usuario !== 3) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }

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
    res.render("gestionUsuarios", { usuarios: usuarios });
});

router.get('/perfil-asesor', (req, res) => {
    res.render('perfilasesor');
});

router.get('/perfil-asesorado', (req, res) => {
    res.render('perfilasesorado');
});

router.get('/editar-perfil', (req, res) => {
    res.render('editarperfilasesorado');
});

router.post('/guardar-perfil', (req, res) => {
    const { nombre, carrera, cuatrimestre } = req.body;
    console.log(`Actualizando a: ${nombre}, ${carrera}, ${cuatrimestre}`);
    res.redirect('/perfil-asesorado');
});

router.get('/panelAdmin', async (req, res) => {
    if (req.session.usuario !== 3) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }

    try {
        const [respuestaUsuarios, respuestaEstadisticas] = await Promise.all([
            fetch("http://127.0.0.1:8000/usuarios/cantidadUsuarios", {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            }),
            fetch("http://127.0.0.1:8000/toma/estadisticas", {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            })
        ]);

        const dataUsuarios = await respuestaUsuarios.json();
        const dataEstadisticas = await respuestaEstadisticas.json();

        res.render('panelAdmin', {
            rol: "Administrador",
            usuarios: dataUsuarios.Total,
            adsesores: dataUsuarios.Asesores,
            asesorados: dataUsuarios.Asesorados,
            administradores: dataUsuarios.Administradores,
            totalAsesorias: dataEstadisticas.totales,
            pendientes: dataEstadisticas.pendientes,
            aceptadas: dataEstadisticas.aceptadas,
            completadas: dataEstadisticas.completadas
        });
    } catch (error) {
        console.error("Error fetching admin data:", error);
        res.render("index", { error: "Error al cargar datos del panel" });
    }
});

router.get('/supervisarAsesorias', async (req, res) => {
    if (req.session.usuario !== 3) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }

    try {
        const [respuestaEstadisticas, respuestaTomas] = await Promise.all([
            fetch("http://127.0.0.1:8000/toma/estadisticas", {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            }),
            fetch("http://127.0.0.1:8000/toma/mostrarToma/", {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            })
        ]);

        const dataEstadisticas = await respuestaEstadisticas.json();
        const dataTomas = await respuestaTomas.json();

        res.render('supervisarAsesorias', {
            estadisticas: dataEstadisticas,
            asesorias: dataTomas.items || []
        });
    } catch (error) {
        console.error("Error fetching supervisar data:", error);
        res.render('supervisarAsesorias', { estadisticas: { totales: 0, pendientes: 0, aceptadas: 0, completadas: 0 }, asesorias: [] });
    }
});

router.get("/borrarSesion", (req, res) => {
    req.session.destroy();
    res.clearCookie("session_id", { path: "/" });
    res.redirect("/")
})

router.get('/solicitarAsesoria', async (req, res) => {
    if (req.session.usuario !== 2) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }

    try {
        const respuesta = await fetch("http://127.0.0.1:8000/materias", {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await respuesta.json();
        const materias = data.items || [];

        res.render('solicitarAsesoria', { materias: materias });
    } catch (error) {
        console.error("Error al obtener materias:", error);
        res.render('solicitarAsesoria', { materias: [] });
    }
});

router.get('/agendar-asesoria', async (req, res) => {
    if (req.session.usuario !== 2) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }

    const materiaId = req.query.id;
    const materiaNombre = req.query.nombre;

    if (!materiaId) {
        return res.redirect('/solicitarAsesoria');
    }

    try {
        const respuesta = await fetch(`http://127.0.0.1:8000/asesores/buscarAsesorMateria/${encodeURIComponent(materiaNombre)}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        });

        let asesores = [];
        if (respuesta.ok) {
            const data = await respuesta.json();
            asesores = data.items || [];
        }

        res.render('agendarAsesoria', {
            materiaId: materiaId,
            materiaNombre: materiaNombre,
            asesores: asesores
        });
    } catch (error) {
        console.error("Error al obtener asesores:", error);
        res.render('agendarAsesoria', {
            materiaId: materiaId,
            materiaNombre: materiaNombre,
            asesores: []
        });
    }
});

router.post('/crear-solicitud', async (req, res) => {
    if (req.session.usuario !== 2) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }

    const { materiaId, id_asesor, tema, fecha, hora_in, hora_fin } = req.body;

    if (!req.session.id_alumno) {
        return res.send(`
            <script>
                alert("Error: No se encontró tu información de alumno. Contacta al administrador.");
                window.location.href = "/solicitarAsesoria";
            </script>
        `);
    }

    try {
        // 1. Crear la asesoría
        const crearAsesoriaResp = await fetch("http://127.0.0.1:8000/asesoria/crearAsesoria", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id_asesor3: parseInt(id_asesor),
                id_materia1: materiaId,
                tema: tema
            })
        });

        if (!crearAsesoriaResp.ok) {
            throw new Error("Error al crear la asesoría");
        }

        const asesoriaData = await crearAsesoriaResp.json();
        const id_asesoria = asesoriaData.id_asesoria;

        // 2. Crear la toma (solicitud)
        const crearTomaResp = await fetch("http://127.0.0.1:8000/toma/crearToma/", {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id_asesor3: parseInt(id_asesor),
                id_asesoria1: id_asesoria,
                id_alumno1: req.session.id_alumno,
                fecha: fecha,
                hora_in: hora_in,
                hora_fin: hora_fin,
                evaluacion_ase: 0
            })
        });

        if (!crearTomaResp.ok) {
            throw new Error("Error al crear la solicitud");
        }

        res.send(`
            <script>
                alert("✅ Solicitud creada exitosamente. El asesor recibirá tu petición.");
                window.location.href = "/solicitarAsesoria";
            </script>
        `);

    } catch (error) {
        console.error("Error al crear solicitud:", error);
        res.send(`
            <script>
                alert("❌ Error al crear la solicitud. Intenta de nuevo.");
                window.location.href = "/solicitarAsesoria";
            </script>
        `);
    }
});

router.get('/panelAsesor', async (req, res) => {
    if (req.session.usuario !== 1) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }

    const idAsesor = req.session.id_asesor || 1;

    try {
        const [respuestaTomasAsesor, respuestaCalificaciones] = await Promise.all([
            fetch(`http://127.0.0.1:8000/toma/buscarTomaAsesor/${idAsesor}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            }),
            fetch(`http://127.0.0.1:8000/toma/calificacionesAsesor/${idAsesor}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            })
        ]);

        const dataTomas = await respuestaTomasAsesor.json();
        const tomas = dataTomas.items || [];

        const pendientes = tomas.filter(t => !t.fecha).length;
        const completadas = tomas.filter(t => t.calificacion && t.calificacion > 0).length;

        let calificacionPromedio = 0;
        if (respuestaCalificaciones.ok) {
            const dataCalif = await respuestaCalificaciones.json();
            if (dataCalif.items && dataCalif.items.length > 0) {
                const suma = dataCalif.items.reduce((acc, curr) => acc + (curr.calificacion || 0), 0);
                calificacionPromedio = Number((suma / dataCalif.items.length).toFixed(1));
            }
        }

        const proximasAsesorias = tomas
            .filter(t => t.fecha && (!t.calificacion || t.calificacion === 0))
            .map(t => ({
                id_toma: t.id_toma || t.id_asesoria1,
                materia: t.asesoria?.materia?.nombre || "Sin materia",
                estudiante: t.alumno?.usuario ? `${t.alumno.usuario.nombres} ${t.alumno.usuario.apellidos}` : "Desconocido",
                fecha: t.fecha || "Fecha por definir",
                hora: t.hora_in ? t.hora_in.substring(0, 5) : "--:--"
            }));

        const evaluacionesRecientes = tomas
            .filter(t => t.calificacion && t.calificacion > 0)
            .slice(0, 5)
            .map(t => ({
                materia: t.asesoria?.materia?.nombre || "Sin materia",
                estudiante: t.alumno?.usuario ? `${t.alumno.usuario.nombres} ${t.alumno.usuario.apellidos}` : "Desconocido",
                comentario: t.comentario || "Sin comentario",
                calificacion: t.calificacion
            }));

        const solicitudesPendientes = tomas
            .filter(t => !t.fecha)
            .map(t => ({
                id_toma: t.id_toma || t.id_asesoria1,
                materia: t.asesoria?.materia?.nombre || "Sin materia",
                estudiante: t.alumno?.usuario ? `${t.alumno.usuario.nombres} ${t.alumno.usuario.apellidos}` : "Desconocido",
                fecha: t.fecha_solicitud || "Pendiente",
                hora: t.hora_solicitud || "--:--"
            }));

        let nombreAsesor = "Asesor";
        if (req.session.nombre_asesor) {
            nombreAsesor = req.session.nombre_asesor;
        }

        res.render('panelAsesor', {
            pendientes: pendientes,
            completadas: completadas,
            calificacionPromedio: calificacionPromedio,
            proximasAsesorias: proximasAsesorias,
            evaluacionesRecientes: evaluacionesRecientes,
            solicitudesPendientes: solicitudesPendientes,
            nombreAsesor: nombreAsesor
        });

    } catch (error) {
        console.error("Error al cargar panel de asesor:", error);
        res.render('panelAsesor', {
            pendientes: 0,
            completadas: 0,
            calificacionPromedio: 0,
            proximasAsesorias: [],
            evaluacionesRecientes: [],
            solicitudesPendientes: [],
            nombreAsesor: "Asesor"
        });
    }
});

router.get('/panelAsesorado', (req, res) => {
    if (req.session.usuario !== 2) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }
    res.render('panelAsesorado');
});

router.get("/historialAsesorias", (req, res) => {
    res.render("historialAsesorias");
});

router.get("/solicitudesDisponibles", (req, res) => {
    res.render("solicitudesDisponibles");
});

export default router;