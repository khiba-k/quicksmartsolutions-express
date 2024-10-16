import {
  TextractClient,
  StartDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommand,
} from "@aws-sdk/client-textract";
import dotenv from "dotenv";

dotenv.config();

// Function to start Textract Job
export async function startTextractJob(s3Key) {
  try {
    const textractClient = new TextractClient({
      region: process.env.AWS_REGION,
    });
    const s3Bucket = process.env.AWS_BUCKET_NAME;

    if (!s3Bucket) {
      throw new Error("AWS_BUCKET_NAME environment variable is not set");
    }

    const startTextractCommand = new StartDocumentTextDetectionCommand({
      DocumentLocation: {
        S3Object: { Bucket: s3Bucket, Name: s3Key },
      },
    });

    const textractResponse = await textractClient.send(startTextractCommand);
    const jobId = textractResponse.JobId;

    if (!jobId) {
      throw new Error("Failed to start Textract job: No JobId returned");
    }

    console.log("Textract job started successfully:", jobId);
    return { success: true, message: "Textract job started", jobId };
  } catch (error) {
    console.error("Error starting Textract job:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

// Function to get the result of Textract Job with polling
export async function getTextractResult(jobId) {
  const textractClient = new TextractClient({
    region: process.env.AWS_REGION,
  });

  try {
    let jobResponse;
    let status = "IN_PROGRESS"; // Initial job status

    // Poll for job completion
    while (status === "IN_PROGRESS") {
      console.log("Waiting for Textract job to complete...");
      jobResponse = await textractClient.send(
        new GetDocumentTextDetectionCommand({ JobId: jobId })
      );

      status = jobResponse.JobStatus;

      if (status === "SUCCEEDED") {
        console.log("Textract Job Completed Successfully");
        return jobResponse.Blocks || [];
      } else if (status === "FAILED") {
        throw new Error("Textract job failed.");
      }

      // Wait before the next poll (e.g., 5 seconds)
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  } catch (error) {
    console.error("Error getting Textract job result:", error);
    throw error; // Re-throw for upstream handling
  }
}

// Function to extract raw text from Textract blocks
export function extractRawText(blocks) {
  let text = "";
  blocks.forEach((block) => {
    if (block.BlockType === "LINE" && block.Text) {
      text += block.Text + " ";
    }
  });
  return text.trim();
}

// Main function to process Textract
export async function processTextract(s3Key) {
  try {
    // Start the Textract job and retrieve the JobId
    const startJobResponse = await startTextractJob(s3Key);

    if (!startJobResponse.success || !startJobResponse.jobId) {
      throw new Error(startJobResponse.message);
    }

    // Get the result of the Textract job
    const blocks = await getTextractResult(startJobResponse.jobId);

    // Extract raw text from blocks
    const rawText = extractRawText(blocks);
    console.log("Raw Text Extracted:", rawText);

    return rawText; // Return the extracted raw text
  } catch (error) {
    console.error("Textract Error:", error);
    throw error; // Re-throw to allow upstream handling
  }
}
