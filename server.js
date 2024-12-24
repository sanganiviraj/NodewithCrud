const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const user = require('./models/user');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Changed import
const multer = require('multer');
const upload = multer();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb+srv://sanganiviraj263:inBxMZuqFbWqBMwO@cluster0.zrpgr.mongodb.net/Demobase').then(() => {
    console.log("Monogodb Is connected");
}).catch((e) => {
    console.log("Monogodb Connection Error : ", e);
})

app.listen(PORT, () => {
    console.log(`server is runnings on ${PORT}`);
})

app.get('/', (req, res) => {
    res.send('Hello, Node.js!');
});

app.post('/user', async (req, res) => {
    const { name, age, email } = req.body;
    const newUser = new user({ name, age, email });

    await newUser.save()
        .then((users) => { res.json(users) })
        .catch((e) => { res.status(500).json({ message: 'error saving user', err: e }) });
})

// Update a user
app.put('/user/:id', (req, res) => {
    const { name, age, email } = req.body;
    user.findByIdAndUpdate(req.params.id, { name, age, email }, { new: true })
        .then((user) => res.json(user))
        .catch((err) => res.status(500).json({ message: 'Error updating user', error: err }));
});

// Delete a user
app.delete('/user/:id', (req, res) => {
    user.findByIdAndDelete(req.params.id)
        .then(() => res.json({ message: 'User deleted' }))
        .catch((err) => res.status(500).json({ message: 'Error deleting user', error: err }));
});

// Fetch users by query
app.get('/user/search', (req, res) => {
    const { name, age } = req.query;
    const filter = {};

    if (name) filter.name = name;
    if (age) filter.age = age;

    user.find(filter)
        .then((users) => res.json(users))
        .catch((err) => res.status(500).json({ message: 'Error retrieving users', error: err }));
});

//Gemini API
const genAI = new GoogleGenerativeAI("AIzaSyAPACEj3b0XgYlomd5vhE9ZBHDdSX33kkc"); // Changed initialization
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Changed model initialization

