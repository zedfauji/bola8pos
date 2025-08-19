#!/bin/bash

BASE_URL="http://localhost:5000/api"

echo "Testing API Endpoints..."

test_endpoint() {
  echo -e "\n=== $1 ==="
  curl -s -X $2 "${BASE_URL}$3" \
    -H "Content-Type: application/json" \
    ${4:+-d $4}
  echo ""
}

# 1. Test Tables API
test_endpoint "Tables" GET "/tables"

# 2. Test Members API
test_endpoint "Create Member" POST "/members" \
  '{"name":"Test Member","email":"test@example.com","phone":"1234567890"}'

# 3. Test Orders API
test_endpoint "Create Order" POST "/orders" \
  '{"tableId":1,"items":[{"itemId":1,"quantity":2}]}'

# 4. Test Inventory
test_endpoint "Inventory" GET "/inventory"

# 5. Test Employee Login
test_endpoint "Employee Login" POST "/auth/login" \
  '{"email":"admin@example.com","pinCode":"1234"}'