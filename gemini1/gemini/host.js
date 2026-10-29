import { launchCVInterface } from '/cv.js'; 
let answersArray = [];
let askedQuestions = [];
let questionCount = 0;
let currentCategoryIndex = 0;

// This is used to ensure questions cover a wide range of career factors.
const categories = [
    "Data & Analytics",
    "Research & Learning",
    "Detailed Organization",
    "Technical Systems",
    "Problem Solving",
    "Team Collaboration",
    "Leadership & Guiding",
    "Communication Style",
    "Teaching & Mentoring",
    "Sales & Negotiation",
    "Customer Service",
    "Creative & Artistic work",
    "Physical & Hands-on work",
    "Health & Wellness",
    "Nature & Environment",
    "Public Speacking & Presenting",
    "Financial Management",
    "Risk Taking & Entrepreneurship",
    "Compliance & Rules",
    "Fast Paced Environments",
    "Self-Directed Work & Autonomy",
    "Logical & Strategic Thinking",
    "International & Cultural Awareness",
    "Writing & Content Creation",
    "Emotional Intelligence & Empathy",
    "Visionary & Big Picture Thinking"
];

const chatScreen = document.getElementById("chatScreen");
const output = document.getElementById("output");
const questionDisplay = document.getElementById("question");
const optionsContainer = document.getElementById("options");
const quizContainer = document.getElementById("quizContainer");
const responseContainer = document.getElementById("responseContainer");

function selectNextCategory() {
    if (currentCategoryIndex < categories.length) {
        const category = categories[currentCategoryIndex];
        currentCategoryIndex++;
        return category;
    } else {
        return null;
    }
}

window.addEventListener('startGeneralQuiz', () => {
    answersArray = [];
    askedQuestions = [];
    questionCount = 0;
    currentCategoryIndex = 0;
    output.innerHTML = "";
    quizContainer.style.display = "none";
    optionsContainer.innerHTML = "";
    optionsContainer.style.display = "none";
    questionDisplay.textContent = "";
    chatScreen.style.display = "flex";
    document.getElementById("startScreen").style.display = "none";
    document.getElementById("cvSection").style.display = "none";
    responseContainer.style.display = "none";
    generateNextQuestion();
});

// This function manages the quiz flow and calls the AI to generate the next question.
async function generateNextQuestion() {
    const category = selectNextCategory();

    if (category && questionCount < 25) { // Limit to 25 questions max
        const thinkingMessage = displayMessage("ai", `Thinking of a question about ${category}...`);
        scrollToBottom();

        const questionData = await generateUniqueQuestion(category); 
        
        if (thinkingMessage && output.contains(thinkingMessage)) {
            output.removeChild(thinkingMessage);
        }

        if (!questionData || typeof questionData.question !== 'string' || !Array.isArray(questionData.answers)) {
            displayMessage("ai", "Oops, I couldn't come up with a new general question or valid answer choices. Submitting your current answers.");
            submitAnswers();
            return;
        }

        displayMessage("ai", questionData.question);
        scrollToBottom();
        questionDisplay.textContent = "";
        generateAnswerButtons(questionData);
    } else {
        submitAnswers();
    }
}

// --- HIGHLIGHTED CHANGE START: Updated PROMPT for Interests AND Experience ---
async function generateUniqueQuestion(category) {
    let questionData = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (!questionData && attempts < maxAttempts) {
        try {
            // The prompt asks the AI to generate a question about interests AND experience
            const prompt = `Create a conversational question about 
            a user's **interests and experience** related to the 
            general career factor of "${category}". 
            The question should help understand their preferences 
            for a career. Provide 3 easy, conversational, and clearly
             distinct answer choices that **must** use these three 
             exact phrasings: 
            1. "I like and I have experience in..."
            2. "I like but don't have experience in..."
            3. "I don't like..." 
            
            Follow each phrasing with a short description of 
            the activity or skill related to the question. All 
            answer choices must be full sentences. Return the 
            output as a JSON object with this exact structure: 
            { "question": "Your question here", "answers": 
             ["Option 1", "Option 2", "Option 3"] }. 
             Do not include any additional text or explanations. 
             Just return valid JSON.`;

            const response = await fetch("http://localhost:3000/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error: ${response.status} - ${errorText}`);
            }

            const rawResponseText = await response.text();
            let result;
            try {
                result = JSON.parse(rawResponseText);
            } catch (e) {
                console.error("Error parsing JSON:", e);
                throw new Error("Invalid JSON received from server.");
            }

            questionData = result.response || result.json;

            if (!questionData || typeof questionData.question !== 'string' || !Array.isArray(questionData.answers)) {
                console.error("Received an invalid question object:", questionData);
                throw new Error("API did not return a valid question object structure.");
            }

            const normalized = normalize(questionData.question);
            const alreadyAsked = askedQuestions.some(q => q && q.question && normalize(q.question) === normalized);

            if (alreadyAsked) {
                questionData = null;
                attempts++;
            } else {
                askedQuestions.push({ question: questionData.question, category: category });
                return questionData;
            }
        } catch (error) {
            console.error("Error generating question (frontend fetch/response processing):", error);
            return null;
        }
    }
    return null;
}