app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        // Validate file upload
        if (!req.file) {
            console.log('No file received');
            return res.status(400).json({ error: 'No image file uploaded' });
        }

        // Check if the uploaded file is a valid image type (image/jpeg, image/png, etc.)
        if (!['image/jpeg', 'image/png', 'image/gif'].includes(req.file.mimetype)) {
            return res.status(400).json({ error: 'Invalid image file type. Please upload a JPEG, PNG, or GIF image.' });
        }

        console.log('File received:', {
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        const image = req.file.buffer.toString('base64');
        const userQuestion = req.body.userQuestion || '';  // User question if provided
        const productCategory = req.body.category?.toLowerCase() || '';  // Ensure category is lowercase

        console.log('Base64 image length:', image.length);
        console.log('User question:', userQuestion);

        // Validate product category
        if (!productCategory) {
            return res.status(400).json({ error: 'No product category specified. Please provide a valid category.' });
        }

        // Ensure category is one of the predefined categories
        const validCategories = ['grocery', 'skincare', 'medicine', 'food', 'supplements', 'beverages'];
        if (!validCategories.includes(productCategory)) {
            return res.status(400).json({
                error: 'Unknown product category. Please ensure the uploaded product belongs to a supported category: Grocery, Skincare, Medicine, Food, Supplements, Beverages.'
            });
        }

        // Create proper image part for Gemini
        const imagePart = {
            inlineData: {
                data: image,
                mimeType: req.file.mimetype
            }
        };

        let promptPart;

        // Create prompt based on product category
        const generatePrompt = (category) => {
            switch (category) {
                case 'grocery':
                    return `
                        Analyze the safety and usage of the grocery product in the provided image.
                        Instructions:
                        1. Extract the product name and ingredients.
                        2. Provide a general safety assessment (e.g., allergies, contaminants).
                        3. List potential side effects (e.g., gastrointestinal issues, allergic reactions).
                        4. Address user question: ${userQuestion}
                        5. Provide usage instructions (e.g., serving size, how to prepare).
                        6. List storage instructions (e.g., store in a cool, dry place, refrigerate after opening).
                        7. Extract expiry date or best-before date, if visible.
                        8. Provide shelf life details, if available.
                        9. Highlight any product benefits (e.g., health benefits, features).
                        10. Identify any health or safety warnings related to the product.
                        Note: Generate the response as a well-structured JSON format.
                    `;
                case 'skincare':
                    return `
                        Analyze the safety and usage of the skincare product in the provided image.
                        Instructions:
                        1. Extract the product name and ingredients.
                        2. Provide a general safety assessment (e.g., skin sensitivity, irritants).
                        3. List potential side effects (e.g., skin irritation, allergies).
                        4. Address user question: ${userQuestion}
                        5. Provide usage instructions (e.g., how to apply, frequency of use).
                        6. List age restrictions (e.g., not suitable for children under 12) and skin types for suitability.
                        7. Extract expiry or best-before date, if visible.
                        8. Identify product benefits (e.g., moisturizing, anti-aging).
                        9. Include any potential health or safety warnings (e.g., sun exposure after use).
                        Note: Generate the response as a well-structured JSON format.
                    `;
                case 'medicine':
                    return `
                        Analyze the safety and usage of the medicine in the provided image.
                        Instructions:
                        1. Extract the product name and ingredients.
                        2. Provide a general safety assessment (e.g., interactions with other drugs, health conditions).
                        3. List potential side effects (e.g., dizziness, nausea, drowsiness).
                        4. Address user question: ${userQuestion}
                        5. Provide dosage instructions (e.g., number of tablets, frequency).
                        6. Extract expiry or best-before date, if visible.
                        7. Include any warnings (e.g., for pregnant women, specific conditions).
                        8. Identify age restrictions (e.g., not suitable for children under 6).
                        9. Highlight any contraindications (e.g., do not take with alcohol).
                        10. Provide any additional health and safety recommendations.
                        Note: Generate the response as a well-structured JSON format.
                    `;
                case 'food':
                    return `
                        Analyze the safety and usage of the food product in the provided image.
                        Instructions:
                        1. Extract the product name and ingredients.
                        2. Provide a general safety assessment (e.g., allergens, preservatives).
                        3. List potential side effects (e.g., bloating, allergic reactions).
                        4. Address user question: ${userQuestion}
                        5. Provide usage instructions (e.g., preparation steps, cooking methods).
                        6. List storage instructions (e.g., refrigerate after opening, consume within X days).
                        7. Extract expiry or best-before date, if visible.
                        8. Highlight any product benefits (e.g., low calorie, high protein).
                        9. Identify any health or safety warnings related to the product.
                        Note: Generate the response as a well-structured JSON format.
                    `;
                case 'supplements':
                    return `
                        Analyze the safety and usage of the supplement product in the provided image.
                        Instructions:
                        1. Extract the product name and ingredients.
                        2. Provide a general safety assessment (e.g., warnings about overdosing, contraindications).
                        3. List potential side effects (e.g., upset stomach, headaches).
                        4. Address user question: ${userQuestion}
                        5. Provide dosage instructions (e.g., number of capsules, frequency).
                        6. Extract expiry or best-before date, if visible.
                        7. List storage instructions (e.g., keep in a cool, dry place).
                        8. Highlight any health benefits (e.g., supports immune system, increases energy).
                        9. Identify any health or safety warnings (e.g., consult a doctor before use).
                        Note: Generate the response as a well-structured JSON format.
                    `;
                case 'beverages':
                    return `
                        Analyze the safety and usage of the beverage product in the provided image.
                        Instructions:
                        1. Extract the product name and ingredients.
                        2. Provide a general safety assessment (e.g., caffeine content, sugar levels).
                        3. List potential side effects (e.g., jitteriness, upset stomach).
                        4. Address user question: ${userQuestion}
                        5. Provide usage instructions (e.g., serving size, temperature of consumption).
                        6. List storage instructions (e.g., refrigerate after opening, consume within X days).
                        7. Extract expiry or best-before date, if visible.
                        8. Identify product benefits (e.g., energy boost, hydration).
                        9. Include any health warnings (e.g., high sugar content, caffeine sensitivity).
                        Note: Generate the response as a well-structured JSON format.
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
            return res.status(500).json({ error: 'Invalid response format' });
        }

        const jsonString = jsonStringMatch[1].trim(); // Extracted JSON string

        // Remove comments (lines starting with //)
        const jsonStringWithoutComments = jsonString.replace(/\/\/.*$/gm, '').trim();

        // Parse the cleaned JSON string
        const structuredData = JSON.parse(jsonStringWithoutComments);

        // Return the structured data as JSON
        res.json({ analysis: structuredData });

    } catch (error) {
        console.error('Error processing image or Gemini API:', error);
        res.status(500).json({
            error: 'Error analyzing image',
            details: error.message
        });
    }
});

