// Global flag to control bot execution
let shouldStop = false;
let scheduledStartTimer = null;
let scheduledStartTime = null;

// Helper function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to update countdown
function updateCountdown(endTime) {
    scheduledStartTime = endTime;
    const countdownElement = document.getElementById('countdown');
    if (!countdownElement) return;

    function update() {
        const now = new Date().getTime();
        const distance = endTime - now;

        if (distance <= 0) {
            countdownElement.textContent = 'Starting...';
            clearInterval(scheduledStartTimer);
            return;
        }

        const hours = Math.floor(distance / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        countdownElement.textContent = `Starting in: ${hours}h ${minutes}m ${seconds}s`;
    }

    update();
    scheduledStartTimer = setInterval(update, 1000);
}

// Helper function to wait for element
async function waitForElement(selector, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element) return element;
        await delay(1000);
    }
    throw new Error(`Element ${selector} not found after ${timeout}ms`);
}

// Helper function to send status updates
function sendStatusUpdate(status, type = 'info') {
    try {
        // Send to popup
        chrome.runtime.sendMessage({
            action: 'statusUpdate',
            status: {
                message: status,
                type: type,
                timestamp: new Date().toISOString()
            }
        });

        // Update panel directly
        addStatusEntry({
            message: status,
            type: type,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error sending status update:', error);
    }
}

// Helper function to get current month from calendar
async function getCurrentMonth() {
    // Find calendar button using attribute selector that matches the pattern
    const monthButton = await waitForElement('[id^="mat-calendar-button-"]');
    const currentMonthText = monthButton.textContent;
    const [currentMonth, currentYear] = currentMonthText.split(' ');
    const currentMonthNum = new Date(`${currentMonth} 1, ${currentYear}`).getMonth() + 1;
    const currentYearNum = parseInt(currentYear);
    return { year: currentYearNum, month: currentMonthNum };
}

// Helper function to check if we're on the selected location
async function isOnSelectedLocation(location) {
    const locationDropdown = await waitForElement("mat-select[panelclass='drop-down-panelcls']");
    const selectedText = locationDropdown.textContent.trim();
    return selectedText.includes(location);
}

// Helper function to refresh data using keyboard navigation
async function refreshData(location) {
    try {
        // Find and focus the location dropdown
        const locationDropdown = await waitForElement("mat-select[panelclass='drop-down-panelcls']");
        locationDropdown.click();
        await delay(300);

        // Get all location options
        const locationOptions = Array.from(document.querySelectorAll('mat-option'));
        if (locationOptions.length < 2) {
            throw new Error('Not enough location options found');
        }

        // Find the current location and the alternate location
        const currentLocationIndex = locationOptions.findIndex(option => option.textContent.includes(location));
        const alternateLocationIndex = currentLocationIndex === 0 ? 1 : 0;

        // Click the alternate location
        locationOptions[alternateLocationIndex].click();
        await delay(300);

        // Click back to the original location
        locationDropdown.click();
        await delay(300);
        locationOptions[currentLocationIndex].click();
        await delay(300);

        return true;
    } catch (error) {
        console.error('Error refreshing data:', error);
        return false;
    }
}

// Main bot function
async function runBot(settings) {
    try {
        shouldStop = false; // Reset stop flag when starting
        sendStatusUpdate('Starting bot with settings: ' + JSON.stringify(settings));
        const { location, targetMonths, searchOnlyTargetMonth } = settings;

        // Wait for location dropdown
        sendStatusUpdate('Looking for location dropdown...');
        const locationDropdown = await waitForElement("mat-select[panelclass='drop-down-panelcls']");
        locationDropdown.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await delay(500);
        locationDropdown.click();
        await delay(500);

        // Select location
        sendStatusUpdate(`Selecting location: ${location}`);
        const locationOptions = await waitForElement('mat-option');
        const targetOption = Array.from(document.querySelectorAll('mat-option'))
            .find(option => option.textContent.includes(location));

        if (targetOption) {
            targetOption.click();
            sendStatusUpdate(`Successfully selected location: ${location}`, 'success');
        } else {
            throw new Error(`Location ${location} not found in options`);
        }

        await delay(1000);

        // Get current month
        const currentMonth = await getCurrentMonth();
        const currentMonthStr = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}`;

        // Check if current month is in target months
        console.log(currentMonthStr);
        console.log(targetMonths);
        sendStatusUpdate(`Current month: ${currentMonthStr}`);
        sendStatusUpdate(`Target months: ${targetMonths}`);
        if (!targetMonths.includes(currentMonthStr)) {
            sendStatusUpdate(`Current month (${currentMonthStr}) is not in target months`, 'warning');
            // if (searchOnlyTargetMonth) {
            //     return;
            // }
        }

        // Start refresh cycle
        while (!shouldStop) {
            // Check if we're on the selected location
            const isOnLocation = await isOnSelectedLocation(location);
            if (!isOnLocation) {
                sendStatusUpdate('Not on selected location, skipping date check...', 'info');
                await delay(500);
                continue;
            }

            // Get current month and check if it's in target months
            const currentMonth = await getCurrentMonth();
            const currentMonthStr = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}`;

            if (!targetMonths.includes(currentMonthStr)) {
                sendStatusUpdate(`Current month (${currentMonthStr}) is not in target months, refreshing...`, 'info');
                // Refresh data using keyboard navigation
                const refreshSuccess = await refreshData(location);
                if (!refreshSuccess) {
                    sendStatusUpdate('Error refreshing data, retrying...', 'warning');
                }
                await delay(1000);
                continue;
            }

            // Check for available dates
            const availableDates = document.querySelectorAll("button.mat-calendar-body-cell.special-date");
            if (availableDates.length > 0) {
                sendStatusUpdate('Found available date!', 'success');
                // Select random date
                const randomDateIndex = Math.floor(Math.random() * availableDates.length);
                availableDates[randomDateIndex].click();
                await delay(2000);

                // Wait for and click time slot
                sendStatusUpdate('Looking for available time slots...');
                const timeSlots = document.querySelectorAll("button.green-button.ng-star-inserted:not(.selected-slot)");
                if (timeSlots.length > 0) {
                    // Click a random time slot
                    const randomTimeSlotIndex = Math.floor(Math.random() * timeSlots.length);
                    timeSlots[randomTimeSlotIndex].click();
                    sendStatusUpdate('Selected random time slot', 'success');
                    await delay(1000);

                    // Verify the slot was selected
                    const selectedSlot = document.querySelector("button.green-button.selected-slot");
                    if (!selectedSlot) {
                        sendStatusUpdate('Failed to select time slot, retrying...', 'warning');
                        continue;
                    }

                    // Check confirmation checkbox
                    sendStatusUpdate('Confirming appointment...');
                    const checkbox = await waitForElement("input#styled-checkbox-1");
                    if (!checkbox.checked) {
                        checkbox.click();
                    }

                    // Click proceed button
                    sendStatusUpdate('Finalizing appointment...');
                    const proceedButton = await waitForElement("button.lrg-common-buttton.light-lanvander-button");
                    proceedButton.click();

                    // Wait and check for confirmation letter
                    await delay(2000);
                    const confirmationLetter = document.querySelector('div.top-main-head');
                    if (confirmationLetter && confirmationLetter.textContent.includes('Confirmation Letter')) {
                        sendStatusUpdate('Successfully booked appointment!', 'success');
                        return;
                    } else {
                        sendStatusUpdate('Appointment was taken by someone else, continuing search...', 'warning');
                        continue;
                    }
                } else {
                    sendStatusUpdate('No time slots available for selected date', 'warning');
                }
            }

            sendStatusUpdate('No available dates found, refreshing...', 'info');

            // Refresh data using keyboard navigation
            const refreshSuccess = await refreshData(location);
            if (!refreshSuccess) {
                sendStatusUpdate('Error refreshing data, retrying...', 'warning');
            }

            // Wait before next check
            await delay(2000);
        }

        if (shouldStop) {
            sendStatusUpdate('Bot stopped by user', 'warning');
        }
    } catch (error) {
        sendStatusUpdate(`Error: ${error.message}`, 'error');
        console.error('Error in bot:', error);
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'injectStatusPanel') {
        // Remove existing panels if any
        const existingPanel = document.getElementById('botStatusPanel');
        const existingControlBar = document.querySelector('.control-bar');
        if (existingPanel) existingPanel.remove();
        if (existingControlBar) existingControlBar.remove();

        // Add styles
        const style = document.createElement('style');
        style.textContent = message.statusCss + `
            .bot-status-panel {
                height: 500px !important;
                display: none;
            }
            
            .bot-status-panel.show {
                display: flex !important;
            }

            .status-container {
                height: calc(100% - 60px) !important;
                overflow-y: auto !important;
                padding: 20px !important;
                background: #f8f9fa !important;
                border-radius: 0 0 16px 16px !important;
            }

            .status-entry {
                margin-bottom: 12px !important;
                padding: 12px 16px !important;
                border-radius: 12px !important;
                background: white !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05) !important;
                border: 1px solid rgba(0, 0, 0, 0.05) !important;
            }

            .status-entry.success {
                background: #e8f5e9 !important;
                border-left: 4px solid #4caf50 !important;
            }

            .status-entry.error {
                background: #ffebee !important;
                border-left: 4px solid #f44336 !important;
            }

            .status-entry.warning {
                background: #fff3e0 !important;
                border-left: 4px solid #ff9800 !important;
            }

            .status-entry.info {
                background: #e3f2fd !important;
                border-left: 4px solid #2196f3 !important;
            }

            .status-entry .timestamp {
                color: #666 !important;
                font-size: 12px !important;
                min-width: 80px !important;
                font-weight: 500 !important;
            }

            .status-entry .message {
                color: #333 !important;
                font-size: 14px !important;
                line-height: 1.4 !important;
            }

            .status-entry.success .message {
                color: #2e7d32 !important;
            }

            .status-entry.error .message {
                color: #c62828 !important;
            }

            .status-entry.warning .message {
                color: #ef6c00 !important;
            }

            .status-entry.info .message {
                color: #1565c0 !important;
            }
        `;
        document.head.appendChild(style);

        // Add panels to page
        const container = document.createElement('div');
        container.innerHTML = message.statusHtml;
        document.body.appendChild(container);

        // Initialize panel functionality
        initializeStatusPanel();
        sendResponse({ success: true });
        return true;
    } else if (message.action === 'scheduleBot') {
        const startTime = message.startTime;
        scheduledStartTime = startTime; // Set the global scheduled start time
        updateCountdown(startTime);
        sendStatusUpdate(`Bot scheduled to start at ${new Date(startTime).toLocaleString()}`, 'info');

        // Schedule the bot to start
        const now = new Date().getTime();
        const delay = startTime - now;

        setTimeout(async () => {
            chrome.storage.local.get(['botSettings'], async (result) => {
                if (result.botSettings) {
                    try {
                        await runBot(result.botSettings);
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                }
            });
        }, delay);

        sendResponse({ success: true });
        return true;
    } else if (message.action === 'startBot') {
        chrome.storage.local.get(['botSettings'], async (result) => {
            if (result.botSettings) {
                try {
                    await runBot(result.botSettings);
                    sendResponse({ success: true });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
            } else {
                sendResponse({ success: false, error: 'No settings found' });
            }
        });
        return true;
    } else if (message.action === 'stopBot') {
        shouldStop = true;
        if (scheduledStartTimer) {
            clearInterval(scheduledStartTimer);
            const countdownElement = document.getElementById('countdown');
            if (countdownElement) {
                countdownElement.textContent = '';
            }
        }
        sendResponse({ success: true });
        return true;
    }
});

function initializeStatusPanel() {
    const titleBar = document.getElementById('statusTitleBar');
    const closeBtn = document.getElementById('statusCloseBtn');
    const controlBar = document.querySelector('.control-bar');
    const showStatusBtn = document.getElementById('showStatusBtn');
    const hideControlBtn = document.getElementById('hideControlBtn');
    const controlStopBtn = document.getElementById('controlStopBtn');
    const statusContainer = document.getElementById('statusContainer');
    const botStatusPanel = document.getElementById('botStatusPanel');
    const controlTimer = document.getElementById('controlTimer');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    // Make window draggable
    if (titleBar) {
        titleBar.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
    }

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

            setTranslate(currentX, currentY, botStatusPanel);
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

    // Show/Hide Status Panel
    if (showStatusBtn) {
        showStatusBtn.addEventListener('click', function () {
            if (botStatusPanel) {
                botStatusPanel.classList.add('show');
            }
        });
    }

    // Close Status Panel
    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            if (botStatusPanel) {
                botStatusPanel.classList.remove('show');
            }
        });
    }

    // Hide/Show Control Bar
    if (hideControlBtn) {
        hideControlBtn.addEventListener('click', function () {
            if (controlBar) {
                controlBar.classList.add('hidden');
                this.textContent = 'Show';
                this.title = 'Show Controls';
            }
        });
    }

    // Show Control Bar on hover near bottom
    document.addEventListener('mousemove', function (e) {
        if (e.clientY > window.innerHeight - 50 && controlBar && hideControlBtn) {
            controlBar.classList.remove('hidden');
            hideControlBtn.textContent = 'Hide';
            hideControlBtn.title = 'Hide Controls';
        }
    });

    // Stop Bot functionality
    if (controlStopBtn) {
        controlStopBtn.addEventListener('click', async function () {
            shouldStop = true;
            this.classList.add('active');
            this.textContent = 'Stopped';
            addStatusEntry({
                message: 'Bot stopped by user',
                type: 'warning',
                timestamp: new Date().toISOString()
            });
        });
    }

    // Update countdown timer
    function updateCountdownTimer() {
        if (controlTimer) {
            if (scheduledStartTime) {
                const now = new Date().getTime();
                const distance = scheduledStartTime - now;

                if (distance <= 0) {
                    controlTimer.textContent = 'Starting...';
                    return;
                }

                const hours = Math.floor(distance / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                controlTimer.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            } else {
                controlTimer.textContent = '00:00:00';
            }
        }
    }

    setInterval(updateCountdownTimer, 1000);
    updateCountdownTimer();
}

function addStatusEntry(status) {
    const statusContainer = document.getElementById('statusContainer');
    if (!statusContainer) return;

    const entry = document.createElement('div');
    entry.className = `status-entry ${status.type}`;

    const timestamp = new Date(status.timestamp).toLocaleTimeString();
    entry.innerHTML = `
        <span class="timestamp">[${timestamp}]</span>
        <span class="message">${status.message}</span>
    `;

    statusContainer.insertBefore(entry, statusContainer.firstChild);
} 