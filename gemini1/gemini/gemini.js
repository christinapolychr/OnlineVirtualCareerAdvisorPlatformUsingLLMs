import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
// change the options to metavlites
const prompt = "give me 3 career options knowing that i like soccer, shoes and cars";

const result = await model.generateContent(prompt);
console.log(result.response.text());

//this is acc useless now and just for testing purposes