from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import time

def run_bot(url, email, password, location, next_try=1):
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
            driver.get(url)
            
            print("Filling in login credentials...")
            email_input = wait.until(
                EC.presence_of_element_located((By.XPATH, "//input[@formcontrolname='username']"))
            )
            email_input.send_keys(email)
            
            password_input = wait.until(
                EC.presence_of_element_located((By.XPATH, "//input[@formcontrolname='password']"))
            )
            password_input.send_keys(password)
            
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
            
            print(f"Selecting location: {location}")
            location_option = wait.until(
                EC.presence_of_element_located((By.XPATH, f"//mat-option[.//span[normalize-space(text())='{location}']]"))
            )
            print("Clicking location option using JavaScript...")
            driver.execute_script("arguments[0].click();", location_option)
            print(f"Successfully selected location: {location}")

            time.sleep(2)

            for attempt in range(next_try):
                print(f"Attempt {attempt + 1} of {next_try}")
                
                try:
                    available_dates = driver.find_elements(By.XPATH, "//button[@class='mat-calendar-body-cell special-date']")
                    if available_dates:
                        print("Found available date, clicking...")
                        driver.execute_script("arguments[0].click();", available_dates[0])
                        print("Successfully clicked available date!")
                        return True
                    else:
                        print("No available dates found in current month")
                except:
                    print("No available dates found in current month")
                
                if attempt < next_try - 1:
                    print("Waiting for next month button to be visible...")
                    next_month = wait.until(
                        EC.visibility_of_element_located((By.XPATH, "//button[@class='mat-focus-indicator mat-calendar-next-button mat-icon-button mat-button-base']"))
                    )
                    print("Next month button is visible, clicking...")
                    try:
                        next_month.click()
                    except:
                        try:
                            driver.execute_script("arguments[0].click();", next_month)
                        except:
                            parent = next_month.find_element(By.XPATH, "./..")
                            driver.execute_script("arguments[0].click();", parent)
                    
                    time.sleep(2)
                else:
                    print("Reached maximum attempts without finding available dates")
                    return False
            
            return True
            
        except Exception as e:
            print(f"Error occurred: {str(e)}")
            return False
            
    except Exception as e:
        print(f"Error occurred: {str(e)}")
        return False

if __name__ == "__main__":
    # Example usage
    url = "https://www.usvisaappt.com/visaapplicantui/login"
    email = input("Enter your email: ")
    password = input("Enter your password: ")
    location = input("Enter your desired location: ")
    next_try = int(input("Enter number of months to check (default 1): ") or "1")
    
    run_bot(url, email, password, location, next_try) 