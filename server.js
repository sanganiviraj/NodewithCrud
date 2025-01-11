const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const user = require("./models/user");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Changed import
const multer = require("multer");
const { default: rateLimit } = require("express-rate-limit");
const upload = multer();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

mongoose
  .connect(
    "mongodb+srv://sanganiviraj263:inBxMZuqFbWqBMwO@cluster0.zrpgr.mongodb.net/Demobase"
  )
  .then(() => {
    console.log("Monogodb Is connected");
  })
  .catch((e) => {
    console.log("Monogodb Connection Error : ", e);
  });

app.listen(PORT, () => {
  console.log(`server is runnings on ${PORT}`);
});

app.get("/", (req, res) => {
  res.send("Hello, Node.js!");
});

app.post("/user", async (req, res) => {
  const { name, age, email } = req.body;
  const newUser = new user({ name, age, email });

  await newUser
    .save()
    .then((users) => {
      res.json(users);
    })
    .catch((e) => {
      res.status(500).json({ message: "error saving user", err: e });
    });
});

// Update a user
app.put("/user/:id", (req, res) => {
  const { name, age, email } = req.body;
  user
    .findByIdAndUpdate(req.params.id, { name, age, email }, { new: true })
    .then((user) => res.json(user))
    .catch((err) =>
      res.status(500).json({ message: "Error updating user", error: err })
    );
});

// Delete a user
app.delete("/user/:id", (req, res) => {
  user
    .findByIdAndDelete(req.params.id)
    .then(() => res.json({ message: "User deleted" }))
    .catch((err) =>
      res.status(500).json({ message: "Error deleting user", error: err })
    );
});

// Fetch users by query
app.get("/user/search", (req, res) => {
  const { name, age } = req.query;
  const filter = {};

  if (name) filter.name = name;
  if (age) filter.age = age;

  user
    .find(filter)
    .then((users) => res.json(users))
    .catch((err) =>
      res.status(500).json({ message: "Error retrieving users", error: err })
    );
});

//Gemini API
const genAI = new GoogleGenerativeAI("AIzaSyCfNFpZKRuhYPArx90H23YDSbUNH7-Axlo"); // Changed initialization
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Changed model initialization

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    // Validate file upload
    if (!req.file) {
      console.log("No file received");
      return res.status(400).json({ error: "No image file uploaded" });
    }

    // Check if the uploaded file is a valid image type (image/jpeg, image/png, etc.)
    if (!["image/jpeg", "image/png", "image/gif"].includes(req.file.mimetype)) {
      return res.status(400).json({
        error:
          "Invalid image file type. Please upload a JPEG, PNG, or GIF image.",
      });
    }

    console.log("File received:", {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });

    const image = req.file.buffer.toString("base64");
    const userQuestion = req.body.userQuestion || ""; // User question if provided
    const productCategory = req.body.category?.toLowerCase() || ""; // Ensure category is lowercase

    console.log("Base64 image length:", image.length);
    console.log("User question:", userQuestion);

    // Validate product category
    if (!productCategory) {
      return res.status(400).json({
        error:
          "No product category specified. Please provide a valid category.",
      });
    }

    // Ensure category is one of the predefined categories
    const validCategories = [
      "grocery",
      "skincare",
      "medicine",
      "food",
      "supplements",
      "beverages",
    ];
    if (!validCategories.includes(productCategory)) {
      return res.status(400).json({
        error:
          "Unknown product category. Please ensure the uploaded product belongs to a supported category: Grocery, Skincare, Medicine, Food, Supplements, Beverages.",
      });
    }

    // Create proper image part for Gemini
    const imagePart = {
      inlineData: {
        data: image,
        mimeType: req.file.mimetype,
      },
    };

    let promptPart;

    // Create prompt based on product category
    const generatePrompt = (category) => {
      const fixedResponseKeys = `
      Instructions:
      Always include the following fixed keys in the JSON response, ensuring each key has a consistent data type:
      - productName: A string representing the name of the product. (Type: string)
      - ingredients: An array of strings, each representing an ingredient. (Type: array of strings)
      - safetyAssessment: A string summarizing the general safety evaluation. (Type: string)
      - sideEffects: An array of strings, each representing a potential side effect. (Type: array of strings)
      - userQuestionResponse: A string that addresses the user's question. (Type: string)
      - usageInstructions: An array of strings, each representing a usage instruction. (Type: array of strings)
      - storageInstructions: An array of strings, each representing a storage guideline. (Type: array of strings)
      - expiryDate: A string representing the expiry date in ISO format (YYYY-MM-DD). If no date is visible, estimate an expiry date based on the product category:
          - For grocery products, assume an expiry of 6 months from the current date.
          - For skincare products, assume 1 to 3 years from the current date.
          - For food products, assume 6 months to 1 year from the current date.
          - For supplements, assume 2 to 3 years from the current date.
          - For medicines, assume 1 to 2 years from the current date. (Type: string)
      - shelfLife: A string representing the product's shelf life (e.g., "6 months", "1 year"). (Type: string)
      - productBenefits: An array of strings, each representing a key product benefit. (Type: array of strings)
      - warnings: An array of strings, each representing a health or safety warning. (Type: array of strings)
      - nutrientComposition: A list of nutrients, where each nutrient is represented as an object containing:
        - name: The nutrient name (e.g., "Protein"). (Type: string),
        - mg: The amount in milligrams. (Type: string or number)
        - percentage: The percentage of the daily value. (Type: string)
        Example: 
        [
          { "name": "Protein", "mg": "20mg", "percentage": "15%" },
          { "name": "Fat", "mg": "10mg", "percentage": "8%" }
        ]    
      - contraindications: An array of strings, each representing a specific contraindication. (Type: array of strings)
      - ageRestrictions: A string specifying suitable age groups or restrictions. (Type: string)
      - additionalRecommendations: An array of strings, each representing an extra recommendation. (Type: array of strings)
      
      If a key is not applicable, include it with a value of null or an empty string, depending on the type:
      - For strings: Use an empty string ("").
      - For arrays: Use an empty array ([]).
      - For objects: Use an empty object ({}).
      `;

      switch (category) {
        case "grocery":
          return `
        Analyze the safety and usage of the grocery product in the provided image.
        ${fixedResponseKeys}
      `;
        case "skincare":
          return `
        Analyze the safety and usage of the skincare product in the provided image.
        ${fixedResponseKeys}
      `;
        case "medicine":
          return `
        Analyze the safety and usage of the medicine in the provided image.
        ${fixedResponseKeys}   
      `;
        case "food":
          return `
        Analyze the safety and usage of the food product in the provided image.
        ${fixedResponseKeys}
      `;
        case "supplements":
          return `
        Analyze the safety and usage of the supplement product in the provided image.
        ${fixedResponseKeys}
      `;
        case "beverages":
          return `
        Analyze the safety and usage of the beverage product in the provided image.
        ${fixedResponseKeys}
      `;
        default:
          return `
        The product category provided is not supported.
        Please ensure the uploaded product belongs to one of the following categories: Grocery, Skincare, Medicine, Food, Supplements, or Beverages.
      `;
      }
    };

    promptPart = { text: generatePrompt(productCategory) };

    // Generate content with proper parts array
    const result = await model.generateContent([promptPart, imagePart]);
    const response = await result.response;
    console.log("API response :", response);
    const text = await response.text(); // Assuming response is JSON

    // Extract JSON string from the markdown code block
    const jsonStringMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonStringMatch) {
      return res.status(500).json({ error: "Invalid response format" });
    }

    const jsonString = jsonStringMatch[1].trim(); // Extracted JSON string

    // Remove comments (lines starting with //)
    const jsonStringWithoutComments = jsonString
      .replace(/\/\/.*$/gm, "")
      .trim();

    // Parse the cleaned JSON string
    const structuredData = JSON.parse(jsonStringWithoutComments);

    // Return the structured data as JSON
    res.json({ analysis: structuredData });
  } catch (error) {
    console.error("Error processing image or Gemini API:", error);
    res.status(500).json({
      error: "Error analyzing image",
      details: error.message,
    });
  }
});

