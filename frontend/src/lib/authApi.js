import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const authClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'AgentID'
  }
});

// Add response interceptor for 401 -> auto refresh
authClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      try {
        await authClient.post('/auth/refresh');
        return authClient(error.config);
      } catch (refreshError) {
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export const register = (data) => authClient.post('/auth/register', data);
export const login = (data) => authClient.post('/auth/login', data);
export const logout = () => authClient.post('/auth/logout');
export const refresh = () => authClient.post('/auth/refresh');
export const getOrg = (orgId) => authClient.get(`/orgs/${orgId}`);
export const getOrgStats = (orgId) => authClient.get(`/orgs/${orgId}/stats`);
export const getOrgMembers = (orgId) => authClient.get(`/orgs/${orgId}/members`);
export const getApiKeys = () => authClient.get('/api-keys');
export const createApiKey = (data) => authClient.post('/api-keys', data);
export const deleteApiKey = (id) => authClient.delete(`/api-keys/${id}`);
export const getOrgAgents = (orgId, params) => authClient.get(`/orgs/${orgId}/agents`, { params });

// Chain support
export const getChains = async () => {
  const res = await authClient.get('/agents/chains');
  return res.data.chains || res.data || [];
};

// Identity Provider management
export const getIdentityProviders = (orgId) => authClient.get(`/orgs/${orgId}/identity-providers`).then(r => r.data);
export const createIdentityProvider = (orgId, config) => authClient.post(`/orgs/${orgId}/identity-providers`, config).then(r => r.data);
export const updateIdentityProvider = (orgId, idpId, updates) => authClient.put(`/orgs/${orgId}/identity-providers/${idpId}`, updates).then(r => r.data);
export const deleteIdentityProvider = (orgId, idpId) => authClient.delete(`/orgs/${orgId}/identity-providers/${idpId}`).then(r => r.data);

export default authClient;
