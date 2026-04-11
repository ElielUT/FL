import { Router } from "express";
import 'dotenv/config';
import session from "express-session";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const url_api = process.env.URL_API ? process.env.URL_API.replace(/\/$/, '') : '';

async function verificarRecaptcha(token, req) {
    if (req && (req.hostname === 'localhost' || req.hostname === '127.0.0.1')) return true;
    if (!token) return false;
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    try {
        const resp = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`, {
            method: 'POST'
        });
        const data = await resp.json();
        return data.success && data.score >= 0.5;
    } catch (e) {
        console.error("Error verificando reCAPTCHA", e);
        return false;
    }
}

const router = Router();

router.get("/", (req, res) => {
    res.render("index");
});

router.get("/registro", (req, res) => {
    res.render("registrarse");
});

router.post("/", async (req, res) => {
    const { correo, contraseña, "g-recaptcha-response": recaptchaToken } = req.body;

    try {
        const isValidRecaptcha = await verificarRecaptcha(recaptchaToken, req);
        if (!isValidRecaptcha) {
            return res.render("index", { error: "Actividad sospechosa detectada por reCAPTCHA" });
        }
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

        const response = await fetch(url_api + "/usuarios/inicio", {
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
            req.session.correo = correo;
            req.session.save(() => {
                res.redirect("/panelAsesor");
            });
        } else if (data.Inicio === 2) {
            req.session.usuario = data.Inicio;
            req.session.id_usuario = data.id_usuario;
            req.session.id_alumno = data.id_alumno;
            req.session.correo = correo;
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

router.post("/registro", async (req, res) => {
    const { nombre, correo, contraseña, carrera, cuatrimestre, "g-recaptcha-response": recaptchaToken, apellidos } = req.body;
    const rol = "asesorado";

    try {
        const isValidRecaptcha = await verificarRecaptcha(recaptchaToken, req);
        if (!isValidRecaptcha) {
            return res.render("registrarse", { error: "Actividad sospechosa detectada por reCAPTCHA" });
        }
        const respuesta = await fetch(url_api + "/usuarios/crearUsuario", {
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
        const recID = await fetch(url_api + "/usuarios/buscarUsuarios/" + correo, {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        })
        const Pre_id_usuario = await recID.json().item;
        const id_usuario = Pre_id_usuario[0].id_usuario;
        const respuesta2 = await fetch(url_api + "/alumnos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id_usuario: id_usuario,
                carrera: carrera,
            })
        })
        res.render("index", { success: "Usuario registrado correctamente, confirma tu correo para iniciar sesión." });
    } catch (error) {
        console.error("Error en registro:", error);
        res.render("registrarse", { error: "Error interno del servidor, intenta de nuevo más tarde." });
    }
});

router.get("/gestionUsuarios", async (req, res) => {
    if (req.session.usuario !== 3) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }

    const respuesta = await fetch(url_api + "/usuarios/mostraUsuarios", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });
    const data = await respuesta.json();
    const usuarios = data.items;
    if (usuarios == null) {
        res.render("index", { error: "Error de conexión" });
    } else {
        res.render("gestionUsuarios", { usuarios: usuarios, url_api: url_api });
    }
});

router.post("/gestionUsuarios", async (req, res) => {
    if (req.session.usuario !== 3) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }

    const { nombre, apellidos, correo, rol, carrera, cuatrimestre, contraseña } = req.body;

    const respuesta = await fetch(url_api + "/usuarios/crearUsuario", {
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
        return res.render("gestionUsuarios", { usuarios: [], error: "Error al crear usuario. Verifica los datos.", url_api: url_api });
    }
    const res2 = await fetch(url_api + "/usuarios/buscarUsuarios/" + correo, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })
    if (!res2.ok) {
        console.error("Error al buscar usuario:", await res2.text());
        return res.render("gestionUsuarios", { usuarios: [], error: "Error al buscar usuario creado.", url_api: url_api });
    }
    const data2 = await res2.json();
    const id_user = data2.item.id_usuario;
    const data = await respuesta.json();
    var user;
    if (rol === "asesorado") {
        const subirAsesorado = await fetch(url_api + "/alumnos", {
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
        const subirAsesor = await fetch(url_api + "/asesores/crearAsesor", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ id_usuario2: id_user, carrera, disponible, categoria: categoriaAS, contacto })
        })
        user = await subirAsesor.json();
    }
    const respuesta3 = await fetch(url_api + "/usuarios/mostraUsuarios", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })
    const data3 = await respuesta3.json();
    const usuarios = data3.items;
    res.render("gestionUsuarios", { usuarios: usuarios, url_api: url_api });
});

router.get('/perfil-asesor', async (req, res) => {
    if (req.session.usuario !== 1) {
        return res.render("index", { error: "Inicia sesión como asesor" });
    }

    try {
        const correo = req.session.correo;
        //console.log("Cargando perfil para asesor:", correo);

        // 1. Buscar el asesor por el correo del usuario
        const resAsesor = await fetch(url_api + `/asesores/buscarAsesorUsuario/${encodeURIComponent(correo)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        if (!resAsesor.ok) throw new Error(`Error API Asesor: ${resAsesor.status}`);
        const dataAsesor = await resAsesor.json();
        const asesorInfo = dataAsesor.items ? dataAsesor.items[0] : null;

        if (!asesorInfo) throw new Error("No se encontró información del asesor en la base de datos");

        // 2. Obtener datos del usuario
        const resUser = await fetch(url_api + `/usuarios/buscarUsuarioID/${asesorInfo.id_usuario2}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const dataUser = await resUser.json();
        const userInfo = dataUser.item;

        if (!userInfo) throw new Error("No se encontró información del usuario");

        // 3. Obtener disponibilidad
        const resDisp = await fetch(url_api + `/disponibilidad/${asesorInfo.id_asesor}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const dataDisp = await resDisp.json();
        const disponibilidadRaw = dataDisp.items || [];

        // Mapeo de fechas a días para mostrar en la vista
        const dayMap = {
            "2024-01-01": "Lunes",
            "2024-01-02": "Martes",
            "2024-01-03": "Miércoles",
            "2024-01-04": "Jueves",
            "2024-01-05": "Viernes",
            "2024-01-06": "Sábado"
        };

        const disponibilidad = disponibilidadRaw.map(d => {
            const diaNombre = dayMap[d.dia] || d.dia;
            const hIn = d.hora_in ? d.hora_in.substring(0, 5) : "";
            const hFin = d.hora_fin ? d.hora_fin.substring(0, 5) : "";
            return `${diaNombre} ${hIn}-${hFin}`;
        });

        // 4. Preparar objeto para la vista
        const datosVista = {
            asesor: {
                nombre: `${userInfo.nombres} ${userInfo.apellidos}`,
                correo: userInfo.correo,
                carrera: asesorInfo.carrera,
                cuatrimestre: userInfo.cuatrimestre + "º cuatrimestre",
                disponibilidad: disponibilidad,
                materias: [],
                calificacion: 0
            }
        };

        res.render('perfilasesor', datosVista);
    } catch (error) {
        console.error("Error detallado al cargar perfil asesor:", error.message);
        res.render('perfilasesor', { error: "Error al cargar datos reales." });
    }
});

router.get('/perfil-asesorado', async (req, res) => {
    if (req.session.usuario !== 2) {
        return res.render("index", { error: "Inicia sesión como asesorado" });
    }

    try {
        const id_usuario = req.session.id_usuario;
        //console.log("Cargando perfil para asesorado, id_usuario:", id_usuario);

        if (!id_usuario) throw new Error("Sesión expirada o ID de usuario no encontrado. Por favor cierra sesión y vuelve a entrar.");

        // 1. Obtener datos del usuario
        const resUser = await fetch(url_api + `/usuarios/buscarUsuarioID/${id_usuario}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const dataUser = await resUser.json();
        const userInfo = dataUser.item;

        if (!userInfo) throw new Error("No se encontró información del usuario");

        // 2. Buscar datos del alumno (carrera)
        const resAlumnos = await fetch(url_api + `/alumnos`, {
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
        const resUser = await fetch(url_api + `/usuarios/buscarUsuarioID/${id_usuario}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const dataUser = await resUser.json();
        const userInfo = dataUser.item;

        if (!userInfo) throw new Error("No se encontró información del usuario");

        // 2. Buscar datos específicos (Alumno o Asesor)
        if (req.session.usuario === 1) { // Asesor
            const resAsesor = await fetch(url_api + `/asesores/buscarAsesorUsuario/${encodeURIComponent(req.session.correo)}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            const dataAsesor = await resAsesor.json();
            const asesorInfo = dataAsesor.items ? dataAsesor.items[0] : null;

            if (!asesorInfo) throw new Error("No se encontró información de asesor");

            // 3. Obtener disponibilidad
            const resDisp = await fetch(url_api + `/disponibilidad/${asesorInfo.id_asesor}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            const dataDisp = await resDisp.json();
            const disponibilidadRaw = dataDisp.items || [];

            const dayMap = {
                "2024-01-01": "Lunes",
                "2024-01-02": "Martes",
                "2024-01-03": "Miércoles",
                "2024-01-04": "Jueves",
                "2024-01-05": "Viernes",
                "2024-01-06": "Sábado"
            };

            const datosVista = {
                asesor: {
                    id_asesor: asesorInfo.id_asesor,
                    nombre: `${userInfo.nombres} ${userInfo.apellidos}`,
                    correo: userInfo.correo,
                    carrera: asesorInfo.carrera,
                    cuatrimestre: userInfo.cuatrimestre,
                    disponibilidad: disponibilidadRaw.map(d => ({
                        id_disponibilidad: d.id_horario, // Usamos el ID de la base de datos para borrar
                        texto: `${dayMap[d.dia] || d.dia} ${d.hora_in.substring(0, 5)}-${d.hora_fin.substring(0, 5)}`
                    }))
                }
            };
            res.render('editarPerfilAsesor', datosVista);

        } else if (req.session.usuario === 2) { // Asesorado
            const resAlumnos = await fetch(url_api + `/alumnos`, {
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
                    cuatrimestre: userInfo.cuatrimestre
                }
            };
            res.render('editarperfilasesorado', datosVista);
        }
    } catch (error) {
        console.error("Error al cargar pantalla editar:", error);
        res.redirect("/perfil-asesorado");
    }
});

router.post('/guardar-perfil', async (req, res) => {
    if (!req.session.usuario) return res.redirect("/");

    const { nombre, carrera, cuatrimestre, contraseña } = req.body;
    const id_usuario = req.session.id_usuario;

    try {
        // 1. Dividir nombre
        const partes = nombre.trim().split(" ");
        const nombres = partes[0];
        const apellidos = partes.length > 1 ? partes.slice(1).join(" ") : "";

        // 2. Actualizar Usuario (Nombre y Cuatrimestre)
        const userUpdateBody = {
            nombres,
            apellidos,
            cuatrimestre: parseInt(cuatrimestre)
        };

        if (contraseña && contraseña.trim() !== '') {
            userUpdateBody.contraseña = contraseña.trim();
        }

        const updateUsuario = await fetch(url_api + `/usuarios/actualizarUsuario/${id_usuario}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userUpdateBody)
        });

        // 3. Actualizar Tabla específica
        if (req.session.usuario === 2) { // Asesorado
            const resAlumnos = await fetch(url_api + `/alumnos`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            const dataAlumnos = await resAlumnos.json();
            const alumnoInfo = dataAlumnos.items ? dataAlumnos.items.find(a => a.id_usuario1 == id_usuario) : null;

            if (alumnoInfo) {
                await fetch(url_api + `/alumnos/${alumnoInfo.id_alumno}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ carrera })
                });
            }
        } else if (req.session.usuario === 1) { // Asesor
            const resAsesor = await fetch(url_api + `/asesores/buscarAsesorUsuario/${encodeURIComponent(req.session.correo)}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            const dataAsesor = await resAsesor.json();
            const asesorInfo = dataAsesor.items ? dataAsesor.items[0] : null;

            if (asesorInfo) {
                await fetch(url_api + `/asesores/actualizarAsesor/${asesorInfo.id_asesor}`, {
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

// Ruta para agregar disponibilidad
router.post('/agregar-disponibilidad', async (req, res) => {
    if (req.session.usuario !== 1) return res.status(403).send("No autorizado");

    const { id_asesor, dia, hora_inicio, hora_fin } = req.body;

    const dayToDate = {
        "Lunes": "2024-01-01",
        "Martes": "2024-01-02",
        "Miércoles": "2024-01-03",
        "Jueves": "2024-01-04",
        "Viernes": "2024-01-05",
        "Sábado": "2024-01-06"
    };

    try {
        const payload = {
            id_horario: Math.floor(Math.random() * 9000) + 1, // El API requiere este ID
            id_asesor1: parseInt(id_asesor),
            dia: dayToDate[dia] || "2024-01-01",
            hora_in: hora_inicio.includes(":") ? (hora_inicio.length === 5 ? `${hora_inicio}:00` : hora_inicio) : "08:00:00",
            hora_fin: hora_fin.includes(":") ? (hora_fin.length === 5 ? `${hora_fin}:00` : hora_fin) : "09:00:00"
        };

        const response = await fetch(url_api + "/disponibilidad", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            res.json({ success: true });
        } else {
            const errData = await response.json();
            console.error("Error Backend Availability:", errData);
            res.status(500).json({ success: false, message: "Error al crear disponibilidad en el servidor" });
        }
    } catch (error) {
        console.error("Error API disponibilidad:", error);
        res.status(500).json({ success: false });
    }
});

// Ruta para eliminar disponibilidad
router.post('/eliminar-disponibilidad', async (req, res) => {
    if (req.session.usuario !== 1) return res.status(403).send("No autorizado");

    const { id_disponibilidad } = req.body;

    try {
        const response = await fetch(url_api + `/disponibilidad/eliminarDisponibilidad/${id_disponibilidad}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" }
        });

        if (response.ok) {
            res.json({ success: true });
        } else {
            res.status(500).json({ success: false });
        }
    } catch (error) {
        console.error("Error API eliminar disponibilidad:", error);
        res.status(500).json({ success: false });
    }
});

