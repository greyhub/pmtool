import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrgSwitcher } from './OrgSwitcher';

const options = [
  { slug: 'acme', name: 'Acme Corp' },
  { slug: 'beta', name: 'Beta Inc' },
];

describe('OrgSwitcher', () => {
  it('opens the menu and selects another organization', async () => {
    const onSelect = vi.fn();
    render(<OrgSwitcher current={options[0]!} options={options} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /Acme Corp/ }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Beta Inc' }));

    expect(onSelect).toHaveBeenCalledWith('beta');
  });

  it('calls onCreateNew when the create-new action is clicked', async () => {
    const onCreateNew = vi.fn();
    render(<OrgSwitcher current={options[0]!} options={options} onSelect={vi.fn()} onCreateNew={onCreateNew} />);

    await userEvent.click(screen.getByRole('button', { name: /Acme Corp/ }));
    await userEvent.click(screen.getByRole('button', { name: '+ Tạo tổ chức mới' }));

    expect(onCreateNew).toHaveBeenCalledOnce();
  });
});
