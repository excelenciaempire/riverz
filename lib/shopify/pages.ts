import { ShopifyAdminClient } from './admin-client';

/**
 * Shopify Online Store Pages — create or update.
 * The pageCreate / pageUpdate GraphQL mutations replaced the deprecated REST
 * /pages.json endpoint. We surface a small wrapper that returns just the
 * fields the publish flow needs (id, handle, full URL).
 *
 * https://shopify.dev/docs/api/admin-graphql/2025-01/mutations/pageCreate
 */

export interface PageInput {
  title: string;
  bodyHtml: string;
  /** "Published in Online Store" (true) vs draft (false). */
  published?: boolean;
  /** Optional handle override; Shopify auto-generates from title if omitted. */
  handle?: string;
}

export interface PublishedPage {
  id: string;
  handle: string;
  url: string;
}

export async function createPage(
  client: ShopifyAdminClient,
  primaryDomain: string,
  input: PageInput,
): Promise<PublishedPage> {
  type Res = {
    pageCreate: {
      page: { id: string; handle: string } | null;
      userErrors: Array<{ field: string[]; message: string; code?: string }>;
    };
  };
  const data = await client.graphql<Res>(
    `mutation PageCreate($page: PageCreateInput!) {
       pageCreate(page: $page) {
         page { id handle }
         userErrors { field message code }
       }
     }`,
    {
      page: {
        title: input.title,
        body: input.bodyHtml,
        handle: input.handle,
        isPublished: input.published !== false,
      },
    },
  );
  if (data.pageCreate.userErrors.length) {
    throw new Error('pageCreate: ' + JSON.stringify(data.pageCreate.userErrors));
  }
  const p = data.pageCreate.page;
  if (!p) throw new Error('pageCreate returned no page');
  return { id: p.id, handle: p.handle, url: `https://${primaryDomain}/pages/${p.handle}` };
}

export async function updatePage(
  client: ShopifyAdminClient,
  primaryDomain: string,
  pageId: string,
  input: PageInput,
): Promise<PublishedPage> {
  type Res = {
    pageUpdate: {
      page: { id: string; handle: string } | null;
      userErrors: Array<{ field: string[]; message: string; code?: string }>;
    };
  };
  const data = await client.graphql<Res>(
    `mutation PageUpdate($id: ID!, $page: PageUpdateInput!) {
       pageUpdate(id: $id, page: $page) {
         page { id handle }
         userErrors { field message code }
       }
     }`,
    {
      id: pageId,
      page: {
        title: input.title,
        body: input.bodyHtml,
        handle: input.handle,
        isPublished: input.published !== false,
      },
    },
  );
  if (data.pageUpdate.userErrors.length) {
    throw new Error('pageUpdate: ' + JSON.stringify(data.pageUpdate.userErrors));
  }
  const p = data.pageUpdate.page;
  if (!p) throw new Error('pageUpdate returned no page');
  return { id: p.id, handle: p.handle, url: `https://${primaryDomain}/pages/${p.handle}` };
}
