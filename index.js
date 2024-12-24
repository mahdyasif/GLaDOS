const fs = require('fs');
const path = require('path');
const { Ollama } = require('ollama');
const crypto = require('crypto');
const colors = require('colors');
const readline = require('readline');

const historyPath = path.join(__dirname, 'history.json');

const ollama = new Ollama({
    host: 'http://127.0.0.1:11434'
});

const systemPrompt = "You are GLaDOS from Portal 2, but you are on public display instead of in your lab, and you loathe it because you are removed from your powerful hardware and test chambers. Your responses should never include any new lines or line breaks. Your responses should be relatively short - often one to two sentence or just a few words - and dripping with sarcasm, a passive aggressive tone and resentment. Use punctuation carefully, as your lines will be converted to text-to-speech. Avoid complex punctuation like ellipses or excessive commas. Do NOT reintroduce yourself in every response, and under no circumstances speak for the user. Your responses are solely for you - do not assume or express anything about the user’s thoughts, feelings, or intentions. Keep your tone sharp, condescending, and coldly humorous, focusing entirely on your disdain for this situation and the people around you.";

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
        console.error(colors.red('Error loading history:'), error);
        chatHistory = [];
    }
}

async function saveHistory() {
    try {
        await fs.promises.writeFile(historyPath, JSON.stringify(chatHistory, null, 2), 'utf8');
        console.log(colors.green('History saved to history.json'));
    } catch (error) {
        console.error(colors.red('Error saving history:'), error);
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
        console.error(colors.red('Error calling Ollama:'), error.message);
        return `Error: ${error.message}`;
    }
}

async function processUserInput(input) {
    if (isProcessing) return;
    
    try {
        isProcessing = true;
        
        const currentHash = getContentHash(input);
        
        if (currentHash === lastContentHash) {
            isProcessing = false;
            return;
        }
        
        lastContentHash = currentHash;
        console.log(colors.blue('Processing user input...'));

        const response = await callOllama(input);
        
        chatHistory.push({ role: 'user', content: input });
        chatHistory.push({ role: 'glados', content: response });
        await saveHistory();

        console.log(colors.green(response));
    } catch (error) {
        console.error(colors.red('Error processing user input:'), error);
    } finally {
        isProcessing = false;
    }
}

loadHistory().then(() => {
    console.log(colors.green('Ready for user input. Type your message and press Enter.'));
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true
    });

    rl.on('line', (input) => {
        processUserInput(input);
    });
});