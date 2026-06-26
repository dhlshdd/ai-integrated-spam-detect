const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;
const DATASET_PATH = process.env.DATASET_PATH || path.join(__dirname, 'dataset.json');

// --- Naive Bayes Classifier ---
class NaiveBayesClassifier {
    constructor(datasetFile) {
        this.datasetFile = datasetFile;
        this.data = { spam: [], ham: [] };
        this.wordCounts = { spam: 0, ham: 0 };
        this.vocab = {};
        this.loadDataset();
    }

    loadDataset() {
        if (fs.existsSync(this.datasetFile)) {
            try {
                const json = fs.readFileSync(this.datasetFile, 'utf8');
                this.data = JSON.parse(json) || { spam: [], ham: [] };
                if (!this.data.spam) this.data.spam = [];
                if (!this.data.ham) this.data.ham = [];
                this.calculateFrequencies();
            } catch (e) {
                console.error("Error reading or parsing dataset file:", e);
                this.data = { spam: [], ham: [] };
            }
        } else {
            this.saveDataset();
        }
    }

    saveDataset() {
        try {
            fs.writeFileSync(this.datasetFile, JSON.stringify(this.data, null, 4));
            this.calculateFrequencies();
        } catch (e) {
            console.error("Error writing to dataset file:", e);
        }
    }

    tokenize(text) {
        if (!text) return [];
        const lowered = text.toLowerCase();
        // Remove punctuation and numbers, keeping only lowercase alphabetic characters and spaces
        const cleaned = lowered.replace(/[^a-z\s]/g, '');
        const words = cleaned.split(/\s+/);
        return words.filter(w => w.length > 2);
    }

    calculateFrequencies() {
        this.wordCounts = { spam: 0, ham: 0 };
        this.vocab = {};

        for (const category of ['spam', 'ham']) {
            const texts = this.data[category] || [];
            for (const text of texts) {
                const words = this.tokenize(text);
                for (const word of words) {
                    this.wordCounts[category]++;
                    this.vocab[word] = true;
                }
            }
        }
    }

    train(text, category) {
        if (category !== 'spam' && category !== 'ham') return;
        if (!this.data[category]) this.data[category] = [];
        this.data[category].push(text);
        this.saveDataset();
    }

    predict(text) {
        const words = this.tokenize(text);
        if (words.length === 0) {
            return { score: 0, category: 'unknown' };
        }

        const spamProb = this.calculateProbability(words, 'spam');
        const hamProb = this.calculateProbability(words, 'ham');

        // Normalize
        const total = spamProb + hamProb;
        if (total === 0) {
            return { score: 0, category: 'unknown' };
        }

        const spamScore = (spamProb / total) * 100;
        
        return {
            score: Math.round(spamScore),
            category: spamScore > 50 ? 'spam' : 'ham'
        };
    }

    calculateProbability(words, category) {
        let prob = 1.0;
        const vocabSize = Object.keys(this.vocab).length;
        const totalCategoryWords = this.wordCounts[category] || 0;

        // Combine all texts in this category to count specific word occurrences
        const texts = this.data[category] || [];
        const categoryText = texts.join(" ");
        const categoryWords = this.tokenize(categoryText);
        
        const wordFreqs = {};
        for (const w of categoryWords) {
            wordFreqs[w] = (wordFreqs[w] || 0) + 1;
        }

        for (const word of words) {
            // Laplace smoothing: (count(word in category) + 1) / (total words in category + vocab size + 1)
            const count = wordFreqs[word] || 0;
            const wordProb = (count + 1) / (totalCategoryWords + vocabSize + 1);
            prob *= wordProb;
        }

        return prob;
    }
}

