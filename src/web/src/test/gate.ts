/** A promise the test opens by hand, to hold a mocked response while it checks a pending state. */
export function createGate() {
  let open: () => void = () => undefined;
  const promise = new Promise<unknown>((resolve) => {
    open = () => resolve(undefined);
  });
  return { promise, open };
}
