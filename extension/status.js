document.addEventListener('DOMContentLoaded', function () {
    const titleBar = document.getElementById('titleBar');
    const minimizeBtn = document.getElementById('minimizeBtn');
    const closeBtn = document.getElementById('closeBtn');
    const stopBtn = document.getElementById('stopBtn');
    const statusContainer = document.getElementById('statusContainer');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    // Make window draggable
    titleBar.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target === titleBar) {
            isDragging = true;
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            setTranslate(currentX, currentY, document.body);
        }
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }

    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    // Minimize/Maximize functionality
    minimizeBtn.addEventListener('click', function () {
        document.body.classList.toggle('minimized');
        minimizeBtn.textContent = document.body.classList.contains('minimized') ? '+' : '−';
    });

    // Close functionality
    closeBtn.addEventListener('click', function () {
        window.close();
    });

    // Stop bot functionality
    stopBtn.addEventListener('click', async function () {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'stopBot' });
                if (response && response.success) {
                    stopBtn.classList.add('active');
                    stopBtn.textContent = '⏹';
                    addStatusEntry({
                        message: 'Bot stopped by user',
                        type: 'warning',
                        timestamp: new Date().toISOString()
                    });
                } else {
                    addStatusEntry({
                        message: 'Error stopping bot',
                        type: 'error',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        } catch (error) {
            addStatusEntry({
                message: 'Error: Please refresh the page and try again',
                type: 'error',
                timestamp: new Date().toISOString()
            });
        }
    });

    // Listen for status updates from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'statusUpdate') {
            addStatusEntry(message.status);
            // Reset stop button if bot is running
            if (message.status.type === 'info' && message.status.message.includes('Starting bot')) {
                stopBtn.classList.remove('active');
                stopBtn.textContent = '⏹';
            }
        }
    });

    function addStatusEntry(status) {
        const entry = document.createElement('div');
        entry.className = `status-entry ${status.type}`;

        const timestamp = new Date(status.timestamp).toLocaleTimeString();
        entry.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <span class="message">${status.message}</span>
        `;

        statusContainer.insertBefore(entry, statusContainer.firstChild);
    }
}); 