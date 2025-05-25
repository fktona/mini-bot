from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from pydantic import BaseModel
import uvicorn
import time

app = FastAPI(title="Selenium Bot API")

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
    maxCycles: int = 3  # Default to 3 cycles, -1 means infinite

@app.get("/")
async def root():
    return FileResponse("static/index.html")

@app.post("/bot/execute")
async def execute_bot(request: BotRequest):
    try:
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--start-maximized")

        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        wait = WebDriverWait(driver, 300) 

        try:
            print("Navigating to login page...")
            driver.get(request.url)
            
            print("Filling in login credentials...")
            email_input = wait.until(
                EC.presence_of_element_located((By.XPATH, "//input[@formcontrolname='username']"))
            )
            email_input.send_keys(request.email)
            
            password_input = wait.until(
                EC.presence_of_element_located((By.XPATH, "//input[@formcontrolname='password']"))
            )
            password_input.send_keys(request.password)
            
            print("Credentials filled. Please complete the login manually...")
            
            print("Waiting for PENDING APPOINTMENT REQUEST to appear...")
            pending_request = None
            while not pending_request:
                try:
                    pending_request = driver.find_element(By.XPATH, "//div[@class='create-taskbutton cursor-pointer-hover' and normalize-space(text())='PENDING APPOINTMENT REQUEST']")
                    if pending_request.is_displayed():
                        print("Found PENDING APPOINTMENT REQUEST div!")
                        break
                except:
                    print("Waiting for login to complete...")
                    time.sleep(2)
                    continue
            
            print("Scrolling to PENDING APPOINTMENT REQUEST...")
            driver.execute_script("arguments[0].scrollIntoView(true);", pending_request)
            time.sleep(1)  
            
            print("Clicking PENDING APPOINTMENT REQUEST using JavaScript...")
            driver.execute_script("arguments[0].click();", pending_request)
            
            print("Waiting for page to load after click...")
            time.sleep(5)
            
            print("Looking for location dropdown...")
            location_dropdown = wait.until(
                EC.presence_of_element_located((By.XPATH, "//mat-select[@role='combobox' and @panelclass='drop-down-panelcls']"))
            )
            print("Found location dropdown, scrolling to it...")
            driver.execute_script("arguments[0].scrollIntoView(true);", location_dropdown)
            time.sleep(1)
            
            print("Clicking location dropdown using JavaScript...")
            driver.execute_script("arguments[0].click();", location_dropdown)
            
            time.sleep(1)
            
            print(f"Selecting location: {request.location}")
            location_option = wait.until(
                EC.presence_of_element_located((By.XPATH, f"//mat-option[.//span[normalize-space(text())='{request.location}']]"))
            )
            print("Clicking location option using JavaScript...")
            driver.execute_script("arguments[0].click();", location_option)
            print(f"Successfully selected location: {request.location}")

            time.sleep(2)

            print("Starting month search cycle...")
            max_cycles = request.maxCycles  # Use the value from request
            cycle = 0
            while max_cycles == -1 or cycle < max_cycles:  # Loop indefinitely if maxCycles is -1
                print(f"Starting cycle {cycle + 1}" + (" (infinite mode)" if max_cycles == -1 else f" of {max_cycles}"))
                
                # First go forward
                print("Checking forward months...")
                for attempt in range(request.nextTry):
                    print(f"Checking month {attempt + 1} forward")
                    try:
                        available_dates = driver.find_elements(By.XPATH, "//button[@class='mat-calendar-body-cell special-date']")
                        if available_dates:
                            print("Found available date, clicking...")
                            driver.execute_script("arguments[0].click();", available_dates[0])
                            print("Successfully clicked available date!")
                            
                            # Wait for and click the first available time slot
                            print("Looking for available time slots...")
                            time.sleep(2)  # Give time for time slots to load
                            time_slot = wait.until(
                                EC.presence_of_element_located((By.XPATH, "//button[contains(@class, 'green-button')]"))
                            )
                            print("Found available time slot, clicking...")
                            driver.execute_script("arguments[0].click();", time_slot)
                            print("Successfully selected time slot!")
                            
                            # Find and check the checkbox
                            print("Looking for confirmation checkbox...")
                            time.sleep(2)  # Give time for checkbox to load
                            checkbox = wait.until(
                                EC.presence_of_element_located((By.XPATH, "//input[@id='styled-checkbox-1']"))
                            )
                            if not checkbox.is_selected():
                                print("Checking confirmation checkbox...")
                                driver.execute_script("arguments[0].click();", checkbox)
                                print("Successfully checked confirmation checkbox!")
                            
                            # Click the Select POST and Proceed button
                            print("Looking for Select POST and Proceed button...")
                            time.sleep(2)  # Give time for button to be clickable
                            proceed_button = wait.until(
                                EC.element_to_be_clickable((By.XPATH, "//button[contains(@class, 'lrg-common-buttton') and contains(text(), 'Select POST and Proceed')]"))
                            )
                            print("Clicking Select POST and Proceed button...")
                            driver.execute_script("arguments[0].click();", proceed_button)
                            print("Successfully clicked Select POST and Proceed button!")
                            
                            # Wait for 30 seconds to ensure success
                            print("Waiting for 30 seconds to ensure success...")
                            time.sleep(30)
                            print("Wait complete, proceeding to return success...")
                            
                            return {
                                "status": "success",
                                "message": "Found and clicked available date, time slot, confirmed appointment, and proceeded to next step"
                            }
                    except:
                        print("No available dates found in current month")
                    
                    if attempt < request.nextTry - 1:
                        print("Clicking next month button...")
                        next_month = wait.until(
                            EC.visibility_of_element_located((By.XPATH, "//button[@class='mat-focus-indicator mat-calendar-next-button mat-icon-button mat-button-base']"))
                        )
                        try:
                            next_month.click()
                        except:
                            try:
                                driver.execute_script("arguments[0].click();", next_month)
                            except:
                                parent = next_month.find_element(By.XPATH, "./..")
                                driver.execute_script("arguments[0].click();", parent)
                        time.sleep(2)
                
                # Then go back to start
                print("Going back to start month...")
                for attempt in range(request.nextTry):
                    print(f"Going back month {attempt + 1}")
                    try:
                        available_dates = driver.find_elements(By.XPATH, "//button[@class='mat-calendar-body-cell special-date']")
                        if available_dates:
                            print("Found available date while going back, clicking...")
                            driver.execute_script("arguments[0].click();", available_dates[0])
                            print("Successfully clicked available date!")
                            
                            # Wait for and click the first available time slot
                            print("Looking for available time slots...")
                            time.sleep(2)  # Give time for time slots to load
                            time_slot = wait.until(
                                EC.presence_of_element_located((By.XPATH, "//button[contains(@class, 'green-button')]"))
                            )
                            print("Found available time slot, clicking...")
                            driver.execute_script("arguments[0].click();", time_slot)
                            print("Successfully selected time slot!")
                            
                            # Find and check the checkbox
                            print("Looking for confirmation checkbox...")
                            time.sleep(2)  # Give time for checkbox to load
                            checkbox = wait.until(
                                EC.presence_of_element_located((By.XPATH, "//input[@id='styled-checkbox-1']"))
                            )
                            if not checkbox.is_selected():
                                print("Checking confirmation checkbox...")
                                driver.execute_script("arguments[0].click();", checkbox)
                                print("Successfully checked confirmation checkbox!")
                            
                            # Click the Select POST and Proceed button
                            print("Looking for Select POST and Proceed button...")
                            time.sleep(2)  # Give time for button to be clickable
                            proceed_button = wait.until(
                                EC.element_to_be_clickable((By.XPATH, "//button[contains(@class, 'lrg-common-buttton') and contains(text(), 'Select POST and Proceed')]"))
                            )
                            print("Clicking Select POST and Proceed button...")
                            driver.execute_script("arguments[0].click();", proceed_button)
                            print("Successfully clicked Select POST and Proceed button!")
                            
                            # Wait for 30 seconds to ensure success
                            print("Waiting for 30 seconds to ensure success...")
                            time.sleep(30)
                            print("Wait complete, proceeding to return success...")
                            
                            return {
                                "status": "success",
                                "message": "Found and clicked available date, time slot, confirmed appointment, and proceeded to next step"
                            }
                    except:
                        print("No available dates found in current month")
                    
                    if attempt < request.nextTry - 1:  # Only try to go back if we haven't reached the limit
                        print("Checking previous month button...")
                        prev_month = wait.until(
                            EC.visibility_of_element_located((By.XPATH, "//button[@class='mat-focus-indicator mat-calendar-previous-button mat-icon-button mat-button-base']"))
                        )
                        
                        # Check if previous month button is disabled
                        is_disabled = driver.execute_script("""
                            const button = arguments[0];
                            return button.disabled || button.getAttribute('aria-disabled') === 'true';
                        """, prev_month)
                        
                        if is_disabled:
                            print("Reached initial month, stopping backward navigation")
                            break
                        
                        print("Clicking previous month button...")
                        try:
                            prev_month.click()
                        except:
                            try:
                                driver.execute_script("arguments[0].click();", prev_month)
                            except:
                                parent = prev_month.find_element(By.XPATH, "./..")
                                driver.execute_script("arguments[0].click();", parent)
                        time.sleep(2)
            
            print("No available dates found after checking all cycles")
            return {
                "status": "no_dates",
                "message": "No available dates found after checking all cycles"
            }
        finally:
            driver.quit()
        
    except Exception as e:
        print(f"Error occurred: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 