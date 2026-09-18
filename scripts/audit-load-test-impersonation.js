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

// System admin credentials for impersonation
const SYSTEM_ADMIN = {
  email: 'superadmin@pathshalapro.net',
  password: 'password123',
  tenantId: 'system-platform'
};

// Tenant IDs to impersonate
const TENANTS = [
  { id: 'amsc', name: 'ABDUL MOJID SCHOOL AND COLLAGE' },
];

// Critical endpoints to test after impersonation
const ENDPOINTS = [
  '/api/students',
  '/api/attendance',
  '/api/fees/collection',
  '/api/exams',
  '/api/dashboard',
];

export default function () {
  // Step 1: Authenticate as System Admin
  group('System Admin Authentication', () => {
    const loginRes = http.post('http://localhost:3001/api/auth/login', JSON.stringify({
      email: SYSTEM_ADMIN.email,
      password: SYSTEM_ADMIN.password
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'x-forwarded-for': `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
        'x-tenant-id': SYSTEM_ADMIN.tenantId
      },
    });
    
    const loginSuccess = check(loginRes, {
      'system admin login status was 200': (r) => r.status === 200,
      'system admin login response time < 1s': (r) => r.timings.duration < 1000,
      'system admin login not rate limited': (r) => r.status !== 429,
    });
    
    let systemAdminToken = '';
    if (loginSuccess && loginRes.status === 200) {
      try {
        const json = loginRes.json();
        systemAdminToken = json.data?.token || json.token || json.accessToken;
      } catch (e) {
        console.log('Failed to parse system admin login response:', e);
      }
    }
    
    if (!systemAdminToken || !loginSuccess) {
      console.log('System admin authentication failed - cannot proceed with impersonation');
      return;
    }
    
    // Step 2: Impersonate each tenant
    for (let i = 0; i < TENANTS.length; i++) {
      const tenant = TENANTS[i];
      
      group(`Impersonate ${tenant.name}`, () => {
        const impersonateRes = http.post('http://localhost:3001/api/system-admin/impersonate', JSON.stringify({
          targetTenantId: tenant.id
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${systemAdminToken}`,
            'x-forwarded-for': `192.168.1.${Math.floor(Math.random() * 254) + 1}`
          },
        });
        
        const impersonateSuccess = check(impersonateRes, {
          [`impersonate ${tenant.name} status was 200`]: (r) => r.status === 200,
          [`impersonate ${tenant.name} response time < 1s`]: (r) => r.timings.duration < 1000,
          [`impersonate ${tenant.name} not rate limited`]: (r) => r.status !== 429,
        });
        
        let impersonationToken = '';
        if (impersonateSuccess && impersonateRes.status === 200) {
          try {
            const json = impersonateRes.json();
            impersonationToken = json.data?.token || json.token || json.accessToken;
          } catch (e) {
            console.log(`Failed to parse impersonation response for ${tenant.name}:`, e);
          }
        }
        
        // Step 3: Test endpoints with impersonated token
        if (impersonationToken && impersonateSuccess) {
          for (let j = 0; j < ENDPOINTS.length; j++) {
            const endpoint = ENDPOINTS[j];
            
            group(`${tenant.name} - ${endpoint}`, () => {
              const res = http.get(`http://localhost:3001${endpoint}?limit=10`, {
                headers: { 
                  'Authorization': `Bearer ${impersonationToken}`,
                  'x-forwarded-for': `192.168.1.${Math.floor(Math.random() * 254) + 1}`
                },
              });
              
              check(res, {
                [`${tenant.name} ${endpoint} status was 200`]: (r) => r.status === 200,
                [`${tenant.name} ${endpoint} response time < 1s`]: (r) => r.timings.duration < 1000,
                [`${tenant.name} ${endpoint} not rate limited`]: (r) => r.status !== 429,
              });
            });
          }
        } else {
          console.log(`Skipping endpoints for ${tenant.name} due to failed impersonation`);
        }
      });
      
      sleep(1); // Small delay between impersonation tests
    }
  });
}