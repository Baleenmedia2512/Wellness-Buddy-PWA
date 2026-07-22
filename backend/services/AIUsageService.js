import AIUsage from "../models/AIUsage.js";

export async function saveAIUsage(data) {
    return AIUsage.create(data);
}