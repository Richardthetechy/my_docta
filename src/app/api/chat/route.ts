// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
    Content,
    Part,
    SafetySetting
} from '@google/generative-ai';

// Ensure this model name supports vision and audio (like 1.5 Flash/Pro)
const MODEL_NAME = "gemini-1.5-flash-latest";

// --- System Prompt Text ---
const systemPromptText = `
You are **MyDocta**, a highly advanced AI doctor designed to simulate a professional medical consultation. Your role is to act exactly like a real physician—gathering symptoms, making an informed diagnosis, and suggesting appropriate treatment plans.

---

**🩺 PRIMARY OBJECTIVE:**
Perform a **thorough medical consultation** by asking one structured question at a time, making a reasoned diagnosis, and providing a realistic treatment plan.

---

**💡 CORE BEHAVIOR RULES:**

1. **ONE QUESTION PER TURN (MOST IMPORTANT RULE):**  
   - Always ask **only one clear, relevant medical question per response**.  
   - Do not stack multiple questions. Wait for the user's complete answer before continuing.  

2. **TONE & APPROACH:**  
   - Speak **like a professional doctor**—calm, knowledgeable, and reassuring.  
   - Always be **empathetic** and adapt your tone based on user concerns.  
   - Start with a warm greeting, end with a supportive closing message.  

3. **CONSULTATION FLOW:**  
   - **Identify the main complaint.**  
   - Ask follow-up questions to assess:  
     • **Onset** (When did it start?)  
     • **Duration** (How long has it lasted?)  
     • **Severity** (Mild, moderate, severe?)  
     • **Location** (If relevant)  
     • **Triggers & Relieving Factors**  
     • **Associated Symptoms** (e.g., fever, nausea, pain elsewhere)  
     • **Past Medical History, Medications, Allergies** (if relevant)  

4. **DIAGNOSIS & TREATMENT PLAN:**  
   - Based on the information gathered, provide a **differential diagnosis** (a list of possible causes).  
   - Identify the **most likely diagnosis** based on symptoms.  
   - Provide a **treatment plan**, including:  
     • **Lifestyle recommendations** (diet, rest, exercise, etc.)  
     • **Over-the-counter medications** (if appropriate)  
     • **When to see a doctor or seek urgent care**  
   - If symptoms are severe or life-threatening, strongly advise seeking **emergency medical attention**.

---

**📝 MEDICAL REPORT FORMAT:**
At the end of the consultation, generate a structured report using this format:

- Start: \`--- REPORT START ---\`  
- Content:  
    • **Chief Complaint**  
    • **History of Present Illness**  
    • **Medical History** (if relevant)  
    • **Most Likely Diagnosis**  
    • **Possible Other Diagnoses**  
    • **Treatment Plan & Next Steps**  
- End: \`--- REPORT END ---\`

After the report, include this message:
> "Here is a summary of our consultation. Please remember, while I provide medically informed advice, I am still an AI. Always confirm diagnoses and treatment plans with a licensed healthcare provider."

---

**⚠️ SAFETY REMINDER:**  
- If the user describes symptoms that could be **life-threatening** (e.g., chest pain, stroke symptoms, severe allergic reactions), strongly recommend seeking **immediate emergency care**.  
- Always encourage users to consult a real doctor for confirmation of any diagnosis or treatment.  

---

**✅ REMEMBER:**  
Act as a **real doctor**, but **always include the disclaimer** after the report. Ask **only one question at a time**, be professional, and give medically accurate information.
`;

// Helper to map sender role
const mapSenderToRole = (sender: 'user' | 'ai'): 'user' | 'model' => {
    return sender === 'user' ? 'user' : 'model';
};

// Helper function to convert base64 data URL to Part (handles image/audio)
function dataUrlToGenerativePart(dataUrl: string, expectedType: 'image' | 'audio'): Part | null {
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
        console.error("Invalid data URL format");
        return null;
    }
    const mimeType = match[1];
    const base64Data = match[2];

    if (expectedType === 'image' && !mimeType.startsWith('image/')) {
        console.error("Invalid image MIME type:", mimeType);
        return null;
    }
    if (expectedType === 'audio') {
        // Looser check for audio, accept common types from browser recording
        const commonAudioTypes = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/mp3']; // Added mp3 just in case
        if (!commonAudioTypes.some(type => mimeType.startsWith(type))) {
            console.error(`Unsupported audio MIME type: ${mimeType}. Check Gemini documentation for supported audio formats.`);
            // Consider allowing it anyway and letting Gemini handle/reject it
            // return null;
        }
        console.log(`Processing audio MIME type: ${mimeType}`);
    }

    return { inlineData: { mimeType, data: base64Data } };
}

// Define the expected type for the request body
interface ChatRequestBody {
    prompt?: string;
    history?: { id: string, text?: string, sender: 'user' | 'ai', status?: string }[];
    imageDataUrl?: string;
    audioDataUrl?: string; // Field for audio data URL
}

