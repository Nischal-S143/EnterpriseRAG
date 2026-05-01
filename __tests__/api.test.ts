import { sanitizeInput, apiFetch, apiFetchStream } from '../lib/api';

describe('sanitizeInput', () => {
    it('should strip HTML tags', () => {
        const input = '<script>alert("xss")</script>Hello <p>world</p>';
        const expected = 'alert(&quot;xss&quot;)Hello world';
        expect(sanitizeInput(input)).toBe(expected);
    });

    it('should escape dangerous characters', () => {
        const input = 'High & Low " \'';
        const expected = 'High &amp; Low &quot; &#039;';
        expect(sanitizeInput(input)).toBe(expected);
    });

    it('should escape standalone brackets', () => {
        const input = 'a < b';
        const expected = 'a &lt; b';
        expect(sanitizeInput(input)).toBe(expected);
    });

    it('should trim whitespace', () => {
        const input = '   hello   ';
        const expected = 'hello';
        expect(sanitizeInput(input)).toBe(expected);
    });

    it('should respect maxLength', () => {
        const input = 'abcdefghij';
        const expected = 'abcde';
        expect(sanitizeInput(input, 5)).toBe(expected);
    });

    it('should handle empty input', () => {
        expect(sanitizeInput('')).toBe('');
    });

    it('should handle complex XSS payloads', () => {
        const input = '<img src=x onerror=alert(1)>';
        const expected = ''; // Tags (including attributes) are completely stripped
        expect(sanitizeInput(input)).toBe(expected);
    });
});

describe('apiFetch', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
        localStorage.clear();
    });

    it('should make a successful request', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ data: 'success' }),
        });

        const result = await apiFetch('/test-endpoint');
        expect(result).toEqual({ data: 'success' });
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/test-endpoint'), expect.any(Object));
    });

    it('should handle API errors', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ detail: 'Bad Request' }),
        });

        await expect(apiFetch('/fail')).rejects.toThrow('Bad Request');
    });

    it('should include auth token when present', async () => {
        localStorage.setItem('pagani_access_token', 'token123');
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({}),
        });

        await apiFetch('/auth-test');
        
        const call = (global.fetch as jest.Mock).mock.calls[0];
        expect(call[1].headers.Authorization).toBe('Bearer token123');
    });

    it('should retry on 401 with token refresh', async () => {
        localStorage.setItem('pagani_refresh_token', 'refresh123');
        
        // First call returns 401
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 401,
        });

        // Refresh call returns 200
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'new_token' }),
        });

        // Retry call returns 200
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ data: 'retried' }),
        });

        const result = await apiFetch('/retry');
        expect(result).toEqual({ data: 'retried' });
        expect(localStorage.getItem('pagani_access_token')).toBe('new_token');
    });
});

describe('apiFetchStream', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
        localStorage.clear();
    });

    it('should return a reader for streaming responses', async () => {
        const mockReader = {};
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            body: {
                getReader: () => mockReader
            }
        });

        const result = await apiFetchStream('/stream');
        expect(result).toBe(mockReader);
    });

    it('should handle 401 by clearing tokens and throwing', async () => {
        localStorage.setItem('pagani_access_token', 'token123');
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 401,
        });

        await expect(apiFetchStream('/stream')).rejects.toThrow('Session expired');
        expect(localStorage.getItem('pagani_access_token')).toBeNull();
    });
});
