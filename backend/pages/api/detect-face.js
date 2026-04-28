import { GoogleGenerativeAI } from "@google/generative-ai";
import { largeBodyConfig as config } from "../../utils/apiConfig.js";

export { config };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { imageBase64 } = req.body || {};

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return res.status(400).json({ success: false, message: "imageBase64 is required" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ [detect-face] GEMINI_API_KEY not configured");
    return res.status(500).json({ success: false, message: "Face detection service not available" });
  }

  try {
    // Extract mime type and raw base64 from data URL
    const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
      "Does this image contain a clear, visible human face? Answer with only 'yes' or 'no'.",
    ]);

    const text = result.response.text().trim().toLowerCase();
    const hasFace = text.startsWith("yes");

    console.log(`✅ [detect-face] Detection result: ${hasFace ? "face found" : "no face"} (raw: "${text}")`);

    return res.status(200).json({ success: true, hasFace });
  } catch (err) {
    console.error("❌ [detect-face] Error calling Gemini:", err.message, err.status, err?.errorDetails);
    return res.status(500).json({ success: false, message: err.message || "Face detection failed. Please try again." });
  }
}
