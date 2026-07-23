import express from "express";
import { getDashboard } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/", getDashboard);
router.get("/dashboard", authenticate, getDashboardController);

export default router;