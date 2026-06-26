document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    const navInstallBtn = document.getElementById('navInstallBtn');
    const installModal = document.getElementById('installModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const finishInstallBtn = document.getElementById('finishInstallBtn');

    const simUrlInput = document.getElementById('simUrl');
    const simTextInput = document.getElementById('simText');
    const simHiddenInput = document.getElementById('simHidden');
    const simCrossOriginCheckbox = document.getElementById('simCrossOrigin');
    const runSimBtn = document.getElementById('runSimBtn');

    const mockBadge = document.getElementById('mockBadge');
    const mockCircle = document.getElementById('mockCircle');
    const mockScoreText = document.getElementById('mockScoreText');
    const mockWarningsList = document.getElementById('mockWarningsList');
    const presetButtons = document.querySelectorAll('.btn-preset');

    // --- Modal Logic ---
    function openModal() {
        installModal.classList.add('active');
        // Trigger the download automatically when they click
        const link = document.createElement('a');
        link.href = 'extension.zip';
        link.download = 'extension.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function closeModal() {
        installModal.classList.remove('active');
    }

    downloadZipBtn.addEventListener('click', openModal);
    navInstallBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
    });
    closeModalBtn.addEventListener('click', closeModal);
    finishInstallBtn.addEventListener('click', closeModal);

    // Close on clicking outside content
    installModal.addEventListener('click', (e) => {
        if (e.target === installModal) {
            closeModal();
        }
    });

    // --- Simulated Heuristics (Local JS Port) ---
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

    function isIPAddress(host) {
        const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
        if (ipv4Regex.test(host)) {
            return host.split('.').every(part => {
                const num = parseInt(part, 10);
                return num >= 0 && num <= 255;
            });
        }
        return host.includes(':') && /^[0-9a-fA-F:]+$/.test(host);
    }

    // A simplified keyword scanner representing the Naive Bayes probability for the client simulation
    function predictTextSpamScore(text) {
        if (!text) return 0;
        const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
        
        const spamKeywords = ['urgent', 'verify', 'suspension', 'prize', 'unauthorized', 'lottery', 'banking', 'restrict', 'parcel', 'validate', 'login', 'secure', 'wallet', 'crypto', 'giveaway'];
        let matchedCount = 0;
        
        spamKeywords.forEach(kw => {
            if (words.includes(kw)) {
                matchedCount++;
            }
        });

        if (matchedCount === 0) return 0;
        if (matchedCount === 1) return 65; // Moderate risk
        if (matchedCount === 2) return 85; // High risk
        return 100; // Extreme risk
    }

    function runSimulation() {
        const url = simUrlInput.value;
        const text = simTextInput.value;
        const hiddenInputs = parseInt(simHiddenInput.value, 10) || 0;
        const crossOrigin = simCrossOriginCheckbox.checked;

        let riskScore = 0;
        const warnings = [];

        // 1. Domain intelligence
        let host = '';
        try {
            const parsed = new URL(url);
            host = parsed.hostname || '';
        } catch (e) {
            const match = url.match(/^https?:\/\/([^/?#]+)/i);
            host = match ? match[1] : url;
        }

        const hostLower = host.toLowerCase();
        const popularBrands = ['paypal', 'google', 'facebook', 'microsoft', 'apple', 'amazon', 'netflix', 'chase', 'bankofamerica'];
        let isTyposquat = false;

        for (const brand of popularBrands) {
            // Brand spoof
            if (hostLower.includes(brand) && !new RegExp("(^|\\.)" + brand + "\\.(com|org|net)$").test(hostLower)) {
                riskScore += 40;
                warnings.push(`Domain attempts to spoof the brand: ${brand.charAt(0).toUpperCase() + brand.slice(1)}`);
                isTyposquat = true;
                break;
            }

            // Levenshtein typosquat
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

        if (isIPAddress(host)) {
            riskScore += 40;
            warnings.push("URL uses an IP address instead of a domain name.");
        }

        // 2. ML Text scan
        const textSpamScore = predictTextSpamScore(text);
        if (textSpamScore > 50) {
            const mlRisk = Math.min(40, textSpamScore - 50);
            riskScore += mlRisk;
            warnings.push(`AI Text Analysis detected a ${textSpamScore}% probability of scam/phishing language.`);
        }

        // 3. Form audits
        const textLower = text.toLowerCase();
        const hasPassword = textLower.includes('password') || textLower.includes('passcode') || textLower.includes('sign in');
        const hasCreditCard = textLower.includes('card') || textLower.includes('cvv') || textLower.includes('banking');

        if (crossOrigin) {
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

        // Update UI Dashboard Mockup
        updateMockupUI(riskScore, warnings);
    }

    function updateMockupUI(score, warnings) {
        mockScoreText.textContent = score;
        mockCircle.setAttribute('stroke-dasharray', `${score}, 100`);

        let color = '#10b981'; // Green
        let badgeText = 'Safe';
        let badgeClass = 'safe';
        let itemClass = 'safe-item';

        if (score >= 60) {
            color = '#ef4444'; // Red
            badgeText = 'High Risk';
            badgeClass = 'danger';
            itemClass = 'danger-item';
        } else if (score >= 30) {
            color = '#f59e0b'; // Yellow
            badgeText = 'Suspicious';
            badgeClass = 'warning';
            itemClass = 'warning-item';
        }

        mockCircle.setAttribute('stroke', color);
        mockBadge.textContent = badgeText;
        mockBadge.className = `mockup-badge ${badgeClass}`;

        mockWarningsList.innerHTML = '';
        if (warnings.length > 0) {
            warnings.forEach(warning => {
                const li = document.createElement('li');
                li.className = itemClass;
                li.textContent = warning;
                mockWarningsList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.className = 'safe-item';
            li.textContent = 'No suspicious indicators detected.';
            mockWarningsList.appendChild(li);
        }
    }

    // Preset configurations
    const presets = {
        scam: {
            url: 'https://secure-paypa1-validation.com',
            text: 'URGENT: Your account access has been restricted. Validate your identity immediately to restore bank access and avoid permanent suspension.',
            hidden: 4,
            crossOrigin: true
        },
        safe: {
            url: 'https://wikipedia.org/wiki/Chocolate_Cake',
            text: 'Welcome to Wikipedia, the free encyclopedia that anyone can edit. Today we are talking about chocolate cake ingredients and cooking release notes.',
            hidden: 0,
            crossOrigin: false
        },
        insecure: {
            url: 'http://my-quick-banking-portal.net',
            text: 'Sign in to access your credit card dashboard. Enter your passcode and verify your security questions.',
            hidden: 0,
            crossOrigin: true
        }
    };

    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            presetButtons.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');

            const presetType = btn.getAttribute('data-preset');
            const data = presets[presetType];

            simUrlInput.value = data.url;
            simTextInput.value = data.text;
            simHiddenInput.value = data.hidden;
            simCrossOriginCheckbox.checked = data.crossOrigin;

            runSimulation();
        });
    });

    // Run scanner simulation
    runSimBtn.addEventListener('click', runSimulation);

    // Initial run
    runSimulation();
});
