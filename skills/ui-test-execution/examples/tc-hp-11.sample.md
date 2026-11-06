# Suite STORE-101 | TC-HP-11 | Bag still holds the product

## 1 Overview
Status: READY

## 2 Environment
Base URL: http://localhost:8099
Chromium (headless)

## 6 Steps
1. Navigate to | {BASE_URL}/bag | - | Expected: URL contains /bag and heading "Bag" visible
2. Verify all | page | - | Expected: all checks below pass
   a) Bag still contains the product | Expected: link "Product Hat" visible | AC1
