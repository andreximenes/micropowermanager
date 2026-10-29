import { initials } from '@/lib/format';

const sizes = {
  sm: 'size-8 rounded-lg text-xs',
  lg: 'size-12 rounded-2xl text-lg sm:size-16 sm:text-xl',
};

/** A person's initials on a tile, for people without a photo. */
export function PersonAvatar({
  person,
  size,
}: {
  person: { name: string; surname: string };
  size: keyof typeof sizes;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center bg-tile font-semibold text-white ${sizes[size]}`}
      aria-hidden="true"
    >
      {initials(person.name, person.surname)}
    </span>
  );
}
