import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatAssistant from '../components/ChatAssistant';
import { isAuthenticated } from '@/lib/auth';

// Mock auth
jest.mock('@/lib/auth', () => ({
    isAuthenticated: jest.fn(),
    getStoredUser: jest.fn(() => ({ username: 'testuser', role: 'admin' })),
    getToken: jest.fn(() => 'fake-token'),
}));

// Mock api
jest.mock('@/lib/api', () => ({
    apiFetch: jest.fn(),
    AuthError: Error,
    sanitizeInput: (i: string) => i,
}));

// Mock constants
jest.mock('@/lib/constants', () => ({
    PIPELINE_STEPS: [
        { step: 1, label: 'Planning' },
        { step: 2, label: 'Retrieval' },
        { step: 3, label: 'Agents' },
        { step: 4, label: 'Evaluation' },
    ],
    formatSSEEvent: (line: string) => {
        if (line.startsWith('event: ')) return { event: line.replace('event: ', '').trim(), data: null };
        if (line.startsWith('data: ')) return { event: null, data: JSON.parse(line.replace('data: ', '').trim()) };
        return { event: null, data: null };
    },
    getScoreColor: jest.fn(),
}));

// Mock LiveActivityFeed
jest.mock('@/components/LiveActivityFeed', () => () => <div data-testid="live-activity">Mock Feed</div>);

describe('ChatAssistant', () => {
    const defaultProps = {
        isOpen: true,
        onClose: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (isAuthenticated as jest.Mock).mockReturnValue(true);
    });

    it('renders the assistant when open', () => {
        render(<ChatAssistant {...defaultProps} />);
        expect(screen.getByRole('heading', { name: /Pagani Intelligence/i })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Ask about the Zonda R/i)).toBeInTheDocument();
    });

    it('shows auth error when not authenticated', () => {
        (isAuthenticated as jest.Mock).mockReturnValue(false);
        render(<ChatAssistant {...defaultProps} />);
        expect(screen.getByText(/Authentication required/i)).toBeInTheDocument();
    });

    it('accepts input and updates state', () => {
        render(<ChatAssistant {...defaultProps} />);
        const input = screen.getByPlaceholderText(/Ask about the Zonda R/i) as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'How fast is it?' } });
        expect(input.value).toBe('How fast is it?');
    });

    it('triggers send on enter key', async () => {
        // Mock global fetch for SSE
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            body: {
                getReader: () => ({
                    read: jest.fn().mockResolvedValueOnce({ done: true }),
                }),
            },
        });

        render(<ChatAssistant {...defaultProps} />);
        const input = screen.getByPlaceholderText(/Ask about the Zonda R/i);
        fireEvent.change(input, { target: { value: 'test question' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
            expect(screen.getByText('test question')).toBeInTheDocument();
        });
    });

    it('shows loading state when sending a message', async () => {
        global.fetch = jest.fn().mockReturnValue(new Promise(() => {})); // Never resolves

        render(<ChatAssistant {...defaultProps} />);
        const input = screen.getByPlaceholderText(/Ask about the Zonda R/i);
        fireEvent.change(input, { target: { value: 'Hi' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        expect(input).toBeDisabled();
        expect(screen.getByRole('button', { name: '' })).toBeDisabled(); // Send button
    });

    it('closes when the close button is clicked', () => {
        render(<ChatAssistant {...defaultProps} />);
        const closeButton = screen.getByLabelText(/Close assistant/i);
        fireEvent.click(closeButton);
        expect(defaultProps.onClose).toHaveBeenCalled();
    });
});
