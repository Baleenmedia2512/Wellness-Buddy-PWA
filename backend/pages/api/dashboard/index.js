import { getDashboard } from "../../../services/DashboardService.js";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({
            message: "Method Not Allowed",
        });
    }

    try {
        // Replace this with your authenticated user later
        const userId = req.query.userId;

        const dashboard = await getDashboard(userId);

        return res.status(200).json(dashboard);
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            message: "Failed to load dashboard",
        });
    }
}