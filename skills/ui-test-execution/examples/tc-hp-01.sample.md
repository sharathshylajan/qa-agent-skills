# Suite STORE-101 | TC-HP-01 | Add product to bag and verify bag

## 1 Overview
Story: STORE-101 Add to bag | AC covered: AC1, AC2 | AC not covered: AC3 | Goal: add a product and see it in the bag | Status: READY

## 2 Environment
Base URL: http://localhost:8099
Start URL: http://localhost:8099/products
Chromium (headless). Basic Auth: handled by runtime, not a step

## 3 Accounts
No login required.

## 4 Test data
| Item | Exact value | Selection | Used in step | Source |
|---|---|---|---|---|
| Product | first product with a single price | any (first in stock with single price) | 2, 3 | AC1 |
| Quantity | 1 | named | 4 | AC1 |

## 5 Preconditions
- Catalogue has products: To be confirmed by executor

## 6 Steps
**Browse**
1. Navigate to | {BASE_URL}/products | - | Expected: URL contains /products and heading "Products" visible
2. Click | link "Product" | - | Expected: heading "Product Detail" visible | Capture: {PRICE}=price of product | Select: first, single price, in stock
3. Click | button "Add to Bag" | - | Expected: text "Added to bag" visible
**Bag**
4. Click | link "Bag" | - | Expected: URL contains /bag and text "{PRICE}" visible
5. Verify all | page | - | Expected: all checks below pass
   a) Bag shows the product | Expected: link "Product" visible | AC1
   b) Bag subtotal equals price | Expected: text "{PRICE}" visible | AC2

## 7 AC traceability
a -> AC1; b -> AC2

## 8 Captured values
{PRICE} | set at step 2 | used at step 4, 5