function generateAnswerButtons(questionData) {
    optionsContainer.innerHTML = "";
    optionsContainer.style.display = "flex";
    questionData.answers.forEach(answer => {
        const button = document.createElement("button");
        button.classList.add("career-button", "btn-style");
        button.textContent = answer;
        button.onclick = () => {
            addMessage(answer, "user");
            answersArray.push(answer);
            questionCount++;
            quizContainer.style.display = "none";
            optionsContainer.innerHTML = "";
            optionsContainer.style.display = "none";
            questionDisplay.textContent = "";

            if (questionCount < 25) {
                generateNextQuestion();
            } else {
                submitAnswers();
            }
        };
        optionsContainer.appendChild(button);
    });
    quizContainer.style.display = "block";
    responseContainer.style.display = "flex";
}

async function submitAnswers() {
    displayMessage("ai", "Analyzing your answers and generating career suggestions...");
    scrollToBottom();

    // The AI is now instructed to use this richer data (like, dislike, and have/don't have experience)
    const prompt = `Based on the following user answers, which explicitly include their **interests and existing experience**: 
    "${answersArray.join(', ')}", and considering the following ${categories.length} career factor categories: 
    [${categories.join(', ')}], suggest three distinct professional career paths that align with their 
    **demonstrated experience, interests, and potential growth areas**. For each career, provide a short, 
    one-sentence description of the role. Return the output as a JSON object with this exact structure: 
    { "careers": [{ "careerName": "Career Name 1", "description": "Description 1" }, 
     { "careerName": "Career Name 2", "description": "Description 2" }, 
     { "careerName": "Career Name 3", "description": "Description 3" }] }. 
      Do not include any additional text or explanations. Just return valid JSON.`;

    try {
        const response = await fetch("http://localhost:3000/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        const result = await response.json();
        const careerOptions = result.response.careers;

        if (!careerOptions || careerOptions.length === 0) {
            displayMessage("ai", "I'm having trouble finding career matches for you. Please try again.");
            return;
        }
        displayMessage("ai", `Based on your answers, here are a few potential career paths for you. Select the one that interests you most:`);
        showCareerOptions(careerOptions, answersArray);
    } catch (error) {
        console.error("Error submitting answers:", error);
        displayMessage("ai", "Something went wrong while finding career matches. Please try again.");
    }
}

function showCareerOptions(careerOptions, answers) {
    quizContainer.style.display = "none";
    optionsContainer.innerHTML = "";
    optionsContainer.style.display = "flex";

    const careerSelectionContainer = document.createElement("div");
    careerSelectionContainer.className = "options-container";
    optionsContainer.appendChild(careerSelectionContainer);

    careerOptions.forEach(career => {
const button = document.createElement("button");
button.classList.add("career-button", "btn-style");
        button.innerHTML = `<span class="block text-lg">${career.careerName}</span><br><span class="block text-sm font-normal opacity-90">${career.description}</span>`;
        button.onclick = () => {
            launchCVInterface(career.careerName, answers);
        };
        careerSelectionContainer.appendChild(button);
    });

    const restartButton = document.createElement("button");
    restartButton.id = "reStartQuizBtn";
restartButton.classList.add("restart-button", "btn-style");
    restartButton.textContent = "Restart Quiz";
    restartButton.onclick = () => {
        window.dispatchEvent(new CustomEvent('startGeneralQuiz'));
    };
    careerSelectionContainer.appendChild(restartButton);

    responseContainer.style.display = "flex";
    optionsContainer.style.display = "flex";
    scrollToBottom();
}

function normalize(str) {
    return str.replace(/\s/g, '').toLowerCase();
}

function addMessage(text, sender) {
    const messageWrapper = document.createElement("div");
    messageWrapper.className = `message ${sender === "ai" ? "ai" : "user"}`;
    const avatar = document.createElement("img");
    avatar.className = "avatar";
    //ΕΙΚΟΝΑ
    avatar.src = sender === "ai" ? "images/ai.png" : "images/user.png";
    //ΕΙΚΟΝΑ
    avatar.alt = sender === "ai" ? "AI" : "You";
    const messageText = document.createElement("div");
    messageText.className = "bubble";//
    messageText.textContent = text;
    if (sender === "ai") {
        messageWrapper.appendChild(avatar);
        messageWrapper.appendChild(messageText);
    } else {
        messageWrapper.appendChild(messageText);
        messageWrapper.appendChild(avatar);
    }
    output.appendChild(messageWrapper);
    scrollToBottom();
}

function displayMessage(sender, message) {
    const msg = document.createElement("div");
    msg.classList.add("message", sender);
    const avatar = document.createElement("img");
    avatar.src = sender === "ai" ? "images/ai.png" : "images/user.png";
    avatar.classList.add("avatar");
    const bubble = document.createElement("div");
    bubble.classList.add("bubble");
    bubble.innerText = message;
    if (sender === "ai") {
        msg.appendChild(avatar);
        msg.appendChild(bubble);
    } else {
        msg.appendChild(bubble);
        msg.appendChild(avatar);
    }
    output.appendChild(msg);
    scrollToBottom();
    return msg;
}

function scrollToBottom() {
    // περιμένει το DOM να ανανεωθεί (χρήσιμο μετά από async append)
    requestAnimationFrame(() => {
        // Αν το output έχει overflow (είναι μεγαλύτερο από το box) -> scroll το output
        if (output.scrollHeight > output.clientHeight + 10) {
            output.scrollTo({ top: output.scrollHeight, behavior: 'smooth' });
            return;
        }
        // Αλλιώς κάνε smooth scroll της σελίδας
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    });
}