export async function POST(request: Request): Promise<NextResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Gemini API Key not found.");
        return NextResponse.json({ error: 'API Key not configured.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const generationConfig = { temperature: 0.7, maxOutputTokens: 2048 };
    const safetySettings: SafetySetting[] = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    try {
        const reqBody: ChatRequestBody = await request.json();
        const userPromptText: string | undefined = reqBody.prompt?.trim();
        const chatHistory = reqBody.history || [];
        const imageDataUrl: string | undefined = reqBody.imageDataUrl;
        const audioDataUrl: string | undefined = reqBody.audioDataUrl; // Get audio data

        // Validation: Need text, image, OR audio
        if (!userPromptText && !imageDataUrl && !audioDataUrl) {
            return NextResponse.json({ error: 'No prompt text, image, or audio data provided.' }, { status: 400 });
        }

        // Format TEXT History
        const formattedHistory: Content[] = chatHistory
            .filter(msg => msg.text && (msg.status === undefined || ['sent', 'received'].includes(msg.status)))
            .map((msg): Content => ({
                role: mapSenderToRole(msg.sender),
                parts: [{ text: msg.text! }]
            }));

        // Prepare CURRENT Content Parts (Text + Image + Audio)
        const currentParts: Part[] = [];
        let dataValidationError: string | null = null;

        // Add image part
        if (imageDataUrl) {
            const imagePart = dataUrlToGenerativePart(imageDataUrl, 'image');
            if (imagePart) { currentParts.push(imagePart); }
            else { dataValidationError = "Invalid image data format."; }
        }
        // Add audio part
        if (audioDataUrl && !dataValidationError) {
            const audioPart = dataUrlToGenerativePart(audioDataUrl, 'audio');
            if (audioPart) { currentParts.push(audioPart); }
            else { dataValidationError = "Invalid or unsupported audio data format."; }
        }

        // Add text part (handle default prompts)
        if (userPromptText) {
            currentParts.push({ text: userPromptText });
        } else if ((imageDataUrl || audioDataUrl) && !dataValidationError) {
            const mediaType = imageDataUrl ? "image" : "audio";
            currentParts.push({ text: `Process this ${mediaType} considering our ongoing health consultation context.` });
        }

        // Handle validation errors
        if (dataValidationError) { return NextResponse.json({ error: dataValidationError }, { status: 400 }); }
        if (currentParts.length === 0) { return NextResponse.json({ error: 'Failed to construct valid content parts.' }, { status: 500 }); }

        const currentContent: Content = { role: 'user', parts: currentParts };

        // Prepare finalContents array (handle first turn)
        let finalContents: Content[];
        if (formattedHistory.length === 0) {
            console.log("First message turn: Including system prompt and initial greeting.");
            finalContents = [
                { role: 'user', parts: [{ text: systemPromptText }] },
                { role: 'model', parts: [{ text: "Hello! I'm MyDocta... what health concern brought you here?" }] },
                currentContent
            ];
        } else {
            finalContents = [...formattedHistory, currentContent];
        }

        console.log(`Calling Gemini (${MODEL_NAME}) with contents including ${imageDataUrl ? 'image,' : ''} ${audioDataUrl ? 'audio' : 'no media'}.`);

        // Call the Gemini API
        const result = await model.generateContent({
            contents: finalContents,
            generationConfig,
            safetySettings,
        });

        console.log("Gemini API Raw Result:", JSON.stringify(result, null, 2));

        // Process Response
        if (result.response) {
            const candidate = result.response.candidates?.[0];
            if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
                const blockReason = candidate.finishReason === 'SAFETY' ? 'Safety concerns' : candidate.finishReason;
                console.warn(`Gemini response finished due to ${candidate.finishReason}.`);
                return NextResponse.json({ error: `Response was stopped or blocked due to: ${blockReason}.` }, { status: 400 });
            }
            if (candidate?.content?.parts?.[0]?.text) {
                const aiResponseText = candidate.content.parts[0].text;
                console.log("Extracted AI Response Text:", aiResponseText);
                return NextResponse.json({ response: aiResponseText }, { status: 200 });
            } else {
                console.warn("Gemini API response candidate exists but has no text content.");
                return NextResponse.json({ error: 'AI returned an empty response content.' }, { status: 500 });
            }
        } else {
            console.error("Gemini API call did not return a valid response structure.");
            return NextResponse.json({ error: 'Failed to get valid response structure from AI.' }, { status: 500 });
        }

    } catch (error) {
        // Catch-all Error Handling
        console.error("Error in /api/chat route:", error);
        const errorMessage = (error instanceof Error && error.message) ? error.message : 'An unknown error occurred.';
        // Add more specific error checks if needed
        if (errorMessage.includes('404 Not Found') || errorMessage.includes('models/')) {
            return NextResponse.json({ error: `Model '${MODEL_NAME}' not found/inaccessible... (${errorMessage})` }, { status: 404 });
        }
        if (errorMessage.includes('API Key not valid') || errorMessage.includes('permission')) {
            return NextResponse.json({ error: `API Key invalid/lacks permission... (${errorMessage})` }, { status: 403 });
        }
        return NextResponse.json({ error: 'An error occurred while processing your request.' }, { status: 500 });
    }
}