router.get('/panelAdmin', async (req, res) => {
    if (req.session.usuario !== 3) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }

    try {
        const [respuestaUsuarios, respuestaEstadisticas] = await Promise.all([
            fetch(url_api + "/usuarios/cantidadUsuarios", {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            }),
            fetch(url_api + "/asesoria/estadisticas", {
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
            completadas: dataEstadisticas.completadas,
            url_api: url_api
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
            fetch(url_api + "/asesoria/estadisticas", {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            }),
            fetch(url_api + "/asesoria/mostrarAsesoria", {
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
        const respuesta = await fetch(url_api + "/materias", {
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
        const respuesta = await fetch(url_api + `/asesores/buscarAsesorMateria/${encodeURIComponent(materiaNombre)}`, {
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

    const { materiaId, id_asesor, tema, fecha, hora_in, hora_fin, modalidad } = req.body;

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
        const crearAsesoriaResp = await fetch(url_api + "/asesoria/crearAsesoria", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id_materia1: materiaId,
                tema: tema,
                modalidad: modalidad || 'virtual'
            })
        });

        if (!crearAsesoriaResp.ok) {
            const errDetail = await crearAsesoriaResp.text();
            console.log("Error BL:", errDetail);
            throw new Error("Error al crear la asesoría");
        }

        const asesoriaData = await crearAsesoriaResp.json();
        //console.log("asesoriaData:", JSON.stringify(asesoriaData));
        const id_asesoria = asesoriaData.items?.id_asesoria || asesoriaData.id_asesoria;

        //console.log("materiaId:", materiaId, "tipo:", typeof materiaId);
        // 2. Crear la toma (solicitud)
        const crearTomaResp = await fetch(url_api + "/toma/crearToma/", {
            method: "POST",
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
                calificacion: 0
            })
        });

        if (!crearTomaResp.ok) {
            const errToma = await crearTomaResp.text();
            console.log("Error Toma BL:", errToma);
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
            fetch(url_api + `/toma/buscarTomaAsesor/${idAsesor}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            }),
            fetch(url_api + `/toma/calificacionesAsesor/${idAsesor}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            })
        ]);

        const dataTomas = await respuestaTomasAsesor.json();
        //console.log("RESPONSE COMPLETO:", JSON.stringify(dataTomas).substring(0, 500));
        const tomas = dataTomas.items || [];
        //console.log("TOMAS RECIBIDAS:", JSON.stringify(tomas.map(t => ({
        //    estado: t.estado,
        //    materia: t.asesoria?.materia?.nombre,
        //    estudiante: t.alumno?.usuario?.nombres
        //}))));

        const solicitudesPendientes = tomas
            .filter(t => t.estado === 'pendiente' || !t.estado)
            .map(t => ({
                id_asesoria: t.id_asesoria1,
                id_asesor3: t.id_asesor3,
                id_alumno1: t.id_alumno1,
                materia: t.asesoria?.materia?.nombre || "Sin materia",
                estudiante: t.alumno?.usuario ? `${t.alumno.usuario.nombres} ${t.alumno.usuario.apellidos}` : "Desconocido",
                fecha: t.fecha || "Pendiente",
                hora: t.hora_in ? t.hora_in.substring(0, 5) : "--:--"
            }));

        const proximasAsesorias = tomas
            .filter(t => t.estado === 'aceptada')
            .map(t => ({
                id_asesoria: t.id_asesoria1,
                id_asesor3: t.id_asesor3,
                id_alumno1: t.id_alumno1,
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

        const pendientes = solicitudesPendientes.length;
        const completadas = tomas.filter(t => t.estado === 'completada').length;

        let calificacionPromedio = 0;
        if (respuestaCalificaciones.ok) {
            const dataCalif = await respuestaCalificaciones.json();
            if (dataCalif.items && dataCalif.items.length > 0) {
                const suma = dataCalif.items.reduce((acc, curr) => acc + (curr.calificacion || 0), 0);
                calificacionPromedio = Number((suma / dataCalif.items.length).toFixed(1));
            }
        }

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

router.get('/panelAsesorado', async (req, res) => {
    if (req.session.usuario !== 2) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }

    const idAlumno = req.session.id_alumno;

    try {
        const respuestaTomas = await fetch(`${url_api}/toma/buscarTomaAlumno/${idAlumno}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        const dataTomas = await respuestaTomas.json();
        const tomas = dataTomas.items || [];

        const asesoriasProgramadas = tomas
            .filter(t => t.estado === 'aceptada')
            .map(t => ({
                id_asesoria: t.id_asesoria1,
                id_asesor3: t.id_asesor3,
                id_alumno1: t.id_alumno1,
                materia: t.asesoria?.materia?.nombre || "Sin materia",
                asesor: t.asesor?.usuario ? `${t.asesor.usuario.nombres} ${t.asesor.usuario.apellidos}` : "Desconocido",
                fecha: t.fecha || "Por definir",
                hora: t.hora_in ? t.hora_in.substring(0, 5) : "--:--"
            }));

        const solicitudesPendientes = tomas
            .filter(t => t.estado === 'pendiente' || !t.estado)
            .map(t => ({
                id_asesoria: t.id_asesoria1,
                id_asesor3: t.id_asesor3,
                id_alumno1: t.id_alumno1,
                materia: t.asesoria?.materia?.nombre || "Sin materia",
                asesor: t.asesor?.usuario ? `${t.asesor.usuario.nombres} ${t.asesor.usuario.apellidos}` : "Desconocido",
                fecha: t.fecha || "Por definir",
                hora: t.hora_in ? t.hora_in.substring(0, 5) : "--:--"
            }));

        const estadisticas = {
            pendientes: solicitudesPendientes.length,
            aceptadas: asesoriasProgramadas.length,
            completadas: tomas.filter(t => t.estado === 'completada').length
        };

        res.render('panelAsesorado', {
            asesoriasProgramadas,
            solicitudesPendientes,
            estadisticas
        });

    } catch (error) {
        console.error("Error al cargar panel asesorado:", error);
        res.render('panelAsesorado', {
            asesoriasProgramadas: [],
            solicitudesPendientes: [],
            estadisticas: { pendientes: 0, aceptadas: 0, completadas: 0 }
        });
    }
});

router.get("/historialAsesorias", async (req, res) => {
    if (!req.session.usuario || ![1, 2].includes(req.session.usuario)) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }

    try {
        let tomas = [];

        if (req.session.usuario === 1) {
            // Asesor
            const idAsesor = req.session.id_asesor;
            const respuesta = await fetch(`${url_api}/toma/buscarTomaAsesor/${idAsesor}`, {
                headers: { "Content-Type": "application/json" }
            });
            const data = await respuesta.json();
            tomas = data.items || [];
        } else {
            // Asesorado
            const idAlumno = req.session.id_alumno;
            const respuesta = await fetch(`${url_api}/toma/buscarTomaAlumno/${idAlumno}`, {
                headers: { "Content-Type": "application/json" }
            });
            const data = await respuesta.json();
            tomas = data.items || [];
        }

        // Solo completadas
        const completadas = tomas.filter(t => t.estado === 'completada');

        // Calcular tiempo total
        let minutosTotales = 0;
        completadas.forEach(t => {
            if (t.hora_in && t.hora_fin) {
                const [hIn, mIn] = t.hora_in.split(':').map(Number);
                const [hFin, mFin] = t.hora_fin.split(':').map(Number);
                const diff = (hFin * 60 + mFin) - (hIn * 60 + mIn);
                minutosTotales += diff > 0 ? diff : 0;
            }
        });
        const horasTotales = Math.floor(minutosTotales / 60);
        const minsExtra = minutosTotales % 60;
        const tiempoStr = horasTotales > 0 ? `${horasTotales} h ${minsExtra} min` : `${minsExtra} min`;

        const rol = req.session.usuario === 1 ? "Asesor" : "Asesorado";

        const asesorias = completadas.map(t => ({
            materia: t.asesoria?.materia?.nombre || "Sin materia",
            tema: t.asesoria?.tema || "Sin tema",
            contraparte: req.session.usuario === 1
                ? (t.alumno?.usuario ? `${t.alumno.usuario.nombres} ${t.alumno.usuario.apellidos}` : "Desconocido")
                : (t.asesor?.usuario ? `${t.asesor.usuario.nombres} ${t.asesor.usuario.apellidos}` : "Desconocido"),
            fecha: t.fecha || "Sin fecha",
            hora_in: t.hora_in ? t.hora_in.substring(0, 5) : "--:--",
            hora_fin: t.hora_fin ? t.hora_fin.substring(0, 5) : "--:--",
            calificacion: t.calificacion || 0,
            id_asesoria: t.id_asesoria1
        }));

        res.render("historialAsesorias", {
            asesorias,
            total: asesorias.length,
            tiempoTotal: tiempoStr,
            rol
        });

    } catch (error) {
        console.error("Error al cargar historial:", error);
        res.render("historialAsesorias", { asesorias: [], total: 0, tiempoTotal: "0 min", rol: "Asesor" });
    }
});

router.get("/solicitudesDisponibles", (req, res) => {
    res.render("solicitudesDisponibles");
});

// ── Detalles de sesión ────────────────────────────────────────────────────────
router.get("/detallesAsesoria/:id_asesoria", async (req, res) => {
    if (!req.session.usuario || ![1, 2].includes(req.session.usuario)) {
        return res.render("index", { error: "No tienes permiso" });
    }
    try {
        const respuesta = await fetch(`${url_api}/toma/detalles/${req.params.id_asesoria}`, {
            headers: { "Content-Type": "application/json" }
        });
        if (!respuesta.ok) throw new Error("Sesión no encontrada");
        const sesion = await respuesta.json();
        const rol = req.session.usuario === 1 ? "Asesor" : "Asesorado";
        res.render("detallesAsesoria", { sesion, rol });
    } catch (error) {
        console.error(error);
        res.send(`<script>alert("Error al cargar los detalles."); window.history.back();</script>`);
    }
});

// ── Generar Meet (solo asesor) ────────────────────────────────────────────────
router.post("/generarMeet/:id_asesor3/:id_asesoria1/:id_alumno1", async (req, res) => {
    if (req.session.usuario !== 1)
        return res.status(403).json({ error: "Solo el asesor puede generar el enlace" });
    try {
        const { id_asesor3, id_asesoria1, id_alumno1 } = req.params;
        const respuesta = await fetch(`${url_api}/toma/generarMeet/${id_asesor3}/${id_asesoria1}/${id_alumno1}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });
        const data = await respuesta.json();
        if (!respuesta.ok) return res.status(502).json({ error: data.detail || "Error al generar Meet" });
        res.json({ meet_link: data.meet_link });
    } catch (error) {
        res.status(500).json({ error: "Error interno" });
    }
});

router.get("/administrarMaterias", async (req, res) => {
    if (req.session.usuario !== 3) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }
    try {
        const respuesta = await fetch(url_api + "/materias", {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const data = await respuesta.json();
        const materias = data.items || [];
        res.render("administrarMaterias", { materias, url_api });
    } catch (error) {
        console.error("Error al cargar materias:", error);
        res.render("administrarMaterias", { materias: [], url_api });
    }
});

router.post("/administrarMaterias", async (req, res) => {
    if (req.session.usuario !== 3) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }
    try {
        const [nombre, carrera, cuatrimestre] = req.body;
        const [subir, respuesta] = await Promise.all([
            await fetch(url_api + "/materias", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    nombre,
                    carrera,
                    parseInt(cuatrimestre)
                )
            }),
            fetch(url_api + "/materias", {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            })
        ]);
        const data = await respuesta.json();
        const materias = data.items || [];
        res.render("administrarMaterias", { materias, url_api });
    } catch (error) {
        console.error("Error al cargar materias:", error);
        res.render("administrarMaterias", { materias: [], url_api });
    }
});

router.post("/asignarMaterias", async (req, res) => {
    if (req.session.usuario !== 3) {
        return res.render("index", { error: "No tienes permiso para acceder a esta página" });
    }
    try {
        const { nombre_materia, id_materia } = req.body;
        const [materia, asesores, todosAsesores] = await Promise.all([
            fetch(url_api + "/materias/" + id_materia, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            }),
            fetch(url_api + "/asesores/buscarAsesorMateria/" + encodeURIComponent(nombre_materia), {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            }),
            fetch(url_api + "/asesores/listarAsesores", {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            })
        ]);

        const dataMateria = await materia.json() || {};
        const dataAsesores = await asesores.json() || {};
        const dataTodosAsesores = await todosAsesores.json() || {};

        res.render("asignarMaterias", {
            materia: dataMateria.items,
            asesores: dataAsesores.items || [],
            todosAsesores: dataTodosAsesores.items || [],
            url_api
        });
    } catch (error) {
        console.error("Error al cargar materias:", error);
        res.render("asignarMaterias", { materia: [], asesores: [], todosAsesores: [], url_api: "" });
    }
});

// Estados de solicitud: Aceptar, Rechazar, Completar
router.post("/actualizarEstado/:id_asesor3/:id_asesoria1/:id_alumno1", async (req, res) => {
    if (req.session.usuario !== 1)
        return res.status(403).json({ error: "No autorizado" });
    try {
        const { id_asesor3, id_asesoria1, id_alumno1 } = req.params;
        const { estado } = req.body;
        const respuesta = await fetch(`${url_api}/toma/actualizarEstado/${id_asesor3}/${id_asesoria1}/${id_alumno1}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado })
        });
        const data = await respuesta.json();
        if (!respuesta.ok) return res.status(502).json({ error: "Error al actualizar estado" });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error interno" });
    }
});

router.delete("/cancelarAsesoria/:id_asesor3/:id_asesoria1/:id_alumno1", async (req, res) => {
    if (!req.session.usuario || ![1, 2].includes(req.session.usuario))
        return res.status(403).json({ error: "No autorizado" });
    try {
        const { id_asesor3, id_asesoria1, id_alumno1 } = req.params;
        const respuesta = await fetch(`${url_api}/toma/cancelar/${id_asesor3}/${id_asesoria1}/${id_alumno1}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" }
        });
        if (!respuesta.ok) return res.status(502).json({ error: "Error al cancelar" });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error interno" });
    }
});

router.get('/sesion-info', (req, res) => {
    res.json({ rol: req.session.usuario || null });
});

router.get('/cambiar-contrasena', (req, res) => {
    if (req.session.id_usuario) {
        res.render('cambiarContraseña', {
            url_api: url_api,
            correo: req.session.correo,
            id_usuario: req.session.id_usuario
        });
    } else {
        res.redirect('/login');
    }
});

export default router;