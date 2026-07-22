import { getDashboard } from "../services/DashboardService.js";

export async function getDashboardController(req, res) {
    try {
        const dashboard = await getDashboard(req.user.id);

        res.json(dashboard);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Failed to load dashboard",
        });
    }
}