/* Saving a file the API returned.

   The export endpoint is staff-only, so the CSV has to be fetched with the
   Authorization header and handed to the browser as a blob. A plain
   <a href="/api/admin/export/..."> would arrive without the header and 401,
   and putting the token in the query string to get around that would write it
   into every access log between here and the server.

   The object URL is revoked on the next frame rather than immediately: Safari
   cancels a download whose blob URL disappears in the same tick. */
import api from '@wag/api-client';

export async function downloadCsv(dataset) {
  const { blob, filename } = await api.admin.exportCsv(dataset);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);

  return filename;
}
