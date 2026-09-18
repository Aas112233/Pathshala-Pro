import http from 'k6/http';
import { check, sleep, group } from 'k6';
import encoding from 'k6/encoding';

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 5 },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% of requests under 1s
    'http_req_failed': ['rate<0.01'], // Less than 1% failure rate
  },
};

// Role credentials with tenant IDs
const ROLES = [
  { 
    email: 'superadmin@pathshalapro.net', 
    password: 'password123', 
    name: 'Superadmin',
    tenantId: 'system-platform'
  },
  { 
    email: 'principleamsc@pathshalapro.edu', 
    password: 'XerjTh7D2i', 
    name: 'SchoolAdmin',
    tenantId: 'amsc'
  },
  { 
    email: 'teacher@pathshalapro.com', 
    password: '12345678', 
    name: 'Teacher',
    tenantId: 'amsc'
  },
];

// Critical endpoints to test
const ENDPOINTS = [
  '/api/students',
  '/api/attendance',
  '/api/fees/collection',
  '/api/exams',
  '/api/dashboard',
];

export default function () {
  // Test each role with proper tenant context
  for (let i = 0; i < ROLES.length; i++) {
    const role = ROLES[i];
    
    group(`Authentication - ${role.name}`, () => {
      // Login request with tenant context header
      const loginRes = http.post('http://localhost:3001/api/auth/login', JSON.stringify({
        email: role.email,
        password: role.password
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'x-forwarded-for': `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
          'x-tenant-id': role.tenantId
        },
      });
      
      // Check if login was successful
      const loginSuccess = check(loginRes, {
        'login status was 200': (r) => r.status === 200,
        'login response time < 1s': (r) => r.timings.duration < 1000,
        'login not rate limited': (r) => r.status !== 429,
      });
      
      let token = '';
      if (loginRes.status === 200) {
        // Extract token from auth_token cookie or response json
        if (loginRes.cookies && loginRes.cookies['auth_token'] && loginRes.cookies['auth_token'].length > 0) {
          token = loginRes.cookies['auth_token'][0].value;
        }
        if (!token) {
          try {
            const json = loginRes.json();
            token = json.data?.token || json.token || json.accessToken;
          } catch (e) {
            console.log(`Failed to parse login response for ${role.name}:`, e);
          }
        }
      }
      
      // Test endpoints with auth
      if (token) {
        for (let j = 0; j < ENDPOINTS.length; j++) {
          const endpoint = ENDPOINTS[j];
          
          group(`${role.name} - ${endpoint}`, () => {
            const res = http.get(`http://localhost:3001${endpoint}?limit=10`, {
              headers: { 
                'Authorization': `Bearer ${token}`,
                'x-forwarded-for': `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
                'x-tenant-id': role.tenantId
              },
            });
            
            check(res, {
              [`${endpoint} status was 200`]: (r) => r.status === 200,
              [`${endpoint} response time < 1s`]: (r) => r.timings.duration < 1000,
              [`${endpoint} not rate limited`]: (r) => r.status !== 429,
            });
          });
        }
      } else {
        console.log(`Skipping endpoints for ${role.name} due to failed login or rate limiting`);
      }
    });
    
    sleep(1); // Small delay between role tests
  }
}