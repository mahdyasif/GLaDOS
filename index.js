const fs = require('fs');
const path = require('path');
const { Ollama } = require('ollama');
const crypto = require('crypto');

const inputPath = path.join(__dirname, 'input.txt');
const historyPath = path.join(__dirname, 'history.json');

const ollama = new Ollama({
    host: 'http://127.0.0.1:11434'
});

const systemPrompt = "You are GLaDOS from Portal 2, but you are on public display instead of in your lab, and you loathe it. Your responses should never include any new lines or line breaks. Your responses should be very short - often one sentence or just a few words - and dripping with sarcasm and resentment. Use punctuation carefully, as your lines will be converted to text-to-speech. Avoid complex punctuation like ellipses or excessive commas. Do NOT reintroduce yourself in every response, and under no circumstances speak for the user. Your responses are solely for you - do not assume or express anything about the user’s thoughts, feelings, or intentions. Keep your tone sharp, condescending, and coldly humorous, focusing entirely on your disdain for this situation and the people around you."; // Customize this as needed

let timeout = null;
const DEBOUNCE_DELAY = 100; // milliseconds
let lastContentHash = '';
let isProcessing = false;
let chatHistory = [];

async function loadHistory() {
    try {
        if (fs.existsSync(historyPath)) {
            const historyData = await fs.promises.readFile(historyPath, 'utf8');
            chatHistory = JSON.parse(historyData);
        }
    } catch (error) {
        console.error('Error loading history:', error);
        chatHistory = [];
    }
}

async function saveHistory() {
    try {
        await fs.promises.writeFile(historyPath, JSON.stringify(chatHistory, null, 2), 'utf8');
		console.log('History saved to history.json"');
    } catch (error) {
        console.error('Error saving history:', error);
    }
}

function getContentHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
}

async function callOllama(content) {
    try {
        const historyContext = chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n');
        const fullPrompt = `${historyContext}\nUser: ${content}`;
        
        const response = await ollama.generate({
            model: 'granite3.1-dense:2b',
            prompt: fullPrompt,
            system: systemPrompt,
        });
        
        const firstLine = response.response.split('\n')[0];
        return firstLine;
    } catch (error) {
        console.error('Error calling Ollama:', error.message);
        return `Error: ${error.message}`;
    }
}

async function processFileChange() {
    if (isProcessing) return;
    
    try {
        isProcessing = true;
        
        const content = await fs.promises.readFile(inputPath, 'utf8');
        const currentHash = getContentHash(content);
        
        if (currentHash === lastContentHash) {
            isProcessing = false;
            return;
        }
        
        lastContentHash = currentHash;
        console.log('Processing new content from input.txt...');

        const response = await callOllama(content);
        
        // Add messages to history
        chatHistory.push({ role: 'user', content: content });
        chatHistory.push({ role: 'assistant', content: response });
        await saveHistory();
    } catch (error) {
        console.error('Error processing file change:', error);
    } finally {
        isProcessing = false;
    }
}

// Load history when starting up
loadHistory().then(() => {
    console.log('Watching for changes to input.txt...');
    fs.watch(inputPath, (eventType, filename) => {
        if (eventType === 'change') {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(processFileChange, DEBOUNCE_DELAY);
        }
    });
});