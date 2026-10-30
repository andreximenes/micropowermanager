import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** Types into a search box and picks the option whose name starts with `option`. */
export async function pickOption(
  user: UserEvent,
  combobox: HTMLElement,
  search: string,
  option: string,
) {
  await user.click(combobox);
  await user.clear(combobox);
  await user.type(combobox, search);
  const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await user.click(await screen.findByRole('option', { name: new RegExp(`^${escaped}`) }));
}
