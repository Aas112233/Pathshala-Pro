# PathshalaPro API Documentation

## Overview
Production-grade, ultra-fast RESTful API for the PathshalaPro School Management ERP system.

## Architecture

### Core Components
- **Framework**: Next.js 16 App Router with API Routes
- **Database**: MongoDB via Prisma ORM
- **Validation**: Zod schemas for request validation
- **Authentication**: Token-based auth with tenant isolation
- **Response Format**: Standardized JSON responses

### API Response Format

#### Success Response
```json
{
  "error": false,
  "data": { ... },
  "message": "Optional success message"
}
```

#### Paginated Response
```json
{
  "error": false,
  "data": [...],
  "pagination": {
    "totalCount": 100,
    "currentPage": 1,
    "pageSize": 20,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

#### Error Response
```json
{
  "error": true,
  "message": "Human-readable error message",
  "details": [
    {
      "field": "email",
      "code": "invalid",
      "message": "Invalid email format"
    }
  ]
}
```

## Authentication

All API endpoints (except `/api/auth/login`) require authentication.

### Headers Required
```
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>
```

### Login Endpoint
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@demohighschool.edu",
  "password": "password123"
}
```

**Response:**
```json
{
  "error": false,
  "data": {
    "user": {
      "id": "...",
      "email": "admin@demohighschool.edu",
      "name": "Admin User",
      "role": "ADMIN",
      "tenantId": "demo-school-001",
      "tenantName": "Demo High School"
    },
    "token": "base64-encoded-token"
  },
  "message": "Login successful"
}
```

## API Endpoints

### Students
```http
GET    /api/students?page=1&limit=20&search=rahim&status=ACTIVE
GET    /api/students/:id
POST   /api/students
PUT    /api/students/:id
DELETE /api/students/:id
```

**Create Student Payload:**
```json
{
  "studentId": "STU-2026-004",
  "rollNumber": "2026004",
  "firstName": "Rahim",
  "lastName": "Ahmed",
  "guardianName": "Karim Ahmed",
  "guardianContact": "+880-1711-223344",
  "guardianEmail": "karim@email.com",
  "dateOfBirth": "2010-05-15",
  "gender": "MALE",
  "status": "ACTIVE"
}
```

### Staff
```http
GET    /api/staff?page=1&limit=20&search=nasrin&department=Administration
GET    /api/staff/:id
POST   /api/staff
PUT    /api/staff/:id
DELETE /api/staff/:id
```

### Academic Years
```http
GET    /api/academic-years?page=1&limit=20&search=2026
GET    /api/academic-years/:id
POST   /api/academic-years
PUT    /api/academic-years/:id
DELETE /api/academic-years/:id
```

### Fee Vouchers
```http
GET    /api/fees?page=1&limit=20&status=PENDING&studentId=xxx
GET    /api/fees/:id
POST   /api/fees
PUT    /api/fees/:id
DELETE /api/fees/:id
```

**Create Fee Voucher Payload:**
```json
{
  "voucherId": "FV-2026-002",
  "studentProfileId": "student-id-here",
  "academicYearId": "year-id-here",
  "feeType": "TUITION_FEE",
  "baseAmount": 5000,
  "discountAmount": 500,
  "arrears": 0,
  "dueDate": "2026-02-01",
  "status": "PENDING"
}
```

### Transactions
```http
GET    /api/transactions?page=1&limit=20&paymentMethod=CASH&startDate=2026-01-01
GET    /api/transactions/:id
POST   /api/transactions
DELETE /api/transactions/:id
```

**Create Transaction Payload:**
```json
{
  "transactionId": "TXN-2026-001",
  "feeVoucherId": "voucher-id-here",
  "amountPaid": 4500,
  "paymentMethod": "CASH",
  "receiptNumber": "RCP-001",
  "collectedById": "user-id-here",
  "note": "Optional note"
}
```

**Features:**
- Atomic transaction: Creates transaction AND updates voucher balance simultaneously
- Automatic balance recalculation
- Prevents overpayment
- Rollback support on deletion

