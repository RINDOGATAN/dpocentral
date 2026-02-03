#!/usr/bin/env python3
"""Take screenshots of key pages for visual review"""

from playwright.sync_api import sync_playwright
import os

BASE_URL = "http://localhost:3001"
DEV_EMAIL = "demo@privacysuite.example"
OUTPUT_DIR = "/tmp/privacy-suite-screenshots"

PAGES_TO_SCREENSHOT = [
    ("/sign-in", "01-sign-in"),
    ("/privacy", "02-dashboard"),
    ("/privacy/data-inventory", "03-data-inventory"),
    ("/privacy/data-inventory/demo-asset-customer-db", "04-asset-detail"),
    ("/privacy/dsar", "05-dsar-list"),
    ("/privacy/dsar/demo-dsar-completed", "06-dsar-detail"),
    ("/privacy/assessments", "07-assessments"),
    ("/privacy/assessments/demo-assessment-completed", "08-assessment-detail"),
    ("/privacy/incidents", "09-incidents"),
    ("/privacy/incidents/demo-incident-closed", "10-incident-detail"),
    ("/privacy/vendors", "11-vendors"),
    ("/privacy/vendors/demo-vendor-aws", "12-vendor-detail"),
    ("/dsar/demo", "13-public-dsar-form"),
]

os.makedirs(OUTPUT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})

    # Screenshot sign-in first
    page.goto(f"{BASE_URL}/sign-in", wait_until="networkidle")
    page.screenshot(path=f"{OUTPUT_DIR}/01-sign-in.png", full_page=True)
    print("✓ 01-sign-in")

    # Authenticate
    dev_email_input = page.locator("#dev-email")
    if dev_email_input.is_visible():
        dev_email_input.fill(DEV_EMAIL)
        page.locator('button:has-text("Dev Sign In")').click()
        page.wait_for_timeout(2000)
        page.wait_for_load_state("networkidle")

    # Screenshot authenticated pages
    for route, name in PAGES_TO_SCREENSHOT[1:]:
        if route.startswith("/dsar/") and not route.startswith("/dsar/demo-"):
            # Public page, no auth needed
            pass
        page.goto(f"{BASE_URL}{route}", wait_until="networkidle")
        page.wait_for_timeout(500)
        page.screenshot(path=f"{OUTPUT_DIR}/{name}.png", full_page=True)
        print(f"✓ {name}")

    browser.close()

print(f"\nScreenshots saved to {OUTPUT_DIR}/")
