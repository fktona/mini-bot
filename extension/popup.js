document.addEventListener('DOMContentLoaded', function () {
    const locationSelect = document.getElementById('location');
    const monthInputsContainer = document.getElementById('monthInputs');
    const addMonthButton = document.getElementById('addMonth');
    const searchOnlyTargetMonthCheckbox = document.getElementById('searchOnlyTargetMonth');
    const startButton = document.getElementById('startBot');
    const stopButton = document.getElementById('stopBot');
    const clearLogButton = document.getElementById('clearLog');
    const statusDiv = document.getElementById('status');
    const statusLog = document.getElementById('statusLog');

    let isRunning = false;

    // Common visa locations
    const locations = [
        'Lagos',
        'Abuja',
    ];

    // Populate locations
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        locationSelect.appendChild(option);
    });

    // Set default target month to next month
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const defaultMonth = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    document.querySelector('.targetMonth').value = defaultMonth;

    // Add month input
    function addMonthInput() {
        const monthInputDiv = document.createElement('div');
        monthInputDiv.className = 'month-input';
        monthInputDiv.innerHTML = `
            <input type="month" class="targetMonth">
            <button class="removeMonth">×</button>
        `;
        monthInputsContainer.appendChild(monthInputDiv);

        // Show remove buttons if more than one input
        const removeButtons = document.querySelectorAll('.removeMonth');
        removeButtons.forEach(button => {
            button.style.display = removeButtons.length > 1 ? 'inline-block' : 'none';
        });

        // Add remove button handler
        monthInputDiv.querySelector('.removeMonth').addEventListener('click', function () {
            monthInputDiv.remove();
            // Update remove button visibility
            const remainingButtons = document.querySelectorAll('.removeMonth');
            remainingButtons.forEach(button => {
                button.style.display = remainingButtons.length > 1 ? 'inline-block' : 'none';
            });
        });
    }

    // Add month button handler
    addMonthButton.addEventListener('click', addMonthInput);

    // Listen for status updates from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'statusUpdate') {
            addStatusLogEntry(message.status);
        }
    });

    function addStatusLogEntry(status) {
        const entry = document.createElement('div');
        entry.className = `log-entry ${status.type}`;

        const timestamp = new Date(status.timestamp).toLocaleTimeString();
        entry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${status.message}`;

        statusLog.insertBefore(entry, statusLog.firstChild);

        // Update the main status display
        showStatus(status.message, status.type);
    }

    // Check if current page is valid for the extension
    async function checkValidPage() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return false;
        console.log(tab.url);

        return tab.url.includes('usvisaappt.com/visaapplicantui/home/appointment/create');
    }

    startButton.addEventListener('click', async function () {
        if (isRunning) return;

        const location = locationSelect.value;
        const targetMonths = Array.from(document.querySelectorAll('.targetMonth'))
            .map(input => input.value)
            .filter(value => value !== ''); // Filter out empty values
        const searchOnlyTargetMonth = searchOnlyTargetMonthCheckbox.checked;
        const scheduledStart = document.getElementById('scheduledStart').value;

        if (!location) {
            showStatus('Please select a location', 'error');
            return;
        }

        if (targetMonths.length === 0) {
            showStatus('Please select at least one target month', 'error');
            return;
        }

        // Check if we're on the correct page
        const isValidPage = await checkValidPage();
        if (!isValidPage) {
            showStatus('Please navigate to the US Visa appointment page first', 'error');
            return;
        }

        isRunning = true;
        startButton.disabled = true;
        stopButton.disabled = false;

        // Store settings in chrome.storage
        await chrome.storage.local.set({
            botSettings: {
                location,
                targetMonths,
                searchOnlyTargetMonth,
                scheduledStart
            }
        });

        // Inject status panel into current page
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'injectStatusPanel',
                    statusHtml: `
                        <div id="botStatusPanel" class="bot-status-panel">
                            <div class="title-bar" id="statusTitleBar">
                                <h2>Bot Status</h2>
                                <div class="controls">
                                    <button class="control-button close" id="statusCloseBtn" title="Close">×</button>
                                </div>
                            </div>
                            <div class="status-container" id="statusContainer"></div>
                        </div>
                        <div class="control-bar" style="display: flex !important; visibility: visible !important; opacity: 1 !important;">
                            <button class="action-button stop" id="controlStopBtn" title="Stop Bot">Stop</button>
                            <div class="timer" id="controlTimer">00:00:00</div>
                            <button class="action-button show-status" id="showStatusBtn" title="Show Status">Status</button>
                            <button class="action-button hide" id="hideControlBtn" title="Hide Controls">Hide</button>
                        </div>
                    `,
                    statusCss: `
                        .bot-status-panel {
                            position: fixed;
                            bottom: 20px;
                            left: 20px;
                            width: 400px;
                            background: #ffffff;
                            border-radius: 16px;
                            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                            z-index: 9999;
                            display: none;
                            flex-direction: column;
                            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                            backdrop-filter: blur(10px);
                            border: 1px solid rgba(255, 255, 255, 0.2);
                            transition: all 0.3s ease;
                        }

                        .bot-status-panel.show {
                            display: flex;
                        }

                        .title-bar {
                            background: linear-gradient(135deg, #1a237e, #283593);
                            color: white;
                            padding: 16px 20px;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            cursor: move;
                            user-select: none;
                            border-radius: 16px 16px 0 0;
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                        }

                        .title-bar h2 {
                            margin: 0;
                            font-size: 18px;
                            font-weight: 600;
                            letter-spacing: 0.5px;
                            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                        }

                        .controls {
                            display: flex;
                            gap: 12px;
                            justify-content: flex-end;
                            align-items: center;
                            margin-right: 5px;
                            min-width: 360px;
                        }

                        .control-button {
                            width: 32px;
                            height: 32px;
                            min-width: 32px;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 16px;
                            font-weight: 600;
                            transition: all 0.2s ease;
                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                            opacity: 0.9;
                            flex-shrink: 0;
                            background: rgba(255, 255, 255, 0.1);
                            backdrop-filter: blur(4px);
                        }

                        .control-button:hover {
                            transform: translateY(-2px);
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                            opacity: 1;
                        }

                        .minimize {
                            background: rgba(255, 255, 255, 0.15);
                        }

                        .minimize:hover {
                            background: rgba(255, 255, 255, 0.25);
                        }

                        .close {
                            background: rgba(239, 83, 80, 0.9);
                        }

                        .close:hover {
                            background: rgba(229, 57, 53, 0.9);
                        }

                        .stop {
                            position: fixed;
                            bottom: 30px;
                            right: 30px;
                            width: 56px;
                            height: 56px;
                            min-width: 56px;
                            border-radius: 50%;
                            background: rgba(76, 175, 80, 0.95);
                            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
                            font-size: 24px;
                            z-index: 10000;
                            display: none;
                        }

                        .stop:hover {
                            background: rgba(67, 160, 71, 0.95);
                            transform: translateY(-3px) scale(1.05);
                            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
                        }

                        .stop.active {
                            background: rgba(239, 83, 80, 0.95);
                            display: flex;
                        }

                        .stop.active:hover {
                            background: rgba(229, 57, 53, 0.95);
                        }

                        .countdown {
                            color: white;
                            font-size: 14px;
                            font-weight: 600;
                            padding: 8px 16px;
                            background: rgba(255, 255, 255, 0.15);
                            border-radius: 8px;
                            backdrop-filter: blur(4px);
                            margin-right: 12px;
                            white-space: nowrap;
                            flex-shrink: 0;
                            border: 1px solid rgba(255, 255, 255, 0.1);
                        }

                        .status-container {
                            flex: 1;
                            overflow-y: auto;
                            padding: 20px;
                            background: #f8f9fa;
                            border-radius: 0 0 16px 16px;
                            scrollbar-width: thin;
                            scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
                            height: 500px;
                        }

                        .status-container.show {
                            display: block;
                            height: 500px;
                        }

                        .status-container::-webkit-scrollbar {
                            width: 8px;
                        }

                        .status-container::-webkit-scrollbar-track {
                            background: transparent;
                        }

                        .status-container::-webkit-scrollbar-thumb {
                            background-color: rgba(0, 0, 0, 0.2);
                            border-radius: 4px;
                        }

                        .status-entry {
                            margin-bottom: 12px;
                            padding: 12px 16px;
                            border-radius: 12px;
                            animation: fadeIn 0.3s ease-in-out;
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
                            border: 1px solid rgba(0, 0, 0, 0.05);
                        }

                        .status-entry .timestamp {
                            color: #666;
                            font-size: 12px;
                            min-width: 80px;
                            font-weight: 500;
                        }

                        .status-entry .message {
                            flex: 1;
                            font-size: 14px;
                            line-height: 1.4;
                        }

                        .success {
                            background: #e8f5e9;
                            border-left: 4px solid #4caf50;
                        }

                        .error {
                            background: #ffebee;
                            border-left: 4px solid #f44336;
                        }

                        .warning {
                            background: #fff3e0;
                            border-left: 4px solid #ff9800;
                        }

                        .info {
                            background: #e3f2fd;
                            border-left: 4px solid #2196f3;
                        }

                        @keyframes fadeIn {
                            from {
                                opacity: 0;
                                transform: translateY(-8px);
                            }
                            to {
                                opacity: 1;
                                transform: translateY(0);
                            }
                        }

                        .minimized {
                            height: 64px !important;
                            transition: height 0.3s ease;
                        }

                        .minimized .status-container {
                            display: none;
                        }

                        .minimized .stop {
                            bottom: 74px;
                        }

                        .control-bar {
                            position: fixed !important;
                            bottom: 20px !important;
                            left: 50% !important;
                            transform: translateX(-50%) !important;
                            background: rgba(26, 35, 126, 0.95) !important;
                            padding: 12px 24px !important;
                            border-radius: 50px !important;
                            display: flex !important;
                            align-items: center !important;
                            gap: 20px !important;
                            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2) !important;
                            backdrop-filter: blur(10px) !important;
                            border: 1px solid rgba(255, 255, 255, 0.1) !important;
                            z-index: 2147483647 !important;
                            visibility: visible !important;
                            opacity: 1 !important;
                        }

                        .control-bar.hidden {
                            visibility: hidden;
                            opacity: 0;
                            transform: translateX(-50%) translateY(100%);
                            transition: all 0.3s ease;
                        }

                        .control-bar .timer {
                            color: white !important;
                            font-size: 16px !important;
                            font-weight: 600 !important;
                            padding: 8px 16px !important;
                            background: rgba(255, 255, 255, 0.1) !important;
                            border-radius: 8px !important;
                            min-width: 120px !important;
                            text-align: center !important;
                        }

                        .control-bar .action-button {
                            width: 40px !important;
                            height: 40px !important;
                            border-radius: 50% !important;
                            border: none !important;
                            background: rgba(255, 255, 255, 0.1) !important;
                            color: white !important;
                            font-size: 18px !important;
                            cursor: pointer !important;
                            display: flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            transition: all 0.2s ease !important;
                            visibility: visible !important;
                            opacity: 1 !important;
                        }

                        .control-bar .action-button:hover {
                            background: rgba(255, 255, 255, 0.2);
                            transform: scale(1.1);
                        }

                        .control-bar .action-button.stop {
                            background: rgba(76, 175, 80, 0.9);
                        }

                        .control-bar .action-button.stop:hover {
                            background: rgba(67, 160, 71, 0.9);
                        }

                        .control-bar .action-button.stop.active {
                            background: rgba(239, 83, 80, 0.9);
                        }

                        .control-bar .action-button.stop.active:hover {
                            background: rgba(229, 57, 53, 0.9);
                        }

                        .control-bar .action-button.hide {
                            background: rgba(255, 255, 255, 0.1);
                        }

                        .control-bar .action-button.hide:hover {
                            background: rgba(255, 255, 255, 0.2);
                        }

                        .control-bar .action-button.show-status {
                            background: rgba(33, 150, 243, 0.9);
                        }

                        .control-bar .action-button.show-status:hover {
                            background: rgba(30, 136, 229, 0.9);
                        }
                    `,
                    statusJs: `
                        (function() {
                            function initializeControls() {
                                const controlBar = document.querySelector('.control-bar');
                                const statusPanel = document.getElementById('botStatusPanel');
                                const showStatusBtn = document.getElementById('showStatusBtn');
                                const hideControlBtn = document.getElementById('hideControlBtn');
                                const closeStatusBtn = document.getElementById('statusCloseBtn');
                                const stopBtn = document.getElementById('controlStopBtn');
                                const timer = document.getElementById('controlTimer');

                                if (!controlBar) {
                                    console.error('Control bar not found');
                                    return;
                                }

                                // Force control bar to be visible
                                controlBar.style.display = 'flex';
                                controlBar.style.visibility = 'visible';
                                controlBar.style.opacity = '1';

                                // Show status panel
                                showStatusBtn.addEventListener('click', function() {
                                    if (statusPanel) {
                                        statusPanel.classList.add('show');
                                    }
                                });

                                // Close status panel
                                if (closeStatusBtn) {
                                    closeStatusBtn.addEventListener('click', function() {
                                        if (statusPanel) {
                                            statusPanel.classList.remove('show');
                                        }
                                    });
                                }

                                // Hide control bar
                                hideControlBtn.addEventListener('click', function() {
                                    controlBar.classList.add('hidden');
                                    this.textContent = '▲';
                                    this.title = 'Show Controls';
                                });

                                // Show control bar on hover near bottom of screen
                                document.addEventListener('mousemove', function(e) {
                                    if (e.clientY > window.innerHeight - 50) {
                                        controlBar.classList.remove('hidden');
                                        hideControlBtn.textContent = '▼';
                                        hideControlBtn.title = 'Hide Controls';
                                    }
                                });

                                // Update timer
                                function updateTimer() {
                                    const now = new Date();
                                    const hours = String(now.getHours()).padStart(2, '0');
                                    const minutes = String(now.getMinutes()).padStart(2, '0');
                                    const seconds = String(now.getSeconds()).padStart(2, '0');
                                    if (timer) {
                                        timer.textContent = \`\${hours}:\${minutes}:\${seconds}\`;
                                    }
                                }

                                setInterval(updateTimer, 1000);
                                updateTimer();
                            }

                            // Try to initialize immediately
                            initializeControls();

                            // Also try after a short delay to ensure DOM is ready
                            setTimeout(initializeControls, 1000);
                        })();
                    `
                });

                // Start the bot or schedule it
                if (scheduledStart) {
                    const startTime = new Date(scheduledStart).getTime();
                    const now = new Date().getTime();
                    if (startTime > now) {
                        await chrome.tabs.sendMessage(tab.id, {
                            action: 'scheduleBot',
                            startTime: startTime
                        });
                        showStatus(`Bot scheduled to start at ${new Date(scheduledStart).toLocaleString()}`, 'info');
                    } else {
                        showStatus('Scheduled time must be in the future', 'error');
                        isRunning = false;
                        startButton.disabled = false;
                        stopButton.disabled = true;
                        return;
                    }
                } else {
                    await chrome.tabs.sendMessage(tab.id, { action: 'startBot' });
                    showStatus('Bot started!', 'success');
                }
            } catch (error) {
                showStatus('Error: Please refresh the page and try again', 'error');
                isRunning = false;
                startButton.disabled = false;
                stopButton.disabled = true;
            }
        }
    });

    stopButton.addEventListener('click', async function () {
        if (!isRunning) return;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            try {
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'stopBot' });
                if (response && response.success) {
                    showStatus('Bot stopped', 'warning');
                    isRunning = false;
                    startButton.disabled = false;
                    stopButton.disabled = true;
                } else {
                    showStatus('Error stopping bot', 'error');
                }
            } catch (error) {
                showStatus('Error: Please refresh the page and try again', 'error');
                // Reset UI state even if there's an error
                isRunning = false;
                startButton.disabled = false;
                stopButton.disabled = true;
            }
        }
    });

    clearLogButton.addEventListener('click', function () {
        statusLog.innerHTML = '';
        statusDiv.style.display = 'none';
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
    }

    // Initialize button states
    stopButton.disabled = true;

    // Check page validity on popup open
    checkValidPage().then(isValid => {
        if (!isValid) {
            showStatus('Please navigate to the US Visa appointment page first', 'warning');
            startButton.disabled = true;
        }
    });
}); 