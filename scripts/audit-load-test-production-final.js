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

// Users for tenant load testing (tenant amsc)
const USERS = [
  { 
    email: 'principleamsc@pathshalapro.edu', 
    password: 'XerjTh7D2i',
    tenantId: 'amsc',
    name: 'SchoolAdmin'
  },
  { 
    email: 'teacher@pathshalapro.com', 
    password: '12345678',
    tenantId: 'amsc',
    name: 'Teacher'
  },
];

// Production-verified ERP endpoints
const ENDPOINTS = [
  '/api/students?limit=10',
  '/api/classes?limit=10',
  '/api/sections?limit=10',
  '/api/exams?limit=10',
  '/api/subjects?limit=10',
  '/api/staff?limit=10',
  '/api/fees?limit=10',
  '/api/dashboard/summary',
];

export default function () {
  // Test each user
  for (let i = 0; i < USERS.length; i++) {
    const user = USERS[i];
    
    group(`Login & Test - ${user.name}`, () => {
      // Login request with proper headers
      const loginBody = JSON.stringify({
        email: user.email,
        password: user.password
      });
      
      const loginRes = http.post('http://localhost:3001/api/auth/login', loginBody, {
        headers: { 
          'Content-Type': 'application/json',
          'x-forwarded-for': `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
          'x-tenant-id': user.tenantId,
        },
      });
      
      // Check if login was successful
      const loginSuccess = check(loginRes, {
        [`${user.name} login status was 200`]: (r) => r.status === 200,
        [`${user.name} login not rate limited`]: (r) => r.status !== 429,
      });
      
      if (!loginSuccess || loginRes.status !== 200) {
        console.log(`${user.name} login failed: ${loginRes.status} ${loginRes.body}`);
        return; // Skip endpoints if login failed
      }
      
      // Extract auth cookie or token
      let cookieHeader = '';
      if (loginRes.cookies && loginRes.cookies['auth_token'] && loginRes.cookies['auth_token'].length > 0) {
        cookieHeader = `auth_token=${loginRes.cookies['auth_token'][0].value}`;
      } else if (loginRes.headers['Set-Cookie']) {
        cookieHeader = loginRes.headers['Set-Cookie'];
      }
      
      // Test endpoints with auth cookie
      for (let j = 0; j < ENDPOINTS.length; j++) {
        const endpoint = ENDPOINTS[j];
        
        group(`${user.name} - ${endpoint}`, () => {
          const res = http.get(`http://localhost:3001${endpoint}`, {
            headers: { 
              'Cookie': cookieHeader,
              'x-forwarded-for': `192.168.1.${Math.floor(Math.random() * 254) + 1}`
            },
          });
          
          check(res, {
            [`${user.name} ${endpoint} status was 200`]: (r) => r.status === 200,
            [`${user.name} ${endpoint} response time < 1s`]: (r) => r.timings.duration < 1000,
            [`${user.name} ${endpoint} not rate limited`]: (r) => r.status !== 429,
          });
        });
      }
    });
    
    sleep(1); // Small delay between user tests
  }
}