// AI Sentinel Content Script

// 1. Extract Text for NLP Analysis
function getPageText() {
    return document.body.innerText.substring(0, 5000); 
}

// 2. Advanced Form Risk & DOM Analysis
function analyzeDOM() {
    const forms = Array.from(document.querySelectorAll('form'));
    let hasCrossOriginForms = false;
    let hiddenInputsCount = 0;

    const currentOrigin = window.location.origin;

    const analyzedForms = forms.map(form => {
        // Check for cross-origin submissions
        const action = form.getAttribute('action');
        if (action && action.startsWith('http')) {
            try {
                const actionUrl = new URL(action);
                if (actionUrl.origin !== currentOrigin) {
                    hasCrossOriginForms = true;
                }
            } catch (e) {}
        }

        const inputs = Array.from(form.querySelectorAll('input'));
        
        // Count hidden inputs (stealth data harvesting)
        inputs.forEach(input => {
            if (input.type === 'hidden' || input.style.display === 'none' || input.style.opacity === '0') {
                hiddenInputsCount++;
            }
        });

        const hasPassword = inputs.some(input => input.type === 'password');
        const hasCreditCard = inputs.some(input => 
            input.name.toLowerCase().includes('card') || 
            input.id.toLowerCase().includes('card') ||
            input.name.toLowerCase().includes('cvv') ||
            input.placeholder.toLowerCase().includes('card number')
        );
        return { hasPassword, hasCreditCard };
    });

    return { 
        forms: analyzedForms, 
        hasCrossOriginForms, 
        hiddenInputsCount 
    };
}

// 3. Inject Warning Banner
function injectWarning(data) {
    if (data.riskScore < 50) return; 

    // Prevent duplicate banners
    if (document.getElementById('ai-sentinel-warning-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'ai-sentinel-warning-banner';
    
    Object.assign(banner.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        backgroundColor: '#ef4444', 
        color: 'white',
        padding: '16px',
        textAlign: 'center',
        zIndex: '999999999',
        fontFamily: '"Inter", "Segoe UI", sans-serif',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    });

    const title = document.createElement('strong');
    title.innerText = '⚠️ AI Sentinel Warning: High Risk Site Detected';
    title.style.fontSize = '18px';
    title.style.display = 'block';
    title.style.marginBottom = '8px';
    
    const explanationList = document.createElement('ul');
    explanationList.style.listStyleType = 'none';
    explanationList.style.padding = '0';
    explanationList.style.margin = '0 0 12px 0';
    explanationList.style.fontSize = '14px';

    data.warnings.forEach(warning => {
        const li = document.createElement('li');
        li.innerText = `• ${warning}`;
        explanationList.appendChild(li);
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.innerText = 'I understand the risks, let me proceed';
    Object.assign(dismissBtn.style, {
        backgroundColor: 'transparent',
        border: '1px solid white',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 'bold',
        transition: 'background-color 0.2s'
    });
    
    dismissBtn.onmouseover = () => { dismissBtn.style.backgroundColor = 'rgba(255,255,255,0.2)'; };
    dismissBtn.onmouseout = () => { dismissBtn.style.backgroundColor = 'transparent'; };
    
    dismissBtn.onclick = () => {
        banner.remove();
    };

    banner.appendChild(title);
    banner.appendChild(explanationList);
    banner.appendChild(dismissBtn);

    document.body.prepend(banner);
}

// Main execution
const domInfo = analyzeDOM();
const pageData = {
    url: window.location.href,
    text: getPageText(),
    forms: domInfo.forms,
    hiddenInputs: domInfo.hiddenInputsCount,
    crossOriginForms: domInfo.hasCrossOriginForms
};

// Send data to background script for analysis
chrome.runtime.sendMessage({ action: 'analyzePage', ...pageData }, (response) => {
    if (response && response.success && response.data) {
        injectWarning(response.data);
    }
});
