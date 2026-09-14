import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleSwitcher } from './LocaleSwitcher';

describe('LocaleSwitcher', () => {
  it('calls onChange with the selected locale code', async () => {
    const onChange = vi.fn();
    render(
      <LocaleSwitcher
        value="vi"
        options={[
          { code: 'vi', label: 'Tiếng Việt' },
          { code: 'en', label: 'English' },
        ]}
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Ngôn ngữ / Language'), 'en');
    expect(onChange).toHaveBeenCalledWith('en');
  });
});
