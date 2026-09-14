import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

describe('Select', () => {
  it('lets the user choose an option', async () => {
    render(
      <Select aria-label="role" defaultValue="MEMBER">
        <option value="ADMIN">Admin</option>
        <option value="MEMBER">Member</option>
      </Select>,
    );
    const select = screen.getByLabelText('role');
    await userEvent.selectOptions(select, 'ADMIN');
    expect(select).toHaveValue('ADMIN');
  });
});
