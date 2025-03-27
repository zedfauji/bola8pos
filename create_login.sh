curl -X POST "http://localhost:5000/api/employees/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Manager","email":"manager@example.com","phone":"0987654321","role":"manager","pinCode":"4321"}'