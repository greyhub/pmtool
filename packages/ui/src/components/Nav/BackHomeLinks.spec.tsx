import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackHomeLinks } from './BackHomeLinks';

describe('BackHomeLinks', () => {
  it('calls onBack when the back control is activated', async () => {
    const onBack = vi.fn();
    render(<BackHomeLinks onBack={onBack} backLabel="Quay lại" homeHref="/" homeLabel="Trang chủ" />);
    await userEvent.click(screen.getByRole('button', { name: /Quay lại/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders the home link with the given href using a native anchor by default', () => {
    render(<BackHomeLinks onBack={() => {}} backLabel="Quay lại" homeHref="/org/dashboard" homeLabel="Trang chủ" />);
    expect(screen.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('href', '/org/dashboard');
  });

  it('uses a custom LinkComponent when provided', () => {
    const CustomLink = ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
      <a href={href} data-custom="true" className={className}>
        {children}
      </a>
    );
    render(
      <BackHomeLinks
        onBack={() => {}}
        backLabel="Quay lại"
        homeHref="/"
        homeLabel="Trang chủ"
        LinkComponent={CustomLink}
      />,
    );
    expect(screen.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('data-custom', 'true');
  });
});
