import openai from "../openaiConfig.js";

function handlePlainTextResponse(responseText) {
  const data = {};
  const lines = responseText.split("\n");

  lines.forEach((line) => {
    const [key, ...value] = line.split(":");
    if (key) {
      data[key.trim()] = value.join(":").trim();
    }
  });

  return data;
}

async function getOpenAIStructuredData(rawText) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `Please structure the following Textract raw text data into the following fields for my Prisma database. Use the provided keys and set missing fields to "none" where necessary. And do not return any comments yourself as we only want the json data. If user is missing, replace with null. The fields are:
                    - firstName
                    - lastName
                    - emailAddress
                    - contacts (if there are multiple, return as a comma-separated string)
                    - summary (professional summary as a string array)
                    - nationality
                    - gender
                    - driverLicense (boolean)
                    - driverLicenseType
                    - address (residence)
                    - education (list of strings)
                    - experience (string)
                    - skills (array of strings)
                    - references
                    - country
                    
                    If any field is not found, please set it to "none" or appropriate default values.
                    Here is the Textract data:\n${rawText}
                    `,
      },
    ],
  });

  return response.choices[0].message.content;
}

function parseAndCleanData(cleanedData) {
  let parsedData;
  try {
    parsedData = JSON.parse(cleanedData);
  } catch (error) {
    console.error("Failed to parse structured data as JSON:", error);
    parsedData = handlePlainTextResponse(cleanedData);
  }

  // Ensure certain fields are arrays
  ["education", "experience", "skills", "references"].forEach((field) => {
    if (!Array.isArray(parsedData[field])) {
      parsedData[field] = [parsedData[field]];
    }
  });

  return parsedData;
}

// Webhook function
export default async function structureDataWithOpenAI(payload, userId) {
  try {
    console.log("Starting OpenAI structuring");

    // Process raw text with OpenAI
    const rawText = payload;
    console.log("Raw Text:", rawText);
    const openAIResponse = await getOpenAIStructuredData(rawText);

    // Clean and parse the response
    const cleanedData = openAIResponse
      .replace(/```json\n?/, "")
      .replace(/```/, "")
      .trim();

    const parsedData = parseAndCleanData(cleanedData);
    console.log("Raw OpenAI API Response:", parsedData);

    // Return structured data along with the user ID
    return {
      success: true,
      message: "CV data processed successfully",
      data: parsedData,
      userId: userId, // Include user ID for use in Next.js application
    };
  } catch (error) {
    console.error("OpenAI Processing Error:", error);
    throw error; // Re-throw error for handling in caller
  }
}
