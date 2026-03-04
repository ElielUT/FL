import { Router } from "express";
import 'dotenv/config';

const router = Router();

router.get("/", (req, res) => {
    res.render("index");
});

router.post("/", (req, res) => {
    const { correo, contraseña } = req.body;
    console.log(correo, contraseña);
});

export default router;