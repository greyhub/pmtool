import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeSwitcher } from './ThemeSwitcher';

const setTheme = vi.fn();
let resolvedTheme = 'light';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme, setTheme }),
}));

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    setTheme.mockClear();
    resolvedTheme = 'light';
  });

  it('switches to dark when currently light', async () => {
    render(<ThemeSwitcher />);
    const button = await waitFor(() => screen.getByRole('button'));
    await userEvent.click(button);
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('switches to light when currently dark', async () => {
    resolvedTheme = 'dark';
    render(<ThemeSwitcher />);
    const button = await waitFor(() => screen.getByRole('button'));
    await userEvent.click(button);
    expect(setTheme).toHaveBeenCalledWith('light');
  });
});
