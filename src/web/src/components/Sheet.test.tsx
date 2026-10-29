import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Sheet } from './Sheet';

function renderSheet(description?: string) {
  const onClose = vi.fn();
  render(
    <Sheet
      title="Sell product"
      description={description}
      onClose={onClose}
      footer={<button type="button">Confirm</button>}
    >
      <p>Sheet body</p>
    </Sheet>,
  );
  return { onClose, user: userEvent.setup() };
}

describe('Sheet', () => {
  it('renders an open dialog with its title, description, body and footer', () => {
    renderSheet('to Amina Okafor');

    const dialog = screen.getByRole('dialog', { name: 'Sell product' });
    expect(dialog).toHaveAccessibleDescription('to Amina Okafor');
    expect(screen.getByText('Sheet body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('renders without a description', () => {
    renderSheet();

    expect(screen.getByRole('dialog', { name: 'Sell product' })).not.toHaveAttribute(
      'aria-describedby',
    );
  });

  it('closes from the close button', async () => {
    const { onClose, user } = renderSheet();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const { onClose, user } = renderSheet();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