// Setup rate limiting
// const limiter = rateLimit({
//   windowMs: 60 * 1000, // 1 minute
//   max: 10, // Limit each IP to 10 requests per minute
// });

// app.use("/chat", limiter);

// // Helper function for retry logic with backoff
// async function callApiWithRetry(apiCall, retries = 3, delay = 1000) {
//   try {
//     return await apiCall();
//   } catch (err) {
//     if (retries > 0 && err.status === 429) {
//       console.log("Rate limit exceeded. Retrying...");
//       await new Promise(resolve => setTimeout(resolve, delay)); // Delay before retrying
//       return callApiWithRetry(apiCall, retries - 1, delay * 2); // Exponential backoff
//     }
//     throw err; // Re-throw error if retries are exhausted or it's a different error
//   }
// }

// // POST route to handle chat requests
// app.post("/chat", async (req, res) => {
//   try {
//     const user = req.body.user || "";

//     // Validate the input
//     if (!user) {
//       return res.status(400).json({ error: "User query is required." });
//     }

//     console.log("User query ->", user);

//     const prompt = `Give an answer related only to coding. User query: ${user}. Always respond in JSON format.`;

//     // Call the API with retry logic
//     const result = await callApiWithRetry(() => model.generateContent([prompt]));
//     const response = await result.response;
//     console.log("API response:", response);

//     const text = await response.text();
//     const jsonStringMatch = text.match(/```json\n([\s\S]*?)\n```/);

//     if (!jsonStringMatch) {
//       return res.status(500).json({ error: "Invalid response format" });
//     }

//     const jsonString = jsonStringMatch[1].trim(); // Extracted JSON string

//     // Clean up the JSON string by removing comments (lines starting with //)
//     const jsonStringWithoutComments = jsonString.replace(/\/\/.*$/gm, "").trim();

//     // Parse the cleaned JSON string
//     const structuredData = JSON.parse(jsonStringWithoutComments);

//     // Return the structured data as JSON
//     return res.json({ analysis: structuredData });

//   } catch (error) {
//     console.error("Error Processing Gemini API:", error);

//     if (error.status === 429) {
//       return res.status(429).json({
//         error: "Rate limit exceeded. Please try again later.",
//       });
//     }

//     // Catch other types of errors
//     return res.status(500).json({
//       error: "An error occurred while processing the request.",
//       details: error.message || error.toString(),
//     });
//   }
// });


// const stripe = Stripe('sk_test_51Qcfr2LtY98Hku9KnFO3sPhdlF5eKZtGuxYViMiJ9A9576atLBOa5cC4w8Aju3ageUoKgg5KoJmxWfX9ArNJYoYH00sEhB8gzm'); // Replace with your actual secret key

// app.post('/create-payment-intent', async (req, res) => {
//   const { amount, currency } = req.body; // Expecting amount in smallest currency unit (e.g., cents for USD)

//   try {
//     // Create a Payment Intent
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount,
//       currency,
//     });

//     res.json({
//       clientSecret: paymentIntent.client_secret, // Return the client secret to the frontend
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