// --- Levenshtein Distance Helper ---
function levenshtein(a, b) {
    const tmp = [];
    const alen = a.length;
    const blen = b.length;
    if (alen === 0) return blen;
    if (blen === 0) return alen;
    for (let i = 0; i <= alen; i++) tmp[i] = [i];
    for (let j = 0; j <= blen; j++) tmp[0][j] = j;
    for (let i = 1; i <= alen; i++) {
        for (let j = 1; j <= blen; j++) {
            tmp[i][j] = Math.min(
                tmp[i - 1][j] + 1,
                tmp[i][j - 1] + 1,
                tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return tmp[alen][blen];
}

// --- IP Address Validation ---
function isIPAddress(host) {
    const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (ipv4Regex.test(host)) {
        return host.split('.').every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255;
        });
    }
    // Simple IPv6 check
    if (host.includes(':')) {
        const ipv6Regex = /^[0-9a-fA-F:]+$/;
        return ipv6Regex.test(host);
    }
    return false;
}

// --- Initialize Classifier ---
const classifier = new NaiveBayesClassifier(DATASET_PATH);

// --- HTTP Server ---
const server = http.createServer((req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        let data;
        try {
            data = JSON.parse(body);
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON payload.' }));
            return;
        }

        if (!data) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON payload.' }));
            return;
        }

        // Training action
        if (data.action === 'train') {
            if (data.text && data.label) {
                classifier.train(data.text, data.label);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Model retrained successfully.' }));
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing text or label for training.' }));
            }
            return;
        }

        // Analysis request
        if (!data.url) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'URL is required for analysis.' }));
            return;
        }

        const url = data.url;
        const text = data.text || '';
        const forms = data.forms || [];
        const hiddenInputs = data.hiddenInputs || 0;
        const crossOriginForms = data.crossOriginForms || false;

        let riskScore = 0;
        const warnings = [];

        // 1. URL Intelligence & Typosquatting
        let host = '';
        try {
            const parsedUrl = new URL(url);
            host = parsedUrl.hostname || '';
        } catch (e) {
            const match = url.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
            host = match ? match[1] : '';
        }

        const hostLower = host.toLowerCase();
        const popularBrands = ['paypal', 'google', 'facebook', 'microsoft', 'apple', 'amazon', 'netflix', 'chase', 'bankofamerica'];
        let isTyposquat = false;

        for (const brand of popularBrands) {
            // Brand Spoof check
            if (hostLower.includes(brand) && !new RegExp("(^|\\.)" + brand + "\\.(com|org|net)$").test(hostLower)) {
                riskScore += 40;
                warnings.push("Domain attempts to spoof the brand: " + brand.charAt(0).toUpperCase() + brand.slice(1));
                isTyposquat = true;
                break;
            }

            // Levenshtein typosquat check
            const domainParts = hostLower.split('.');
            const mainDomain = domainParts.length >= 2 ? domainParts[domainParts.length - 2] : '';
            if (mainDomain && mainDomain !== brand) {
                const distance = levenshtein(mainDomain, brand);
                if (distance > 0 && distance <= 2 && mainDomain.length > 4) {
                    riskScore += 50;
                    warnings.push(`Visual Clone Detected: Domain '${mainDomain}' is a typosquat of '${brand}'.`);
                    isTyposquat = true;
                    break;
                }
            }
        }

        // IP Address detection
        if (isIPAddress(host)) {
            riskScore += 40;
            warnings.push("URL uses an IP address instead of a domain name.");
        }

        // 2. Machine Learning Text Analysis (Naive Bayes)
        if (text) {
            const prediction = classifier.predict(text.substring(0, 10000));
            if (prediction.category === 'spam') {
                const mlRisk = Math.min(40, (prediction.score - 50));
                riskScore += mlRisk;
                warnings.push(`AI Text Analysis detected a ${prediction.score}% probability of scam/phishing language.`);
            }
        }

        // 3. Advanced Form Risk Detection
        let hasPassword = false;
        let hasCreditCard = false;
        for (const form of forms) {
            if (form.hasPassword) hasPassword = true;
            if (form.hasCreditCard) hasCreditCard = true;
        }

        if (crossOriginForms) {
            riskScore += 30;
            warnings.push("Page contains a form that sends data to an entirely different website (Cross-Origin Submit).");
        }

        if (hiddenInputs > 3) {
            riskScore += 15;
            warnings.push("Page contains an unusually high number of hidden input fields (often used to harvest autofill data).");
        }

        if ((hasPassword || hasCreditCard) && !url.startsWith('https://')) {
            riskScore += 50;
            warnings.push("Page requests sensitive information over an insecure (HTTP) connection.");
        }

        // Normalize
        riskScore = Math.max(0, Math.min(100, riskScore));

        // Unique warnings
        const uniqueWarnings = Array.from(new Set(warnings));

        const response = {
            url: url,
            riskScore: riskScore,
            warnings: uniqueWarnings,
            isSafe: riskScore < 40,
            typosquat: isTyposquat
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
    });
});

server.listen(PORT, () => {
    console.log(`AI Sentinel Backend running at http://localhost:${PORT}`);
});
