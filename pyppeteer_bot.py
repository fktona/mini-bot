from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import asyncio
from pyppeteer import launch
import uvicorn

app = FastAPI(title="Pyppeteer Bot API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

class BotRequest(BaseModel):
    url: str = "https://www.usvisaappt.com/visaapplicantui/login"
    email: str
    password: str
    location: str
    nextTry: int = 1

@app.get("/")
async def root():
    return FileResponse("static/index.html")

@app.post("/bot/execute")
async def execute_bot(request: BotRequest):
    try:
        # Launch browser
        browser = await launch(
            headless=False,
            args=['--no-sandbox', '--start-maximized']
        )
        page = await browser.newPage()
        
        try:
            # Navigate to login page
            print("Navigating to login page...")
            await page.goto(request.url)
            
            # Wait for and fill in login credentials
            print("Filling in login credentials...")
            await page.waitForSelector("input[formcontrolname='username']")
            await page.type("input[formcontrolname='username']", request.email)
            
            await page.waitForSelector("input[formcontrolname='password']")
            await page.type("input[formcontrolname='password']", request.password)
            
            print("Credentials filled. Please complete the login manually...")
            
            # Wait for PENDING APPOINTMENT REQUEST
            print("Waiting for PENDING APPOINTMENT REQUEST to appear...")
            while True:
                try:
                    pending_request = await page.waitForSelector(
                        "div.create-taskbutton.cursor-pointer-hover",
                        timeout=2000
                    )
                    if pending_request:
                        text = await page.evaluate('(element) => element.textContent', pending_request)
                        if "PENDING APPOINTMENT REQUEST" in text:
                            print("Found PENDING APPOINTMENT REQUEST div!")
                            break
                except:
                    print("Waiting for login to complete...")
                    await asyncio.sleep(2)
                    continue
            
            # Click PENDING APPOINTMENT REQUEST
            print("Clicking PENDING APPOINTMENT REQUEST...")
            await pending_request.click()
            
            # Wait for page load
            await asyncio.sleep(5)
            
            # Find and click location dropdown
            print("Looking for location dropdown...")
            await page.waitForSelector("mat-select[role='combobox']")
            await page.click("mat-select[role='combobox']")
            
            # Wait for dropdown options and select location
            print(f"Selecting location: {request.location}")
            await page.waitForSelector(f"mat-option span:text-is('{request.location}')")
            await page.click(f"mat-option span:text-is('{request.location}')")
            print(f"Successfully selected location: {request.location}")
            
            # Wait for calendar to load
            await asyncio.sleep(2)
            
            # Try to find and click available dates
            for attempt in range(request.nextTry):
                print(f"Attempt {attempt + 1} of {request.nextTry}")
                
                # Check for available dates
                available_dates = await page.querySelectorAll("button.mat-calendar-body-cell.special-date")
                if available_dates:
                    print("Found available date, clicking...")
                    await available_dates[0].click()
                    print("Successfully clicked available date!")
                    return {
                        "status": "success",
                        "message": "Found and clicked available date"
                    }
                else:
                    print("No available dates found in current month")
                
                # If no dates found and we haven't reached max attempts, click next month
                if attempt < request.nextTry - 1:
                    print("Clicking next month button...")
                    next_month = await page.querySelector("button.mat-calendar-next-button")
                    if next_month:
                        await next_month.click()
                        await asyncio.sleep(2)
                    else:
                        print("Could not find next month button")
                        break
                else:
                    print("Reached maximum attempts without finding available dates")
                    return {
                        "status": "no_dates",
                        "message": "No available dates found after checking all months"
                    }
            
            return {
                "status": "success",
                "message": f"Successfully selected location: {request.location}"
            }
            
        finally:
            # Keep the browser open for manual interaction
            pass
            
    except Exception as e:
        print(f"Error occurred: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("pyppeteer_bot:app", host="0.0.0.0", port=8000, reload=True) 