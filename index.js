import express from "express";
import cors from "cors";
import { processTextract } from "./textract/textract.js";
import structureDataWithOpenAI from "./openai/openai.js";

const app = express();
app.use(cors());
app.use(express.json());

const processTextractHandler = async (req, res) => {
  try {
    const { s3Key, userId, webhookUrl } = req.body;

    // Immediately acknowledge the request
    res.status(200).json({
      success: true,
      message: "Textract job started", // Acknowledge without waiting
    });

    // Process Textract and OpenAI in the background
    const result = await processTextract(s3Key);
    const openAIResponse = await structureDataWithOpenAI(result, userId);

    // Send the structured data to the frontend using the webhook
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        message: "Textract and OpenAI processing successful",
        data: openAIResponse, // Send the structured data to the webhook
        userId: userId,
      }),
    });
    if (webhookResponse.ok) {
      console.log("Webhook POST request successful:", webhookResponse.status);
    } else {
      console.error(
        "Webhook POST request failed with status:",
        webhookResponse.status
      );
      console.error(await webhookResponse.text()); // Log any response text for debugging
    }
  } catch (error) {
    console.error(error);
    // Optionally handle the error in the webhook as well
  }
};

app.post("/process-textract", processTextractHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
