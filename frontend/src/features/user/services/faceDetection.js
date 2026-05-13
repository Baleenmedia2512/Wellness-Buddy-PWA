// Gemini-based face detection. Returns one of:
//   "face_found" | "no_face" | "detection_error"
import { GoogleGenerativeAI } from '@google/generative-ai';

const PROMPT =
  "Look at this image carefully. Is it a real photograph of an actual human " +
  "being taken with a camera or phone? Answer 'no' if the image is: a cartoon, " +
  "an illustrated avatar, a drawing, a vector/clip art icon, anime, 3D CGI, " +
  "AI-generated art, a painting, a sketch, or has any glowing/robotic/cybernetic " +
  "elements. Answer 'no' if the face looks drawn or stylized rather than " +
  "photographed. Only answer 'yes' if it is clearly a real photo of a real " +
  "person. Answer with only 'yes' or 'no'.";

export const detectFace = async (base64String) => {
  try {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    if (!apiKey) return 'detection_error';
    const mimeMatch = base64String.match(/^data:(image\/[a-zA-Z]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const data = base64String.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent([
      { inlineData: { mimeType, data } },
      PROMPT,
    ]);
    const text = result.response.text().trim().toLowerCase();
    return text.startsWith('yes') ? 'face_found' : 'no_face';
  } catch (err) {
    console.error('[faceDetection] failed:', err.message);
    return 'detection_error';
  }
};
