import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';

const items = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/board', label: 'Bảng công việc' },
];

describe('Sidebar', () => {
  it('renders each item as a link to its href', () => {
    render(<Sidebar items={items} activeHref="/dashboard" />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Bảng công việc' })).toHaveAttribute('href', '/board');
  });

  it('uses a custom LinkComponent when provided', () => {
    const CustomLink = ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
      <a href={href} data-custom="true" className={className}>
        {children}
      </a>
    );
    render(<Sidebar items={items} activeHref="/dashboard" LinkComponent={CustomLink} />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('data-custom', 'true');
  });
});
