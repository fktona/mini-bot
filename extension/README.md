# US Visa Appointment Finder Chrome Extension

This Chrome extension helps automate the process of finding available US visa appointments.

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `extension` folder
5. The extension should now be installed and visible in your Chrome toolbar

## Usage

1. Navigate to https://www.usvisaappt.com/visaapplicantui/home/appointment/create
2. Click the extension icon in your Chrome toolbar
3. In the popup:
   - Select your desired location
   - Choose your target month (YYYY-MM)
   - Set the number of months to check
4. Click "Start Finding Appointments"

The extension will then:
- Select your chosen location
- Navigate to your target month
- Continuously check for available dates
- Automatically book an appointment when one becomes available

## Features

- No login required - starts directly from the appointment creation page
- User-friendly interface
- Automatic location selection
- Target month navigation
- Continuous date checking
- Automatic appointment booking

## Note

You'll need to add icon files to the `icons` directory before loading the extension:
- icon16.png (16x16 pixels)
- icon48.png (48x48 pixels)
- icon128.png (128x128 pixels)

## Troubleshooting

If the extension doesn't work:
1. Make sure you're on the correct page
2. Check the browser console for error messages
3. Try refreshing the page
4. Ensure you have the latest version of Chrome 