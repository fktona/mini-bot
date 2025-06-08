document.addEventListener('DOMContentLoaded', function () {
    const locationSelect = document.getElementById('location');
    const targetMonthInput = document.getElementById('targetMonth');
    const nextTryInput = document.getElementById('nextTry');
    const startButton = document.getElementById('startBot');
    const statusDiv = document.getElementById('status');

    // Common visa locations
    const locations = [
        'Mumbai',
        'Delhi',
        'Chennai',
        'Hyderabad',
        'Kolkata',
        'Bangalore'
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
    targetMonthInput.value = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;

    startButton.addEventListener('click', async function () {
        const location = locationSelect.value;
        const targetMonth = targetMonthInput.value;
        const nextTry = parseInt(nextTryInput.value);

        if (!location) {
            showStatus('Please select a location', 'error');
            return;
        }

        // Store settings in chrome.storage
        await chrome.storage.local.set({
            botSettings: {
                location,
                targetMonth,
                nextTry
            }
        });

        // Send message to content script
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.tabs.sendMessage(tab.id, { action: 'startBot' });
            showStatus('Bot started!', 'success');
        } else {
            showStatus('Please navigate to the appointment page first', 'error');
        }
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
    }
}); 