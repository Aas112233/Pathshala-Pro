import http from 'k6/http';
import { check, sleep, group } from 'k6';
import encoding from 'k6/encoding';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 50 },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% of requests under 1s
    'http_req_failed': ['rate<0.01'], // Less than 1% failure rate
  },
};

// Role credentials
const ROLES = [
  { email: 'superadmin@pathshalapro.net', password: 'password123', name: 'Superadmin' },
  { email: 'principleamsc@pathshalapro.edu', password: 'XerjTh7D2i', name: 'SchoolAdmin' },
  { email: 'teacher@pathshalapro.com', password: '12345678', name: 'Teacher' },
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
  // Test each role
  for (let i = 0; i < ROLES.length; i++) {
    const role = ROLES[i];
    
    group(`Authentication - ${role.name}`, () => {
      const loginRes = http.post('http://localhost:3001/api/auth/login', JSON.stringify({
        email: role.email,
        password: role.password
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
      check(loginRes, {
        'login status was 200': (r) => r.status === 200,
        'login response time < 1s': (r) => r.timings.duration < 1000,
      });
      
      // Extract token if present
      let token = '';
      try {
        const json = loginRes.json();
        token = json.token || json.accessToken || json.data?.token;
      } catch (e) {
        // Token not found in response
      }
      
      // Test endpoints with auth
      for (let j = 0; j < ENDPOINTS.length; j++) {
        const endpoint = ENDPOINTS[j];
        
        group(`${role.name} - ${endpoint}`, () => {
          const res = http.get(`http://localhost:3001${endpoint}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          });
          
          check(res, {
            [`${endpoint} status was 200`]: (r) => r.status === 200,
            [`${endpoint} response time < 1s`]: (r) => r.timings.duration < 1000,
          });
        });
      }
    });
    
    sleep(0.5); // Small delay between role tests
  }
}