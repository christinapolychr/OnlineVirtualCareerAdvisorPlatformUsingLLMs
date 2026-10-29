import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import mammoth from 'mammoth';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// For ES Modules, get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the current directory
app.use(express.static(__dirname));

// Check if API_KEY is loaded
if (!process.env.API_KEY) {
    console.error("ERROR: API_KEY is not set in your .env file!");
}

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

//  function to safely parse a JSON string from a response
const tryParseJson = (text) => {
    const jsonMatch = text.match(/```json\n([\s\S]*)\n```/);
    if (jsonMatch && jsonMatch[1]) {
        try {
            return JSON.parse(jsonMatch[1]);
        } catch (e) {
            console.error("Error parsing JSON from code block:", e);
        }
    }

    // If no code block is found, or parsing failed, try to parse the entire text as JSON
    try {
        const trimmedText = text.trim();
        // Check if the trimmed text looks like a JSON object or array
        if ((trimmedText.startsWith('{') && trimmedText.endsWith('}')) || (trimmedText.startsWith('[') && trimmedText.endsWith(']'))) {
            return JSON.parse(trimmedText);
        }
    } catch (e) {
        console.error("Error parsing plain JSON text:", e);
    }
    
    // If all attempts fail, return null
    return null;
};

app.post('/generate', async (req, res) => {
    const prompt = req.body.prompt;
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    try {
        const result = await model.generateContent(prompt);
        let text = result.response?.text(); // Get the raw text from Gemini

        console.log("Gemini Raw Response Text (server-side):", text); // See what Gemini actually returned
        if (!text) {
            console.error("No text response from Gemini.");
            return res.status(500).json({ error: "No response from Gemini." });
        }
        // Check if the prompt indicates a CV creation/improvement request
       const isCvRequest = prompt.includes("Create a professional CV") || prompt.includes("Improve the following CV");

        if (isCvRequest) {
            // If it's a CV request, just send the raw text back to the frontend.
            // Remove any leading/trailing markdown code block delimiters if present.
            const cleanedCvText = text.replace(/^```(?:\w+)?\n|\n```$/g, '').trim();
            console.log("Sending cleaned CV text (server-side):", cleanedCvText);
            return res.json({ response: { cv: cleanedCvText } }); // Send as an object with a 'cv' key
        }

        //  Json for quiz
        let parsedJson = tryParseJson(text);

        if (!parsedJson) {
            console.error("Failed to parse JSON from AI response:", text);
            return res.status(500).json({
                error: "Invalid JSON format received from AI (server-side parsing failed).",
                rawResponse: text,
            });
        }
        
        console.log("Parsed JSON Object (server-side):", parsedJson); 

        // Send the parsed JSON object to the frontend
        res.json({ response: parsedJson });

    } catch (error) {
        // Log the full error object for better debugging
        console.error("Error generating content from Gemini API (network/API error):", error);
        // Send detailed error message to the frontend
        res.status(500).send(`Error generating content from AI (server-side API call failed): ${error.message || JSON.stringify(error)}`);
    }
});

app.post("/next", async (req, res) => {
    const { answers } = req.body;

    const prompt = `Based on these answers, suggest 3 distinct professional career paths that align with the user's 
    interests and experiences. For each career, provide a short, one-sentence description of the role. 
    Return the output as a JSON object with this exact structure: { "careers": [{ "careerName": 
    "Career Name 1", "description": "Description 1" }, { "careerName": "Career Name 2", "description": 
    "Description 2" }, { "careerName": "Career Name 3", "description": "Description 3" }] }. 
    Do not include any additional text or explanations. Just return valid JSON.`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); 
        const result = await model.generateContent(prompt);
        let text = result.response?.text();
        
        console.log("Gemini Raw Response Text (server-side):", text);

        if (!text) {
            console.error("No text response from Gemini.");
            return res.status(500).json({ error: "No response from Gemini." });
        }

        let parsedJson = tryParseJson(text);

        if (!parsedJson) {
            console.error("Failed to parse JSON from AI response:", text);
            return res.status(500).json({
                error: "Invalid JSON format received from AI (server-side parsing failed).",
                rawResponse: text,
            });
        }

        console.log("Parsed JSON Object (server-side):", parsedJson);

        // response format like /generate 
        res.json({ response: parsedJson });
    } catch (error) {
        // Log the full error object for better debugging
        console.error("Error getting career suggestions from Gemini API:", error); 
        // Send detailed error message
        res.status(500).send(`Error generating career suggestions (server-side API call failed): ${error.message || JSON.stringify(error)}`);
    }
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        console.log("File received:", req.file.originalname);
        
        // Use mammoth to extract text from the .docx file's buffer
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        const text = result.value;

        if (!text) {
            console.error("No text extracted from the DOCX file.");
            return res.status(500).json({ error: "Could not extract text from the document." });
        }

        console.log("Text extracted successfully.");

        // Send text back to frontend
        res.json({ text: text });
    } catch (error) {
        console.error("Error processing DOCX file:", error);
        res.status(500).json({ error: `Server-side error processing file: ${error.message}` });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
