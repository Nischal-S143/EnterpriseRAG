import { login, logout, getToken, isAuthenticated, getStoredUser } from '../lib/auth';
import { apiFetch } from '../lib/api';

// Mock apiFetch
jest.mock('../lib/api', () => ({
    apiFetch: jest.fn(),
    AuthError: class AuthError extends Error {
        constructor(message: string) {
            super(message);
            this.name = "AuthError";
        }
    }
}));

describe('auth utilities', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    it('should store tokens on successful login', async () => {
        const mockResponse = {
            access_token: 'fake_access',
            refresh_token: 'fake_refresh',
            username: 'testuser',
            role: 'admin'
        };
        (apiFetch as jest.Mock).mockResolvedValue(mockResponse);

        await login('testuser', 'password123');

        expect(localStorage.getItem('pagani_access_token')).toBe('fake_access');
        expect(localStorage.getItem('pagani_refresh_token')).toBe('fake_refresh');
        expect(JSON.parse(localStorage.getItem('pagani_user')!)).toEqual({
            username: 'testuser',
            role: 'admin'
        });
    });

    it('should clear tokens on logout', () => {
        localStorage.setItem('pagani_access_token', 'val');
        localStorage.setItem('pagani_refresh_token', 'val');
        
        logout();

        expect(localStorage.getItem('pagani_access_token')).toBeNull();
        expect(localStorage.getItem('pagani_refresh_token')).toBeNull();
    });

    it('should return correct auth state', () => {
        expect(isAuthenticated()).toBe(false);
        localStorage.setItem('pagani_access_token', 'val');
        expect(isAuthenticated()).toBe(true);
        expect(getToken()).toBe('val');
    });

    it('should return stored user info', () => {
        const user = { username: 'bob', role: 'viewer' };
        localStorage.setItem('pagani_user', JSON.stringify(user));
        expect(getStoredUser()).toEqual(user);
    });

    it('should handle malformed stored user JSON', () => {
        localStorage.setItem('pagani_user', '{invalid');
        expect(getStoredUser()).toBeNull();
    });
});
