import { Router } from "express";
import 'dotenv/config';
import session from "express-session";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

        // El backend responde {"Inicio": 1} para asesor, 2 asesorado, 3 admin
        if (data.Inicio === 1) {
            req.session.usuario = data.Inicio;
            req.session.id_usuario = data.id;
            req.session.correo = correo;
            req.session.save(() => {
                res.redirect("/panelAsesor");
            });
        } else if (data.Inicio === 2) {
            req.session.usuario = data.Inicio;
            req.session.id_usuario = data.id;
            req.session.correo = correo;
            req.session.save(() => {
                res.redirect("/panelAsesorado");
            });
        } else if (data.Inicio === 3) {
            req.session.usuario = data.Inicio;
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

router.get('/perfil-asesor', async (req, res) => {
    if (req.session.usuario !== 1) {
        return res.render("index", { error: "Inicia sesión como asesor" });
    }

    try {
        const correo = req.session.correo;
        console.log("Cargando perfil para asesor:", correo);

        // 1. Buscar el asesor por el correo del usuario
        const resAsesor = await fetch(`http://localhost:8000/asesores/buscarAsesorUsuario/${encodeURIComponent(correo)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        if (!resAsesor.ok) throw new Error(`Error API Asesor: ${resAsesor.status}`);
        const dataAsesor = await resAsesor.json();
        const asesorInfo = dataAsesor.items ? dataAsesor.items[0] : null;

        if (!asesorInfo) throw new Error("No se encontró información del asesor en la base de datos");

        // 2. Obtener datos del usuario
        const resUser = await fetch(`http://localhost:8000/usuarios/buscarUsuarioID/${asesorInfo.id_usuario2}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const dataUser = await resUser.json();
        const userInfo = dataUser.item;

        if (!userInfo) throw new Error("No se encontró información del usuario");

        // 3. Obtener disponibilidad
        const resDisp = await fetch(`http://localhost:8000/disponibilidad/${asesorInfo.id_asesor}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const dataDisp = await resDisp.json();
        const disponibilidad = dataDisp.items || [];

        // 4. Preparar objeto para la vista
        const datosVista = {
            asesor: {
                nombre: `${userInfo.nombres} ${userInfo.apellidos}`,
                correo: userInfo.correo,
                carrera: asesorInfo.carrera,
                cuatrimestre: userInfo.cuatrimestre + "º cuatrimestre",
                disponibilidad: disponibilidad.map(d => `${d.dia} ${d.hora_inicio}-${d.hora_fin}`),
                materias: [], // Eliminado el hardcode de "Bases de datos" y "POO"
                calificacion: 0
            }
        };

        res.render('perfilasesor', datosVista);
    } catch (error) {
        console.error("Error detallado al cargar perfil asesor:", error.message);
        res.render('perfilasesor', { error: "Error al cargar datos reales. Se muestran datos locales." });
    }
});

router.get('/perfil-asesorado', async (req, res) => {
    if (req.session.usuario !== 2) {
        return res.render("index", { error: "Inicia sesión como asesorado" });
    }

    try {
        const id_usuario = req.session.id_usuario;
        console.log("Cargando perfil para asesorado, id_usuario:", id_usuario);

        if (!id_usuario) throw new Error("Sesión expirada o ID de usuario no encontrado. Por favor cierra sesión y vuelve a entrar.");

        // 1. Obtener datos del usuario
        const resUser = await fetch(`http://localhost:8000/usuarios/buscarUsuarioID/${id_usuario}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const dataUser = await resUser.json();
        const userInfo = dataUser.item;

        if (!userInfo) throw new Error("No se encontró información del usuario");

        // 2. Buscar datos del alumno (carrera)
        const resAlumnos = await fetch(`http://localhost:8000/alumnos`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const dataAlumnos = await resAlumnos.json();
        const alumnoInfo = dataAlumnos.items ? dataAlumnos.items.find(a => a.id_usuario1 == id_usuario) : null;

        const datosVista = {
            asesor: {
                nombre: `${userInfo.nombres} ${userInfo.apellidos}`,
                correo: userInfo.correo,
                carrera: alumnoInfo ? alumnoInfo.carrera : "No especificada",
                cuatrimestre: userInfo.cuatrimestre + "º cuatrimestre"
            }
        };

        res.render('perfilasesorado', datosVista);
    } catch (error) {
        console.error("Error detallado al cargar perfil asesorado:", error.message);
        res.render('perfilasesorado', { error: error.message });
    }
});

router.get('/editar-perfil', async (req, res) => {
    if (!req.session.usuario) {
        return res.render("index", { error: "Inicia sesión para editar tu perfil" });
    }

    try {
        const id_usuario = req.session.id_usuario;
        
        // 1. Obtener datos del usuario
        const resUser = await fetch(`http://localhost:8000/usuarios/buscarUsuarioID/${id_usuario}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const dataUser = await resUser.json();
        const userInfo = dataUser.item;

        // 2. Buscar datos específicos (Alumno o Asesor)
        let carrera = "No especificada";
        if (req.session.usuario === 1) { // Asesor
            const resAsesor = await fetch(`http://localhost:8000/asesores/buscarAsesorUsuario/${encodeURIComponent(req.session.correo)}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            const dataAsesor = await resAsesor.json();
            if (dataAsesor.items && dataAsesor.items[0]) {
                carrera = dataAsesor.items[0].carrera;
            }
        } else if (req.session.usuario === 2) { // Asesorado
            const resAlumnos = await fetch(`http://localhost:8000/alumnos`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            const dataAlumnos = await resAlumnos.json();
            const alumnoInfo = dataAlumnos.items ? dataAlumnos.items.find(a => a.id_usuario1 == id_usuario) : null;
            if (alumnoInfo) carrera = alumnoInfo.carrera;
        }

        const datosVista = {
            asesor: {
                nombre: `${userInfo.nombres} ${userInfo.apellidos}`,
                correo: userInfo.correo,
                carrera: carrera,
                cuatrimestre: userInfo.cuatrimestre
            }
        };

        res.render('editarperfilasesorado', datosVista);
    } catch (error) {
        console.error("Error al cargar pantalla editar:", error);
        res.redirect("/perfil-asesorado");
    }
});

router.post('/guardar-perfil', async (req, res) => {
    if (!req.session.usuario) return res.redirect("/");

    const { nombre, carrera, cuatrimestre } = req.body;
    const id_usuario = req.session.id_usuario;

    try {
        // 1. Dividir nombre (asumimos espacio para apellidos)
        const partes = nombre.trim().split(" ");
        const nombres = partes[0];
        const apellidos = partes.length > 1 ? partes.slice(1).join(" ") : "";

        // 2. Actualizar Usuario (Nombre y Cuatrimestre)
        const updateUsuario = await fetch(`http://localhost:8000/usuarios/actualizarUsuario/${id_usuario}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nombres,
                apellidos,
                cuatrimestre: parseInt(cuatrimestre)
            })
        });

        // 3. Actualizar Tabla específica (Alumno o Asesor)
        if (req.session.usuario === 2) { // Asesorado
            const resAlumnos = await fetch(`http://localhost:8000/alumnos`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            const dataAlumnos = await resAlumnos.json();
            const alumnoInfo = dataAlumnos.items ? dataAlumnos.items.find(a => a.id_usuario1 == id_usuario) : null;

            if (alumnoInfo) {
                await fetch(`http://localhost:8000/alumnos/${alumnoInfo.id_alumno}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ carrera })
                });
            }
        } else if (req.session.usuario === 1) { // Asesor
            const resAsesor = await fetch(`http://localhost:8000/asesores/buscarAsesorUsuario/${encodeURIComponent(req.session.correo)}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            const dataAsesor = await resAsesor.json();
            const asesorInfo = dataAsesor.items ? dataAsesor.items[0] : null;

            if (asesorInfo) {
                await fetch(`http://localhost:8000/asesores/actualizarAsesor/${asesorInfo.id_asesor}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ carrera })
                });
            }
        }

        res.redirect(req.session.usuario === 1 ? '/perfil-asesor' : '/perfil-asesorado');
    } catch (error) {
        console.error("Error al guardar perfil:", error);
        res.redirect("/editar-perfil");
    }
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

    try {
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

        // TODO: Obtener id_alumno del asesorado logueado y crear la toma
        // Por ahora solo mostramos éxito parcial

        res.send(`
            <script>
                alert("Solicitud creada exitosamente. La asesoría ha sido registrada.");
                window.location.href = "/solicitarAsesoria";
            </script>
        `);

    } catch (error) {
        console.error("Error al crear solicitud:", error);
        res.send(`
            <script>
                alert("Error al crear la solicitud. Intenta de nuevo.");
                window.location.href = "/solicitarAsesoria";
            </script>
        `);
    }
});

router.get('/panelAsesor', async (req, res) => {
    if (req.session.usuario !== 1) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }

    // Datos de ejemplo (luego conectar con backend real)
    const datosPanel = {
        pendientes: 3,
        completadas: 1,
        calificacionPromedio: 5.0,
        proximasAsesorias: [
            { id_toma: 1, materia: "Programación Orientada a Objetos", estudiante: "Mariana Rodríguez", fecha: "09/03/26", hora: "14:00" },
            { id_toma: 2, materia: "Bases de datos", estudiante: "Eliel Priske Alanis", fecha: "09/03/26", hora: "13:00" }
        ],
        evaluacionesRecientes: [
            { materia: "Proyecto integrador", estudiante: "Yael Izaid Meza", comentario: "Excelente explicación, muy clara y con buenos ejemplos", calificacion: 5 },
            { materia: "Bases de datos", estudiante: "Raquel Pastor", comentario: "Excelente explicación, muy clara y con buenos ejemplos", calificacion: 5 }
        ],
        solicitudesPendientes: [
            { id_toma: 3, materia: "Proyecto integrador", estudiante: "Yael Izaid Meza", fecha: "09/03/26", hora: "15:00" }
        ]
    };

    res.render('panelAsesor', datosPanel);
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