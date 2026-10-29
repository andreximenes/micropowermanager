import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { UploadDocumentSheet } from './UploadDocumentSheet';

import { documentFixture, signIn } from '@/test/fixtures';
import { renderWithQueryClient } from '@/test/render';
import { server } from '@/test/server';

const pdf = (name = 'National ID.pdf', bytes = 2048) =>
  new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });

function renderSheet() {
  const onClose = vi.fn();
  const view = renderWithQueryClient(
    <UploadDocumentSheet customerId={7} customerName="Amina Okafor" onClose={onClose} />,
  );
  return { ...view, onClose };
}

const fileInput = () => screen.getByLabelText(/^File/);

describe('UploadDocumentSheet', () => {
  beforeEach(() => {
    signIn();
  });

  it('uploads the file and its type as a multipart form, then closes', async () => {
    const sent: { hasFile: boolean; type: unknown; contentType: string | null }[] = [];
    server.use(
      http.post('/api/people/7/documents', async ({ request }) => {
        const form = await request.formData();
        sent.push({
          // jsdom's File loses its name on the way through Node's fetch, so only presence is checked.
          hasFile: form.get('file') !== null,
          type: form.get('type'),
          contentType: request.headers.get('Content-Type'),
        });
        return HttpResponse.json({ data: documentFixture({ type: 'National ID' }) });
      }),
    );
    const { user, onClose } = renderSheet();

    expect(screen.getByText('For Amina Okafor. PDF or Word (.docx), up to 5 MB.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Document type *'), '  National ID ');
    await user.upload(fileInput(), pdf());
    expect(screen.getByText('National ID.pdf · 2 KB')).toBeInTheDocument();
    expect(screen.getByText('Replace file')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sent).toMatchObject([{ hasFile: true, type: 'National ID' }]);
    expect(sent[0]?.contentType).toMatch(/^multipart\/form-data; boundary=/);
  });

  it('asks for the type and a file before sending anything', async () => {
    const { user } = renderSheet();

    await user.click(screen.getByRole('button', { name: 'Upload' }));

    expect(screen.getByText('Say what the document is, e.g. National ID.')).toBeInTheDocument();
    expect(screen.getByText('Choose a PDF or Word (.docx) file.')).toBeInTheDocument();
  });

  it('refuses other file types and files over 5 MB', async () => {
    const { user } = renderSheet();
    await user.type(screen.getByLabelText('Document type *'), 'Photo');

    fireEvent.change(fileInput(), { target: { files: [new File(['x'], 'photo.png')] } });
    await user.click(screen.getByRole('button', { name: 'Upload' }));
    expect(
      screen.getByText('Only PDF and Word (.docx) files can be uploaded.'),
    ).toBeInTheDocument();

    fireEvent.change(fileInput(), { target: { files: [pdf('scan.pdf', 5 * 1024 * 1024 + 1)] } });
    expect(screen.getByText('scan.pdf · 5.0 MB')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Upload' }));
    expect(screen.getByText('The file is larger than 5 MB.')).toBeInTheDocument();
  });

  it('shows the server refusal next to the field it is about', async () => {
    server.use(
      http.post('/api/people/7/documents', () =>
        HttpResponse.json(
          {
            message: 'Maximum of 3 documents reached for this customer.',
            errors: { file: ['Maximum of 3 documents reached for this customer.'] },
          },
          { status: 422 },
        ),
      ),
    );
    const { user, onClose } = renderSheet();
    await user.type(screen.getByLabelText('Document type *'), 'Contract');
    await user.upload(fileInput(), pdf('contract.pdf'));

    await user.click(screen.getByRole('button', { name: 'Upload' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The document was not uploaded: Maximum of 3 documents reached for this customer.',
    );
    expect(screen.getAllByText('Maximum of 3 documents reached for this customer.')).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
