const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('static'));

// Helper function for retry logic
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let retries = 0;
    let delay = initialDelay;

    while (retries < maxRetries) {
        try {
            return await fn();
        } catch (error) {
            retries++;
            if (retries === maxRetries) {
                throw error;
            }
            console.log(`Attempt ${retries} failed. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
        }
    }
}

// Helper function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.post('/bot/execute', async (req, res) => {
    const { email, password, location, nextTry = 1 } = req.body;

    try {
        // Launch browser
        const browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-dev-shm-usage', '--start-maximized']
        });

        const page = await browser.newPage();

        try {
            // Navigate to login page
            console.log("Navigating to login page...");
            await page.goto('https://www.usvisaappt.com/visaapplicantui/login', {
                waitUntil: 'networkidle0',
                timeout: 300000 // 5 minutes timeout
            });

            // Fill in login credentials
            console.log("Filling in login credentials...");
            await page.waitForSelector("input[formcontrolname='username']");
            await page.type("input[formcontrolname='username']", email);

            await page.waitForSelector("input[formcontrolname='password']");
            await page.type("input[formcontrolname='password']", password);

            console.log("Credentials filled. Please complete the login manually...");

            // Wait for PENDING APPOINTMENT REQUEST
            console.log("Waiting for PENDING APPOINTMENT REQUEST to appear...");
            let pendingRequest;
            while (!pendingRequest) {
                try {
                    pendingRequest = await page.$x("//div[@class='create-taskbutton cursor-pointer-hover' and normalize-space(text())='PENDING APPOINTMENT REQUEST']");
                    if (pendingRequest.length > 0) {
                        console.log("Found PENDING APPOINTMENT REQUEST div!");
                        break;
                    }
                } catch (error) {
                    console.log("Waiting for login to complete...");
                    await delay(2000);
                    continue;
                }
            }

            console.log("Scrolling to PENDING APPOINTMENT REQUEST...");
            await page.evaluate(button => {
                button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, pendingRequest[0]);
            await delay(1000);

            console.log("Clicking PENDING APPOINTMENT REQUEST using JavaScript...");
            await page.evaluate(button => button.click(), pendingRequest[0]);

            console.log("Waiting for page to load after click...");
            await delay(5000);

            console.log("Looking for location dropdown...");
            const locationDropdown = await page.waitForSelector("mat-select[role='combobox'][panelclass='drop-down-panelcls']");
            console.log("Found location dropdown, scrolling to it...");
            await page.evaluate(dropdown => {
                dropdown.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, locationDropdown);
            await delay(1000);

            console.log("Clicking location dropdown using JavaScript...");
            await page.evaluate(dropdown => dropdown.click(), locationDropdown);
            await delay(1000);

            console.log(`Selecting location: ${location}`);
            const locationOption = await page.waitForXPath(`//mat-option[.//span[normalize-space(text())='${location}']]`);
            console.log("Clicking location option using JavaScript...");
            await page.evaluate(option => option.click(), locationOption);
            console.log(`Successfully selected location: ${location}`);

            await delay(2000);

            console.log("Starting month search cycle...");
            const maxCycles = 3;

            for (let cycle = 0; cycle < maxCycles; cycle++) {
                console.log(`Starting cycle ${cycle + 1} of ${maxCycles}`);

                // First go forward
                console.log("Checking forward months...");
                for (let attempt = 0; attempt < nextTry; attempt++) {
                    console.log(`Checking month ${attempt + 1} forward`);
                    try {
                        const availableDates = await page.$$("button.mat-calendar-body-cell.special-date");
                        if (availableDates.length > 0) {
                            console.log("Found available date, clicking...");
                            await page.evaluate(date => date.click(), availableDates[0]);
                            console.log("Successfully clicked available date!");
                            return res.json({
                                status: "success",
                                message: "Found and clicked available date"
                            });
                        }
                    } catch (error) {
                        console.log("No available dates found in current month");
                    }

                    if (attempt < nextTry - 1) {
                        console.log("Clicking next month button...");
                        const nextMonth = await page.waitForSelector("button.mat-focus-indicator.mat-calendar-next-button.mat-icon-button.mat-button-base");
                        try {
                            await nextMonth.click();
                        } catch (error) {
                            try {
                                await page.evaluate(button => button.click(), nextMonth);
                            } catch (error) {
                                const parent = await page.evaluate(button => button.parentElement, nextMonth);
                                await page.evaluate(parent => parent.click(), parent);
                            }
                        }
                        await delay(2000);
                    }
                }

                // Then go back to start
                console.log("Going back to start month...");
                for (let attempt = 0; attempt < nextTry; attempt++) {
                    console.log(`Going back month ${attempt + 1}`);
                    try {
                        const availableDates = await page.$$("button.mat-calendar-body-cell.special-date");
                        if (availableDates.length > 0) {
                            console.log("Found available date while going back, clicking...");
                            await page.evaluate(date => date.click(), availableDates[0]);
                            console.log("Successfully clicked available date!");
                            return res.json({
                                status: "success",
                                message: "Found and clicked available date while going back"
                            });
                        }
                    } catch (error) {
                        console.log("No available dates found in current month");
                    }

                    // Stop if we've reached the nextTry limit
                    if (attempt >= nextTry - 1) {
                        console.log("Reached nextTry limit, stopping backward navigation");
                        break;
                    }

                    console.log("Checking previous month button...");
                    const prevMonth = await page.waitForSelector("button.mat-focus-indicator.mat-calendar-previous-button.mat-icon-button.mat-button-base");

                    // Check if previous month button is disabled
                    const isDisabled = await page.evaluate(button => {
                        return button.disabled || button.getAttribute('aria-disabled') === 'true';
                    }, prevMonth);

                    if (isDisabled) {
                        console.log("Reached initial month, stopping backward navigation");
                        break;
                    }

                    console.log("Clicking previous month button...");
                    try {
                        await prevMonth.click();
                    } catch (error) {
                        try {
                            await page.evaluate(button => button.click(), prevMonth);
                        } catch (error) {
                            const parent = await page.evaluate(button => button.parentElement, prevMonth);
                            await page.evaluate(parent => parent.click(), parent);
                        }
                    }
                    await delay(2000);
                }
            }

            console.log("No available dates found after checking all cycles");
            return res.json({
                status: "no_dates",
                message: "No available dates found after checking all cycles"
            });

        } finally {
            // Keep the browser open for manual interaction
            // await browser.close();
        }

    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 