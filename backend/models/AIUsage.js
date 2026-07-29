import mongoose from "mongoose";

const AIUsageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    captureId: String,

    imageType: String,

    inputTokens: Number,

    outputTokens: Number,

    totalTokens: Number,

    estimatedCost: Number,

    model: String,

    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.models.AIUsage ||
mongoose.model("AIUsage", AIUsageSchema);