import { ShopifyAdminClient } from './admin-client';

/**
 * Upload an image to Shopify Files. Returns a CDN URL hosted on
 * `cdn.shopify.com/s/files/...` that's safe to embed in a Page body.
 *
 * Two-step flow per Shopify docs:
 *   1) stagedUploadsCreate     → returns a temp upload target (S3-style)
 *   2) PUT/POST the bytes      → goes to that target
 *   3) fileCreate              → registers the staged upload as a permanent File
 *   4) poll the file node      → wait for status: READY so we can read its
 *                                preview.image.url (the CDN URL we want).
 *
 * https://shopify.dev/docs/api/admin-graphql/2025-01/objects/StagedUploadTarget
 * https://shopify.dev/docs/api/admin-graphql/2025-01/mutations/fileCreate
 */
export async function uploadImageToShopify(
  client: ShopifyAdminClient,
  opts: {
    /** http(s) URL or data: URL — caller is responsible for fetching/decoding. */
    bytes: Buffer;
    filename: string;
    mimeType: string;
    altText?: string;
  },
): Promise<{ fileId: string; cdnUrl: string }> {
  // 1) Ask Shopify for a staged upload target.
  type StagedRes = {
    stagedUploadsCreate: {
      stagedTargets: Array<{
        url: string;
        resourceUrl: string;
        parameters: Array<{ name: string; value: string }>;
      }>;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  };
  const staged = await client.graphql<StagedRes>(
    `mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
       stagedUploadsCreate(input: $input) {
         stagedTargets { url resourceUrl parameters { name value } }
         userErrors { field message }
       }
     }`,
    {
      input: [
        {
          filename: opts.filename,
          mimeType: opts.mimeType,
          httpMethod: 'POST',
          // FILE = generic file (used for Files API).
          // IMAGE works too but FILE handles non-images uniformly.
          resource: 'FILE',
          fileSize: String(opts.bytes.byteLength),
        },
      ],
    },
  );

  if (staged.stagedUploadsCreate.userErrors.length) {
    throw new Error('stagedUploadsCreate: ' + JSON.stringify(staged.stagedUploadsCreate.userErrors));
  }
  const target = staged.stagedUploadsCreate.stagedTargets[0];
  if (!target) throw new Error('stagedUploadsCreate returned no target');

  // 2) Upload the bytes to the staged target. Shopify uses Google Cloud
  //    Storage behind the scenes, which expects multipart form-data with
  //    every parameter from the response, plus the file last.
  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append('file', new Blob([new Uint8Array(opts.bytes)], { type: opts.mimeType }), opts.filename);

  const uploadRes = await fetch(target.url, { method: 'POST', body: form });
  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => '');
    throw new Error(`Staged upload failed (${uploadRes.status}): ${text.slice(0, 300)}`);
  }

  // 3) Register the staged upload as a Shopify File.
  type FileCreateRes = {
    fileCreate: {
      files: Array<{ id: string; fileStatus: string }>;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  };
  const created = await client.graphql<FileCreateRes>(
    `mutation FileCreate($files: [FileCreateInput!]!) {
       fileCreate(files: $files) {
         files { id fileStatus }
         userErrors { field message }
       }
     }`,
    {
      files: [
        {
          alt: opts.altText || '',
          contentType: opts.mimeType.startsWith('image/') ? 'IMAGE' : 'FILE',
          originalSource: target.resourceUrl,
        },
      ],
    },
  );
  if (created.fileCreate.userErrors.length) {
    throw new Error('fileCreate: ' + JSON.stringify(created.fileCreate.userErrors));
  }
  const fileId = created.fileCreate.files[0]?.id;
  if (!fileId) throw new Error('fileCreate returned no file id');

  // 4) Poll until the file is processed. Shopify usually finishes in <2s
  //    but we give it up to ~25s before giving up.
  const cdnUrl = await waitForFileReady(client, fileId);
  return { fileId, cdnUrl };
}

async function waitForFileReady(client: ShopifyAdminClient, fileId: string): Promise<string> {
  type FileNodeRes = {
    node:
      | {
          __typename: 'MediaImage';
          id: string;
          fileStatus: string;
          image: { url: string } | null;
        }
      | {
          __typename: 'GenericFile';
          id: string;
          fileStatus: string;
          url: string | null;
        }
      | null;
  };
  const start = Date.now();
  while (Date.now() - start < 25_000) {
    const data = await client.graphql<FileNodeRes>(
      `query File($id: ID!) {
         node(id: $id) {
           __typename
           ... on MediaImage { id fileStatus image { url } }
           ... on GenericFile { id fileStatus url }
         }
       }`,
      { id: fileId },
    );
    const n = data.node;
    if (n && n.fileStatus === 'READY') {
      const url = n.__typename === 'MediaImage' ? n.image?.url : n.url;
      if (url) return url;
      throw new Error('File READY but no URL returned');
    }
    if (n && n.fileStatus === 'FAILED') throw new Error('File processing FAILED');
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('Timed out waiting for Shopify file to be READY');
}
