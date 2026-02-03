#!/usr/bin/env python3
"""Test the sign-in page authentication options."""

from playwright.sync_api import sync_playwright
import time

PRODUCTION_URL = "https://privacysuite-ten.vercel.app"

def test_signin_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print(f"\n{'='*60}")
        print("Testing Sign-In Page")
        print(f"{'='*60}\n")

        # Navigate to sign-in page
        print("1. Navigating to sign-in page...")
        response = page.goto(f"{PRODUCTION_URL}/sign-in", wait_until="networkidle")

        if response and response.status >= 400:
            print(f"   ERROR: Page returned status {response.status}")
            browser.close()
            return False

        print(f"   Status: {response.status if response else 'unknown'}")

        # Take screenshot
        page.screenshot(path="/tmp/signin-page.png", full_page=True)
        print("   Screenshot saved to /tmp/signin-page.png")

        # Check for Google OAuth button
        print("\n2. Checking for Google OAuth button...")
        google_button = page.locator("text=Continue with Google").first
        if google_button.is_visible():
            print("   ✓ Google OAuth button found and visible")
        else:
            # Try alternative selectors
            google_button = page.locator("button:has-text('Google')").first
            if google_button.is_visible():
                print("   ✓ Google button found (alternative selector)")
            else:
                print("   ✗ Google OAuth button not found")

        # Check for email/magic link input
        print("\n3. Checking for email magic link option...")
        email_input = page.locator("input[type='email'], input[placeholder*='email']").first
        if email_input.is_visible():
            print("   ✓ Email input field found")
        else:
            print("   ✗ Email input not found")

        # Check for magic link button
        magic_link_button = page.locator("text=Sign in with Email, text=Magic Link, button:has-text('Email')").first
        if magic_link_button.is_visible():
            print("   ✓ Magic link button found")
        else:
            # Check for any submit button near email
            submit_button = page.locator("button[type='submit']").first
            if submit_button.is_visible():
                print("   ✓ Submit button found for email sign-in")
            else:
                print("   ? Could not locate magic link submit button")

        # Test Google OAuth flow (just click to see if it redirects correctly)
        print("\n4. Testing Google OAuth redirect...")
        try:
            google_btn = page.locator("text=Continue with Google").first
            if google_btn.is_visible():
                # Click and check for Google redirect
                with page.expect_navigation(timeout=10000) as nav_info:
                    google_btn.click()

                current_url = page.url
                if "accounts.google.com" in current_url or "google.com/o/oauth2" in current_url:
                    print("   ✓ Successfully redirected to Google OAuth")
                    page.screenshot(path="/tmp/google-oauth.png")
                    print("   Screenshot saved to /tmp/google-oauth.png")
                else:
                    print(f"   ? Redirected to: {current_url}")
                    page.screenshot(path="/tmp/google-redirect.png")
        except Exception as e:
            print(f"   Note: {str(e)[:100]}")

        # Go back to sign-in to test email
        print("\n5. Testing email input...")
        page.goto(f"{PRODUCTION_URL}/sign-in", wait_until="networkidle")
        time.sleep(1)

        email_input = page.locator("input[type='email'], input[placeholder*='email']").first
        if email_input.is_visible():
            email_input.fill("test@example.com")
            print("   ✓ Email input accepts text")
            page.screenshot(path="/tmp/email-filled.png")
            print("   Screenshot saved to /tmp/email-filled.png")

        # Check for console errors
        print(f"\n6. Console errors: {len(console_errors)}")
        if console_errors:
            for err in console_errors[:5]:
                print(f"   - {err[:100]}")
        else:
            print("   ✓ No console errors")

        # List all visible buttons for debugging
        print("\n7. All visible buttons on sign-in page:")
        page.goto(f"{PRODUCTION_URL}/sign-in", wait_until="networkidle")
        buttons = page.locator("button").all()
        for btn in buttons:
            if btn.is_visible():
                text = btn.inner_text().strip()
                print(f"   - {text if text else '(no text)'}")

        browser.close()

        print(f"\n{'='*60}")
        print("Sign-in page test complete!")
        print(f"{'='*60}\n")
        return True

if __name__ == "__main__":
    test_signin_page()