### Salary
```http
GET    /api/salary?page=1&limit=20&month=1&year=2026&status=PAID
GET    /api/salary/:id
POST   /api/salary
PUT    /api/salary/:id
DELETE /api/salary/:id
```

**Create Salary Ledger Payload:**
```json
{
  "staffProfileId": "staff-id-here",
  "academicYearId": "year-id-here",
  "month": 1,
  "year": 2026,
  "baseSalary": 45000,
  "deductions": 2000,
  "advances": 5000,
  "status": "PENDING"
}
```

### Attendance
```http
GET    /api/attendance?page=1&limit=20&date=2026-01-15&status=PRESENT
GET    /api/attendance/:id
POST   /api/attendance
PUT    /api/attendance/:id
DELETE /api/attendance/:id
```

**Mark Attendance Payload:**
```json
{
  "studentProfileId": "student-id-here",
  "date": "2026-01-15",
  "status": "PRESENT",
  "note": "Optional note"
}
```

### Exams
```http
GET    /api/exams?page=1&limit=20&examName=Midterm&subject=Math
GET    /api/exams/:id
POST   /api/exams
PUT    /api/exams/:id
DELETE /api/exams/:id
```

**Create Exam Result Payload:**
```json
{
  "studentProfileId": "student-id-here",
  "academicYearId": "year-id-here",
  "examName": "Midterm Examination",
  "subject": "Mathematics",
  "maxMarks": 100,
  "obtainedMarks": 85
}
```

**Features:**
- Auto-calculates grade based on percentage
- Auto-generates remarks

### Users
```http
GET    /api/users?page=1&limit=20&search=admin
GET    /api/users/:id
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
```

## Features

### Multi-Tenancy
- All data is isolated by `tenantId`
- Automatic tenant extraction from auth token
- No data bleed between tenants

### Validation
- All inputs validated with Zod schemas
- Type-safe API responses
- Detailed error messages with field-level validation

### Performance
- Server-side pagination on all list endpoints
- MongoDB indexes on frequently queried fields
- Efficient Prisma queries with selective field projection

### Error Handling
- Standardized error response format
- HTTP status codes: 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict), 422 (Validation Error), 500 (Server Error)
- Graceful error boundaries

### Atomic Operations
- Fee payments: Transaction + voucher balance update in single transaction
- Rollback support for deletions
- Data integrity guaranteed

## Frontend Integration

### API Client
```typescript
import { api, studentsApi } from "@/lib/api-client";

// Set auth token
api.setAuth(token, tenantId);

// Fetch students with pagination
const students = await studentsApi.list({ page: 1, limit: 20, search: "rahim" });

// Create student
const newStudent = await studentsApi.create(studentData);

// Update student
await studentsApi.update(id, updateData);

// Delete student
await studentsApi.delete(id);
```

### React Query Hooks
```typescript
import { useStudents, useCreateStudent } from "@/hooks/use-queries";

// Fetch students
const { data, isLoading, error } = useStudents({ page: 1, limit: 20 });

// Create student
const createMutation = useCreateStudent();
createMutation.mutate(studentData, {
  onSuccess: () => {
    // Handle success
  },
  onError: (error) => {
    // Handle error
  }
});
```

## Security

### Password Hashing
- SHA-256 with salt (upgrade to bcrypt in production)
- Never stored or transmitted in plain text

### Token Authentication
- Base64-encoded tokens with expiry
- Tenant ID embedded in token
- Automatic validation on protected routes

### Input Sanitization
- All inputs validated and sanitized
- SQL injection prevention via Prisma ORM
- XSS prevention via React escaping

## Testing

### Test Credentials
```
Email: admin@demohighschool.edu
Password: password123
```

### Sample Requests
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demohighschool.edu","password":"password123"}'

# Get students (with auth token)
curl -X GET "http://localhost:3000/api/students?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: demo-school-001"
```

## Deployment Notes

1. Set `NEXTAUTH_SECRET` to a strong random string
2. Use production MongoDB connection string
3. Enable MongoDB Atlas network access
4. Configure CORS for production domain
5. Set up rate limiting on auth endpoints
6. Enable HTTPS in production
7. Implement proper JWT tokens with NextAuth
