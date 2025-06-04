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
    const { email, password, location, nextTry = 1, targetMonth } = req.body;

    try {
        // Launch browser
        const browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-dev-shm-usage', '--start-maximized'],
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' // Path to latest Chrome
        });

        const page = await browser.newPage();

        try {
            // Navigate to login page with retry logic
            console.log("Navigating to login page...");
            let navigationSuccess = false;
            while (!navigationSuccess) {
                try {
                    await page.goto('https://www.usvisaappt.com/visaapplicantui/login', {
                        waitUntil: 'networkidle0',
                        timeout: 0 // No timeout
                    });
                    navigationSuccess = true;
                    console.log("Successfully navigated to login page");
                } catch (error) {
                    console.log("Navigation failed, retrying...");
                    await delay(2000);
                }
            }

            // Fill in login credentials
            console.log("Filling in login credentials...");
            let usernameInput;
            while (true) {
                try {
                    usernameInput = await page.$("input[formcontrolname='username']");
                    if (usernameInput) {
                        await usernameInput.type(email);
                        break;
                    }
                } catch (error) {
                    console.log("Still searching for username input...");
                }
                await delay(1000);
            }

            let passwordInput;
            while (true) {
                try {
                    passwordInput = await page.$("input[formcontrolname='password']");
                    if (passwordInput) {
                        await passwordInput.type(password);
                        break;
                    }
                } catch (error) {
                    console.log("Still searching for password input...");
                }
                await delay(1000);
            }

            console.log("Credentials filled. Please complete the login manually...");

            // Wait for login form to disappear
            console.log("Waiting for login to complete...");
            while (true) {
                try {
                    const loginForm = await page.$("input[formcontrolname='username']");
                    if (!loginForm) {
                        console.log("Login form no longer visible - login appears successful");
                        break;
                    }
                } catch (error) {
                    console.log("Login form not found - proceeding...");
                    break;
                }
                await delay(1000);
            }

            // Now wait for PENDING APPOINTMENT REQUEST
            console.log("Looking for buttons with class 'create-taskbutton cursor-pointer-hover'...");
            let buttons;
            while (true) {
                try {
                    buttons = await page.$$('.create-taskbutton.cursor-pointer-hover');
                    if (buttons.length > 0) {
                        console.log(`Found ${buttons.length} buttons`);
                        const buttonToClick = buttons.length > 1 ? buttons[1] : buttons[0];
                        console.log("Clicking button...");
                        await page.evaluate(button => button.click(), buttonToClick);
                        console.log("Button clicked successfully!");
                        break;
                    }
                } catch (error) {
                    console.log("Still searching for buttons...");
                }
                await delay(1000);
            }

            console.log("Waiting for page to load after click...");
            await delay(5000);

            console.log("Looking for location dropdown...");
            let locationDropdown;
            while (true) {
                try {
                    locationDropdown = await page.$("mat-select[panelclass='drop-down-panelcls']");
                    if (locationDropdown) {
                        console.log("Found location dropdown, scrolling to it...");
                        await page.evaluate(dropdown => {
                            dropdown.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, locationDropdown);
                        await delay(1000);
                        break;
                    }
                } catch (error) {
                    console.log("Still searching for location dropdown...");
                }
                await delay(1000);
            }

            console.log("Clicking location dropdown using JavaScript...");

            await page.evaluate(dropdown => dropdown.click(), locationDropdown);
            await delay(1000);

            console.log(`Selecting location: ${location}`);
            let locationOption;
            while (true) {
                try {
                    // Try different selector patterns
                    locationOption = await page.$$('mat-option');
                    if (locationOption.length > 0) {
                        // Find the option with matching text
                        for (const option of locationOption) {
                            const text = await page.evaluate(el => el.textContent, option);
                            if (text.includes(location)) {
                                console.log("Found matching location option, clicking...");
                                await page.evaluate(option => option.click(), option);
                                console.log(`Successfully selected location: ${location}`);
                                break;
                            }
                        }
                        break;
                    }
                } catch (error) {
                    console.log("Still searching for location options...");
                }
                await delay(1000);
            }

            await delay(2000);

            console.log("Starting month search cycle...");
            const maxCycles = 3;

            if (targetMonth) {
                console.log(`Navigating to target month: ${targetMonth}`);
                const [targetYear, targetMonthNum] = targetMonth.split('-').map(Number);

                // First navigate to target month
                while (true) {
                    let currentMonthText;
                    while (true) {
                        try {
                            currentMonthText = await page.evaluate(() => {
                                const monthElement = document.querySelector('#mat-calendar-button-2');
                                return monthElement ? monthElement.textContent : '';
                            });

                            if (currentMonthText) {
                                console.log({ currentMonthText });
                                break;
                            }
                        } catch (error) {
                            console.log("Still waiting for calendar button...");
                        }
                        await delay(1000);
                    }

                    const [currentMonth, currentYear] = currentMonthText.split(' ');
                    const currentMonthNum = new Date(`${currentMonth} 1, ${currentYear}`).getMonth() + 1;
                    const currentYearNum = parseInt(currentYear);

                    console.log({ currentMonth, currentYear: currentYearNum, currentMonthNum, targetYear, targetMonthNum });

                    if (currentYearNum === targetYear && currentMonthNum === targetMonthNum) {
                        console.log("Reached target month");
                        break;
                    }

                    // Determine if we need to go forward or backward
                    const shouldGoForward = (currentYearNum < targetYear) ||
                        (currentYearNum === targetYear && currentMonthNum < targetMonthNum);

                    // Click next or previous month button
                    const buttonSelector = shouldGoForward ?
                        "button.mat-focus-indicator.mat-calendar-next-button.mat-icon-button.mat-button-base" :
                        "button.mat-focus-indicator.mat-calendar-previous-button.mat-icon-button.mat-button-base";

                    let monthButton;
                    while (true) {
                        try {
                            monthButton = await page.$(buttonSelector);
                            if (monthButton) {
                                const isDisabled = await page.evaluate(button => {
                                    return button.disabled || button.getAttribute('aria-disabled') === 'true';
                                }, monthButton);

                                if (isDisabled) {
                                    console.log("Reached month limit, stopping navigation");
                                    break;
                                }

                                console.log(`Clicking ${shouldGoForward ? 'next' : 'previous'} month button...`);
                                await page.evaluate(button => button.click(), monthButton);
                                await delay(2000); // Wait for calendar to update
                                break;
                            }
                        } catch (error) {
                            console.log(`Still searching for ${shouldGoForward ? 'next' : 'previous'} month button...`);
                        }
                        await delay(1000);
                    }
                }

                // Now start the refresh cycle
                while (true) {
                    console.log("Starting refresh cycle...");

                    // Check for available dates in target month
                    let availableDates;
                    while (true) {
                        try {
                            availableDates = await page.$$("button.mat-calendar-body-cell.special-date");
                            if (availableDates.length > 0) {
                                console.log("Found available date in target month, clicking...");
                                await page.evaluate(date => date.click(), availableDates[0]);
                                console.log("Successfully clicked available date!");
                                console.log("Looking for available time slots...");
                                await delay(2000); // Give time for time slots to load

                                // Wait for and click the first available time slot
                                let timeSlot;
                                while (true) {
                                    try {
                                        timeSlot = await page.$("button.green-button");
                                        if (timeSlot) {
                                            console.log("Found available time slot, clicking...");
                                            await page.evaluate(slot => slot.click(), timeSlot);
                                            console.log("Successfully selected time slot!");
                                            break;
                                        }
                                    } catch (error) {
                                        console.log("Still searching for time slot...");
                                    }
                                    await delay(1000);
                                }

                                // Find and check the checkbox
                                console.log("Looking for confirmation checkbox...");
                                await delay(2000); // Give time for checkbox to load
                                let checkbox;
                                while (true) {
                                    try {
                                        checkbox = await page.$("input#styled-checkbox-1");
                                        if (checkbox) {
                                            const isChecked = await page.evaluate(cb => cb.checked, checkbox);
                                            if (!isChecked) {
                                                console.log("Checking confirmation checkbox...");
                                                await page.evaluate(cb => cb.click(), checkbox);
                                                console.log("Successfully checked confirmation checkbox!");
                                            }
                                            break;
                                        }
                                    } catch (error) {
                                        console.log("Still searching for checkbox...");
                                    }
                                    await delay(1000);
                                }

                                // Click the Select POST and Proceed button
                                console.log("Looking for Select POST and Proceed button...");
                                await delay(2000); // Give time for button to be clickable
                                let proceedButton;
                                while (true) {
                                    try {
                                        proceedButton = await page.$("button.lrg-common-buttton");
                                        if (proceedButton) {
                                            console.log("Clicking Select POST and Proceed button...");
                                            await page.evaluate(button => button.click(), proceedButton);
                                            console.log("Successfully clicked Select POST and Proceed button!");
                                            break;
                                        }
                                    } catch (error) {
                                        console.log("Still searching for proceed button...");
                                    }
                                    await delay(1000);
                                }

                                // Wait for 30 seconds to ensure success
                                console.log("Waiting for 30 seconds to ensure success...");
                                await delay(30000);
                                console.log("Wait complete, proceeding to return success...");

                                return res.json({
                                    status: "success",
                                    message: "Found and clicked available date, time slot, confirmed appointment, and proceeded to next step"
                                });
                            }
                            break;
                        } catch (error) {
                            console.log("Still searching for available dates...");
                        }
                        await delay(1000);
                    }

                    // Go forward one month
                    console.log("Going forward one month...");
                    let nextMonth;
                    while (true) {
                        try {
                            nextMonth = await page.$("button.mat-focus-indicator.mat-calendar-next-button.mat-icon-button.mat-button-base");
                            if (nextMonth) {
                                const isDisabled = await page.evaluate(button => {
                                    return button.disabled || button.getAttribute('aria-disabled') === 'true';
                                }, nextMonth);

                                if (isDisabled) {
                                    console.log("Cannot go forward, reached month limit");
                                    break;
                                }

                                await page.evaluate(button => button.click(), nextMonth);
                                await delay(2000);
                                break;
                            }
                        } catch (error) {
                            console.log("Still searching for next month button...");
                        }
                        await delay(1000);
                    }

                    // Go back to target month
                    console.log("Going back to target month...");
                    while (true) {
                        let currentMonthText;
                        while (true) {
                            try {
                                currentMonthText = await page.evaluate(() => {
                                    const monthElement = document.querySelector('#mat-calendar-button-2');
                                    return monthElement ? monthElement.textContent : '';
                                });

                                if (currentMonthText) {
                                    break;
                                }
                            } catch (error) {
                                console.log("Still waiting for calendar button...");
                            }
                            await delay(1000);
                        }

                        const [currentMonth, currentYear] = currentMonthText.split(' ');
                        const currentMonthNum = new Date(`${currentMonth} 1, ${currentYear}`).getMonth() + 1;
                        const currentYearNum = parseInt(currentYear);

                        if (currentYearNum === targetYear && currentMonthNum === targetMonthNum) {
                            console.log("Back at target month");
                            break;
                        }

                        let prevMonth;
                        while (true) {
                            try {
                                prevMonth = await page.$("button.mat-focus-indicator.mat-calendar-previous-button.mat-icon-button.mat-button-base");
                                if (prevMonth) {
                                    await page.evaluate(button => button.click(), prevMonth);
                                    await delay(2000);
                                    break;
                                }
                            } catch (error) {
                                console.log("Still searching for previous month button...");
                            }
                            await delay(1000);
                        }
                    }

                    // Wait before next refresh cycle
                    console.log("Waiting before next refresh cycle...");
                    await delay(5000);
                }
            }

            for (let cycle = 0; cycle < maxCycles; cycle++) {
                console.log(`Starting cycle ${cycle + 1} of ${maxCycles}`);

                // First go forward
                console.log("Checking forward months...");
                for (let attempt = 0; attempt < nextTry; attempt++) {
                    console.log(`Checking month ${attempt + 1} forward`);
                    try {
                        let availableDates;
                        while (true) {
                            try {
                                availableDates = await page.$$("button.mat-calendar-body-cell.special-date");
                                if (availableDates.length > 0) {
                                    console.log("Found available date, clicking...");
                                    await page.evaluate(date => date.click(), availableDates[0]);
                                    console.log("Successfully clicked available date!");
                                    console.log("Looking for available time slots...");
                                    await delay(2000); // Give time for time slots to load

                                    // Wait for and click the first available time slot
                                    let timeSlot;
                                    while (true) {
                                        try {
                                            timeSlot = await page.$("button.green-button");
                                            if (timeSlot) {
                                                console.log("Found available time slot, clicking...");
                                                await page.evaluate(slot => slot.click(), timeSlot);
                                                console.log("Successfully selected time slot!");
                                                break;
                                            }
                                        } catch (error) {
                                            console.log("Still searching for time slot...");
                                        }
                                        await delay(1000);
                                    }

                                    // Find and check the checkbox
                                    console.log("Looking for confirmation checkbox...");
                                    await delay(2000); // Give time for checkbox to load
                                    let checkbox;
                                    while (true) {
                                        try {
                                            checkbox = await page.$("input#styled-checkbox-1");
                                            if (checkbox) {
                                                const isChecked = await page.evaluate(cb => cb.checked, checkbox);
                                                if (!isChecked) {
                                                    console.log("Checking confirmation checkbox...");
                                                    await page.evaluate(cb => cb.click(), checkbox);
                                                    console.log("Successfully checked confirmation checkbox!");
                                                }
                                                break;
                                            }
                                        } catch (error) {
                                            console.log("Still searching for checkbox...");
                                        }
                                        await delay(1000);
                                    }

                                    // Click the Select POST and Proceed button
                                    console.log("Looking for Select POST and Proceed button...");
                                    await delay(2000); // Give time for button to be clickable
                                    let proceedButton;
                                    while (true) {
                                        try {
                                            proceedButton = await page.$("button.lrg-common-buttton");
                                            if (proceedButton) {
                                                console.log("Clicking Select POST and Proceed button...");
                                                await page.evaluate(button => button.click(), proceedButton);
                                                console.log("Successfully clicked Select POST and Proceed button!");
                                                break;
                                            }
                                        } catch (error) {
                                            console.log("Still searching for proceed button...");
                                        }
                                        await delay(1000);
                                    }

                                    // Wait for 30 seconds to ensure success
                                    console.log("Waiting for 30 seconds to ensure success...");
                                    await delay(30000);
                                    console.log("Wait complete, proceeding to return success...");

                                    return res.json({
                                        status: "success",
                                        message: "Found and clicked available date, time slot, confirmed appointment, and proceeded to next step"
                                    });
                                }
                                break;
                            } catch (error) {
                                console.log("Still searching for available dates...");
                            }
                            await delay(1000);
                        }
                    } catch (error) {
                        console.log("No available dates found in current month");
                    }

                    if (attempt < nextTry - 1) {
                        console.log("Clicking next month button...");
                        let nextMonth;
                        while (true) {
                            try {
                                nextMonth = await page.$("button.mat-focus-indicator.mat-calendar-next-button.mat-icon-button.mat-button-base");
                                if (nextMonth) {
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
                                    break;
                                }
                            } catch (error) {
                                console.log("Still searching for next month button...");
                            }
                            await delay(1000);
                        }
                        await delay(2000);
                    }
                }

                // Then go back to start
                console.log("Going back to start month...");
                for (let attempt = 0; attempt < nextTry; attempt++) {
                    console.log(`Going back month ${attempt + 1}`);
                    try {
                        let availableDates;
                        while (true) {
                            try {
                                availableDates = await page.$$("button.mat-calendar-body-cell.special-date");
                                if (availableDates.length > 0) {
                                    console.log("Found available date while going back, clicking...");
                                    await page.evaluate(date => date.click(), availableDates[0]);
                                    console.log("Successfully clicked available date!");
                                    return res.json({
                                        status: "success",
                                        message: "Found and clicked available date while going back"
                                    });
                                }
                                break;
                            } catch (error) {
                                console.log("Still searching for available dates...");
                            }
                            await delay(1000);
                        }
                    } catch (error) {
                        console.log("No available dates found in current month");
                    }

                    if (attempt >= nextTry - 1) {
                        console.log("Reached nextTry limit, stopping backward navigation");
                        break;
                    }

                    console.log("Checking previous month button...");
                    let prevMonth;
                    while (true) {
                        try {
                            prevMonth = await page.$("button.mat-focus-indicator.mat-calendar-previous-button.mat-icon-button.mat-button-base");
                            if (prevMonth) {
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
                                break;
                            }
                        } catch (error) {
                            console.log("Still searching for previous month button...");
                        }
                        await delay(1000);
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