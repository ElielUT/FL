import express from "express";
import session from "express-session";
import rutas from "./routes/rutas.js"
import 'dotenv/config';
import cors from "cors";

const app = express();

//BACKEND
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use(session({
    secret: process.env.SECRET_SESSION,
    name: "session_id",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, path: "/" },
}));

app.use(express.urlencoded({ extended: true }))
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use("/", rutas);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
});