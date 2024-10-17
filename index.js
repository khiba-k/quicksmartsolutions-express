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

    const webhookPayload = {
      success: true,
      message: "Textract and OpenAI processing successful",
      data: openAIResponse,
      userId: userId,
    };

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error(
        `Webhook POST request failed with status: ${webhookResponse.status}`
      );
      console.error("Error response:", errorText);
      // You might want to handle this error case specifically
      return;
    }

    console.log("Webhook POST request successful:", webhookResponse.status);
  } catch (error) {
    console.error("Error during processing:", error);

    // Attempt to notify via webhook about the failure if webhookUrl exists
    if (req.body?.webhookUrl) {
      try {
        await fetch(req.body.webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            success: false,
            message: "Processing failed",
            error: error.message,
            userId: req.body.userId,
          }),
        });
      } catch (webhookError) {
        console.error("Failed to send error webhook:", webhookError);
      }
    }
  }
};

app.post("/process-textract", processTextractHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
